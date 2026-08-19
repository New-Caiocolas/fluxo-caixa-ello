# Migração para Supabase self-hosted no ZimaOS

Runbook do corte do Supabase gerenciado + Vercel para Supabase self-hosted +
app em Docker no ZimaOS, publicado por Cloudflare Tunnel.

> **O sistema está em produção.** Os passos 1 a 5 são preparatórios e não
> afetam quem está usando — dá para fazer com calma, em dias diferentes. Só o
> passo 6 (corte) tem indisponibilidade, e ele é curto. Até lá o Supabase
> gerenciado segue sendo a produção real.

---

## Topologia final

```
Internet → Cloudflare (TLS) → túnel de saída → cloudflared (ZimaOS)
                                                    ↓  rede Docker
                                              app (Next.js :3000)
                                                    ↓  rede Docker
                                              db (Postgres do Supabase :5432)
```

O Postgres não tem porta aberta para a LAN nem para a internet. O roteador não
precisa de nenhum port forward — o `cloudflared` faz uma conexão **de saída**
para a Cloudflare, e o tráfego público volta por ela.

---

## Pré-requisitos

- ZimaOS com Docker e `docker compose` disponíveis por SSH
- Um domínio gerenciado pela Cloudflare (nameservers apontando para ela)
- `psql` e `pg_dump` na sua máquina, para a migração dos dados
- Espaço em disco no ZimaOS: reserve ~10 GB (Supabase completo são ~10 containers)

### Particularidades do ZimaOS

Levantadas no ambiente real (ZimaOS em `10.9.74.86`, usuário `caiocolas`) — não
assuma que um servidor Linux comum se comporta assim:

- **A home do usuário é `/DATA`, pertence ao `root` e não é gravável.** Por isso
  o diretório de trabalho é `/DATA/AppData/fluxo-caixa`, criado com `sudo` e
  com dono ajustado. `AppData` é a convenção do ZimaOS para aplicações.
- **`root` não aceita login por SSH**; conecte com o usuário criado na
  instalação.
- **O usuário não nasce no grupo `docker`.** Sem isso, todo comando Docker exige
  `sudo`. Resolva uma vez e reconecte para valer:

```bash
sudo usermod -aG docker $USER
```

### Confira a versão do Postgres antes de tudo

Restaurar um dump numa versão **anterior** à de origem falha. Rode contra o
Supabase gerenciado:

```bash
psql "$SUPABASE_URL" -c "select version();"
```

Anote a major version (ex.: 15, 17). A imagem do Supabase self-hosted precisa
ser igual ou superior.

---

## 1. Supabase self-hosted (já instalado)

A instalação já existe nesta máquina. Não reinstale — apenas confirme o estado:

```bash
cd /DATA/AppData/supabase-novo/docker && docker compose ps
```

| Item | Valor confirmado em 2026-08-19 |
|---|---|
| Diretório do compose | `/DATA/AppData/supabase-novo/docker` |
| Projeto compose | `supabase` |
| Rede Docker | `supabase_default` |
| PostgreSQL | 17.6 |
| Envoy (API) | porta 8000 do host |
| Supavisor (pooler) | portas 5432 e 6543 do host |
| Domínio público | `financeiro.ellolabs.org` |

> ⚠️ **Existe uma segunda stack do Supabase nesta máquina**, o projeto
> `supabase-projeto2`, em `/data/compose/2` (criada via Portainer), com
> containers prefixados `supabase-p2-` nas portas 8010/5433/6544. **Ela não tem
> relação com este sistema** — tem outro `JWT_SECRET` e rejeita a chave anon do
> domínio. Confira sempre o prefixo do container antes de rodar qualquer coisa
> destrutiva: `supabase-db` é a nossa; `supabase-p2-db` não é.

