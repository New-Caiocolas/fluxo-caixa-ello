import { describe, expect, it } from "vitest";
import { ALIQUOTAS, DSR_BASE_DIAS, DSR_DIAS, calcularFolha } from "@/lib/folha";

describe("calcularFolha", () => {
  it("calcula um caso simples de ponta a ponta (sem triênio, sem comissão)", () => {
    const r = calcularFolha(3_000, 0, 0);

    expect(r.trienio).toBe(0);
    expect(r.dsr).toBeCloseTo(400, 2); // 3.000 / 30 * 4
    expect(r.totalBruto).toBeCloseTo(3_400, 2);
    expect(r.inssPatronal).toBeCloseTo(680, 2); // 20%
    expect(r.entidades).toBeCloseTo(197.2, 2); // 5,8%
    expect(r.fgts).toBeCloseTo(289, 2); // 8,5%
    expect(r.totalEncargos).toBeCloseTo(1_166.2, 2);
    expect(r.totalPagar).toBeCloseTo(4_566.2, 2);
  });

  it("aplica o triênio como percentual sobre o salário base", () => {
    const r = calcularFolha(3_000, 0.03, 0);
    expect(r.trienio).toBeCloseTo(90, 2);
    // Triênio entra na base antes do DSR: (3.000 + 90) / 30 * 4
    expect(r.dsr).toBeCloseTo(412, 2);
    expect(r.totalBruto).toBeCloseTo(3_502, 2);
  });

  it("inclui a comissão na base do DSR", () => {
    const semComissao = calcularFolha(3_000, 0, 0);
    const comComissao = calcularFolha(3_000, 0, 600);
    expect(comComissao.dsr).toBeGreaterThan(semComissao.dsr);
    expect(comComissao.dsr).toBeCloseTo((3_600 / DSR_BASE_DIAS) * DSR_DIAS, 2);
    expect(comComissao.totalBruto).toBeCloseTo(3_600 + 480, 2);
  });

  it("os encargos somam sempre 34,3% do total bruto", () => {
    const percentualTotal =
      ALIQUOTAS.INSS_PATRONAL + ALIQUOTAS.ENTIDADES + ALIQUOTAS.FGTS;
    expect(percentualTotal).toBeCloseTo(0.343, 10);

    for (const [base, trienio, comissao] of [
      [1_500, 0, 0],
      [3_000, 0.03, 500],
      [12_345.67, 0.09, 1_234.56],
    ]) {
      const r = calcularFolha(base, trienio, comissao);
      expect(r.totalEncargos).toBeCloseTo(r.totalBruto * percentualTotal, 6);
      expect(r.totalPagar).toBeCloseTo(r.totalBruto * (1 + percentualTotal), 6);
    }
  });

  it("totalPagar é sempre maior que totalBruto (encargos nunca somam zero ou negativo)", () => {
    const r = calcularFolha(2_000, 0.06, 300);
    expect(r.totalPagar).toBeGreaterThan(r.totalBruto);
    expect(r.totalEncargos).toBeGreaterThan(0);
  });

  it("funcionário com salário zero não gera encargo nem NaN", () => {
    const r = calcularFolha(0, 0, 0);
    expect(r.totalBruto).toBe(0);
    expect(r.totalEncargos).toBe(0);
    expect(r.totalPagar).toBe(0);
    expect(Number.isNaN(r.totalPagar)).toBe(false);
  });

  it("escala linearmente com o salário base", () => {
    const um = calcularFolha(1_000, 0.03, 100);
    const dez = calcularFolha(10_000, 0.03, 1_000);
    expect(dez.totalPagar).toBeCloseTo(um.totalPagar * 10, 6);
  });

  it("mantém as alíquotas patronais vigentes", () => {
    // Se alguma alíquota mudar por lei, atualize aqui de forma consciente.
    expect(ALIQUOTAS.INSS_PATRONAL).toBe(0.2);
    expect(ALIQUOTAS.ENTIDADES).toBe(0.058);
    expect(ALIQUOTAS.FGTS).toBe(0.085);
  });
});
