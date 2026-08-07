import { describe, expect, it } from "vitest";
import { validarGrupo, validarSubgrupo, CLASSIFICACOES } from "@/lib/grupos";

const base = {
  nome: "Novo Grupo",
  tipo: "SAIDA",
  classificacao: "CUSTO_OPERACIONAL",
};

const erro = (r: ReturnType<typeof validarGrupo>) => (r.ok ? null : r.erro);

describe("validarGrupo", () => {
  it("aceita um grupo coerente", () => {
    const r = validarGrupo(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dados.nome).toBe("Novo Grupo");
      expect(r.dados.classificacao).toBe("CUSTO_OPERACIONAL");
      expect(r.dados.ativo).toBe(true);
      expect(r.dados.permiteAmbosTipos).toBe(false);
    }
  });

  describe("coerência entre tipo e classificação", () => {
    /**
     * O erro mais caro que essa validação evita: um grupo de SAIDA classificado
     * como RECEBIMENTO somaria receita a cada despesa lançada, e isso apareceria
     * só como número errado no relatório — sem exceção, sem log.
     */
    it("recusa SAIDA classificado como RECEBIMENTO", () => {
      const r = validarGrupo({ ...base, tipo: "SAIDA", classificacao: "RECEBIMENTO" });
      expect(r.ok).toBe(false);
      expect(erro(r)).toContain("ENTRADA");
    });

    it("recusa ENTRADA classificado como CUSTO_OPERACIONAL", () => {
      const r = validarGrupo({ ...base, tipo: "ENTRADA", classificacao: "CUSTO_OPERACIONAL" });
      expect(r.ok).toBe(false);
    });

    it("recusa ENTRADA classificado como INVESTIMENTO", () => {
      const r = validarGrupo({ ...base, tipo: "ENTRADA", classificacao: "INVESTIMENTO" });
      expect(r.ok).toBe(false);
    });

    it("aceita as duas direções em RESULTADO_FINANCEIRO", () => {
      for (const tipo of ["ENTRADA", "SAIDA"]) {
        expect(validarGrupo({ ...base, tipo, classificacao: "RESULTADO_FINANCEIRO" }).ok).toBe(true);
      }
    });

    it("aceita as duas direções em NEUTRO", () => {
      for (const tipo of ["ENTRADA", "SAIDA"]) {
        expect(validarGrupo({ ...base, tipo, classificacao: "NEUTRO" }).ok).toBe(true);
      }
    });
  });

  describe("permiteAmbosTipos", () => {
    it("só é permitido em RESULTADO_FINANCEIRO", () => {
      const r = validarGrupo({ ...base, permiteAmbosTipos: true });
      expect(r.ok).toBe(false);
      expect(erro(r)).toContain("resultado financeiro");
    });

    it("é aceito em RESULTADO_FINANCEIRO", () => {
      const r = validarGrupo({
        ...base,
        classificacao: "RESULTADO_FINANCEIRO",
        permiteAmbosTipos: true,
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.dados.permiteAmbosTipos).toBe(true);
    });

    it("só true liga a flag — string 'true' não conta", () => {
      const r = validarGrupo({ ...base, classificacao: "RESULTADO_FINANCEIRO", permiteAmbosTipos: "true" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.dados.permiteAmbosTipos).toBe(false);
    });
  });

  describe("entradas inválidas", () => {
    it("exige nome", () => {
      expect(validarGrupo({ ...base, nome: "" }).ok).toBe(false);
      expect(validarGrupo({ ...base, nome: "   " }).ok).toBe(false);
      expect(validarGrupo({ ...base, nome: undefined }).ok).toBe(false);
      expect(validarGrupo({ ...base, nome: 42 }).ok).toBe(false);
    });

    it("limita o tamanho do nome", () => {
      expect(validarGrupo({ ...base, nome: "x".repeat(61) }).ok).toBe(false);
      expect(validarGrupo({ ...base, nome: "x".repeat(60) }).ok).toBe(true);
    });

    it("apara espaços do nome", () => {
      const r = validarGrupo({ ...base, nome: "  Fretes  " });
      if (r.ok) expect(r.dados.nome).toBe("Fretes");
    });

    it("recusa tipo fora do enum", () => {
      expect(validarGrupo({ ...base, tipo: "entrada" }).ok).toBe(false);
      expect(validarGrupo({ ...base, tipo: "OUTRO" }).ok).toBe(false);
      expect(validarGrupo({ ...base, tipo: undefined }).ok).toBe(false);
    });

    it("recusa classificação fora do enum", () => {
      expect(validarGrupo({ ...base, classificacao: "QUALQUER" }).ok).toBe(false);
      expect(validarGrupo({ ...base, classificacao: undefined }).ok).toBe(false);
    });

    it("não estoura com entrada nula ou não-objeto", () => {
      expect(validarGrupo(null).ok).toBe(false);
      expect(validarGrupo(undefined).ok).toBe(false);
      expect(validarGrupo("texto").ok).toBe(false);
    });
  });

  describe("ordem", () => {
    it("usa 999 quando ausente ou inválida", () => {
      for (const ordem of [undefined, "abc", -1, 0, NaN]) {
        const r = validarGrupo({ ...base, ordem });
        if (r.ok) expect(r.dados.ordem).toBe(999);
      }
    });

    it("aceita ordem positiva e trunca decimal", () => {
      const r = validarGrupo({ ...base, ordem: 7.9 });
      if (r.ok) expect(r.dados.ordem).toBe(7);
    });
  });

  it("toda classificação do enum é aceita com o tipo compatível", () => {
    for (const c of CLASSIFICACOES) {
      const tipo = c === "RECEBIMENTO" ? "ENTRADA" : "SAIDA";
      expect(validarGrupo({ ...base, tipo, classificacao: c }).ok, c).toBe(true);
    }
  });
});

describe("validarSubgrupo", () => {
  it("aceita nome válido", () => {
    const r = validarSubgrupo({ nome: "Marketing Digital" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dados.nome).toBe("Marketing Digital");
      expect(r.dados.ativo).toBe(true);
    }
  });

  it("exige nome", () => {
    expect(validarSubgrupo({ nome: "  " }).ok).toBe(false);
    expect(validarSubgrupo({}).ok).toBe(false);
    expect(validarSubgrupo(null).ok).toBe(false);
  });

  it("respeita ativo: false para desativação", () => {
    const r = validarSubgrupo({ nome: "Antigo", ativo: false });
    if (r.ok) expect(r.dados.ativo).toBe(false);
  });
});
