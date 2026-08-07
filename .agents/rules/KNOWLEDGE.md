# Knowledge Base — Fluxo de Caixa Grupo ELLO

Este documento registra as principais decisões de arquitetura, padrões de projeto e regras de negócio deliberadas para este repositório.

---

## 🏛️ Estrutura de Navegação e Abas

### Decisão de Produto (Mapeamento de Rotas vs Abas)
- **`/lancamentos`**: Hub centralizado de lançamentos financeiros.
  - **Aba 1 (Diários)**: Lançamentos diários (entradas/saídas de caixa, Grupos 1 a 14).
  - **Aba 2 (Faturamento)**: Registro e gestão de notas fiscais faturadas por competência.
  - **Aba 3 (Folha de Pagamento)**: Cadastro de funcionários, cálculo de encargos (INSS, FGTS, etc.) e totalizador da folha.
- **`IMPORTANTE`**: As rotas legadas `/folha` e `/faturamento` foram removidas deliberadamente. Todas as funcionalidades foram consolidadas como abas da rota `/lancamentos`. **Não recriar rotas isoladas para Folha ou Faturamento.**

---

## 🛡️ Matriz de Permissões e Segurança

Centralizada em `lib/permissoes.ts`.

| Papel | Permissões |
|---|---|
| **ADMIN** | Acesso total: cria/edita/exclui lançamentos, faturamentos, folha, metas, gestão de usuários, e limpeza de base. |
| **GESTOR** | Acesso operacional completo a lançamentos, faturamento, folha e metas. **Sem acesso** a gestão de usuários ou limpeza de base. |
| **OPERADOR** | **Pode editar** lançamentos existentes. **Não pode** criar ou excluir lançamentos. O botão "Novo Lançamento" é ocultado para este perfil. |

> **Decisão deliberada (commit `78387d7`)**: O perfil `OPERADOR` ter permissão de edição em lançamentos existentes foi uma decisão explícita de produto. Não alterar essa regra.

---

## 📡 Endpoints Principais de Leitura e Agregação

1. **`GET /api/mensal?filialId=...&competencia=YYYY-MM`**
   - Retorna a visão mensal completa dia a dia com totais por grupo e subgrupo, saldo inicial, saldo final e cálculo de fluxo operacional e livre.
   - *Nota*: Substituiu a antiga rota `PUT /api/saldos` para respeitar a semântica REST de leitura via `GET`.

2. **`GET /api/consolidado?filialId=...&ano=YYYY`**
   - Retorna o consolidado dos 12 meses do ano especificado em uma única chamada ao banco de dados.
   - *Nota*: Substituiu a abordagem legada de efetuar 12 requisições em paralelo no frontend.

3. **`proxy.ts` (Next.js 16 Proxy / Middleware)**
   - Protege páginas e rotas de API server-side.
   - Requisições sem JWT válido para rotas de `/api/` são rejeitadas com status `401 JSON`.
   - Rotas de páginas sem JWT válido são redirecionadas para `/login`.

---

## 🗄️ Migrations (Prisma + Supabase)

O banco foi **baselined** em 2026-08-07 com a migration `0_init`, gerada a partir do schema e marcada como aplicada via `prisma migrate resolve --applied` — o SQL nunca foi executado, porque as tabelas já existiam. A partir daí o fluxo é o normal: `npx prisma migrate dev --name <nome>`.

> ⚠️ **Nunca rode `migrate dev` contra um banco não-baselined.** O Prisma interpreta as tabelas pré-existentes como drift e oferece resetar o banco — o que apagaria produção.

**As duas URLs não são intercambiáveis:**

| Variável | Porta | Modo | Uso |
|---|---|---|---|
| `DATABASE_URL` | 6543 | Transaction (PgBouncer) | Runtime da aplicação |
| `DIRECT_URL` | 5432 | Session | **Somente** migrations |

Migrations exigem prepared statements e advisory locks, que o pooler de transação não suporta — apontar migrations para a 6543 faz o CLI travar indefinidamente, sem erro. `prisma.config.ts` lê `DIRECT_URL` para isso.

Evite a conexão direta (`db.<ref>.supabase.co:5432`): ela é IPv6-only sem o add-on de IPv4 e pendura em redes IPv4. O session pooler resolve isso e é o que o próprio Supabase recomenda para Prisma.

`supabase-schema.sql` é um artefato histórico de quando o DDL era aplicado à mão. **A fonte de verdade do schema agora é `prisma/migrations/`.**

---

## ⚙️ Variáveis de Ambiente Necessárias (`.env`)

- `DATABASE_URL`: Connection pooler em modo transaction (porta 6543) para runtime.
- `DIRECT_URL`: Pooler em modo session (porta 5432) — usado só por migrations.
- `JWT_SECRET`: Chave secreta de validação de tokens JWT.
- `GMAIL_USER` / `GMAIL_APP_PASSWORD`: Credenciais para envio do e-mail SMTP de boas-vindas via Nodemailer.
- `APP_URL`: URL base pública do sistema para links em e-mails.
