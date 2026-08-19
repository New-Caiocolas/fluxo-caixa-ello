// Monta DATABASE_URL e DIRECT_URL no .env sem você precisar escapar nada.
//
//   node scripts/configurar-env.mjs
//
// Existe porque senha com @, + ou # quebra a URL de conexão em silêncio: o
// parser corta no caractere errado e o erro que aparece é "host não encontrado"
// ou "senha inválida" — nunca "sua senha precisa de encode".

import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const pergunta = (q) => new Promise((r) => rl.question(q, r));

// Esconde o que for digitado (a senha não fica visível nem no scrollback).
async function perguntaOculta(q) {
  process.stdout.write(q);
  const stdin = process.stdin;
  const eraRaw = stdin.isRaw;
  if (stdin.setRawMode) stdin.setRawMode(true);
  return new Promise((resolve) => {
    let v = "";
    const onData = (ch) => {
      const c = ch.toString("utf8");
      if (c === "\r" || c === "\n") {
        if (stdin.setRawMode) stdin.setRawMode(eraRaw ?? false);
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(v);
      } else if (c === "\u0003") {
        process.exit(1);
      } else if (c === "\u007f" || c === "\b") {
        v = v.slice(0, -1);
      } else {
        v += c;
      }
    };
    stdin.on("data", onData);
  });
}

const host = (await pergunta(
  "Host do pooler (ex.: aws-1-sa-east-1.pooler.supabase.com): "
)).trim();
const usuario = (await pergunta("Usuário (ex.: postgres.abcdefgh): ")).trim();
const senha = await perguntaOculta("Senha (não será exibida): ");
rl.close();

if (!host || !usuario || !senha) {
  console.error("Faltou preencher algum campo.");
  process.exit(1);
}
if (host.includes("REGIAO") || host.includes("[")) {
  console.error(`Host ainda é um placeholder: ${host}`);
  process.exit(1);
}

// encodeURIComponent resolve @, +, #, / e afins de uma vez.
const s = encodeURIComponent(senha);
const base = `postgresql://${usuario}:${s}@${host}`;

const linhas = {
  DATABASE_URL: `${base}:6543/postgres?pgbouncer=true&connection_limit=1`,
  DIRECT_URL: `${base}:5432/postgres`,
};

let env = readFileSync(".env", "utf8");
for (const [chave, valor] of Object.entries(linhas)) {
  const re = new RegExp(`^${chave}=.*$`, "m");
  const nova = `${chave}="${valor}"`;
  env = re.test(env) ? env.replace(re, nova) : `${env}\n${nova}`;
}
writeFileSync(".env", env);

if (s !== senha) {
  console.log("Senha tinha caractere especial — foi codificada automaticamente.");
}
console.log(`.env atualizado. Host: ${host}`);
console.log("Confira a conexão com: node scripts/backup-supabase.mjs");
