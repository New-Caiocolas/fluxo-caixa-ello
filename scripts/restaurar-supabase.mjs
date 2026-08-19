// Restaura um backup gerado por backup-supabase.mjs.
//
//   node scripts/restaurar-supabase.mjs backups/backup-....json --confirmar
//
// DESTRUTIVO: apaga o conteúdo atual das 12 tabelas antes de inserir. Exige
// --confirmar justamente para não ser disparado por engano num histórico de
// terminal.
//
// Insere com query parametrizada: o driver cuida de aspas, nulos, JSON e datas.
// Montar SQL por concatenação seria a forma clássica de corromper os dados em
// silêncio.

import "dotenv/config";
import { readFileSync } from "node:fs";
import pg from "pg";
import { TABELAS } from "./backup-supabase.mjs";

const arquivo = process.argv[2];
const confirmado = process.argv.includes("--confirmar");

if (!arquivo) {
  console.error("Uso: node scripts/restaurar-supabase.mjs <arquivo.json> --confirmar");
  process.exit(1);
}

const backup = JSON.parse(readFileSync(arquivo, "utf8"));
const destino = new URL(process.env.DATABASE_URL).host;

console.log(`Backup : ${arquivo}`);
console.log(`Origem : ${backup.origem}  (${backup.geradoEm})`);
console.log(`Destino: ${destino}`);
console.log(`Linhas : ${Object.values(backup.contagem).reduce((a, b) => a + b, 0)}`);

if (!confirmado) {
  console.log("\nSimulação — nada foi alterado.");
  console.log("Para executar de verdade, repita o comando com --confirmar");
  process.exit(0);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const cliente = await pool.connect();

try {
  await cliente.query("begin");

  // Ordem inversa da inserção: filhos antes dos pais, para as FKs não barrarem.
  for (const t of [...TABELAS].reverse()) {
    await cliente.query(`delete from "${t}"`);
  }

  let total = 0;
  for (const t of TABELAS) {
    const linhas = backup.dados[t] ?? [];
    if (linhas.length === 0) continue;

    const colunas = Object.keys(linhas[0]);
    const lista = colunas.map((c) => `"${c}"`).join(", ");

    for (const linha of linhas) {
      const marcadores = colunas.map((_, i) => `$${i + 1}`).join(", ");
      await cliente.query(
        `insert into "${t}" (${lista}) values (${marcadores})`,
        colunas.map((c) => linha[c])
      );
      total++;
    }
    console.log(`  ${t.padEnd(14)} ${String(linhas.length).padStart(6)} restauradas`);
  }

  await cliente.query("commit");
  console.log(`\n${total} linhas restauradas.`);
} catch (e) {
  await cliente.query("rollback");
  console.error(`\nFALHOU, tudo revertido: ${e.message}`);
  process.exit(1);
} finally {
  cliente.release();
  await pool.end();
}