Para identificar qual stack responde por um domínio, sem ler segredo nenhum: a
chave anon só é aceita pela instalação que a assinou.

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8000/rest/v1/Filial?select=id" -H "apikey: SUA_ANON_KEY"
```

**Não publique a porta do serviço `db` no host.** O app fala com ele pela rede
interna do Docker; expor só aumentaria a superfície de ataque.


---

## 2. Criar o túnel Cloudflare

No painel **Cloudflare Zero Trust → Networks → Tunnels → Create a tunnel**:

1. Tipo **Cloudflared**, dê um nome (ex.: `zimaos-fluxo`)
2. Escolha o conector **Docker** e **copie o token** que aparece
3. Em **Public hostname**, configure:
   - Subdomínio/domínio: o que será a URL pública (ex.: `fluxo.seudominio.com.br`)
   - Serviço: **HTTP** → `app:3000`

O `app:3000` funciona porque o `cloudflared` roda na mesma rede Docker que o
app e resolve o nome do serviço pelo DNS interno.

---

## 3. Levar o código para o ZimaOS

```bash
git clone https://github.com/<sua-conta>/fluxo-caixa-ello /DATA/AppData/fluxo-caixa
```

---

## 4. Configurar o ambiente da aplicação

```bash
cp /DATA/AppData/fluxo-caixa/infra/.env.example /DATA/AppData/fluxo-caixa/infra/.env
```

Preencha conforme os comentários do arquivo. Os campos que exigem atenção:

- `DATABASE_URL` / `DIRECT_URL` — mesma string nas duas, com a
  `POSTGRES_PASSWORD` do passo 1
- `JWT_SECRET` — **copie o valor atual da Vercel** (Settings → Environment
  Variables). Um valor diferente derruba todas as sessões abertas; não corrompe
  nada, mas todo mundo precisa logar de novo
- `TUNNEL_TOKEN` — o token do passo 2
- `APP_URL` — o hostname do túnel
- `SUPABASE_NETWORK` — pode deixar como está; o script do passo 4.1 corrige sozinho

### 4.1 Conferir antes de subir

O clone do git não preserva a permissão de execução em toda configuração, então
garanta primeiro:

```bash
chmod +x /DATA/AppData/fluxo-caixa/infra/preparar.sh /DATA/AppData/fluxo-caixa/scripts/backup.sh
```

```bash
cd /DATA/AppData/fluxo-caixa/infra && ./preparar.sh
```

O script detecta o nome real da rede do Supabase e grava no `.env`, confere se
nenhuma variável ficou vazia ou com placeholder, e testa a conexão com o banco
de verdade — host, senha e permissão. Cada ✗ vem com o que fazer a respeito.

Só siga adiante quando ele terminar limpo. As falhas que ele pega aqui, em
texto claro, seriam container reiniciando em loop mais à frente.

---

## 5. Criar o schema e migrar os dados

### 5.1 Criar o schema no banco novo

O `migrator` aplica as migrations do Prisma. Rode só ele, ainda sem o app:

```bash
cd /DATA/AppData/fluxo-caixa/infra && docker compose run --rm migrate
```

Ao final o banco novo tem as 13 tabelas **vazias**, com a mesma estrutura da
produção — porque a fonte de verdade do schema é `prisma/migrations/`.

### 5.1.1 Fechar a API pública antes de carregar dados

O schema acabou de ser criado — e, por padrão do Supabase, as tabelas nasceram
acessíveis pela API REST pública. Feche isso **agora**, enquanto o banco ainda
está vazio:

```bash
docker compose -f /DATA/AppData/supabase-novo/docker/docker-compose.yml cp /DATA/AppData/fluxo-caixa/scripts/blindar-postgrest.sql db:/tmp/blindar.sql
```

```bash
docker compose -f /DATA/AppData/supabase-novo/docker/docker-compose.yml exec db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/blindar.sql
```

A saída lista as tabelas com `rowsecurity`; todas devem estar `t`.

Confirme de fora, do seu PC — deve responder 401, 403 ou 404, nunca dados:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://financeiro.ellolabs.org/rest/v1/Filial?select=id" -H "apikey: SUA_ANON_KEY"
```

> Rode este script de novo sempre que uma migration criar tabelas novas. O
> `alter default privileges` cobre o caso, mas a conferência custa dez segundos.

### 5.2 Exportar os dados do Supabase gerenciado

