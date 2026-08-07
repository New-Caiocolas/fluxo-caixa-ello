import { describe, expect, it } from "vitest";
import { resolverTipoLancamento, type GrupoParaTipo } from "@/lib/lancamentos";

/** Grupo de direção única (a maioria) — o tipo vem do grupo, não do cliente. */
const entrada: GrupoParaTipo = { tipo: "ENTRADA", permiteAmbosTipos: false };
const saida: GrupoParaTipo = { tipo: "SAIDA", permiteAmbosTipos: false };
/** Grupo com as duas direções (hoje o 13) — o usuário escolhe. */
const ambos: GrupoParaTipo = { tipo: "SAIDA", permiteAmbosTipos: true };

/**
 * Regressão do bug crítico nº 2 (corrigido em 2026-08-03): o `tipo` do lançamento vinha
 * do cliente e era gravado sem validação, então um POST feito à mão podia registrar um
 * recebimento como saída (e inverter o fluxo de caixa da filial).
 */
describe("resolverTipoLancamento", () => {
  it("força o tipo do grupo de entrada, mesmo se o cliente mandar SAIDA", () => {
    expect(resolverTipoLancamento(entrada, "SAIDA")).toBe("ENTRADA");
    expect(resolverTipoLancamento(entrada, "ENTRADA")).toBe("ENTRADA");
    expect(resolverTipoLancamento(entrada, undefined)).toBe("ENTRADA");
  });

  it("força o tipo do grupo de saída, mesmo se o cliente mandar ENTRADA", () => {
    expect(resolverTipoLancamento(saida, "ENTRADA")).toBe("SAIDA");
    expect(resolverTipoLancamento(saida, undefined)).toBe("SAIDA");
  });

  it("respeita a escolha do usuário em grupo com os dois sentidos", () => {
    // "Juros Recebidos" é entrada, "Juros Pagos" é saída — ambos no mesmo grupo.
    expect(resolverTipoLancamento(ambos, "ENTRADA")).toBe("ENTRADA");
    expect(resolverTipoLancamento(ambos, "SAIDA")).toBe("SAIDA");
  });

  it("rejeita grupo de tipo livre sem tipo explícito ou com tipo inválido", () => {
    expect(resolverTipoLancamento(ambos, undefined)).toBeNull();
    expect(resolverTipoLancamento(ambos, null)).toBeNull();
    expect(resolverTipoLancamento(ambos, "")).toBeNull();
    expect(resolverTipoLancamento(ambos, "entrada")).toBeNull(); // minúsculo não passa
    expect(resolverTipoLancamento(ambos, "QUALQUER_COISA")).toBeNull();
    expect(resolverTipoLancamento(ambos, 1)).toBeNull();
    expect(resolverTipoLancamento(ambos, { tipo: "ENTRADA" })).toBeNull();
  });

  it("rejeita grupo inexistente em vez de assumir um tipo", () => {
    // A rota passa o resultado de findUnique direto; grupo inexistente vira null.
    expect(resolverTipoLancamento(null, "ENTRADA")).toBeNull();
    expect(resolverTipoLancamento(undefined, "SAIDA")).toBeNull();
  });

  it("vale igual para grupo criado pelo usuário", () => {
    // Antes a função consultava o array estático e devolvia null para qualquer
    // grupo que só existisse no banco — o lançamento morria com 400.
    const novo: GrupoParaTipo = { tipo: "SAIDA", permiteAmbosTipos: false };
    expect(resolverTipoLancamento(novo, "ENTRADA")).toBe("SAIDA");
  });
});
