import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { calcularIndicadores, type TotaisPorGrupo, type GrupoClassificado } from "@/lib/utils";
function toNum(d: unknown): number {
  return d ? Number(d) : 0;
}

/**
 * Acumulado de um mês: totais por grupo separados por direção.
 *
 * Antes esta struct tinha campos nomeados por id de grupo (grupo13Entrada,
 * grupo14...). Com grupos criados pelo usuário isso não escala — quem decide o
 * papel de cada grupo agora é a classificação, resolvida em calcularIndicadores.
 */
type MesAcumulado = TotaisPorGrupo;

function novoMesAcumulado(): MesAcumulado {
  return {};
}

function acumular(mes: MesAcumulado, grupoId: number, valor: number, tipo: string) {
  const t = (mes[grupoId] ??= { entrada: 0, saida: 0 });
  if (tipo === "ENTRADA") t.entrada += valor;
  else t.saida += valor;
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

  const grupos = await prisma.grupo.findMany({ orderBy: { ordem: "asc" } });
  const gruposClassificados: GrupoClassificado[] = grupos.map((g) => ({
    id: g.id,
    classificacao: g.classificacao,
  }));

  // Dados mensais para gráficos — restrito às atividades operacionais
  // (recebimento x custo operacional); financiamento/investimento ficam na aba DFC.
  const graficoMensal = competencias.map((comp) => {
    const [, m] = comp.split("-");
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const ind = calcularIndicadores(gruposClassificados, porMes[comp]);
    return {
      mes: meses[parseInt(m) - 1],
      competencia: comp,
      recebimento: ind.recebimento,
      saidas: ind.custos,
      fluxoOperacional: ind.fluxoOperacional,
    };
  });

  // KPIs do mês atual
  const mesAtual = `${ano}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const mesData = porMes[mesAtual] || novoMesAcumulado();
  const ind = calcularIndicadores(gruposClassificados, mesData);
  const { fluxoOperacional: fluxoOp, fluxoLivre } = ind;

  // "Custo direto" é especificamente o grupo 4 — é a base da meta CUSTO_DIRETO,
  // não um balde de classificação.
  const custosDir = mesData[4]?.saida ?? 0;

  // Movimento de caixa do mês: tudo que entrou menos tudo que saiu, em qualquer
  // grupo (inclusive NEUTRO — o dinheiro se move mesmo fora dos indicadores).
  const totalEntradasMes = Object.values(mesData).reduce((a, t) => a + t.entrada, 0);
  const totalSaidasMes = Object.values(mesData).reduce((a, t) => a + t.saida, 0);

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

  const composicaoDespesas = despesasPorGrupo.map((d) => {
    const grupo = grupos.find((g) => g.id === d.grupoId);
    return {
      nome: grupo?.nome || `Grupo ${d.grupoId}`,
      valor: toNum(d._sum.valor),
    };
  });

  return NextResponse.json({
    kpis: {
      totalRecebimento: ind.recebimento,
      totalFaturamento,
      fluxoOperacional: fluxoOp,
      fluxoLivre,
      percentFluxoLivre: ind.recebimento > 0 ? (fluxoLivre / ind.recebimento) * 100 : 0,
      percentCustoDireto: totalFaturamento > 0 ? (custosDir / totalFaturamento) * 100 : 0,
      saldoAtual: totalEntradasMes - totalSaidasMes,
    },
    graficoMensal,
    distribuicaoRecebimento,
    composicaoDespesas,
  });
}