Na sua máquina, com `$SUPABASE_URL` sendo a `DIRECT_URL` atual (porta 5432):

```bash
pg_dump "$SUPABASE_URL" --data-only --schema=public --no-owner --no-privileges --disable-triggers --exclude-table=_prisma_migrations -f dados.sql
```

Cada flag está resolvendo um problema concreto:

| Flag | Por quê |
|---|---|
| `--data-only` | O schema já foi criado pelo Prisma no 5.1. Dump completo brigaria com ele. |
| `--schema=public` | Ignora os schemas internos do Supabase (`auth`, `storage`, `realtime`), que o destino já tem os seus. |
| `--no-owner --no-privileges` | Os roles das duas instalações não são idênticos; sem isso o restore falha em `ALTER ... OWNER TO`. |
| `--disable-triggers` | Desliga a checagem de chave estrangeira durante a carga, para a ordem das tabelas não importar. |
| `--exclude-table=_prisma_migrations` | Essa tabela **já foi preenchida** pelo `migrate deploy`. Duplicar as linhas faria o Prisma achar que há migrations aplicadas duas vezes. |

### 5.3 Importar no banco novo

O Postgres não está exposto, então copie o dump e carregue de dentro do ZimaOS:

```bash
scp dados.sql <usuario>@<ip-do-zimaos>:/DATA/
```

```bash
docker compose -f /DATA/AppData/supabase-novo/docker/docker-compose.yml cp /DATA/dados.sql db:/tmp/dados.sql
```

```bash
docker compose -f /DATA/AppData/supabase-novo/docker/docker-compose.yml exec db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/dados.sql
```

O `ON_ERROR_STOP=1` é importante: sem ele o `psql` engole erros e segue,
e você termina com uma carga parcial parecendo bem-sucedida.

Apague o dump depois — ele tem os dados financeiros em claro:

```bash
rm /DATA/dados.sql && docker compose -f /DATA/AppData/supabase-novo/docker/docker-compose.yml exec db rm /tmp/dados.sql
```

### 5.4 Conferir antes de confiar

Rode a mesma contagem nos dois bancos e compare linha a linha:

```sql
select 'User' t, count(*) from "User"
union all select 'Filial', count(*) from "Filial"
union all select 'Grupo', count(*) from "Grupo"
union all select 'Subgrupo', count(*) from "Subgrupo"
union all select 'Lancamento', count(*) from "Lancamento"
union all select 'Saldo', count(*) from "Saldo"
union all select 'Funcionario', count(*) from "Funcionario"
union all select 'Folha', count(*) from "Folha"
union all select 'FolhaItem', count(*) from "FolhaItem"
union all select 'Faturamento', count(*) from "Faturamento"
union all select 'Meta', count(*) from "Meta"
union all select 'AuditLog', count(*) from "AuditLog"
order by 1;
```

Não confie só na contagem. Confira também um valor agregado — se bater, a
carga veio íntegra e não só completa:

```sql
select "filialId", "tipo", count(*), sum("valor")
from "Lancamento"
group by 1, 2
order by 1, 2;
```

---

## 6. Corte

A partir daqui há indisponibilidade. Avise quem usa.

1. **Congele a escrita.** Na Vercel, pause o projeto (ou coloque em manutenção).
   O ponto é garantir que ninguém lance nada entre o dump e a virada.
2. **Refaça o dump** (passos 5.2 e 5.3). O dump anterior foi um ensaio; este é
   o que vale, e agora você já sabe que o procedimento funciona.
3. **Suba o app no ZimaOS:**

```bash
cd /DATA/AppData/fluxo-caixa/infra && docker compose up -d --build
```

4. **Acompanhe a subida:**

```bash
docker compose logs -f app migrate
```

O app tem healthcheck próprio, que só fica `healthy` depois de conseguir
consultar o banco — e o `cloudflared` espera por isso antes de publicar. Ou
seja, `healthy` aqui significa que o caminho app→banco funciona:

```bash
docker compose ps
```

