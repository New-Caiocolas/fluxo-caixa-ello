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

export function calcularFluxoOperacional(
  totalEntradas: number,
  totalPorGrupo: Record<number, number>
): number {
  const custos = [4, 5, 6, 7, 8, 9, 10, 11, 12].reduce(
    (acc, g) => acc + (totalPorGrupo[g] || 0),
    0
  );
  return totalEntradas - custos;
}

export function calcularFluxoLivre(
  fluxoOperacional: number,
  totalGrupo13: number,
  totalGrupo14: number
): number {
  return fluxoOperacional + totalGrupo13 - totalGrupo14;
}
