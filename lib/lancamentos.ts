import { getGrupoById } from "@/lib/categorias";

/**
 * Deriva o tipo (ENTRADA/SAIDA) de um lançamento a partir do grupo, ignorando o que
 * o cliente mandou — exceto nos grupos marcados com `permiteAmbosTipos` (hoje só o
 * Grupo 13, Receitas/Despesas Financeiras, onde "Juros Recebidos" e "Juros Pagos"
 * convivem legitimamente).
 *
 * Retorna `null` quando o grupo não existe ou quando um grupo de tipo livre recebeu
 * um tipo inválido — nesse caso a rota devolve 400 em vez de gravar dado torto.
 *
 * Este arquivo existe porque a função estava duplicada em `app/api/lancamentos/route.ts`
 * e em `app/api/lancamentos/[id]/route.ts`: duas cópias da regra que gerou o bug crítico
 * de sinal invertido no fluxo de caixa. Agora é uma só, e coberta por testes.
 */
export function resolverTipoLancamento(
  grupoId: number,
  tipoRecebido: unknown
): "ENTRADA" | "SAIDA" | null {
  const grupo = getGrupoById(grupoId);
  if (!grupo) return null;
  if (!grupo.permiteAmbosTipos) return grupo.tipo;
  return tipoRecebido === "ENTRADA" || tipoRecebido === "SAIDA" ? tipoRecebido : null;
}
