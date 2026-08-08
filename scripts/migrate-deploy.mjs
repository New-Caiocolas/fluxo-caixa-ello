// Aplica migrations pendentes durante o build.
//
// Existe como script em vez de `prisma migrate deploy` direto no package.json
// por duas razões:
//
// 1. Preview deploy não pode migrar. As previews da Vercel usam a mesma
//    DATABASE_URL da produção, então uma branch com migration experimental
//    alteraria o banco de produção antes de qualquer revisão.
//
// 2. DIRECT_URL ausente precisa falhar rápido. Sem ela o prisma.config.ts cai
//    para a DATABASE_URL, que é o pooler de transação — e migration por ali
//    não dá erro, ela trava até o build estourar o tempo limite.

// Carrega o .env para o build local funcionar igual ao da Vercel, onde as
// variáveis já chegam pelo ambiente. Sem arquivo, o dotenv apenas não faz nada.
import "dotenv/config";
import { spawnSync } from "node:child_process";

const ambiente = process.env.VERCEL_ENV; // "production" | "preview" | "development"

if (ambiente && ambiente !== "production") {
  console.log(`[migrate] ambiente "${ambiente}" — migrations não são aplicadas fora de produção.`);
  process.exit(0);
}

const direta = process.env.DIRECT_URL;

if (!direta) {
  console.error(
    "[migrate] DIRECT_URL não está definida.\n" +
      "          Migrations exigem conexão em modo session (porta 5432).\n" +
      "          Na Vercel: Settings > Environment Variables > DIRECT_URL."
  );
  process.exit(1);
}

// O pooler de transação não suporta prepared statements nem advisory locks:
// a migration não falha, ela pendura. Melhor recusar com mensagem clara.
if (direta.includes(":6543") || direta.includes("pgbouncer=true")) {
  console.error(
    "[migrate] DIRECT_URL aponta para o pooler de transação (porta 6543).\n" +
      "          Use o session pooler, na porta 5432 — a migration travaria."
  );
  process.exit(1);
}

console.log("[migrate] aplicando migrations pendentes...");
const r = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(r.status ?? 1);
