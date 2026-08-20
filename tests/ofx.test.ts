import { describe, expect, it } from "vitest";
import { decodificarOFX, parseOFX } from "@/lib/ofx";

/** OFX 1.x: SGML, tags não fecham. É o que a maioria dos bancos ainda emite. */
const ofx1 = `OFXHEADER:100
DATA:OFXSGML
CHARSET:1252

<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260701120000[-3:BRT]
<TRNAMT>-1234.56
<FITID>2026070100001
<MEMO>TARIFA BANCARIA
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260702
<TRNAMT>5000.00
<FITID>2026070200002
<MEMO>J MACEDO
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

/** OFX 2.x: XML bem formado. */
const ofx2 = `<?xml version="1.0" encoding="UTF-8"?>
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260703</DTPOSTED>
<TRNAMT>-99.90</TRNAMT><FITID>ABC123</FITID><MEMO>TARIFA PIX</MEMO></STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe("parseOFX", () => {
  it("lê OFX 1.x, com tags que não fecham", () => {
    const t = parseOFX(ofx1);
    expect(t).toHaveLength(2);
    expect(t[0].fitid).toBe("2026070100001");
    expect(t[0].descricao).toBe("TARIFA BANCARIA");
  });

  it("lê OFX 2.x (XML) com o mesmo código", () => {
    const t = parseOFX(ofx2);
    expect(t).toHaveLength(1);
    expect(t[0].descricao).toBe("TARIFA PIX");
    expect(t[0].fitid).toBe("ABC123");
  });

  it("converte o sinal em tipo e guarda o valor positivo", () => {
    // O sistema inteiro guarda valor positivo e usa `tipo` para a direção;
    // gravar negativo aqui dobraria a subtração nos totalizadores.
    const [saida, entrada] = parseOFX(ofx1);
    expect(saida.tipo).toBe("SAIDA");
    expect(saida.valor).toBe(1234.56);
    expect(entrada.tipo).toBe("ENTRADA");
    expect(entrada.valor).toBe(5000);
  });

  it("usa meia-noite UTC, para o dia não escorregar pelo fuso", () => {
    // 20260701 às 12:00 BRT: convertido para fuso local, um lançamento de
    // madrugada cairia no dia anterior nas telas, que formatam com getUTC*.
    const [t] = parseOFX(ofx1);
    expect(t.data.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("ignora transação sem FITID, sem data ou de valor zero", () => {
    const ruim = `<STMTTRN><DTPOSTED>20260701<TRNAMT>-10.00</STMTTRN>
      <STMTTRN><FITID>X1<DTPOSTED>20260701<TRNAMT>0.00</STMTTRN>`;
    expect(parseOFX(ruim)).toHaveLength(0);
  });

  it("cai para NAME quando não há MEMO", () => {
    const semMemo = `<STMTTRN><FITID>N1<DTPOSTED>20260701<TRNAMT>-5.00
      <NAME>BOLETO</STMTTRN>`;
    expect(parseOFX(semMemo)[0].descricao).toBe("BOLETO");
  });

  it("devolve lista vazia para arquivo sem transações", () => {
    expect(parseOFX("<OFX></OFX>")).toHaveLength(0);
  });
});

describe("decodificarOFX", () => {
  it("lê ISO-8859-1, o padrão dos bancos brasileiros", () => {
    // Sem isso "MANUTENÇÃO" chega corrompido — e a descrição é a chave usada
    // para classificar o lançamento pelo histórico.
    const buf = Buffer.from("CHARSET:1252\n<MEMO>MANUTENÇÃO", "latin1");
    expect(decodificarOFX(buf)).toContain("MANUTENÇÃO");
  });

  it("respeita UTF-8 quando o cabeçalho declara", () => {
    const buf = Buffer.from("ENCODING:UTF-8\n<MEMO>MANUTENÇÃO", "utf8");
    expect(decodificarOFX(buf)).toContain("MANUTENÇÃO");
  });
});
