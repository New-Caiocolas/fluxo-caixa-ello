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
  const competencia = searchParams.get("competencia");

  if (!filialId || !competencia) {
    return NextResponse.json({ error: "filialId e competencia são obrigatórios" }, { status: 400 });
  }

  const saldos = await prisma.saldo.findMany({
    where: { filialId, competencia },
    orderBy: { data: "asc" },
  });

  return NextResponse.json(saldos);
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { filialId, data, saldoInicial } = await req.json();
  const dataObj = new Date(data);
  const ano = dataObj.getUTCFullYear();
  const mes = String(dataObj.getUTCMonth() + 1).padStart(2, "0");
  const competencia = `${ano}-${mes}`;

  const saldo = await prisma.saldo.upsert({
    where: { filialId_data: { filialId, data: dataObj } },
    create: { filialId, data: dataObj, saldoInicial, competencia },
    update: { saldoInicial },
  });

  return NextResponse.json(saldo);
}

// Endpoint para calcular e retornar visão mensal completa
export async function PUT(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filialId = searchParams.get("filialId") || "";
  const competencia = searchParams.get("competencia");

  if (!competencia) {
    return NextResponse.json({ error: "competencia é obrigatória" }, { status: 400 });
  }

  const [ano, mes] = competencia.split("-").map(Number);
  const diasNoMes = new Date(ano, mes, 0).getDate();

  // Determina quais filiais consultar
  let filialIds: string[];
  if (filialId) {
    filialIds = [filialId];
  } else {
    const todasFiliais = await prisma.filial.findMany({ where: { ativa: true }, select: { id: true } });
    filialIds = todasFiliais.map((f) => f.id);
  }

  // Busca todos os lançamentos do mês
  const lancamentos = await prisma.lancamento.findMany({
    where: { filialId: { in: filialIds }, competencia },
    include: { grupo: true, subgrupo: true },
    orderBy: { data: "asc" },
  });

  // Busca e soma saldo inicial de cada filial
  const primeirosSaldos = await Promise.all(
    filialIds.map((fId) =>
      prisma.saldo.findFirst({
        where: { filialId: fId, competencia },
        orderBy: { data: "asc" },
      })
    )
  );
  const saldoInicialMes = primeirosSaldos.reduce((sum, s) => sum + toNum(s?.saldoInicial), 0);

  // Agrupa por grupo/subgrupo e por dia
  const gruposMap: Record<number, {
    nome: string;
    tipo: string;
    subgrupos: Record<string, { nome: string; porDia: Record<number, number>; total: number }>;
    porDia: Record<number, number>;
    total: number;
  }> = {};

  for (const l of lancamentos) {
    const dia = new Date(l.data).getUTCDate();
    const valor = toNum(l.valor);

    if (!gruposMap[l.grupoId]) {
      gruposMap[l.grupoId] = {
        nome: l.grupo.nome,
        tipo: l.grupo.tipo,
        subgrupos: {},
        porDia: {},
        total: 0,
      };
    }

    const g = gruposMap[l.grupoId];
    g.porDia[dia] = (g.porDia[dia] || 0) + valor;
    g.total += valor;

    if (l.subgrupoId) {
      if (!g.subgrupos[l.subgrupoId]) {
        g.subgrupos[l.subgrupoId] = {
          nome: l.subgrupo?.nome || "",
          porDia: {},
          total: 0,
        };
      }
      const s = g.subgrupos[l.subgrupoId];
      s.porDia[dia] = (s.porDia[dia] || 0) + valor;
      s.total += valor;
    }
  }

  const totalRecebimento = gruposMap[1]?.total || 0;

  // Calcula saldo dia a dia
  let saldoCorrente = saldoInicialMes;
  const saldoPorDia: Record<number, { inicial: number; final: number }> = {};

  for (let d = 1; d <= diasNoMes; d++) {
    const entradasDia = gruposMap[1]?.porDia[d] || 0;
    const saidasDia = Object.entries(gruposMap)
      .filter(([gId]) => Number(gId) !== 1)
      .reduce((acc, [, g]) => acc + (g.porDia[d] || 0), 0);

    saldoPorDia[d] = { inicial: saldoCorrente, final: saldoCorrente + entradasDia - saidasDia };
    saldoCorrente = saldoPorDia[d].final;
  }

  const custosOp = [4, 5, 6, 7, 8, 9, 10, 11, 12].reduce(
    (acc, g) => acc + (gruposMap[g]?.total || 0), 0
  );
  const fluxoOperacional = totalRecebimento - custosOp;
  const fluxoFinanceiro = gruposMap[13]?.total || 0;
  const investimentos = gruposMap[14]?.total || 0;
  const fluxoLivre = fluxoOperacional + fluxoFinanceiro - investimentos;

  return NextResponse.json({
    competencia,
    filialId: filialId || null,
    diasNoMes,
    saldoInicialMes,
    saldoFinalMes: saldoCorrente,
    totalRecebimento,
    fluxoOperacional,
    fluxoLivre,
    saldoPorDia,
    grupos: gruposMap,
  });
}
