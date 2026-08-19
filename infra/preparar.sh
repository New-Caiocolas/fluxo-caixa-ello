#!/usr/bin/env bash
#
# Verificação antes de subir o app no ZimaOS.
#
#   cd /DATA/AppData/fluxo-caixa/infra && ./preparar.sh
#
# Detecta a rede do Supabase, confere se o infra/.env está completo e testa a
# conexão real com o banco. Existe para as falhas aparecerem aqui, com uma
# mensagem clara, em vez de virarem um container reiniciando em loop.

set -euo pipefail

cd "$(dirname "$0")"

falhou=0
erro() { echo "  ✗ $1"; falhou=1; }
ok()   { echo "  ✓ $1"; }

echo
echo "1. Arquivo de configuração"

if [ ! -f .env ]; then
  echo "  ✗ infra/.env não existe."
  echo "    Crie com: cp .env.example .env   (depois preencha os valores)"
  exit 1
fi
ok "infra/.env encontrado"

# set -a exporta tudo que for definido no arquivo, para o docker compose e o
# teste de conexão abaixo enxergarem.
set -a
# shellcheck disable=SC1091
. ./.env
set +a


echo
echo "2. Variáveis obrigatórias"

for v in DATABASE_URL DIRECT_URL JWT_SECRET APP_URL TUNNEL_TOKEN; do
  if [ -z "${!v:-}" ]; then
    erro "$v está vazia"
  else
    ok "$v definida"
  fi
done

# Erro fácil de cometer e chato de diagnosticar: manter o placeholder do
# exemplo, que faz a autenticação falhar sem dizer o porquê.
case "${DATABASE_URL:-}" in
  *SUA_POSTGRES_PASSWORD*)
    erro "DATABASE_URL ainda tem o placeholder SUA_POSTGRES_PASSWORD"
    ;;
esac


echo
echo "3. Rede do Supabase"

# O compose oficial do Supabase nomeia o container do Postgres como supabase-db.
rede=$(docker inspect supabase-db \
  --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null || true)

if [ -z "$rede" ]; then
  erro "container 'supabase-db' não encontrado — o Supabase está rodando?"
  echo "    Verifique com: docker ps --filter name=supabase"
else
  ok "rede detectada: $rede"

  if [ "${SUPABASE_NETWORK:-}" != "$rede" ]; then
    echo "    → SUPABASE_NETWORK no .env está como '${SUPABASE_NETWORK:-vazio}'; corrigindo."
    if grep -q '^SUPABASE_NETWORK=' .env; then
      sed -i "s|^SUPABASE_NETWORK=.*|SUPABASE_NETWORK=\"$rede\"|" .env
    else
      echo "SUPABASE_NETWORK=\"$rede\"" >> .env
    fi
    ok "SUPABASE_NETWORK atualizado"
  fi
fi


echo
echo "4. Conexão com o banco"

if [ -n "$rede" ] && [ -n "${DATABASE_URL:-}" ]; then
  # Rodado de dentro do supabase-db: ele já tem psql e já está na rede certa,
  # então valida host, senha e permissão de uma vez — sem baixar imagem nova.
  #
  # A query string é removida porque `?schema=public` é parâmetro do Prisma, não
  # do libpq: o psql recusa com "invalid URI query parameter" e a conexão boa
  # seria reportada como falha de senha.
  url_psql="${DATABASE_URL%%\?*}"
  if docker exec supabase-db psql "$url_psql" -c 'select 1' >/dev/null 2>&1; then
    ok "conectou e autenticou"
  else
    erro "não conseguiu conectar com a DATABASE_URL"
    echo "    Causas prováveis: senha diferente da POSTGRES_PASSWORD do Supabase,"
    echo "    ou host errado (dentro da rede o host é 'db', não 'localhost')."
  fi
else
  echo "  – pulado (depende dos passos acima)"
fi


echo
if [ "$falhou" -ne 0 ]; then
  echo "Corrija os itens marcados com ✗ e rode de novo."
  exit 1
fi

echo "Tudo certo. Próximo passo — criar o schema no banco novo:"
echo
echo "    docker compose run --rm migrate"
echo
