/**
 * Cálculo da folha de pagamento.
 *
 * Extraído de `app/api/folha/route.ts` para poder ser testado: era a maior conta de
 * dinheiro do sistema sem nenhuma cobertura. O comportamento é idêntico ao anterior,
 * inclusive o DSR simplificado — se as alíquotas ou a regra do DSR mudarem, mude aqui
 * e os testes em `tests/folha.test.ts` apontam o impacto.
 */

/** Alíquotas patronais aplicadas sobre o total bruto. */
export const ALIQUOTAS = {
  INSS_PATRONAL: 0.2,
  ENTIDADES: 0.058,
  FGTS: 0.085,
} as const;

/** DSR simplificado: 4 dias sobre a base de 30 (~13,33% da base). */
export const DSR_DIAS = 4;
export const DSR_BASE_DIAS = 30;

export interface ResultadoFolha {
  trienio: number;
  dsr: number;
  totalBruto: number;
  inssPatronal: number;
  entidades: number;
  fgts: number;
  totalEncargos: number;
  totalPagar: number;
}

/**
 * @param salarioBase salário base do funcionário
 * @param trienioPerc percentual de triênio (0,03 = 3%), multiplicado pelo salário base
 * @param comissao comissão do mês
 */
export function calcularFolha(
  salarioBase: number,
  trienioPerc: number,
  comissao: number
): ResultadoFolha {
  const trienio = salarioBase * trienioPerc;
  const baseComDSR = salarioBase + comissao + trienio;
  const dsr = (baseComDSR / DSR_BASE_DIAS) * DSR_DIAS;
  const totalBruto = baseComDSR + dsr;

  const inssPatronal = totalBruto * ALIQUOTAS.INSS_PATRONAL;
  const entidades = totalBruto * ALIQUOTAS.ENTIDADES;
  const fgts = totalBruto * ALIQUOTAS.FGTS;
  const totalEncargos = inssPatronal + entidades + fgts;
  const totalPagar = totalBruto + totalEncargos;

  return { trienio, dsr, totalBruto, inssPatronal, entidades, fgts, totalEncargos, totalPagar };
}
