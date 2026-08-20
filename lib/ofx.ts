/**
 * Leitor de extrato OFX.
 *
 * Escrito à mão em vez de usar biblioteca por dois motivos: o formato é
 * simples o bastante (blocos <STMTTRN> com meia dúzia de tags), e os pacotes
 * de OFX no npm são pouco mantidos — dependência a mais num sistema que já
 * carrega vulnerabilidade alta em `xlsx`.
 *
 * Trata as duas gerações do formato:
 *   OFX 1.x — SGML, com tags que não fecham (`<MEMO>TEXTO` e ponto final)
 *   OFX 2.x — XML bem formado
 */

export interface TransacaoOFX {
  /** FITID como veio do banco. Guardado para referência, NÃO para deduplicar. */
  fitid: string;
  /**
   * Chave de deduplicação. Ver `montarChave` — o FITID sozinho não serve.
   */
  chave: string;
  /** Meia-noite UTC: o app formata datas com getUTC*, e converter para o fuso
   *  local deslocaria o dia de lançamentos feitos de madrugada. */
  data: Date;
  /** Sempre positivo. A direção vai em `tipo`, como o resto do sistema faz. */
  valor: number;
  tipo: "ENTRADA" | "SAIDA";
  descricao: string;
}

/**
 * Bancos brasileiros costumam emitir OFX em ISO-8859-1, não UTF-8. Lido como
 * UTF-8, "MANUTENÇÃO" vira "MANUTEN��O" — e a descrição é justamente a chave
 * usada para classificar o lançamento pelo histórico.
 */
export function decodificarOFX(buffer: Buffer): string {
  const inicio = buffer.subarray(0, 1024).toString("latin1").toUpperCase();
  const utf8 =
    inicio.includes("CHARSET:UTF-8") ||
    inicio.includes("ENCODING:UTF-8") ||
    inicio.includes('ENCODING="UTF-8"');
  return buffer.toString(utf8 ? "utf8" : "latin1");
}

/** O Bradesco escapa `&` como `&amp;` no MEMO; sem desfazer, a descrição
 *  gravada fica diferente da que a pessoa vê no extrato. */
function decodificarEntidades(s: string): string {
  return s
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    // &amp; por último: antes, desfaria o escape duplo de "&amp;lt;"
    .replace(/&amp;/gi, "&");
}

function tag(bloco: string, nome: string): string | null {
  // [^<\r\n]* para em "<" (OFX 2.x, tag fechada) ou na quebra de linha
  // (OFX 1.x, tag aberta) — cobre as duas gerações com um padrão só.
  const m = bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, "i"));
  return m ? m[1].trim() : null;
}

function paraData(bruto: string): Date | null {
  // DTPOSTED vem como YYYYMMDD ou YYYYMMDDHHMMSS[-3:BRT]; só a data importa.
  const m = bruto.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const [, ano, mes, dia] = m;
  const d = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Chave de deduplicação.
 *
 * O FITID deveria ser único por transação, e no Bradesco é. Na Caixa, não:
 * ele espelha o CHECKNUM, e num extrato real de 65 transações havia só 53
 * valores distintos — `424065` aparecia cinco vezes com valores e datas
 * diferentes, e duas transações traziam FITID `0`.
 *
 * Deduplicar pelo FITID puro descartaria 12 das 65 sem avisar, deixando o
 * caixa com um valor plausível e errado. Por isso a chave combina FITID, data,
 * valor e descrição — que juntos identificam a transação nos dois bancos.
 */
function montarChave(t: Omit<TransacaoOFX, "chave">): string {
  const dia = t.data.toISOString().slice(0, 10);
  const sinal = t.tipo === "SAIDA" ? "-" : "+";
  return `${t.fitid}|${dia}|${sinal}${t.valor.toFixed(2)}|${t.descricao}`;
}

export function parseOFX(conteudo: string): TransacaoOFX[] {
  const blocos = conteudo.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  const transacoes: TransacaoOFX[] = [];
  const vistas = new Map<string, number>();

  for (const bloco of blocos) {
    const fitid = tag(bloco, "FITID");
    const dtposted = tag(bloco, "DTPOSTED");
    const trnamt = tag(bloco, "TRNAMT");
    if (!fitid || !dtposted || !trnamt) continue;

    const data = paraData(dtposted);
    // O Bradesco emite valor com vírgula decimal mesmo em OFX.
    const valor = Number(trnamt.replace(",", "."));
    if (!data || !Number.isFinite(valor) || valor === 0) continue;

    // MEMO costuma ser mais descritivo que NAME; quando falta, NAME serve.
    const descricao =
      decodificarEntidades(tag(bloco, "MEMO") ?? tag(bloco, "NAME") ?? "")
        .replace(/\s+/g, " ")
        .trim() || "(sem descrição)";

    const base = {
      fitid,
      data,
      valor: Math.abs(valor),
      tipo: (valor < 0 ? "SAIDA" : "ENTRADA") as "SAIDA" | "ENTRADA",
      descricao,
    };

    // Duas transações realmente idênticas no mesmo dia (mesma tarifa cobrada
    // duas vezes, por exemplo) existem de verdade. O sufixo mantém as duas,
    // e é estável enquanto o banco exportar na mesma ordem — o que é o caso
    // quando se reexporta o mesmo período.
    let chave = montarChave(base);
    const repeticao = (vistas.get(chave) ?? 0) + 1;
    vistas.set(chave, repeticao);
    if (repeticao > 1) chave = `${chave}#${repeticao}`;

    transacoes.push({ ...base, chave });
  }

  return transacoes;
}
