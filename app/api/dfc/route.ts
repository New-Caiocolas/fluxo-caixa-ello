import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { calcularIndicadores, totalizarLancamentos } from "@/lib/utils";

function toNum(d: unknown): number {
  return d ? Number(d) : 0;
}

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filialId = searchParams.get("filialId") || "";
  const ano = parseInt(searchParams.get("ano") || String(new Date().getFullYear()));

  const competencias: string[] = Array.from({ length: 12 }, (_, i) =>
    `${ano}-${String(i + 1).padStart(2, "0")}`
  );

  let filialIds: string[];
  if (filialId) {
    filialIds = [filialId];
  } else {
    const filiais = await prisma.filial.findMany({ where: { ativa: true }, select: { id: true } });
    filialIds = filiais.map((f) => f.id);
  }

  // Busca todos os lançamentos do ano em uma query
  const lancamentos = await prisma.lancamento.findMany({
    where: {
      filialId: { in: filialIds },
      competencia: { in: competencias },
    },
    select: {
      competencia: true,
      grupoId: true,
      valor: true,
      tipo: true,
      grupo: { select: { classificacao: true } },
    },
  });

  // Agrupa por competência e grupoId. O Grupo 13 (Receitas/Despesas Financeiras) é o
  // único que mistura entrada e saída dentro do mesmo grupo — por isso soma com sinal
  // (entrada some, saída subtrai); os demais grupos são sempre de um único tipo.
  const porMes: Record<string, Record<number, number>> = {};
  const lancsPorMes: Record<string, typeof lancamentos> = {};
  for (const comp of competencias) {
    porMes[comp] = {};
    lancsPorMes[comp] = [];
  }
  for (const l of lancamentos) {
    if (!porMes[l.competencia]) continue;
    lancsPorMes[l.competencia].push(l);
    const val = toNum(l.valor);
    // Grupos de resultado financeiro misturam as duas direções no mesmo grupo,
    // então entram com sinal; os demais são sempre de um único tipo.
    const assina = l.grupo.classificacao === "RESULTADO_FINANCEIRO";
    const valorAssinado = assina ? (l.tipo === "ENTRADA" ? val : -val) : val;
    porMes[l.competencia][l.grupoId] = (porMes[l.competencia][l.grupoId] || 0) + valorAssinado;
  }

  const grupos = [
    ...new Map(
      lancamentos.map((l) => [l.grupoId, { id: l.grupoId, classificacao: l.grupo.classificacao }])
    ).values(),
  ];

  // Busca saldo inicial por mês (soma de todas as filiais)
  const saldosPorMes: Record<string, number> = {};
  await Promise.all(
    competencias.map(async (comp) => {
      const saldos = await Promise.all(
        filialIds.map((fId) =>
          prisma.saldo.findFirst({
            where: { filialId: fId, competencia: comp },
            orderBy: { data: "asc" },
          })
        )
      );
      saldosPorMes[comp] = saldos.reduce((sum, s) => sum + toNum(s?.saldoInicial), 0);
    })
  );

  const dfcMensal = competencias.map((comp, i) => {
    const g = porMes[comp];

    // Atividades Operacionais
    const recebimentos = g[1] || 0;
    const custosDiretos = g[4] || 0;
    const maoDeObra = g[5] || 0;
    const materiaisIndiretos = g[6] || 0;
    const despesasAdm = g[7] || 0;
    const pessoalAdm = g[8] || 0;
    const proLabore = g[9] || 0;
    const despesasComerciais = g[10] || 0;
    const impostosVendas = g[11] || 0;
    const outrosImpostos = g[12] || 0;
    const totalSaidasOp =
      custosDiretos + maoDeObra + materiaisIndiretos + despesasAdm +
      pessoalAdm + proLabore + despesasComerciais + impostosVendas + outrosImpostos;
    const indicadores = calcularIndicadores(
      grupos,
      totalizarLancamentos(
        lancsPorMes[comp].map((l) => ({
          grupoId: l.grupoId,
          tipo: l.tipo,
          valor: toNum(l.valor),
        }))
      )
    );
    const caixaLiquidoOp = indicadores.fluxoOperacional;

    // Atividades de Financiamento (grupo 13, já somado com sinal acima)
    const atividadesFinanciamento = g[13] || 0;
    const caixaLiquidoFin = atividadesFinanciamento;

    // Atividades de Investimento (grupo 14 — reduz caixa)
    const atividadesInvestimento = g[14] || 0;
    const caixaLiquidoInv = -atividadesInvestimento;

    const variacaoLiquida = indicadores.fluxoLivre;
    const saldoInicial = saldosPorMes[comp] || 0;
    const saldoFinal = saldoInicial + variacaoLiquida;

    return {
      mes: MESES_ABREV[i],
      competencia: comp,
      recebimentos,
      custosDiretos,
      maoDeObra,
      materiaisIndiretos,
      despesasAdm,
      pessoalAdm,
      proLabore,
      despesasComerciais,
      impostosVendas,
      outrosImpostos,
      totalSaidasOp,
      caixaLiquidoOp,
      atividadesFinanciamento,
      caixaLiquidoFin,
      atividadesInvestimento,
      caixaLiquidoInv,
      variacaoLiquida,
      saldoInicial,
      saldoFinal,
    };
  });

  return NextResponse.json({ dfcMensal });
}
