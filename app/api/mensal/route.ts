import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { calcularIndicadores, totalizarLancamentos } from "@/lib/utils";

function toNum(d: unknown): number {
  return d ? Number(d) : 0;
}

/**
 * GET /api/mensal?filialId=...&competencia=YYYY-MM
 *
 * Calcula e retorna a visão mensal completa: lançamentos agrupados por
 * grupo/subgrupo e dia, saldos diários, fluxo operacional e livre.
 *
 * Extraído do antigo PUT /api/saldos para corrigir a semântica REST
 * (leitura de dados deve usar GET).
 */
export async function GET(req: NextRequest) {
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

  // Movimento diário correto por tipo real do lançamento — não por grupo. Isso importa
  // especialmente para o Grupo 13 (Receitas/Despesas Financeiras), que mistura entrada
  // e saída: um "Juros Recebidos" precisa aumentar o saldo do dia, não reduzir.
  const diaEntradas: Record<number, number> = {};
  const diaSaidas: Record<number, number> = {};

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

    if (l.tipo === "ENTRADA") {
      diaEntradas[dia] = (diaEntradas[dia] || 0) + valor;
    } else {
      diaSaidas[dia] = (diaSaidas[dia] || 0) + valor;
    }
  }

  const totalRecebimento = gruposMap[1]?.total || 0;

  // Calcula saldo dia a dia
  let saldoCorrente = saldoInicialMes;
  const saldoPorDia: Record<number, { inicial: number; final: number }> = {};

  for (let d = 1; d <= diasNoMes; d++) {
    const entradasDia = diaEntradas[d] || 0;
    const saidasDia = diaSaidas[d] || 0;

    saldoPorDia[d] = { inicial: saldoCorrente, final: saldoCorrente + entradasDia - saidasDia };
    saldoCorrente = saldoPorDia[d].final;
  }

  // Fluxo Operacional/Livre pela mesma fórmula centralizada usada em /api/dfc e /api/dashboard.
  // A classificação vem do próprio grupo, então grupo criado pelo usuário entra na
  // conta sozinho. Derivada dos lançamentos: grupo sem lançamento contribui zero.
  const grupos = [
    ...new Map(
      lancamentos.map((l) => [l.grupoId, { id: l.grupoId, classificacao: l.grupo.classificacao }])
    ).values(),
  ];
  const totais = totalizarLancamentos(
    lancamentos.map((l) => ({ grupoId: l.grupoId, tipo: l.tipo, valor: toNum(l.valor) }))
  );
  const { fluxoOperacional, fluxoLivre } = calcularIndicadores(grupos, totais);

  // Persiste o saldo diário calculado. Só faz sentido por filial — a visão "todas as
  // filiais" soma vários filialIds num único número, que não corresponde a nenhuma linha
  // real de Saldo.
  if (filialId) {
    try {
      const upserts = [];
      for (let d = 1; d <= diasNoMes; d++) {
        const dataDia = new Date(Date.UTC(ano, mes - 1, d));
        const { inicial, final } = saldoPorDia[d];
        upserts.push(
          prisma.saldo.upsert({
            where: { filialId_data: { filialId, data: dataDia } },
            create: {
              filialId,
              data: dataDia,
              competencia,
              saldoInicial: inicial,
              saldoFinal: final,
              totalEntradas: diaEntradas[d] || 0,
              totalSaidas: diaSaidas[d] || 0,
            },
            update: {
              saldoInicial: inicial,
              saldoFinal: final,
              totalEntradas: diaEntradas[d] || 0,
              totalSaidas: diaSaidas[d] || 0,
            },
          })
        );
      }
      await prisma.$transaction(upserts);
    } catch (error) {
      // Não deixa uma falha ao persistir o cache derrubar a visão mensal, que já
      // tem os números corretos calculados em memória a partir dos lançamentos.
      console.error("Falha ao persistir saldo diário:", error);
    }
  }

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
