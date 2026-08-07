/**
 * Matriz única de permissões do sistema.
 *
 * Antes desta lib, cada rota repetia à mão o seu próprio `if (user.role === "OPERADOR")`.
 * Isso já causou um bug real em produção: o commit `ef0177a` protegeu o DELETE de
 * faturamento na rota `[id]` e esqueceu a rota antiga por querystring, que ficou aberta.
 * Com a matriz centralizada, "esquecer o guard" passa a ser visível e testável.
 */

export type Papel = "ADMIN" | "GESTOR" | "OPERADOR";

export const ACOES = [
  "lancamento:criar",
  "lancamento:editar",
  "lancamento:excluir",
  "faturamento:criar",
  "faturamento:editar",
  "faturamento:excluir",
  "folha:editar",
  "funcionario:criar",
  "funcionario:editar",
  "meta:configurar",
  "usuario:gerenciar",
  "base:limpar",
  "auditoria:ler",
] as const;

export type Acao = (typeof ACOES)[number];

/**
 * Map em vez de objeto literal de propósito: com um objeto, `PERMISSOES["__proto__"]`
 * devolveria `Object.prototype` (truthy, sem `.includes`) e o lookup estouraria um
 * TypeError em vez de simplesmente negar o acesso.
 */
const PERMISSOES = new Map<Papel, readonly Acao[]>([
  // ADMIN faz tudo, incluindo gerenciar usuários, limpar a base e ler a auditoria.
  ["ADMIN", ACOES],

  // GESTOR opera o financeiro por completo, mas não administra o sistema:
  // não cria/edita usuários, não limpa a base e não lê a trilha de auditoria.
  [
    "GESTOR",
    [
      "lancamento:criar",
      "lancamento:editar",
      "lancamento:excluir",
      "faturamento:criar",
      "faturamento:editar",
      "faturamento:excluir",
      "folha:editar",
      "funcionario:criar",
      "funcionario:editar",
      "meta:configurar",
    ],
  ],

  // OPERADOR só corrige lançamentos existentes — não cria nem exclui.
  // Decisão deliberada de produto do commit `78387d7` (2026-05-27): não "consertar"
  // isso adicionando um bloqueio de edição, já foi tratado como bug uma vez por engano.
  ["OPERADOR", ["lancamento:editar"]],
]);

/**
 * Fail-closed: papel ausente, vazio ou desconhecido (token antigo, papel removido
 * do enum, valor adulterado) nunca recebe permissão.
 */
export function podeExecutar(papel: string | null | undefined, acao: Acao): boolean {
  if (!papel) return false;
  const permitidas = PERMISSOES.get(papel as Papel);
  if (!permitidas) return false;
  return permitidas.includes(acao);
}

export function ehAdmin(papel: string | null | undefined): boolean {
  return papel === "ADMIN";
}

/** Usado só nos testes, para garantir que a matriz cobre todos os papéis do enum. */
export const PAPEIS: readonly Papel[] = ["ADMIN", "GESTOR", "OPERADOR"];
