/**
 * Gera o .ssf do `com.ello.metrics` com as alterações que este projeto precisa.
 *
 *   npm run senior:build
 *
 * SEMPRE parte de `com.ello.metrics.base.ssf` e reescreve
 * `com.ello.metrics.novo.ssf`. Nunca aplica patch sobre patch — assim rodar
 * duas vezes dá o mesmo resultado, e adicionar uma alteração nova é só
 * acrescentar à lista abaixo.
 *
 * Para trazer um base novo do Senior: exporte o provedor pelo editor de web
 * services e substitua o arquivo `.base.ssf`.
 *
 * ⚠️ Importar o resultado é MUDANÇA EM PRODUÇÃO. O `com.ello.metrics` também
 * alimenta o dashboard do commission-compass. Rollback = reimportar o base.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSsf, getRuleText, setRule } from "./ssf-lib.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const BASE = join(AQUI, "com.ello.metrics.base.ssf");
const SAIDA = join(AQUI, "com.ello.metrics.novo.ssf");

/**
 * Alterações por porta. Cada item é [rótulo, procurar, substituir].
 * O build aborta se algum `procurar` não casar — melhor não gerar nada que
 * gerar um arquivo meio-alterado.
 */
const ALTERACOES = {
  ConsultarFinanceiro: (EOL) => [
    [
      "declara vHistorico",
      "Definir Numero vCtafin;",
      `Definir Numero vCtafin;${EOL}Definir Alfa vHistorico;`,
    ],
    [
      "traz HisTit no SELECT",
      't.SitTit, t.ctafin "',
      't.SitTit, t.ctafin, t.HisTit historico "',
    ],
    [
      "lê historico do cursor",
      'SQL_RetornarInteiro(xCursor, "ctafin", vCtafin);',
      `SQL_RetornarInteiro(xCursor, "ctafin", vCtafin);${EOL}` +
        `SQL_RetornarAlfa(xCursor, "historico", vHistorico);`,
    ],
    [
      // Reaproveita `centroCusto`: a coluna existe no grid e nunca é
      // preenchida (o SELECT nem a traz). Criar coluna nova exigiria mexer no
      // grid, cujo layout a ssf-lib não decodifica nestas portas — fazer às
      // cegas corromperia o arquivo.
      "devolve em centroCusto",
      /(ConsultarFinanceiro\.Resultado\.ctafin\s*=\s*vCtafin;)/,
      `$1${EOL}ConsultarFinanceiro.Resultado.centroCusto = vHistorico;`,
    ],
  ],
};

let buf = readFileSync(BASE);
console.log(`base: ${BASE.split(/[\\/]/).pop()} (${buf.length} bytes)`);
console.log(`provedor: ${parseSsf(buf).provider}\n`);

for (const [porta, montar] of Object.entries(ALTERACOES)) {
  const alvo = parseSsf(buf).ports.find((p) => p.name === porta);
  if (!alvo) throw new Error(`porta não encontrada: ${porta}`);

  const regra = getRuleText(buf, alvo);
  if (!regra) throw new Error(`não consegui ler a regra de ${porta}`);

  const EOL = regra.includes("\r\n") ? "\r\n" : "\n";
  let nova = regra;

  console.log(`${porta}:`);
  for (const [rotulo, procurar, substituir] of montar(EOL)) {
    const achou =
      procurar instanceof RegExp ? procurar.test(nova) : nova.includes(procurar);
    if (!achou) throw new Error(`  em ${porta}, não casou: ${rotulo}`);
    nova = nova.replace(procurar, substituir);
    console.log(`  ok  ${rotulo}`);
  }

  // Guardas do guia do Senior: linha longa é recusada na importação, e chaves
  // desbalanceadas quebram a compilação da regra.
  for (const l of nova.split(/\r?\n/)) {
    if (l.length > 255) throw new Error(`linha com ${l.length} caracteres em ${porta}`);
  }
  const ini = (nova.match(/\binicio\b/g) || []).length;
  const fim = (nova.match(/\bfim;/g) || []).length;
  if (ini !== fim) throw new Error(`${porta}: inicio=${ini} mas fim=${fim}`);

  buf = setRule(buf, porta, nova);
}

// Confirma que o arquivo gerado continua legível pela própria lib.
const conferencia = parseSsf(buf);
console.log(`\nverificação: ${conferencia.ports.length} portas legíveis`);
for (const p of conferencia.ports) {
  const t = getRuleText(buf, p);
  console.log(`  ${p.name.padEnd(24)} regra ${t ? `${t.length} chars` : "ILEGÍVEL"}`);
  if (!t) throw new Error(`regra de ${p.name} ficou ilegível — não vou gravar`);
}

writeFileSync(SAIDA, buf);
console.log(`\ngravado: ${SAIDA.split(/[\\/]/).pop()} (${buf.length} bytes)`);
console.log("Importe no editor de web services do Senior. Rollback: reimporte o .base.ssf");
