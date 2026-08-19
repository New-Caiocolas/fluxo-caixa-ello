// Cria (ou atualiza a senha de) um usuário do sistema.
//
//   node scripts/criar-usuario.mjs
//
// Existe porque a criação normal passa pela tela de Usuários, que exige estar
// logado — e no primeiro acesso a um banco existente não há como entrar.
//
// Usa o mesmo bcrypt com custo 12 do seed, então a senha gerada aqui funciona
// na tela de login sem nenhum tratamento especial.

import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const pergunta = (q) => new Promise((r) => rl.question(q, r));

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
        process.stdout.write("\n");
        resolve(v);
      } else if (c === "\u0003") process.exit(1);
      else if (c === "\u007f" || c === "\b") v = v.slice(0, -1);
      else v += c;
    };
    stdin.on("data", onData);
  });
}

const email = (await pergunta("E-mail: ")).trim().toLowerCase();
const nome = (await pergunta("Nome: ")).trim();
const papel = ((await pergunta("Papel [ADMIN/GESTOR/OPERADOR] (ADMIN): ")).trim() || "ADMIN").toUpperCase();
rl.pause();
const senha = await perguntaOculta("Senha: ");
rl.close();

if (!email.includes("@") || !nome || !senha) {
  console.error("E-mail, nome e senha são obrigatórios.");
  process.exit(1);
}
if (!["ADMIN", "GESTOR", "OPERADOR"].includes(papel)) {
  console.error(`Papel inválido: ${papel}`);
  process.exit(1);
}
if (senha.length < 8) {
  console.error("Use ao menos 8 caracteres.");
  process.exit(1);
}

const hash = await bcrypt.hash(senha, 12);
const cliente = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await cliente.connect();

try {
  const existe = await cliente.query('select id from "User" where lower(email) = $1', [email]);

  if (existe.rowCount) {
    // Só a senha: papel e nome de um usuário real não devem ser sobrescritos
    // sem querer por um comando de recuperação de acesso.
    await cliente.query(
      'update "User" set password = $1, "mustChangePassword" = false, "updatedAt" = now() where id = $2',
      [hash, existe.rows[0].id]
    );
    console.log(`Senha atualizada para ${email} (usuário já existia).`);
  } else {
    await cliente.query(
      `insert into "User" (id, name, email, password, role, "mustChangePassword", "createdAt", "updatedAt")
       values ($1, $2, $3, $4, $5, false, now(), now())`,
      [randomUUID(), nome, email, hash, papel]
    );
    console.log(`Usuário ${email} criado com papel ${papel}.`);
  }
  console.log("Pronto. Entre em http://localhost:3000/login");
} finally {
  await cliente.end();
}
