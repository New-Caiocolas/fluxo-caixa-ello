<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Knowledge Base & Rules

**Leia primeiro:** [docs/ESTADO-ATUAL.md](docs/ESTADO-ATUAL.md) — situação atual,
pendências abertas e armadilhas já descobertas neste ambiente.

- [.agents/rules/KNOWLEDGE.md](.agents/rules/KNOWLEDGE.md) — decisões de
  arquitetura, navegação, matriz de permissões, padrões de API, migrations.
- [docs/MIGRACAO-SELFHOST.md](docs/MIGRACAO-SELFHOST.md) — runbook do Supabase
  self-hosted no ZimaOS.

O projeto é um sistema de fluxo de caixa **em produção** numa empresa real.
Mudanças em banco, autenticação e deploy afetam a operação financeira do Grupo
ELLO — prefira alterações reversíveis e valide antes de aplicar.
