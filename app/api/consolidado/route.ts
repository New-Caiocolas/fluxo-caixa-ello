import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { calcularFluxoOperacional, calcularFluxoLivre } from "@/lib/utils";

function toNum(d: unknown): number {
  return d ? Number(d) : 0;
}

interface MesConsolidado {
  competencia: string;
  totalEntradas: number;
  totalSaidas: number;
  fluxoOperacional: number;
  fluxoLivre: number;
  percentFluxoLivre: number;
  porGrupo: Record<number, number>;
}

/**
 * GET /api/consolidado?filialId=...&ano=YYYY
 *
 * Retorna os 12 meses do ano de uma vez, com totais por grupo, fluxo
 * operacional e livre. Substitui as 12 chamadas paralelas a /api/saldos
 * que o consolidado/page.tsx fazia antes.
 */
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filialId = searchParams.get("filialId") || "";
  const ano = Number(searchParams.get("ano") || new Date().getFullYear());

  // Determina quais filiais consultar
  let filialIds: string[];
  if (filialId) {
    filialIds = [filialId];
  } else {
    const todasFiliais = await prisma.filial.findMany({ where: { ativa: true }, select: { id: true } });
    filialIds = todasFiliais.map((f) => f.id);
  }

  // Busca TODOS os lançamentos do ano de uma vez
  const competencias = Array.from({ length: 12 }, (_, i) =>
    `${ano}-${String(i + 1).padStart(2, "0")}`
  );

  const lancamentos = await prisma.lancamento.findMany({
    where: {
      filialId: { in: filialIds },
      competencia: { in: competencias },
    },
    include: { grupo: true },
    orderBy: { data: "asc" },
  });

  // Agrupa lançamentos por competência
  const lancamentosPorMes: Record<string, typeof lancamentos> = {};
  for (const comp of competencias) {
    lancamentosPorMes[comp] = [];
  }
  for (const l of lancamentos) {
    lancamentosPorMes[l.competencia]?.push(l);
  }

  // Processa cada mês
  const meses: MesConsolidado[] = competencias.map((comp) => {
    const lancsMes = lancamentosPorMes[comp] || [];

    const porGrupo: Record<number, number> = {};
    let grupo13Entrada = 0;
    let grupo13Saida = 0;

    for (const l of lancsMes) {
      const valor = toNum(l.valor);
      porGrupo[l.grupoId] = (porGrupo[l.grupoId] || 0) + valor;

      if (l.grupoId === 13) {
        if (l.tipo === "ENTRADA") grupo13Entrada += valor;
        else grupo13Saida += valor;
      }
    }

    const totalEntradas = porGrupo[1] || 0;
    const totalSaidas = Object.entries(porGrupo)
      .filter(([g]) => Number(g) !== 1)
      .reduce((a, [, v]) => a + v, 0);

    const totalPorGrupo: Record<number, number> = {};
    for (const gId of [4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      totalPorGrupo[gId] = porGrupo[gId] || 0;
    }

    const fluxoOperacional = calcularFluxoOperacional(totalEntradas, totalPorGrupo);
    const investimentos = porGrupo[14] || 0;
    const fluxoLivre = calcularFluxoLivre(fluxoOperacional, grupo13Entrada - grupo13Saida, investimentos);

    return {
      competencia: comp,
      totalEntradas,
      totalSaidas,
      fluxoOperacional,
      fluxoLivre,
      percentFluxoLivre: totalEntradas > 0 ? (fluxoLivre / totalEntradas) * 100 : 0,
      porGrupo,
    };
  });

  return NextResponse.json(meses);
}
