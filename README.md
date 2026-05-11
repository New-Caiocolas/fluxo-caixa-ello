# Fluxo de Caixa — Grupo ELLO

Sistema de gestão de fluxo de caixa diário para o Grupo ELLO com suporte a múltiplas filiais (ELLO, Imperatriz, Faz do Brasil).

## Stack

- **Frontend/Backend:** Next.js 16 (App Router) + TypeScript
- **Estilo:** Tailwind CSS 4
- **Banco de dados:** PostgreSQL + Prisma ORM 7
- **Auth:** JWT com cookies httpOnly
- **Gráficos:** Recharts

## Funcionalidades

- Dashboard executivo com KPIs e gráficos
- Lançamentos diários (entradas/saídas) com 14 grupos e subcategorias
- Visão mensal — tabela com colunas por dia, grupos colapsáveis
- Consolidado anual — tabela por mês com indicadores de meta
- Folha de pagamento — cálculo de salários, encargos e totais por filial
- Faturamento vs Recebimento — análise de inadimplência e margem
- Configurações de filiais e metas

## Requisitos

- Node.js 18+
- PostgreSQL 14+

## Instalação

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite .env com sua string de conexão PostgreSQL

# 3. Criar tabelas no banco
npm run db:push

# 4. Popular dados iniciais (usuário admin + filiais + categorias)
npm run db:seed

# 5. Iniciar o servidor de desenvolvimento
npm run dev
```

Acesse: http://localhost:3000

**Credenciais padrão:** admin@ello.com / admin123

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run db:push` | Sincroniza schema com o banco (sem migrations) |
| `npm run db:migrate` | Cria migration e aplica ao banco |
| `npm run db:seed` | Popula dados iniciais |
| `npm run db:studio` | Abre Prisma Studio (interface visual) |

## Estrutura

```
├── app/
│   ├── (auth)/login/      # Página de login
│   ├── (dashboard)/       # Páginas autenticadas
│   │   ├── dashboard/     # Dashboard executivo
│   │   ├── lancamentos/   # Lançamentos diários
│   │   ├── mensal/        # Visão mensal
│   │   ├── consolidado/   # Consolidado anual
│   │   ├── folha/         # Folha de pagamento
│   │   ├── faturamento/   # Faturamento vs Recebimento
│   │   └── configuracoes/ # Configurações
│   └── api/               # API Routes
├── components/            # Componentes React
├── lib/                   # Utilitários, auth, Prisma
├── prisma/                # Schema e seed
└── types/                 # TypeScript types
```

## Grupos de categorias

| Grupo | Nome |
|-------|------|
| 1 | Recebimentos (Boleto, PIX, Cartão, etc.) |
| 4 | Custos Diretos |
| 5 | Mão de Obra Direta |
| 6 | Materiais Indiretos |
| 7 | Despesas Administrativas |
| 8 | Despesas com Pessoal ADM |
| 9 | Pró-Labore Diretoria |
| 10 | Despesas Comerciais |
| 11 | Impostos sobre Vendas |
| 12 | Outros Impostos |
| 13 | Receitas/Despesas Financeiras |
| 14 | Investimentos |

## Regras de negócio

- **Fluxo Caixa Operacional** = Recebimento − (Grupos 4 a 12)
- **Fluxo Caixa Livre** = Fluxo Operacional +/− Grupo 13 − Grupo 14
- **Meta Fluxo Livre** ≥ 25% do Recebimento (alerta visual)
- **Meta Custo Direto** ≤ 50% do Faturamento (alerta visual)
- Saldo Final = Saldo Inicial + Entradas − Saídas do dia
