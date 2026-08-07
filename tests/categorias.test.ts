import { describe, expect, it } from "vitest";
import { GRUPOS, getGrupoById, getSubgrupoById } from "@/lib/categorias";

describe("integridade do plano de contas", () => {
  it("não tem id de grupo duplicado", () => {
    const ids = GRUPOS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("não tem id de subgrupo duplicado em todo o plano", () => {
    const ids = GRUPOS.flatMap((g) => g.subgrupos.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo subgrupo é prefixado pelo id do seu grupo", () => {
    for (const grupo of GRUPOS) {
      for (const sub of grupo.subgrupos) {
        expect(sub.id.startsWith(`${grupo.id}-`)).toBe(true);
      }
    }
  });

  it("a ordem dos subgrupos é sequencial a partir de 1 em cada grupo", () => {
    for (const grupo of GRUPOS) {
      const ordens = grupo.subgrupos.map((s) => s.ordem);
      expect(ordens).toEqual(ordens.map((_, i) => i + 1));
    }
  });

  it("a ordem de exibição dos grupos é sequencial a partir de 1", () => {
    const ordens = GRUPOS.map((g) => g.ordem);
    expect(ordens).toEqual(ordens.map((_, i) => i + 1));
  });

  it("todo grupo tem pelo menos um subgrupo", () => {
    for (const grupo of GRUPOS) {
      expect(grupo.subgrupos.length).toBeGreaterThan(0);
    }
  });

  it("o Grupo 1 (Recebimentos) é o único de tipo ENTRADA", () => {
    const entradas = GRUPOS.filter((g) => g.tipo === "ENTRADA").map((g) => g.id);
    expect(entradas).toEqual([1]);
  });

  it("apenas o Grupo 13 permite os dois tipos de lançamento", () => {
    const ambos = GRUPOS.filter((g) => g.permiteAmbosTipos).map((g) => g.id);
    expect(ambos).toEqual([13]);
  });

  /**
   * Invariante que amarra o plano de contas à fórmula do fluxo em lib/utils.ts:
   * `calcularFluxoOperacional` soma os grupos 4..12 como custo. Se alguém criar um
   * grupo de saída novo (ex.: 15) e esquecer de incluí-lo na fórmula, este teste falha
   * e aponta exatamente o que precisa ser atualizado.
   */
  it("os grupos de saída são exatamente os custos operacionais (4..12) + financeiro (13) + investimento (14)", () => {
    const saidas = GRUPOS.filter((g) => g.tipo === "SAIDA")
      .map((g) => g.id)
      .sort((a, b) => a - b);
    expect(saidas).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });
});

describe("getGrupoById", () => {
  it("encontra um grupo existente", () => {
    expect(getGrupoById(1)?.nome).toBe("Recebimentos");
    expect(getGrupoById(13)?.permiteAmbosTipos).toBe(true);
  });

  it("devolve undefined para grupo inexistente", () => {
    expect(getGrupoById(999)).toBeUndefined();
    // Os ids 2 e 3 não existem no plano de contas — o salto de 1 para 4 é intencional.
    expect(getGrupoById(2)).toBeUndefined();
    expect(getGrupoById(3)).toBeUndefined();
  });
});

describe("getSubgrupoById", () => {
  it("encontra um subgrupo dentro do grupo certo", () => {
    expect(getSubgrupoById(1, "1-2")?.nome).toBe("PIX");
  });

  it("não encontra subgrupo de outro grupo (evita lançar em conta errada)", () => {
    expect(getSubgrupoById(4, "1-2")).toBeUndefined();
  });

  it("devolve undefined quando o grupo não existe", () => {
    expect(getSubgrupoById(999, "999-1")).toBeUndefined();
  });
});
