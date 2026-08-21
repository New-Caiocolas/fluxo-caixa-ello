/**
 * Imprime a regra LSP de uma porta de um .ssf.
 *
 *   node senior/mostrar-regra.mjs <arquivo.ssf> [porta]
 *
 * Sem o nome da porta, lista todas. Serve para conferir o que foi gerado
 * antes de importar no Senior — e para ler o que está em produção hoje.
 */
import { readFileSync } from "node:fs";
import { parseSsf, getRuleText } from "./ssf-lib.mjs";

const arquivo = process.argv[2];
const alvo = process.argv[3];

if (!arquivo) {
  console.error("uso: node senior/mostrar-regra.mjs <arquivo.ssf> [porta]");
  process.exit(1);
}

const buf = readFileSync(arquivo);
const { provider, ports } = parseSsf(buf);
console.log(`provedor: ${provider} | portas: ${ports.length}\n`);

for (const p of ports) {
  if (alvo && p.name !== alvo) continue;
  const texto = getRuleText(buf, p);
  console.log("=".repeat(72));
  console.log(p.name);
  console.log("=".repeat(72));
  if (!texto) {
    console.log("(regra ilegível)");
    continue;
  }
  if (!alvo) {
    console.log(`${texto.length} caracteres — passe o nome da porta para ver o conteúdo\n`);
    continue;
  }
  console.log(
    texto
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .join("\n")
  );
  console.log("");
}
