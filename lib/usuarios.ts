/**
 * Invariante: o sistema precisa ter sempre pelo menos um ADMIN.
 *
 * Sem isso, um ADMIN que se rebaixa a OPERADOR deixa a base sem ninguém capaz
 * de gerenciar usuários, limpar a base ou promover alguém de volta — e como a
 * própria promoção exige ser ADMIN, não há saída pela aplicação. A recuperação
 * só seria possível com acesso direto ao banco.
 *
 * A regra vale para quem executa a ação e para terceiros: rebaixar *qualquer*
 * último ADMIN produz o mesmo resultado. Por isso a checagem é sobre o alvo da
 * operação, não sobre "é você mesmo?".
 */

export const PAPEL_ADMIN = "ADMIN";

/**
 * Diz se a operação deixaria o sistema sem nenhum ADMIN.
 *
 * @param alvoEhAdmin  Se o usuário afetado é ADMIN hoje.
 * @param papelNovo    Papel após a operação, ou `null` quando é exclusão.
 * @param totalAdmins  Quantos ADMINs existem agora, incluindo o alvo.
 */
export function deixariaSemAdmin({
  alvoEhAdmin,
  papelNovo,
  totalAdmins,
}: {
  alvoEhAdmin: boolean;
  papelNovo: string | null;
  totalAdmins: number;
}): boolean {
  // Mexer em quem não é ADMIN nunca altera a contagem de ADMINs.
  if (!alvoEhAdmin) return false;

  // Continua ADMIN depois da edição — a contagem não muda.
  if (papelNovo === PAPEL_ADMIN) return false;

  // Era ADMIN e deixa de ser (rebaixado ou excluído): só é seguro se houver outro.
  return totalAdmins <= 1;
}
