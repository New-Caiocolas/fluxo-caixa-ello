import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { calcularIndicadores, totalizarLancamentos } from "@/lib/utils";

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
    for (const l of lancsMes) {
      porGrupo[l.grupoId] = (porGrupo[l.grupoId] || 0) + toNum(l.valor);
    }

    // A classificação de cada grupo é quem decide o balde — grupo criado pelo
    // usuário entra na conta sem alteração de código.
    const grupos = [
      ...new Map(
        lancsMes.map((l) => [l.grupoId, { id: l.grupoId, classificacao: l.grupo.classificacao }])
      ).values(),
    ];
    const totais = totalizarLancamentos(
      lancsMes.map((l) => ({ grupoId: l.grupoId, tipo: l.tipo, valor: toNum(l.valor) }))
    );
    const { recebimento, fluxoOperacional, fluxoLivre } = calcularIndicadores(grupos, totais);

    const totalEntradas = recebimento;
    const idsRecebimento = new Set(
      grupos.filter((g) => g.classificacao === "RECEBIMENTO").map((g) => g.id)
    );
    const totalSaidas = Object.entries(porGrupo)
      .filter(([g]) => !idsRecebimento.has(Number(g)))
      .reduce((a, [, v]) => a + v, 0);

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
