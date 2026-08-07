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

## ⚙️ Variáveis de Ambiente Necessárias (`.env`)

- `DATABASE_URL`: Connection pooler (Supabase PgBouncer) para runtime.
- `DIRECT_URL`: Conexão direta para migrations do Prisma.
- `JWT_SECRET`: Chave secreta de validação de tokens JWT.
- `GMAIL_USER` / `GMAIL_APP_PASSWORD`: Credenciais para envio do e-mail SMTP de boas-vindas via Nodemailer.
- `APP_URL`: URL base pública do sistema para links em e-mails.