5. **Valide pela URL do túnel**, com o celular no 4G (fora da rede local, para
   provar que o caminho público funciona):
   - Login com um usuário real
   - Dashboard carrega os KPIs com os números certos
   - Um lançamento novo salva e aparece na visão mensal
   - Consolidado anual bate com o que era exibido antes
6. **Só então** reative o acesso para o time.

**Não desligue o projeto Supabase gerenciado.** Deixe-o parado como está por
pelo menos uma semana de operação normal — é o seu rollback.

---

## 7. Rollback

Se algo der errado depois do corte, reverter é rápido porque nada foi destruído:

```bash
cd /DATA/AppData/fluxo-caixa/infra && docker compose stop app cloudflared
```

Despause o projeto na Vercel. Ela nunca deixou de apontar para o Supabase
gerenciado, que continua com os dados íntegros do momento do corte.

O único dado perdido é o que foi lançado no ZimaOS após a virada — mais um
motivo para validar rápido e decidir cedo.

---

## 8. Backup (não pule esta parte)

Saindo do Supabase gerenciado, backup deixa de ser problema de outra pessoa e
passa a ser seu. O ZimaOS tem um disco só; se ele falhar, a base financeira da
empresa vai junto.

O script [`scripts/backup.sh`](../scripts/backup.sh) faz o dump comprimido e
mantém as últimas 30 diárias. Instale no cron do ZimaOS:

```bash
crontab -e
```

```
0 2 * * * /DATA/AppData/fluxo-caixa/scripts/backup.sh >> /DATA/backups/backup.log 2>&1
```

Duas coisas que fazem esse backup valer alguma coisa:

- **Cópia fora do ZimaOS.** Backup no mesmo disco do banco não é backup.
  Sincronize `/DATA/backups` para outra máquina, um HD externo ou nuvem.
- **Restore testado.** Um backup nunca restaurado é uma suposição. Uma vez por
  trimestre, restaure num banco descartável e confira as contagens do 5.4.

---

## 9. Desenvolvimento local contra o banco do ZimaOS

Para rodar `npm run dev` na sua máquina falando com o banco do servidor, sem
expor nenhuma porta. Abra o túnel e deixe o terminal aberto:

```bash
ssh -L 5433:localhost:5432 <usuario>@<ip-do-zimaos>
```

**Atenção ao usuário.** A porta 5432 do host do ZimaOS é do **Supavisor**, o
pooler — o container `db` não publica porta nenhuma. O Supavisor é multi-tenant
e exige o usuário no formato `postgres.<tenant>`, diferente do `postgres` puro
que a aplicação usa por dentro da rede Docker. Pegue o tenant com:

```bash
grep POOLER_TENANT_ID /DATA/AppData/supabase-novo/docker/.env
```

No `.env` local (a porta 5433 evita conflito com um Postgres seu, se houver):

```
DATABASE_URL="postgresql://postgres.<tenant>:<senha>@localhost:5433/postgres?schema=public"
DIRECT_URL="postgresql://postgres.<tenant>:<senha>@localhost:5433/postgres?schema=public"
```

A 5432 do Supavisor é modo **session**, que suporta prepared statements e
advisory locks — então migrations funcionam por aqui. A 6543 é transaction e
travaria; não use.

> Se a senha tiver caracteres especiais, faça percent-encode na URL (`@` vira
> `%40`, `#` vira `%23`). Senão o parser corta a string no lugar errado e o erro
> não diz isso.

⚠️ Lembre que este é o banco de **produção** depois do corte. Para experimentar
migrations ou testar `db:seed`, use um Postgres local descartável, não o túnel.

---

## Operação no dia a dia

Atualizar a aplicação depois de um push:

```bash
cd /DATA/AppData/fluxo-caixa && git pull && cd infra && docker compose up -d --build
```

O `migrate` roda sozinho antes do app a cada `up`, então migrations novas são
aplicadas na ordem certa.

Ver logs:

```bash
cd /DATA/AppData/fluxo-caixa/infra && docker compose logs -f app
```

Abrir um psql no banco:

```bash
docker compose -f /DATA/AppData/supabase-novo/docker/docker-compose.yml exec db psql -U postgres -d postgres
```
