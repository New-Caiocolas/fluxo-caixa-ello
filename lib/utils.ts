import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function getCompetencia(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function getDiasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

export function competenciaToLabel(competencia: string): string {
  const [ano, mes] = competencia.split("-");
  const meses = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  return `${meses[parseInt(mes) - 1]}/${ano}`;
}

export function mesNome(mes: number): string {
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return meses[mes - 1];
}

// Metas padrão usadas como fallback quando a filial não tem meta configurada
// (ou na visão consolidada "todas as filiais", onde não existe um único valor válido).
export const META_PADRAO = {
  FLUXO_LIVRE: 25,
  CUSTO_DIRETO: 50,
} as const;

import type { Classificacao } from "@/lib/categorias";

/** O mínimo que o cálculo precisa saber de um grupo. */
export interface GrupoClassificado {
  id: number;
  classificacao: Classificacao;
}

/**
 * Totais de um grupo separados por direção.
 *
 * Guardar entrada e saída em vez de um único total é o que permite tratar
 * grupos com as duas direções (RESULTADO_FINANCEIRO, onde juros recebidos e
 * juros pagos convivem) sem perder o sinal.
 */
export interface TotaisGrupo {
  entrada: number;
  saida: number;
}

export type TotaisPorGrupo = Record<number, TotaisGrupo>;

export interface Indicadores {
  recebimento: number;
  custos: number;
  fluxoOperacional: number;
  resultadoFinanceiro: number;
  investimento: number;
  fluxoLivre: number;
}

function somar(
  grupos: GrupoClassificado[],
  totais: TotaisPorGrupo,
  classificacao: Classificacao,
  /** Direção "natural" do balde: entradas somam ou saídas somam. */
  sinal: "entrada" | "saida"
): number {
  return grupos
    .filter((g) => g.classificacao === classificacao)
    .reduce((acc, g) => {
      const t = totais[g.id];
      if (!t) return acc;
      return acc + (sinal === "entrada" ? t.entrada - t.saida : t.saida - t.entrada);
    }, 0);
}

/**
 * Indicadores de fluxo de caixa, derivados da classificação de cada grupo.
 *
 * Antes, as listas de grupos viviam hardcoded aqui ([4..12] como custo, 13 e 14
 * à parte). Com grupos criados pelo usuário isso não se sustenta: um grupo novo
 * ficaria fora de toda conta e seus lançamentos sumiriam do relatório sem erro
 * algum. Agora quem decide é o campo `classificacao` do próprio grupo.
 *
 * Grupos NEUTRO ficam de fora de propósito — é a única forma de registrar
 * movimento sem afetar indicador, e exige escolha explícita de quem cria.
 */
export function calcularIndicadores(
  grupos: GrupoClassificado[],
  totais: TotaisPorGrupo
): Indicadores {
  const recebimento = somar(grupos, totais, "RECEBIMENTO", "entrada");
  const custos = somar(grupos, totais, "CUSTO_OPERACIONAL", "saida");
  const resultadoFinanceiro = somar(grupos, totais, "RESULTADO_FINANCEIRO", "entrada");
  const investimento = somar(grupos, totais, "INVESTIMENTO", "saida");

  const fluxoOperacional = recebimento - custos;
  const fluxoLivre = fluxoOperacional + resultadoFinanceiro - investimento;

  return {
    recebimento,
    custos,
    fluxoOperacional,
    resultadoFinanceiro,
    investimento,
    fluxoLivre,
  };
}

/** Agrupa lançamentos em totais por grupo e direção. */
export function totalizarLancamentos(
  lancamentos: { grupoId: number; tipo: string; valor: number }[]
): TotaisPorGrupo {
  const totais: TotaisPorGrupo = {};
  for (const l of lancamentos) {
    const t = (totais[l.grupoId] ??= { entrada: 0, saida: 0 });
    if (l.tipo === "ENTRADA") t.entrada += l.valor;
    else t.saida += l.valor;
  }
  return totais;
}
