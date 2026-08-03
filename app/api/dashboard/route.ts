import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { calcularFluxoOperacional, calcularFluxoLivre } from "@/lib/utils";
function toNum(d: unknown): number {
  return d ? Number(d) : 0;
}

interface MesAcumulado {
  recebimento: number; // Grupo 1 — único grupo que define "Recebimento"
  porGrupo: Record<number, number>; // Grupos 4 a 12 (sempre SAÍDA)
  grupo13Entrada: number;
  grupo13Saida: number;
  grupo14: number; // Investimentos (sempre SAÍDA)
}

function novoMesAcumulado(): MesAcumulado {
  return { recebimento: 0, porGrupo: {}, grupo13Entrada: 0, grupo13Saida: 0, grupo14: 0 };
}

function acumular(mes: MesAcumulado, grupoId: number, valor: number, tipo: string) {
  if (grupoId === 1) {
    mes.recebimento += valor;
  } else if (grupoId === 13) {
    if (tipo === "ENTRADA") mes.grupo13Entrada += valor;
    else mes.grupo13Saida += valor;
  } else if (grupoId === 14) {
    mes.grupo14 += valor;
  } else {
    mes.porGrupo[grupoId] = (mes.porGrupo[grupoId] || 0) + valor;
  }
}

function custosOperacionais(mes: MesAcumulado): number {
  return [4, 5, 6, 7, 8, 9, 10, 11, 12].reduce((acc, g) => acc + (mes.porGrupo[g] || 0), 0);
}

function calcularFluxos(mes: MesAcumulado) {
  const fluxoOperacional = calcularFluxoOperacional(mes.recebimento, mes.porGrupo);
  const grupo13Liquido = mes.grupo13Entrada - mes.grupo13Saida;
  const fluxoLivre = calcularFluxoLivre(fluxoOperacional, grupo13Liquido, mes.grupo14);
  return { fluxoOperacional, fluxoLivre };
}

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filialId = searchParams.get("filialId");
  const ano = parseInt(searchParams.get("ano") || String(new Date().getFullYear()));

  const competencias: string[] = [];
  for (let m = 1; m <= 12; m++) {
    competencias.push(`${ano}-${String(m).padStart(2, "0")}`);
  }

  const where: Record<string, unknown> = { competencia: { in: competencias } };
  if (filialId) where.filialId = filialId;

  const lancamentos = await prisma.lancamento.findMany({
    where,
    select: {
      competencia: true,
      grupoId: true,
      valor: true,
      tipo: true,
    },
  });

  // Agrupa por competência
  const porMes: Record<string, MesAcumulado> = {};
  for (const comp of competencias) porMes[comp] = novoMesAcumulado();

  for (const l of lancamentos) {
    const mes = porMes[l.competencia];
    if (!mes) continue;
    acumular(mes, l.grupoId, toNum(l.valor), l.tipo);
  }

  // Dados mensais para gráficos — restrito às atividades operacionais
  // (Grupo 1 x Grupos 4-12); financiamento/investimento ficam na aba DFC.
  const graficoMensal = competencias.map((comp) => {
    const mes = porMes[comp];
    const [, m] = comp.split("-");
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const { fluxoOperacional } = calcularFluxos(mes);
    return {
      mes: meses[parseInt(m) - 1],
      competencia: comp,
      recebimento: mes.recebimento,
      saidas: custosOperacionais(mes),
      fluxoOperacional,
    };
  });

  // KPIs do mês atual
  const mesAtual = `${ano}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const mesData = porMes[mesAtual] || novoMesAcumulado();
  const custosDir = toNum(mesData.porGrupo[4]);
  const { fluxoOperacional: fluxoOp, fluxoLivre } = calcularFluxos(mesData);
  const totalEntradasMes = mesData.recebimento + mesData.grupo13Entrada;
  const totalSaidasMes = custosOperacionais(mesData) + mesData.grupo14 + mesData.grupo13Saida;

  // Faturamento do mês atual (NFs)
  const faturamentoWhere: Record<string, unknown> = { competencia: mesAtual };
  if (filialId) faturamentoWhere.filialId = filialId;
  const faturamentos = await prisma.faturamento.findMany({ where: faturamentoWhere });
  const totalFaturamento = faturamentos.reduce((acc, f) => acc + toNum(f.valorNF), 0);

  // Distribuição meios recebimento (grupo 1 subgrupos)
  const recebWhere: Record<string, unknown> = { competencia: mesAtual, grupoId: 1 };
  if (filialId) recebWhere.filialId = filialId;
  const recebimentos = await prisma.lancamento.groupBy({
    by: ["subgrupoId"],
    where: recebWhere,
    _sum: { valor: true },
  });

  const subgrupos = await prisma.subgrupo.findMany({ where: { grupoId: 1 } });
  const distribuicaoRecebimento = recebimentos.map((r) => {
    const sub = subgrupos.find((s) => s.id === r.subgrupoId);
    return {
      nome: sub?.nome || "Outros",
      valor: toNum(r._sum.valor),
    };
  });

  // Composição despesas por grupo
  const despesasWhere: Record<string, unknown> = {
    competencia: mesAtual,
    tipo: "SAIDA",
  };
  if (filialId) despesasWhere.filialId = filialId;
  const despesasPorGrupo = await prisma.lancamento.groupBy({
    by: ["grupoId"],
    where: despesasWhere,
    _sum: { valor: true },
  });

  const grupos = await prisma.grupo.findMany({ orderBy: { ordem: "asc" } });
  const composicaoDespesas = despesasPorGrupo.map((d) => {
    const grupo = grupos.find((g) => g.id === d.grupoId);
    return {
      nome: grupo?.nome || `Grupo ${d.grupoId}`,
      valor: toNum(d._sum.valor),
    };
  });

  return NextResponse.json({
    kpis: {
      totalRecebimento: mesData.recebimento,
      totalFaturamento,
      fluxoOperacional: fluxoOp,
      fluxoLivre,
      percentFluxoLivre: mesData.recebimento > 0 ? (fluxoLivre / mesData.recebimento) * 100 : 0,
      percentCustoDireto: totalFaturamento > 0 ? (custosDir / totalFaturamento) * 100 : 0,
      saldoAtual: totalEntradasMes - totalSaidasMes,
    },
    graficoMensal,
    distribuicaoRecebimento,
    composicaoDespesas,
  });
}
