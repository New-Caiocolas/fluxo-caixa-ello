// Backup completo dos dados da aplicação, sem depender de pg_dump.
//
//   node scripts/backup-supabase.mjs
//
// Usa a DATABASE_URL do .env e grava um JSON por execução em backups/.
// Restaure com scripts/restaurar-supabase.mjs.
//
// Por que JSON e não SQL: gerar INSERT à mão exige escapar aspas, nulos, JSON e
// datas corretamente — cada um um jeito de corromper o backup em silêncio. O
// restore usa query parametrizada, onde o driver cuida disso.

import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import pg from "pg";
import { pathToFileURL } from "node:url";

// Ordem topológica: quem é referenciado vem antes de quem referencia. O restore
// percorre esta mesma lista, então as FKs são satisfeitas sem desligar trigger.
export const TABELAS = [
  "User", "Filial", "Grupo", "Subgrupo", "Funcionario", "Folha",
  "Lancamento", "Saldo", "FolhaItem", "Faturamento", "Meta", "AuditLog",
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL não está definida (.env).");
    process.exit(1);
  }

  // Numeric chega como string no driver, e é isso que queremos: converter para
  // Number perderia precisão justamente nas colunas de dinheiro.
  const pool = new pg.Pool({ connectionString: url });

  const host = new URL(url).host;
  console.log(`Origem: ${host}`);

  const dados = {};
  const contagem = {};
  let total = 0;

  for (const t of TABELAS) {
    const { rows } = await pool.query(`select * from "${t}"`);
    dados[t] = rows;
    contagem[t] = rows.length;
    total += rows.length;
    console.log(`  ${t.padEnd(14)} ${String(rows.length).padStart(6)} linhas`);
  }

  await pool.end();

  if (total === 0) {
    console.error("\nNenhuma linha em nenhuma tabela — banco vazio.");
    console.error("Confirme se a DATABASE_URL aponta para o projeto certo.");
    process.exit(1);
  }

  const carimbo = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  mkdirSync("backups", { recursive: true });
  const arquivo = `backups/backup-${carimbo}.json`;

  writeFileSync(
    arquivo,
    JSON.stringify({ geradoEm: new Date().toISOString(), origem: host, contagem, dados }, null, 2)
  );

  console.log(`\n${total} linhas gravadas em ${arquivo}`);
}

// Só executa quando chamado direto. Sem esta guarda, qualquer módulo que
// importe TABELAS (ex.: restaurar-supabase.mjs) dispararia um backup completo
// como efeito colateral do import.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error("Falhou:", e.message);
    process.exit(1);
  });
}
