# Estado do projeto — handoff

Situação em **2026-08-19**, ao fim de uma sessão longa de trabalho. Leia isto
antes de mexer em qualquer coisa. Detalhes de arquitetura estão em
[`.agents/rules/KNOWLEDGE.md`](../.agents/rules/KNOWLEDGE.md); o runbook do
self-hosted está em [`MIGRACAO-SELFHOST.md`](MIGRACAO-SELFHOST.md).

---

## ⚠️ Pendência crítica: a produção está fora do ar

A senha do banco Postgres no Supabase gerenciado **foi resetada** durante a
sessão. A Vercel continua com a senha antiga nas variáveis de ambiente, então
toda requisição falha e os funcionários veem "Erro interno" no login.

**Correção (3 minutos):**

1. Vercel → projeto → Settings → Environment Variables
2. Substituir `DATABASE_URL` e `DIRECT_URL` pelos valores do `.env` local
3. Deployments → mais recente → `···` → Redeploy

Verificação — deve responder `401`, não `500`:

```bash
curl -s -X POST https://grupoello-fc.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teste@invalido.local","password":"x"}'
```

---

## Onde as coisas estão

| Ambiente | Endereço | Situação |
|---|---|---|
| Produção (app) | `grupoello-fc.vercel.app` | Fora do ar (ver acima) |
| Produção (banco) | Supabase gerenciado, ref `dvuaefuxyxvtazoutgzf`, região **us-east-2** | Saudável, migrado |
| Self-hosted (experimento) | ZimaOS `10.9.74.86`, LAN do escritório | Schema criado, sem dados |

O ZimaOS **não é alcançável de casa** — está na rede local do escritório. Todo
o trabalho remoto acontece contra o Supabase gerenciado.

### Conectar ao banco de produção

O host direto (`db.<ref>.supabase.co`) é **IPv6-only** e não funciona em rede
IPv4 — falha com "No address associated with hostname". Use sempre o pooler:

- Host: `aws-1-us-east-2.pooler.supabase.com`
- Usuário: `postgres.dvuaefuxyxvtazoutgzf` (com o ref, não `postgres` puro)
- Porta `6543` para a aplicação, `5432` para migrations

---

## O que não vem no clone

| Arquivo | Como recriar |
|---|---|
| `.env` | `node scripts/colar-url.mjs` e colar a `DATABASE_URL` da Vercel |
| `backups/` | `node scripts/backup-supabase.mjs` |
| `node_modules/` | `npm ci` (não `npm install` — houve instalação corrompida antes) |

O `.env` precisa também de `JWT_SECRET` (qualquer string longa serve em
desenvolvimento) e `APP_URL=http://localhost:3000`.

---

## Feito nesta sessão

**Infraestrutura de self-hosting** (`Dockerfile`, `infra/`, `docs/MIGRACAO-SELFHOST.md`)
— app em Docker com `output: standalone`, Supabase self-hosted no ZimaOS,
Cloudflare Tunnel. Funciona até o passo 5.1 do runbook; os dados nunca foram
migrados para lá.

**Segurança do PostgREST** (`scripts/blindar-postgrest.sql`) — as tabelas
criadas pelo Prisma nascem com privilégios para o role `anon` do Supabase e sem
RLS, ficando legíveis pela API REST pública. No self-hosted foram encontrados
**182 privilégios abertos**, zerados pelo script. **Isto ainda NÃO foi aplicado
ao Supabase gerenciado** — ver pendências.

**Correções de schema** (migration `20260819190000`) — colunas monetárias saíram
de `DECIMAL(65,30)`, o padrão do Prisma, para `DECIMAL(14,2)`; corrigiu 125
valores com ruído de ponto flutuante. `Funcionario.trienio` e `Meta.valorMeta`
ficaram de fora por serem percentuais, não dinheiro. Mais `@@unique` em
`Folha(competencia)` e `FolhaItem(folhaId, funcionarioId)`, e 7 índices de FK
(`AuditLog` não tinha nenhum além da PK).

**Correção do dashboard** — `formatCurrency`/`formatPercent` aceitam string,
porque `Decimal` do Prisma vira string no JSON.

---

## Pendências, por prioridade

1. **Restaurar a produção** (acima). Único item que afeta outras pessoas.
2. **Aplicar `scripts/blindar-postgrest.sql` no Supabase gerenciado.** Pelo SQL
   Editor do dashboard. Sem isso a base financeira pode estar legível por quem
   tiver a chave anon, que é pública por design. Verificar antes se o problema
   existe lá:
   ```sql
   select count(*) from information_schema.role_table_grants
   where table_schema='public' and grantee in ('anon','authenticated');
   ```
3. **Aritmética monetária em float64.** `lib/folha.ts:42` calcula com `number`,
   então `salarioBase * trienioPerc` produz `8766.299999999999`. A migration
   limpou o histórico, mas o próximo cálculo de folha reintroduz o ruído. A
   correção é fazer a conta em centavos inteiros ou com biblioteca decimal —
   mexe em `lib/folha.ts` e nos testes de folha.
4. **`Meta.tipo`, `Meta.operador`, `Meta.baseCalculo` são `String`** onde
   deveriam ser enum. Os dados são bem-comportados (dois valores distintos em
   cada), mas a mudança mexe em código da aplicação.
5. **16 erros de lint pré-existentes**, quase todos `react-hooks/set-state-in-effect`.
6. **Nenhuma das 25 rotas de API tem teste.** Os 153 testes cobrem só `lib/`.
7. **Trocar a `POSTGRES_PASSWORD` do Supabase self-hosted** — ela foi exposta
   num chat. Risco limitado (não está na internet), mas vale rotacionar.

---

## Armadilhas já descobertas

Cada uma destas custou tempo real; não repita.

- **`db.<ref>.supabase.co` é IPv6-only.** Em rede IPv4 nem resolve. Use o pooler.
- **`?schema=public` é parâmetro do Prisma, não do libpq.** O `psql` recusa com
  "invalid URI query parameter", parecendo erro de senha.
- **Senha com `@` ou `+` precisa de percent-encode na URL** — mas a URL da
  Vercel **já vem codificada**. Codificar de novo (`%40` → `%2540`) quebra.
  `scripts/colar-url.mjs` grava verbatim; `scripts/configurar-env.mjs` codifica.
  Use um ou outro conforme a origem do valor.
- **`Decimal` do Prisma chega ao cliente como string.** Sempre `Number()` antes
  de comparar ou usar em CSS.
- **`Number("")` e `Number(null)` retornam `0`, não `NaN`.** Em código
  financeiro isso transforma dado ausente em "R$ 0,00" — indistinguível de
  movimento zero legítimo.
- **Prompt oculto com `readline` + modo raw trava no Windows** sem erro. Por
  isso `criar-usuario.mjs` recebe argumentos e sorteia a senha.
- **Não rode `npm install` neste projeto — use `npm ci`.** Uma instalação
  parcial deixou `vitest` e os tipos de `lucide-react` faltando, com erro de
  compilação enganoso.

---

## Comandos úteis

```bash
npm run dev                                    # desenvolvimento
npm test                                       # 153 testes
node scripts/backup-supabase.mjs               # backup para backups/
node scripts/criar-usuario.mjs <email> <nome> ADMIN   # cria/reseta acesso
npx prisma migrate deploy                      # aplica migrations
```
