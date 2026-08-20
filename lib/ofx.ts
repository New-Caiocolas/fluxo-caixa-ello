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
 *
 * O regex extrai até a próxima tag ou fim de linha, então funciona nos dois.
 */

export interface TransacaoOFX {
  /** Identificador único da transação no banco. Base da deduplicação. */
  fitid: string;
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

function tag(bloco: string, nome: string): string | null {
  // [^<\r\n]* para em "<" (OFX 2.x, tag fechada) ou na quebra de linha
  // (OFX 1.x, tag aberta) — cobre as duas gerações com um padrão só.
  const m = bloco.match(new RegExp(`<${nome}>([^<\r\n]*)`, "i"));
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

export function parseOFX(conteudo: string): TransacaoOFX[] {
  const blocos = conteudo.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  const transacoes: TransacaoOFX[] = [];

  for (const bloco of blocos) {
    const fitid = tag(bloco, "FITID");
    const dtposted = tag(bloco, "DTPOSTED");
    const trnamt = tag(bloco, "TRNAMT");
    if (!fitid || !dtposted || !trnamt) continue;

    const data = paraData(dtposted);
    // Alguns bancos usam vírgula decimal mesmo em OFX.
    const valor = Number(trnamt.replace(",", "."));
    if (!data || !Number.isFinite(valor) || valor === 0) continue;

    // MEMO costuma ser mais descritivo que NAME; quando falta, NAME serve.
    const descricao = (tag(bloco, "MEMO") ?? tag(bloco, "NAME") ?? "")
      .replace(/\s+/g, " ")
      .trim();

    transacoes.push({
      fitid,
      data,
      valor: Math.abs(valor),
      tipo: valor < 0 ? "SAIDA" : "ENTRADA",
      descricao: descricao || "(sem descrição)",
    });
  }

  return transacoes;
}
