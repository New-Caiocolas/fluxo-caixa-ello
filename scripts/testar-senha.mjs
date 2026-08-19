// Testa a senha do banco conectando SEM montar URL, e só grava o .env se
// funcionar.
//
//   node scripts/testar-senha.mjs
//
// Passar host/user/password como campos separados ao driver elimina a classe
// inteira de erro de percent-encode: nada é interpretado, a senha vai crua para
// o servidor. Se falhar aqui, a senha está errada de verdade — não é escape.

import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

const HOST = "aws-1-us-east-2.pooler.supabase.com";
const USER = "postgres.dvuaefuxyxvtazoutgzf";

function perguntaOculta(q) {
  process.stdout.write(q);
  const stdin = process.stdin;
  if (stdin.setRawMode) stdin.setRawMode(true);
  return new Promise((resolve) => {
    let v = "";
    const onData = (ch) => {
      const c = ch.toString("utf8");
      if (c === "\r" || c === "\n") {
        if (stdin.setRawMode) stdin.setRawMode(false);
        stdin.removeListener("data", onData);
        stdin.pause();
        process.stdout.write("\n");
        resolve(v);
      } else if (c === "\u0003") process.exit(1);
      else if (c === "\u007f" || c === "\b") v = v.slice(0, -1);
      else v += c;
    };
    stdin.on("data", onData);
  });
}

const senha = await perguntaOculta("Senha do banco (não será exibida): ");
if (!senha) { console.error("Vazia."); process.exit(1); }
console.log(`Recebi ${senha.length} caracteres. Testando ${HOST}...`);

const cliente = new pg.Client({
  host: HOST, port: 5432, user: USER, password: senha,
  database: "postgres", ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

try {
  await cliente.connect();
  const { rows } = await cliente.query(
    `select current_database() as bd,
            (select count(*) from pg_tables where schemaname='public') as tabelas`
  );
  console.log(`\nCONECTOU. banco=${rows[0].bd} tabelas_public=${rows[0].tabelas}`);

  if (Number(rows[0].tabelas) === 0) {
    console.log("\nAtenção: o schema public está VAZIO.");
    console.log("Este projeto não tem as tabelas da aplicação — não é a produção.");
  }
  await cliente.end();

  // Só agora monta a URL, com o encode aplicado uma única vez.
  const s = encodeURIComponent(senha);
  const base = `postgresql://${USER}:${s}@${HOST}`;
  let env = readFileSync(".env", "utf8");
  for (const [k, v] of [
    ["DATABASE_URL", `${base}:6543/postgres?pgbouncer=true&connection_limit=1`],
    ["DIRECT_URL", `${base}:5432/postgres`],
  ]) {
    const re = new RegExp(`^${k}=.*$`, "m");
    env = re.test(env) ? env.replace(re, `${k}="${v}"`) : `${env}\n${k}="${v}"`;
  }
  writeFileSync(".env", env);
  console.log(".env atualizado.");
} catch (e) {
  console.error(`\nFALHOU: ${e.message}`);
  if (/password authentication/i.test(e.message)) {
    console.error("A senha foi rejeitada pelo servidor — não é problema de encode.");
    console.error("Provavelmente é a senha de OUTRO projeto Supabase.");
  }
  process.exit(1);
}
