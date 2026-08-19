// Grava no .env a connection string EXATA que você colar.
//
//   node scripts/colar-url.mjs
//
// Diferente de configurar-env.mjs, este NÃO codifica nada: a URL da Vercel já
// vem percent-encoded e funcionando. Codificar de novo transformaria %40 em
// %2540 e a autenticação falharia — foi por isso que este script existe.

import { readFileSync, writeFileSync } from "node:fs";

process.stdout.write("Cole a DATABASE_URL da Vercel e tecle Enter (não será exibida):\n");

const stdin = process.stdin;
if (stdin.setRawMode) stdin.setRawMode(true);

let bruto = "";
stdin.on("data", (ch) => {
  const c = ch.toString("utf8");
  if (c === "\r" || c === "\n") {
    if (stdin.setRawMode) stdin.setRawMode(false);
    stdin.pause();
    process.stdout.write("\n");
    finalizar(bruto.trim());
  } else if (c === "\u0003") {
    process.exit(1);
  } else if (c === "\u007f" || c === "\b") {
    bruto = bruto.slice(0, -1);
  } else {
    bruto += c;
  }
});

function finalizar(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    console.error("Não é uma URL válida. Deve começar com postgresql://");
    process.exit(1);
  }
  if (!u.protocol.startsWith("postgres")) {
    console.error(`Protocolo inesperado: ${u.protocol}`);
    process.exit(1);
  }
  if (u.hostname.includes("REGIAO") || u.hostname.includes("[")) {
    console.error(`Host ainda é placeholder: ${u.hostname}`);
    process.exit(1);
  }

  // DIRECT_URL é a mesma coisa em modo session (5432) e sem os parâmetros de
  // pooler — migrations precisam de prepared statements, que a 6543 não tem.
  const direta = new URL(u.toString());
  direta.port = "5432";
  direta.search = "";

  let env = readFileSync(".env", "utf8");
  for (const [chave, valor] of [["DATABASE_URL", u.toString()], ["DIRECT_URL", direta.toString()]]) {
    const re = new RegExp(`^${chave}=.*$`, "m");
    const linha = `${chave}="${valor}"`;
    env = re.test(env) ? env.replace(re, linha) : `${env}\n${linha}`;
  }
  writeFileSync(".env", env);

  console.log(`host    : ${u.hostname}`);
  console.log(`usuario : ${u.username}`);
  console.log(`portas  : ${u.port} (app) e 5432 (migrations)`);
  console.log("\n.env atualizado. Agora rode: node scripts/backup-supabase.mjs");
}
