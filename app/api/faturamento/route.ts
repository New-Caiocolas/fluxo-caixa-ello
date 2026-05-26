import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
function toNum(d: unknown): number {
  return d ? Number(d) : 0;
}

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filialId = searchParams.get("filialId");
  const ano = searchParams.get("ano") || String(new Date().getFullYear());

  const competencias = Array.from({ length: 12 }, (_, i) =>
    `${ano}-${String(i + 1).padStart(2, "0")}`
  );

  const faturamentoWhere: Record<string, unknown> = { competencia: { in: competencias } };
  if (filialId) faturamentoWhere.filialId = filialId;

  const faturamentos = await prisma.faturamento.findMany({
    where: faturamentoWhere,
    include: { filial: true },
    orderBy: [{ competencia: "asc" }],
  });

  // Recebimentos por competência
  const recebimentoWhere: Record<string, unknown> = {
    competencia: { in: competencias },
    grupoId: 1,
    tipo: "ENTRADA",
  };
  if (filialId) recebimentoWhere.filialId = filialId;

  const recebimentos = await prisma.lancamento.groupBy({
    by: ["competencia"],
    where: recebimentoWhere,
    _sum: { valor: true },
  });

  // Custos diretos por competência
  const custosWhere: Record<string, unknown> = {
    competencia: { in: competencias },
    grupoId: 4,
    tipo: "SAIDA",
  };
  if (filialId) custosWhere.filialId = filialId;

  const custos = await prisma.lancamento.groupBy({
    by: ["competencia"],
    where: custosWhere,
    _sum: { valor: true },
  });

  const recMap: Record<string, number> = {};
  for (const r of recebimentos) {
    recMap[r.competencia] = toNum(r._sum.valor);
  }

  const custMap: Record<string, number> = {};
  for (const c of custos) {
    custMap[c.competencia] = toNum(c._sum.valor);
  }

  const fatMap: Record<string, number> = {};
  for (const f of faturamentos) {
    fatMap[f.competencia] = (fatMap[f.competencia] || 0) + toNum(f.valorNF);
  }

  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const comparativo = competencias.map((comp, i) => {
    const faturado = fatMap[comp] || 0;
    const recebido = recMap[comp] || 0;
    const custoDireto = custMap[comp] || 0;
    const inadimplencia = faturado - recebido;
    const margemContribuicao = recebido - custoDireto;
    const percentMargem = recebido > 0 ? (margemContribuicao / recebido) * 100 : 0;
    const percentInadimplencia = faturado > 0 ? (inadimplencia / faturado) * 100 : 0;

    return {
      mes: meses[i],
      competencia: comp,
      faturado,
      recebido,
      custoDireto,
      inadimplencia,
      margemContribuicao,
      percentMargem,
      percentInadimplencia,
    };
  });

  return NextResponse.json({ comparativo, faturamentos });
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (user.role === "OPERADOR") return NextResponse.json({ error: "Sem permissão para lançar faturamento" }, { status: 403 });

  const { filialId, competencia, valorNF, descricao } = await req.json();

  const faturamento = await prisma.faturamento.create({
    data: { filialId, competencia, valorNF, descricao },
    include: { filial: true },
  });

  return NextResponse.json(faturamento, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  await prisma.faturamento.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
