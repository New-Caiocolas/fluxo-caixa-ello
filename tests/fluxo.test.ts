import { describe, expect, it } from "vitest";
import {
  calcularIndicadores,
  totalizarLancamentos,
  META_PADRAO,
  type GrupoClassificado,
} from "@/lib/utils";

/** Estrutura equivalente à do banco hoje: 1 recebimento, 4-12 custo, 13 financeiro, 14 investimento. */
const GRUPOS_PADRAO: GrupoClassificado[] = [
  { id: 1, classificacao: "RECEBIMENTO" },
  ...[4, 5, 6, 7, 8, 9, 10, 11, 12].map(
    (id): GrupoClassificado => ({ id, classificacao: "CUSTO_OPERACIONAL" })
  ),
  { id: 13, classificacao: "RESULTADO_FINANCEIRO" },
  { id: 14, classificacao: "INVESTIMENTO" },
];

/** Açúcar: total só de saída (o caso da maioria dos grupos). */
const saida = (v: number) => ({ entrada: 0, saida: v });
const entrada = (v: number) => ({ entrada: v, saida: 0 });

describe("calcularIndicadores", () => {
  it("subtrai os custos operacionais do recebimento", () => {
    const r = calcularIndicadores(GRUPOS_PADRAO, {
      1: entrada(100_000),
      4: saida(20_000),
      5: saida(10_000),
      11: saida(5_000),
    });
    expect(r.recebimento).toBe(100_000);
    expect(r.custos).toBe(35_000);
    expect(r.fluxoOperacional).toBe(65_000);
  });

  it("soma todos os grupos de custo operacional", () => {
    const totais = Object.fromEntries(
      [4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => [g, saida(5)])
    );
    const r = calcularIndicadores(GRUPOS_PADRAO, { 1: entrada(1_000), ...totais });
    expect(r.fluxoOperacional).toBe(1_000 - 45);
  });

  it("não conta financeiro nem investimento no fluxo operacional", () => {
    const base = calcularIndicadores(GRUPOS_PADRAO, { 1: entrada(50_000), 4: saida(10_000) });
    const comExtras = calcularIndicadores(GRUPOS_PADRAO, {
      1: entrada(50_000),
      4: saida(10_000),
      13: entrada(5_000),
      14: saida(8_000),
    });
    expect(comExtras.fluxoOperacional).toBe(base.fluxoOperacional);
  });

  it("aplica o sinal do grupo financeiro: entrada soma, saída subtrai", () => {
    const recebido = calcularIndicadores(GRUPOS_PADRAO, {
      1: entrada(10_000),
      13: { entrada: 3_000, saida: 1_000 },
    });
    // Líquido +2.000 sobre um operacional de 10.000.
    expect(recebido.resultadoFinanceiro).toBe(2_000);
    expect(recebido.fluxoLivre).toBe(12_000);

    const pago = calcularIndicadores(GRUPOS_PADRAO, {
      1: entrada(10_000),
      13: { entrada: 0, saida: 1_500 },
    });
    expect(pago.resultadoFinanceiro).toBe(-1_500);
    expect(pago.fluxoLivre).toBe(8_500);
  });

  it("subtrai investimento do fluxo livre", () => {
    const r = calcularIndicadores(GRUPOS_PADRAO, { 1: entrada(10_000), 14: saida(4_000) });
    expect(r.fluxoLivre).toBe(6_000);
  });

  it("fluxo livre iguala o operacional quando não há financeiro nem investimento", () => {
    const r = calcularIndicadores(GRUPOS_PADRAO, { 1: entrada(7_777) });
    expect(r.fluxoLivre).toBe(7_777);
  });

  it("aceita ausência de lançamentos", () => {
    const r = calcularIndicadores(GRUPOS_PADRAO, {});
    expect(r.fluxoOperacional).toBe(0);
    expect(r.fluxoLivre).toBe(0);
  });

  it("permite fluxo operacional negativo", () => {
    const r = calcularIndicadores(GRUPOS_PADRAO, { 1: entrada(1_000), 4: saida(5_000) });
    expect(r.fluxoOperacional).toBe(-4_000);
  });

  describe("grupos criados pelo usuário", () => {
    it("um grupo de custo novo entra no fluxo operacional sem alterar código", () => {
      const comNovo = [
        ...GRUPOS_PADRAO,
        { id: 15, classificacao: "CUSTO_OPERACIONAL" } as GrupoClassificado,
      ];
      const r = calcularIndicadores(comNovo, { 1: entrada(10_000), 15: saida(2_500) });
      expect(r.custos).toBe(2_500);
      expect(r.fluxoOperacional).toBe(7_500);
    });

    it("um grupo NEUTRO fica fora de todos os indicadores", () => {
      const comNeutro = [
        ...GRUPOS_PADRAO,
        { id: 16, classificacao: "NEUTRO" } as GrupoClassificado,
      ];
      const r = calcularIndicadores(comNeutro, { 1: entrada(10_000), 16: saida(9_999) });
      expect(r.custos).toBe(0);
      expect(r.fluxoOperacional).toBe(10_000);
      expect(r.fluxoLivre).toBe(10_000);
    });

    it("ignora totais de grupo que não está na lista", () => {
      // Grupo removido da lista mas com lançamentos históricos não deve entrar.
      const r = calcularIndicadores(GRUPOS_PADRAO, { 1: entrada(10_000), 99: saida(5_000) });
      expect(r.fluxoOperacional).toBe(10_000);
    });
  });
});

describe("totalizarLancamentos", () => {
  it("separa entrada e saída por grupo", () => {
    const totais = totalizarLancamentos([
      { grupoId: 13, tipo: "ENTRADA", valor: 300 },
      { grupoId: 13, tipo: "SAIDA", valor: 100 },
      { grupoId: 4, tipo: "SAIDA", valor: 50 },
    ]);
    expect(totais[13]).toEqual({ entrada: 300, saida: 100 });
    expect(totais[4]).toEqual({ entrada: 0, saida: 50 });
  });

  it("devolve objeto vazio para lista vazia", () => {
    expect(totalizarLancamentos([])).toEqual({});
  });

  it("compõe com calcularIndicadores preservando o sinal do financeiro", () => {
    const totais = totalizarLancamentos([
      { grupoId: 1, tipo: "ENTRADA", valor: 10_000 },
      { grupoId: 13, tipo: "ENTRADA", valor: 3_000 },
      { grupoId: 13, tipo: "SAIDA", valor: 1_000 },
    ]);
    expect(calcularIndicadores(GRUPOS_PADRAO, totais).fluxoLivre).toBe(12_000);
  });
});

describe("META_PADRAO", () => {
  it("mantém os limiares de fallback", () => {
    expect(META_PADRAO.FLUXO_LIVRE).toBe(25);
    expect(META_PADRAO.CUSTO_DIRETO).toBe(50);
  });
});
