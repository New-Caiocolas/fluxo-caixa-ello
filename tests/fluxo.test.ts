import { describe, expect, it } from "vitest";
import { calcularFluxoOperacional, calcularFluxoLivre, META_PADRAO } from "@/lib/utils";

/**
 * Estas fórmulas são a fonte única usada por /api/dfc, /api/dashboard e /api/saldos.
 * Antes de 2026-08-03 cada rota calculava do seu jeito e os três números divergiam na
 * tela. Os testes abaixo travam o contrato para que a divergência não volte.
 */
describe("calcularFluxoOperacional", () => {
  it("subtrai das entradas apenas os grupos de custo operacional (4 a 12)", () => {
    const fluxo = calcularFluxoOperacional(100_000, { 4: 20_000, 5: 10_000, 11: 5_000 });
    expect(fluxo).toBe(65_000);
  });

  it("soma todos os grupos de 4 a 12, sem esquecer nenhum", () => {
    const todosCustos = { 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7, 11: 8, 12: 9 };
    expect(calcularFluxoOperacional(1_000, todosCustos)).toBe(1_000 - 45);
  });

  it("ignora o grupo 1 se ele vier no mapa — recebimento já está em totalEntradas", () => {
    // Regressão: contar o grupo 1 duas vezes zeraria o fluxo de uma empresa saudável.
    const semGrupo1 = calcularFluxoOperacional(100_000, { 4: 20_000 });
    const comGrupo1 = calcularFluxoOperacional(100_000, { 1: 100_000, 4: 20_000 });
    expect(comGrupo1).toBe(semGrupo1);
  });

  it("ignora os grupos 13 e 14 — eles só entram no fluxo livre", () => {
    const base = calcularFluxoOperacional(50_000, { 4: 10_000 });
    expect(calcularFluxoOperacional(50_000, { 4: 10_000, 13: 5_000, 14: 8_000 })).toBe(base);
  });

  it("trata grupo ausente como zero, sem virar NaN", () => {
    expect(calcularFluxoOperacional(10_000, {})).toBe(10_000);
  });

  it("aceita resultado negativo (mês no vermelho é informação, não erro)", () => {
    expect(calcularFluxoOperacional(1_000, { 4: 5_000 })).toBe(-4_000);
  });
});

describe("calcularFluxoLivre", () => {
  it("soma o financeiro líquido e subtrai investimentos", () => {
    expect(calcularFluxoLivre(50_000, 2_000, 8_000)).toBe(44_000);
  });

  /**
   * Regressão do bug crítico nº 3 (corrigido em 2026-08-03): o Grupo 13 era tratado
   * como saída pura, então "Juros Recebidos" DIMINUÍA o fluxo livre em vez de aumentar.
   * O chamador passa o líquido (entradas - saídas) e aqui ele precisa somar com sinal.
   */
  it("juros recebidos aumentam o fluxo livre; juros pagos diminuem", () => {
    const entradas = 3_000;
    const saidas = 1_000;
    const liquido = entradas - saidas;

    expect(calcularFluxoLivre(10_000, liquido, 0)).toBe(12_000);
    // Se o sinal voltasse a ser invertido, o resultado seria 6.000 (10.000 - 4.000).
    expect(calcularFluxoLivre(10_000, liquido, 0)).not.toBe(6_000);
  });

  it("grupo 13 líquido negativo (mais juros pagos que recebidos) reduz o fluxo livre", () => {
    expect(calcularFluxoLivre(10_000, -1_500, 0)).toBe(8_500);
  });

  it("investimentos sempre reduzem o fluxo livre", () => {
    expect(calcularFluxoLivre(10_000, 0, 4_000)).toBe(6_000);
  });

  it("sem financeiro nem investimento, fluxo livre é igual ao operacional", () => {
    expect(calcularFluxoLivre(7_777, 0, 0)).toBe(7_777);
  });
});

describe("META_PADRAO", () => {
  it("mantém os limiares de negócio usados como fallback (25% e 50%)", () => {
    // Os mesmos valores estão no seed (prisma/seed.ts) como meta inicial de cada filial.
    expect(META_PADRAO.FLUXO_LIVRE).toBe(25);
    expect(META_PADRAO.CUSTO_DIRETO).toBe(50);
  });
});
