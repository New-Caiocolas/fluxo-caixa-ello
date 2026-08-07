import { describe, expect, it } from "vitest";
import {
  competenciaToLabel,
  formatCurrency,
  formatDate,
  formatPercent,
  getCompetencia,
  getDiasNoMes,
  mesNome,
} from "@/lib/utils";

/** O Intl usa espaço não-quebrável entre "R$" e o número; normaliza para comparar. */
const norm = (s: string) => s.replace(/ /g, " ");

describe("formatCurrency", () => {
  it("formata em real com separador de milhar e duas decimais", () => {
    expect(norm(formatCurrency(1_234.56))).toBe("R$ 1.234,56");
    expect(norm(formatCurrency(0))).toBe("R$ 0,00");
    expect(norm(formatCurrency(1_000_000))).toBe("R$ 1.000.000,00");
  });

  it("mostra valor negativo com sinal (mês no vermelho)", () => {
    expect(norm(formatCurrency(-500.5))).toBe("-R$ 500,50");
  });

  it("arredonda para 2 casas", () => {
    expect(norm(formatCurrency(10.005))).toBe("R$ 10,01");
    expect(norm(formatCurrency(10.004))).toBe("R$ 10,00");
  });
});

describe("formatPercent", () => {
  it("usa uma casa decimal por padrão", () => {
    expect(formatPercent(25)).toBe("25.0%");
    expect(formatPercent(33.333)).toBe("33.3%");
  });

  it("aceita número de decimais customizado", () => {
    expect(formatPercent(33.333, 0)).toBe("33%");
    expect(formatPercent(33.333, 2)).toBe("33.33%");
  });
});

describe("getCompetencia", () => {
  it("devolve ano-mês com dois dígitos no mês", () => {
    expect(getCompetencia(new Date("2026-08-05T12:00:00Z"))).toBe("2026-08");
    expect(getCompetencia(new Date("2026-01-15T00:00:00Z"))).toBe("2026-01");
    expect(getCompetencia(new Date("2026-12-31T23:59:59Z"))).toBe("2026-12");
  });

  it("é baseado em UTC — data de virada de mês cai na competência UTC", () => {
    // 31/01 às 23h30 em Brasília (UTC-3) é 01/02 em UTC, então a competência é 2026-02.
    // Comportamento documentado, não acidental: o app grava e lê tudo em UTC.
    expect(getCompetencia(new Date("2026-01-31T23:30:00-03:00"))).toBe("2026-02");
  });

  it("bate com a competência usada no formato do label", () => {
    const comp = getCompetencia(new Date("2026-08-05T12:00:00Z"));
    expect(competenciaToLabel(comp)).toBe("Ago/2026");
  });
});

describe("formatDate", () => {
  it("formata em dd/mm/aaaa a partir de Date ou string", () => {
    expect(formatDate(new Date("2026-08-05T00:00:00Z"))).toBe("05/08/2026");
    expect(formatDate("2026-08-05T00:00:00Z")).toBe("05/08/2026");
  });

  it("preenche dia e mês com zero à esquerda", () => {
    expect(formatDate(new Date("2026-01-01T00:00:00Z"))).toBe("01/01/2026");
  });
});

describe("getDiasNoMes", () => {
  it("conta os dias de meses de 31, 30 e 28", () => {
    expect(getDiasNoMes(2026, 1)).toBe(31);
    expect(getDiasNoMes(2026, 4)).toBe(30);
    expect(getDiasNoMes(2026, 2)).toBe(28);
    expect(getDiasNoMes(2026, 12)).toBe(31);
  });

  it("acerta fevereiro em ano bissexto", () => {
    expect(getDiasNoMes(2024, 2)).toBe(29);
    expect(getDiasNoMes(2028, 2)).toBe(29);
    expect(getDiasNoMes(2100, 2)).toBe(28); // século não divisível por 400
  });
});

describe("competenciaToLabel", () => {
  it("traduz para mês abreviado em português", () => {
    expect(competenciaToLabel("2026-01")).toBe("Jan/2026");
    expect(competenciaToLabel("2026-03")).toBe("Mar/2026");
    expect(competenciaToLabel("2026-12")).toBe("Dez/2026");
  });
});

describe("mesNome", () => {
  it("devolve o nome completo do mês em português", () => {
    expect(mesNome(1)).toBe("Janeiro");
    expect(mesNome(3)).toBe("Março");
    expect(mesNome(12)).toBe("Dezembro");
  });
});
