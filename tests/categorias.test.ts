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
   * A fórmula do fluxo não é mais amarrada a ids (era [4..12] em lib/utils.ts):
   * agora quem manda é a classificação. O que precisa ser garantido no seed é a
   * coerência entre `tipo` e `classificacao` — um grupo de saída classificado
   * como RECEBIMENTO somaria receita a cada despesa lançada.
   */
  it("a classificação de cada grupo é coerente com o tipo", () => {
    for (const g of GRUPOS) {
      if (g.classificacao === "RECEBIMENTO") {
        expect(g.tipo, `grupo ${g.id}`).toBe("ENTRADA");
      }
      if (g.classificacao === "CUSTO_OPERACIONAL" || g.classificacao === "INVESTIMENTO") {
        expect(g.tipo, `grupo ${g.id}`).toBe("SAIDA");
      }
    }
  });

  it("nenhum grupo do seed fica NEUTRO", () => {
    // NEUTRO é opt-out explícito para grupos novos; nenhum do plano original
    // deve cair nele, ou sumiria dos indicadores.
    expect(GRUPOS.filter((g) => g.classificacao === "NEUTRO")).toEqual([]);
  });

  it("todo grupo que permite os dois tipos é de resultado financeiro", () => {
    for (const g of GRUPOS.filter((x) => x.permiteAmbosTipos)) {
      expect(g.classificacao, `grupo ${g.id}`).toBe("RESULTADO_FINANCEIRO");
    }
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
