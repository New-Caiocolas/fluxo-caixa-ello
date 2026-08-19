// Cria um usuário, ou redefine a senha de um existente.
//
//   node scripts/criar-usuario.mjs <email> [nome] [ADMIN|GESTOR|OPERADOR]
//
// Existe porque a criação normal passa pela tela de Usuários, que exige estar
// logado — num banco existente sem senha conhecida, não há por onde entrar.
//
// A senha é sorteada e exibida UMA vez, em vez de perguntada: prompt oculto
// depende de TTY em modo raw, que se comporta de forma diferente entre
// terminais no Windows e trava sem erro. Sorteando, o valor nunca é digitado
// (não vai para o histórico) e nunca aparece numa captura de tela de formulário.
//
// mustChangePassword fica true de propósito: a senha temporária passa pelo
// fluxo de /trocar-senha que o sistema já tem, e vale por um acesso só.

import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";
import { randomBytes, randomUUID } from "node:crypto";

const [email, nome = "Usuário", papel = "ADMIN"] = process.argv.slice(2);

if (!email?.includes("@")) {
  console.error("Uso: node scripts/criar-usuario.mjs <email> [nome] [papel]");
  process.exit(1);
}
if (!["ADMIN", "GESTOR", "OPERADOR"].includes(papel.toUpperCase())) {
  console.error(`Papel inválido: ${papel}`);
  process.exit(1);
}

const senha = randomBytes(12).toString("base64url");
const hash = await bcrypt.hash(senha, 12);

const cliente = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await cliente.connect();

try {
  const existe = await cliente.query(
    'select id, role from "User" where lower(email) = lower($1)',
    [email]
  );

  if (existe.rowCount) {
    // Só a senha: sobrescrever nome e papel num comando de recuperação de
    // acesso arriscaria alterar um usuário real por engano.
    await cliente.query(
      'update "User" set password = $1, "mustChangePassword" = true, "updatedAt" = now() where id = $2',
      [hash, existe.rows[0].id]
    );
    console.log(`Senha redefinida — ${email} (papel ${existe.rows[0].role}, inalterado).`);
  } else {
    await cliente.query(
      `insert into "User" (id, name, email, password, role, "mustChangePassword", "createdAt", "updatedAt")
       values ($1, $2, $3, $4, $5, true, now(), now())`,
      [randomUUID(), nome, email.toLowerCase(), hash, papel.toUpperCase()]
    );
    console.log(`Usuário criado — ${email} (papel ${papel.toUpperCase()}).`);
  }

  console.log(`\n  senha temporária: ${senha}\n`);
  console.log("Anote agora: não será exibida de novo.");
  console.log("O sistema vai pedir uma senha nova no primeiro acesso.");
} finally {
  await cliente.end();
}
