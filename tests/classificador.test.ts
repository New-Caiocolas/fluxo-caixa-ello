import { describe, expect, it } from "vitest";
import { construirIndice, sugerir, type LancamentoHistorico } from "@/lib/classificador";

const historico: LancamentoHistorico[] = [
  { descricao: "TARIFA BANCARIA", grupoId: 7, subgrupoId: "sub-tarifa" },
  { descricao: "TARIFA BANCARIA", grupoId: 7, subgrupoId: "sub-tarifa" },
  { descricao: "J MACEDO", grupoId: 1, subgrupoId: "sub-boleto" },
  { descricao: "PIX ENVIADO JOAO SILVA 12/07", grupoId: 4, subgrupoId: null },
  // PROMEDICA aparece em dois grupos na base real — caso de ambiguidade.
  { descricao: "PROMEDICA", grupoId: 8, subgrupoId: null },
  { descricao: "PROMEDICA", grupoId: 8, subgrupoId: null },
  { descricao: "PROMEDICA", grupoId: 7, subgrupoId: null },
];

const indice = construirIndice(historico);

describe("sugerir", () => {
  it("casa descrição idêntica com confiança alta", () => {
    const s = sugerir(indice, "TARIFA BANCARIA");
    expect(s).toMatchObject({ grupoId: 7, subgrupoId: "sub-tarifa", confianca: "alta", ambiguo: false });
  });

  it("ignora caixa, acento e pontuação", () => {
    expect(sugerir(indice, "  tarifa  bancária. ")?.grupoId).toBe(7);
  });

  it("casa ignorando números, porque datas variam a cada transação", () => {
    // "PIX ENVIADO JOAO SILVA 03/08" nunca casaria exato com o histórico de
    // 12/07, mas é claramente o mesmo tipo de lançamento.
    const s = sugerir(indice, "PIX ENVIADO JOAO SILVA 03/08");
    expect(s?.grupoId).toBe(4);
    expect(s?.confianca).toBe("media");
  });

  it("marca ambiguidade e escolhe o grupo mais frequente", () => {
    // Escolher em silêncio entre dois grupos esconderia a dúvida de quem
    // revisa; a tela precisa saber para destacar a linha.
    const s = sugerir(indice, "PROMEDICA");
    expect(s?.ambiguo).toBe(true);
    expect(s?.grupoId).toBe(8);
    expect(s?.confianca).toBe("media");
  });

  it("devolve null quando não há base, em vez de inventar", () => {
    expect(sugerir(indice, "FORNECEDOR QUE NUNCA APARECEU")).toBeNull();
    expect(sugerir(indice, "")).toBeNull();
  });

  it("informa em que lançamento a sugestão se baseou", () => {
    expect(sugerir(indice, "j macedo")?.baseadoEm).toBe("J MACEDO");
  });

  it("lida com histórico vazio", () => {
    expect(sugerir(construirIndice([]), "QUALQUER")).toBeNull();
  });
});
