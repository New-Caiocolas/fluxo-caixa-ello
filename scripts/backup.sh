#!/usr/bin/env bash
#
# Backup diário do banco do Fluxo de Caixa (Supabase self-hosted no ZimaOS).
#
# Instalação no cron:
#   0 2 * * * /DATA/AppData/fluxo-caixa/scripts/backup.sh >> /DATA/backups/backup.log 2>&1
#
# O dump sai de dentro do container `db` porque o Postgres não tem porta
# publicada no host — e não deve ter.

set -euo pipefail

SUPABASE_DIR="${SUPABASE_DIR:-/DATA/AppData/supabase-novo/docker}"
DESTINO="${DESTINO:-/DATA/backups}"
RETENCAO_DIAS="${RETENCAO_DIAS:-30}"

mkdir -p "$DESTINO"

carimbo="$(date +%Y%m%d-%H%M%S)"
final="$DESTINO/fluxo-caixa-$carimbo.sql.gz"
# Escreve em .parcial e só renomeia no fim: um dump interrompido (falta de
# disco, container reiniciando) nunca fica no diretório parecendo válido.
parcial="$final.parcial"

echo "[$(date -Is)] iniciando backup"

# -T desativa o TTY: sem isso o comando falha quando roda pelo cron.
# pipefail (acima) garante que uma falha do pg_dump não seja mascarada pelo
# gzip, que sairia com 0 mesmo recebendo um fluxo truncado.
docker compose -f "$SUPABASE_DIR/docker-compose.yml" exec -T db \
  pg_dump -U postgres -d postgres \
    --schema=public --no-owner --no-privileges \
  | gzip > "$parcial"

# Um dump válido deste schema não tem como ser tão pequeno; se for, algo saiu
# errado de um jeito que o código de saída não capturou.
tamanho=$(wc -c < "$parcial")
if [ "$tamanho" -lt 1024 ]; then
  echo "[$(date -Is)] ERRO: dump com apenas ${tamanho} bytes — descartando"
  rm -f "$parcial"
  exit 1
fi

mv "$parcial" "$final"
echo "[$(date -Is)] backup concluído: $final (${tamanho} bytes)"

# Retenção. Só remove depois do sucesso acima — assim uma sequência de falhas
# nunca consome os backups antigos que ainda são a última cópia boa.
find "$DESTINO" -name 'fluxo-caixa-*.sql.gz' -type f -mtime "+$RETENCAO_DIAS" -delete
echo "[$(date -Is)] retenção aplicada (mantendo $RETENCAO_DIAS dias)"

# LEMBRETE: isto grava no mesmo disco do banco. Copie $DESTINO para fora do
# ZimaOS (rsync, HD externo, nuvem) — senão uma falha de disco leva os dois.
