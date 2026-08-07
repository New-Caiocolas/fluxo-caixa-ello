import { describe, expect, it } from "vitest";
import { ACOES, PAPEIS, type Acao, type Papel, ehAdmin, podeExecutar } from "@/lib/permissoes";

/**
 * Matriz completa escrita à mão de propósito: se alguém mudar a matriz da lib, este
 * arquivo precisa mudar junto — é a decisão de negócio ficando explícita, não um espelho
 * da implementação. Cada `true`/`false` aqui é uma regra que o Grupo Ello combinou.
 */
const MATRIZ_ESPERADA: Record<Papel, Record<Acao, boolean>> = {
  ADMIN: {
    "lancamento:criar": true,
    "lancamento:editar": true,
    "lancamento:excluir": true,
    "faturamento:criar": true,
    "faturamento:editar": true,
    "faturamento:excluir": true,
    "folha:editar": true,
    "funcionario:criar": true,
    "funcionario:editar": true,
    "meta:configurar": true,
    "usuario:gerenciar": true,
    "base:limpar": true,
    "auditoria:ler": true,
  },
  GESTOR: {
    "lancamento:criar": true,
    "lancamento:editar": true,
    "lancamento:excluir": true,
    "faturamento:criar": true,
    "faturamento:editar": true,
    "faturamento:excluir": true,
    "folha:editar": true,
    "funcionario:criar": true,
    "funcionario:editar": true,
    "meta:configurar": true,
    "usuario:gerenciar": false,
    "base:limpar": false,
    "auditoria:ler": false,
  },
  OPERADOR: {
    "lancamento:criar": false,
    "lancamento:editar": true,
    "lancamento:excluir": false,
    "faturamento:criar": false,
    "faturamento:editar": false,
    "faturamento:excluir": false,
    "folha:editar": false,
    "funcionario:criar": false,
    "funcionario:editar": false,
    "meta:configurar": false,
    "usuario:gerenciar": false,
    "base:limpar": false,
    "auditoria:ler": false,
  },
};

describe("matriz de permissões", () => {
  for (const papel of PAPEIS) {
    for (const acao of ACOES) {
      const esperado = MATRIZ_ESPERADA[papel][acao];
      it(`${papel} ${esperado ? "PODE" : "NÃO pode"} ${acao}`, () => {
        expect(podeExecutar(papel, acao)).toBe(esperado);
      });
    }
  }

  it("cobre todas as ações declaradas, sem furo na tabela de teste", () => {
    for (const papel of PAPEIS) {
      expect(Object.keys(MATRIZ_ESPERADA[papel]).sort()).toEqual([...ACOES].sort());
    }
  });
});

describe("regras de negócio específicas", () => {
  /** Decisão do commit 78387d7 (2026-05-27) — já foi revertida por engano uma vez. */
  it("OPERADOR edita lançamento, mas não cria nem exclui", () => {
    expect(podeExecutar("OPERADOR", "lancamento:editar")).toBe(true);
    expect(podeExecutar("OPERADOR", "lancamento:criar")).toBe(false);
    expect(podeExecutar("OPERADOR", "lancamento:excluir")).toBe(false);
  });

  it("só ADMIN limpa a base e lê a auditoria", () => {
    const podemLimpar = PAPEIS.filter((p) => podeExecutar(p, "base:limpar"));
    const podemLerAuditoria = PAPEIS.filter((p) => podeExecutar(p, "auditoria:ler"));
    expect(podemLimpar).toEqual(["ADMIN"]);
    expect(podemLerAuditoria).toEqual(["ADMIN"]);
  });

  it("só ADMIN gerencia usuários", () => {
    expect(PAPEIS.filter((p) => podeExecutar(p, "usuario:gerenciar"))).toEqual(["ADMIN"]);
  });
});

describe("fail-closed", () => {
  const entradasInvalidas = [
    null,
    undefined,
    "",
    "admin",
    "Admin",
    "ADMINISTRADOR",
    "SUPERADMIN",
    "GESTOR ",
    // Chaves que quebrariam um lookup em objeto literal em vez de negar o acesso.
    "__proto__",
    "constructor",
    "toString",
    "hasOwnProperty",
  ];

  for (const papel of entradasInvalidas) {
    it(`nega tudo para papel ${JSON.stringify(papel)}`, () => {
      for (const acao of ACOES) {
        expect(podeExecutar(papel, acao)).toBe(false);
      }
    });
  }
});

describe("ehAdmin", () => {
  it("aceita apenas o valor exato ADMIN", () => {
    expect(ehAdmin("ADMIN")).toBe(true);
    expect(ehAdmin("GESTOR")).toBe(false);
    expect(ehAdmin("OPERADOR")).toBe(false);
    expect(ehAdmin("admin")).toBe(false);
    expect(ehAdmin(null)).toBe(false);
    expect(ehAdmin(undefined)).toBe(false);
  });
});
