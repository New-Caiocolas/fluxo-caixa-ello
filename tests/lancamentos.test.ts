import { describe, expect, it } from "vitest";
import { resolverTipoLancamento } from "@/lib/lancamentos";

/**
 * Regressão do bug crítico nº 2 (corrigido em 2026-08-03): o `tipo` do lançamento vinha
 * do cliente e era gravado sem validação, então um POST feito à mão podia registrar um
 * recebimento como saída (e inverter o fluxo de caixa da filial).
 */
describe("resolverTipoLancamento", () => {
  it("força ENTRADA no Grupo 1, mesmo se o cliente mandar SAIDA", () => {
    expect(resolverTipoLancamento(1, "SAIDA")).toBe("ENTRADA");
    expect(resolverTipoLancamento(1, "ENTRADA")).toBe("ENTRADA");
    expect(resolverTipoLancamento(1, undefined)).toBe("ENTRADA");
  });

  it("força SAIDA nos grupos de custo, mesmo se o cliente mandar ENTRADA", () => {
    for (const grupoId of [4, 5, 6, 7, 8, 9, 10, 11, 12, 14]) {
      expect(resolverTipoLancamento(grupoId, "ENTRADA")).toBe("SAIDA");
    }
  });

  it("respeita a escolha do usuário no Grupo 13, que tem os dois sentidos", () => {
    // "Juros Recebidos" é entrada, "Juros Pagos" é saída — ambos no mesmo grupo.
    expect(resolverTipoLancamento(13, "ENTRADA")).toBe("ENTRADA");
    expect(resolverTipoLancamento(13, "SAIDA")).toBe("SAIDA");
  });

  it("rejeita o Grupo 13 sem tipo explícito ou com tipo inválido", () => {
    expect(resolverTipoLancamento(13, undefined)).toBeNull();
    expect(resolverTipoLancamento(13, null)).toBeNull();
    expect(resolverTipoLancamento(13, "")).toBeNull();
    expect(resolverTipoLancamento(13, "entrada")).toBeNull(); // minúsculo não passa
    expect(resolverTipoLancamento(13, "QUALQUER_COISA")).toBeNull();
    expect(resolverTipoLancamento(13, 1)).toBeNull();
    expect(resolverTipoLancamento(13, { tipo: "ENTRADA" })).toBeNull();
  });

  it("rejeita grupo inexistente em vez de assumir um tipo", () => {
    expect(resolverTipoLancamento(999, "ENTRADA")).toBeNull();
    expect(resolverTipoLancamento(0, "SAIDA")).toBeNull();
    expect(resolverTipoLancamento(NaN, "SAIDA")).toBeNull();
  });
});
