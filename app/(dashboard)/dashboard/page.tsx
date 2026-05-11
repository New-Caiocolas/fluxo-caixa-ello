"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { KPICard } from "@/components/ui/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useFilialAtiva } from "@/lib/hooks/useFilial";
import { formatCurrency, formatPercent, mesNome } from "@/lib/utils";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  DollarSign, TrendingUp, Activity, Wallet, AlertTriangle,
  BarChart2, Zap, TrendingDown, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CORES_PIE = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];
const CORES_GRUPO = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#8b5cf6", "#ec4899"];

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface DashboardData {
  kpis: {
    totalRecebimento: number;
    totalFaturamento: number;
    fluxoOperacional: number;
    fluxoLivre: number;
    percentFluxoLivre: number;
    percentCustoDireto: number;
    saldoAtual: number;
  };
  graficoMensal: Array<{
    mes: string;
    recebimento: number;
    saidas: number;
    fluxoOperacional: number;
  }>;
  distribuicaoRecebimento: Array<{ nome: string; valor: number }>;
  composicaoDespesas: Array<{ nome: string; valor: number }>;
}

interface DFCMes {
  mes: string;
  competencia: string;
  recebimentos: number;
  custosDiretos: number;
  maoDeObra: number;
  materiaisIndiretos: number;
  despesasAdm: number;
  pessoalAdm: number;
  proLabore: number;
  despesasComerciais: number;
  impostosVendas: number;
  outrosImpostos: number;
  totalSaidasOp: number;
  caixaLiquidoOp: number;
  atividadesFinanciamento: number;
  caixaLiquidoFin: number;
  atividadesInvestimento: number;
  caixaLiquidoInv: number;
  variacaoLiquida: number;
  saldoInicial: number;
  saldoFinal: number;
}

type DFCKey = keyof DFCMes;

type DFCLinha =
  | { tipo: "secao"; label: string; cor: string }
  | { tipo: "item"; label: string; key: DFCKey; positivo: boolean }
  | { tipo: "subtotal"; label: string; key: DFCKey; cor: string }
  | { tipo: "total"; label: string; key: DFCKey }
  | { tipo: "saldo"; label: string; key: DFCKey };

const DFC_LINHAS: DFCLinha[] = [
  { tipo: "secao", label: "ATIVIDADES OPERACIONAIS", cor: "emerald" },
  { tipo: "item", label: "(+) Recebimentos de Clientes", key: "recebimentos", positivo: true },
  { tipo: "item", label: "(-) Custos Diretos", key: "custosDiretos", positivo: false },
  { tipo: "item", label: "(-) Mão de Obra Direta", key: "maoDeObra", positivo: false },
  { tipo: "item", label: "(-) Materiais Indiretos", key: "materiaisIndiretos", positivo: false },
  { tipo: "item", label: "(-) Despesas Administrativas", key: "despesasAdm", positivo: false },
  { tipo: "item", label: "(-) Desp. c/ Pessoal ADM", key: "pessoalAdm", positivo: false },
  { tipo: "item", label: "(-) Pró-Labore Diretoria", key: "proLabore", positivo: false },
  { tipo: "item", label: "(-) Despesas Comerciais", key: "despesasComerciais", positivo: false },
  { tipo: "item", label: "(-) Impostos s/ Vendas", key: "impostosVendas", positivo: false },
  { tipo: "item", label: "(-) Outros Impostos", key: "outrosImpostos", positivo: false },
  { tipo: "subtotal", label: "= CAIXA LÍQUIDO OPERACIONAL", key: "caixaLiquidoOp", cor: "emerald" },
  { tipo: "secao", label: "ATIVIDADES DE FINANCIAMENTO", cor: "blue" },
  { tipo: "item", label: "(+/-) Resultado Financeiro Líquido", key: "atividadesFinanciamento", positivo: true },
  { tipo: "subtotal", label: "= CAIXA LÍQUIDO FINANCIAMENTO", key: "caixaLiquidoFin", cor: "blue" },
  { tipo: "secao", label: "ATIVIDADES DE INVESTIMENTO", cor: "amber" },
  { tipo: "item", label: "(-) Aquisições e Investimentos", key: "atividadesInvestimento", positivo: false },
  { tipo: "subtotal", label: "= CAIXA LÍQUIDO INVESTIMENTO", key: "caixaLiquidoInv", cor: "amber" },
  { tipo: "total", label: "VARIAÇÃO LÍQUIDA DO CAIXA", key: "variacaoLiquida" },
  { tipo: "saldo", label: "Saldo Inicial de Caixa", key: "saldoInicial" },
  { tipo: "saldo", label: "Saldo Final de Caixa", key: "saldoFinal" },
];

const SECAO_COR: Record<string, { bg: string; text: string; border: string; left: string }> = {
  emerald: { bg: "bg-emerald-100", text: "text-emerald-900", border: "border-emerald-300", left: "border-l-emerald-500" },
  blue:    { bg: "bg-blue-100",    text: "text-blue-900",    border: "border-blue-300",    left: "border-l-blue-500"    },
  amber:   { bg: "bg-amber-100",   text: "text-amber-900",   border: "border-amber-300",   left: "border-l-amber-500"   },
};

function dfcCelula(linha: DFCLinha, mes: DFCMes): { display: string; cls: string } {
  if (linha.tipo === "secao") return { display: "", cls: "" };

  const raw = mes[linha.key] as number;

  if (linha.tipo === "item") {
    if (raw === 0) return { display: "—", cls: "text-gray-300" };
    if (linha.positivo) {
      return { display: formatCurrency(raw), cls: "text-emerald-700" };
    } else {
      return { display: formatCurrency(raw), cls: "text-red-600" };
    }
  }

  // subtotal, total, saldo
  if (raw === 0) return { display: "—", cls: "text-gray-400" };
  return {
    display: formatCurrency(raw),
    cls: raw >= 0 ? "text-emerald-700" : "text-red-600",
  };
}

export default function DashboardPage() {
  const { filialAtiva } = useFilialAtiva();
  const [data, setData] = useState<DashboardData | null>(null);
  const [dfcData, setDfcData] = useState<DFCMes[]>([]);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [loadingDFC, setLoadingDFC] = useState(false);
  const [aba, setAba] = useState<"visao-geral" | "dfc">("visao-geral");

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ano: String(ano) });
      if (filialAtiva) params.set("filialId", filialAtiva);
      const res = await fetch(`/api/dashboard?${params}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [filialAtiva, ano]);

  const fetchDFC = useCallback(async () => {
    setLoadingDFC(true);
    try {
      const params = new URLSearchParams({ ano: String(ano) });
      if (filialAtiva) params.set("filialId", filialAtiva);
      const res = await fetch(`/api/dfc?${params}`);
      const json = await res.json();
      setDfcData(json.dfcMensal || []);
    } finally {
      setLoadingDFC(false);
    }
  }, [filialAtiva, ano]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useEffect(() => { if (aba === "dfc") fetchDFC(); }, [aba, fetchDFC]);

  const mesAtual = mesNome(new Date().getMonth() + 1);
  const fluxoAlerta = data && data.kpis.percentFluxoLivre < 25;
  const custoAlerta = data && data.kpis.percentCustoDireto > 50;

  // Totais anuais DFC
  const dfcAnual = {
    caixaOp:  dfcData.reduce((a, m) => a + m.caixaLiquidoOp, 0),
    caixaFin: dfcData.reduce((a, m) => a + m.caixaLiquidoFin, 0),
    caixaInv: dfcData.reduce((a, m) => a + m.caixaLiquidoInv, 0),
    variacao: dfcData.reduce((a, m) => a + m.variacaoLiquida, 0),
  };

  // Dados para gráfico DFC
  const graficoDFC = dfcData.map((m) => ({
    mes: m.mes,
    operacional: m.caixaLiquidoOp,
    financiamento: m.caixaLiquidoFin,
    investimento: m.caixaLiquidoInv,
    variacao: m.variacaoLiquida,
  }));

  // Coluna "Total Ano" na tabela DFC
  const dfcTotais: Partial<Record<DFCKey, number>> = {
    recebimentos: dfcData.reduce((a, m) => a + m.recebimentos, 0),
    custosDiretos: dfcData.reduce((a, m) => a + m.custosDiretos, 0),
    maoDeObra: dfcData.reduce((a, m) => a + m.maoDeObra, 0),
    materiaisIndiretos: dfcData.reduce((a, m) => a + m.materiaisIndiretos, 0),
    despesasAdm: dfcData.reduce((a, m) => a + m.despesasAdm, 0),
    pessoalAdm: dfcData.reduce((a, m) => a + m.pessoalAdm, 0),
    proLabore: dfcData.reduce((a, m) => a + m.proLabore, 0),
    despesasComerciais: dfcData.reduce((a, m) => a + m.despesasComerciais, 0),
    impostosVendas: dfcData.reduce((a, m) => a + m.impostosVendas, 0),
    outrosImpostos: dfcData.reduce((a, m) => a + m.outrosImpostos, 0),
    totalSaidasOp: dfcData.reduce((a, m) => a + m.totalSaidasOp, 0),
    caixaLiquidoOp: dfcData.reduce((a, m) => a + m.caixaLiquidoOp, 0),
    atividadesFinanciamento: dfcData.reduce((a, m) => a + m.atividadesFinanciamento, 0),
    caixaLiquidoFin: dfcData.reduce((a, m) => a + m.caixaLiquidoFin, 0),
    atividadesInvestimento: dfcData.reduce((a, m) => a + m.atividadesInvestimento, 0),
    caixaLiquidoInv: dfcData.reduce((a, m) => a + m.caixaLiquidoInv, 0),
    variacaoLiquida: dfcData.reduce((a, m) => a + m.variacaoLiquida, 0),
    saldoInicial: dfcData[0]?.saldoInicial || 0,
    saldoFinal: dfcData[dfcData.length - 1]?.saldoFinal || 0,
  };

  const hoje = new Date();
  const isCurrentYear = ano === hoje.getFullYear();
  const mesAtualIdx = hoje.getMonth();

  return (
    <div>
      <Header
        title="Dashboard Executivo"
        subtitle={`${mesAtual} ${ano} — visão consolidada`}
      />

      {/* Abas */}
      <div className="bg-white border-b border-gray-200 px-6">
        <nav className="flex gap-1 -mb-px">
          {([
            { id: "visao-geral", label: "Visão Geral" },
            { id: "dfc", label: "DFC — Dem. do Fluxo de Caixa" },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setAba(tab.id)}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                aba === tab.id
                  ? "border-emerald-500 text-emerald-700"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Conteúdo */}
      <div className="p-6 space-y-6">

        {/* ─── ABA VISÃO GERAL ─── */}
        {aba === "visao-geral" && (
          <>
            {/* Alertas */}
            {(fluxoAlerta || custoAlerta) && (
              <div className="flex gap-3 flex-wrap">
                {fluxoAlerta && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
                    <AlertTriangle size={16} />
                    Fluxo Livre abaixo de 25% do recebimento ({formatPercent(data!.kpis.percentFluxoLivre)})
                  </div>
                )}
                {custoAlerta && (
                  <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-700 px-4 py-2 rounded-lg text-sm">
                    <AlertTriangle size={16} />
                    Custo Direto acima de 50% do faturamento ({formatPercent(data!.kpis.percentCustoDireto)})
                  </div>
                )}
              </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Recebimento Total"
                value={data?.kpis.totalRecebimento || 0}
                icon={DollarSign}
                iconColor="text-emerald-500"
                subtitle="Mês atual"
              />
              <KPICard
                title="Faturamento (NF)"
                value={data?.kpis.totalFaturamento || 0}
                icon={TrendingUp}
                iconColor="text-blue-500"
                subtitle="Notas emitidas"
              />
              <KPICard
                title="Fluxo Operacional"
                value={data?.kpis.fluxoOperacional || 0}
                icon={Activity}
                iconColor="text-violet-500"
                subtitle="Receb. − Custos op."
              />
              <KPICard
                title="Fluxo Livre"
                value={data?.kpis.fluxoLivre || 0}
                icon={Wallet}
                iconColor={fluxoAlerta ? "text-red-500" : "text-emerald-500"}
                subtitle={`${formatPercent(data?.kpis.percentFluxoLivre || 0)} do recebimento`}
                alert={fluxoAlerta || false}
              />
            </div>

            {/* Gráficos linha e barra */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Recebimento vs Faturamento</CardTitle>
                    <select
                      value={ano}
                      onChange={(e) => setAno(Number(e.target.value))}
                      className="text-xs border border-gray-200 rounded px-2 py-1"
                      suppressHydrationWarning
                    >
                      {[2023, 2024, 2025, 2026].map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={data?.graficoMensal || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Legend />
                      <Line type="monotone" dataKey="recebimento" name="Recebimento" stroke="#10b981" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="saidas" name="Saídas" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                      <Line type="monotone" dataKey="fluxoOperacional" name="Fluxo Op." stroke="#8b5cf6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Composição das Despesas</CardTitle>
                </CardHeader>
                <CardContent>
                  {data?.composicaoDespesas && data.composicaoDespesas.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={data.composicaoDespesas} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={140} />
                        <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                        <Bar dataKey="valor" name="Valor" radius={[0, 4, 4, 0]}>
                          {data.composicaoDespesas.map((_, i) => (
                            <Cell key={i} fill={CORES_GRUPO[i % CORES_GRUPO.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">
                      Nenhum dado disponível
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Pizza e Indicadores */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Meios de Recebimento</CardTitle>
                </CardHeader>
                <CardContent>
                  {data?.distribuicaoRecebimento && data.distribuicaoRecebimento.length > 0 ? (
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="55%" height={220}>
                        <PieChart>
                          <Pie
                            data={data.distribuicaoRecebimento}
                            cx="50%" cy="50%"
                            innerRadius={55} outerRadius={90}
                            paddingAngle={3} dataKey="valor"
                          >
                            {data.distribuicaoRecebimento.map((_, i) => (
                              <Cell key={i} fill={CORES_PIE[i % CORES_PIE.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-2">
                        {data.distribuicaoRecebimento.map((item, i) => {
                          const total = data.distribuicaoRecebimento.reduce((a, b) => a + b.valor, 0);
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: CORES_PIE[i % CORES_PIE.length] }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-700 truncate">{item.nome}</p>
                                <p className="text-xs text-gray-500">{formatPercent(total > 0 ? (item.valor / total) * 100 : 0)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
                      Nenhum recebimento lançado
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Indicadores de Meta</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-5 pt-2">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600">Fluxo Livre / Recebimento</span>
                        <span className={`text-sm font-semibold ${fluxoAlerta ? "text-red-600" : "text-emerald-600"}`}>
                          {formatPercent(data?.kpis.percentFluxoLivre || 0)} / meta 25%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${fluxoAlerta ? "bg-red-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(data?.kpis.percentFluxoLivre || 0, 100)}%` }}
                        />
                      </div>
                      <div className="relative">
                        <div className="absolute left-[25%] -top-1 w-0.5 h-3 bg-gray-400" />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600">Custo Direto / Faturamento</span>
                        <span className={`text-sm font-semibold ${custoAlerta ? "text-red-600" : "text-emerald-600"}`}>
                          {formatPercent(data?.kpis.percentCustoDireto || 0)} / limite 50%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${custoAlerta ? "bg-red-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(data?.kpis.percentCustoDireto || 0, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Saldo do mês</span>
                        <span className={`text-lg font-bold ${(data?.kpis.saldoAtual || 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {formatCurrency(data?.kpis.saldoAtual || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* ─── ABA DFC ─── */}
        {aba === "dfc" && (
          <>
            {/* Controles e KPIs anuais */}
            <div className="flex flex-wrap items-center gap-4">
              <select
                value={ano}
                onChange={(e) => setAno(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                suppressHydrationWarning
              >
                {[2023, 2024, 2025, 2026].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              {!filialAtiva && (
                <span className="text-xs text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200 font-medium">
                  Consolidado — todas as filiais
                </span>
              )}
            </div>

            {/* KPI cards anuais DFC */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: "Caixa Operacional",
                  value: dfcAnual.caixaOp,
                  icon: Activity,
                  sub: "Resultado das operações",
                  corPos: "text-emerald-700",
                  bgPos: "bg-emerald-50 border-l-emerald-500",
                  corNeg: "text-red-600",
                  bgNeg: "bg-red-50 border-l-red-400",
                },
                {
                  label: "Caixa Financiamento",
                  value: dfcAnual.caixaFin,
                  icon: TrendingUp,
                  sub: "Empréstimos e financeiros",
                  corPos: "text-blue-700",
                  bgPos: "bg-blue-50 border-l-blue-500",
                  corNeg: "text-red-600",
                  bgNeg: "bg-red-50 border-l-red-400",
                },
                {
                  label: "Caixa Investimento",
                  value: dfcAnual.caixaInv,
                  icon: BarChart2,
                  sub: "Aquisições e investimentos",
                  corPos: "text-amber-700",
                  bgPos: "bg-amber-50 border-l-amber-500",
                  corNeg: "text-red-600",
                  bgNeg: "bg-red-50 border-l-red-400",
                },
                {
                  label: "Variação Líquida",
                  value: dfcAnual.variacao,
                  icon: Zap,
                  sub: "Total gerado/consumido",
                  corPos: "text-violet-700",
                  bgPos: "bg-violet-50 border-l-violet-500",
                  corNeg: "text-red-600",
                  bgNeg: "bg-red-50 border-l-red-400",
                },
              ].map((item) => {
                const pos = item.value >= 0;
                const Icon = item.icon;
                return (
                  <div key={item.label} className={cn(
                    "rounded-xl border border-l-4 p-4",
                    pos ? item.bgPos : item.bgNeg
                  )}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-500">{item.label}</p>
                      <Icon size={14} className={pos ? item.corPos : item.corNeg} />
                    </div>
                    <p className={cn("text-base font-bold tabular-nums", pos ? item.corPos : item.corNeg)}>
                      {formatCurrency(item.value)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{item.sub}</p>
                  </div>
                );
              })}
            </div>

            {/* Gráfico DFC */}
            <Card>
              <CardHeader>
                <CardTitle>Composição do Fluxo de Caixa — {ano}</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingDFC ? (
                  <div className="h-[260px] flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={graficoDFC} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Legend />
                      <Bar dataKey="operacional" name="Op." stackId="stack" fill="#10b981" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="financiamento" name="Fin." stackId="stack" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="investimento" name="Inv." stackId="stack" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="variacao" name="Variação" stroke="#7c3aed" strokeWidth={2} dot={false} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Tabela DFC */}
            {loadingDFC ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-400">Carregando DFC...</p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                  <ChevronRight size={16} className="text-emerald-500" />
                  <h3 className="text-sm font-semibold text-gray-800">
                    Demonstração do Fluxo de Caixa — Método Direto — {ano}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse" suppressHydrationWarning>
                    <thead>
                      <tr className="bg-gray-900 text-white">
                        <th className="sticky left-0 z-20 bg-gray-900 text-left px-3 py-3 font-semibold min-w-[240px] border-r border-gray-700">
                          Linha DFC
                        </th>
                        {MESES.map((m, i) => {
                          const isCurrent = isCurrentYear && i === mesAtualIdx;
                          return (
                            <th
                              key={m}
                              className={cn(
                                "px-2 py-3 text-right font-medium min-w-[80px] border-r border-gray-700",
                                isCurrent && "bg-blue-700 text-blue-100 font-bold"
                              )}
                              suppressHydrationWarning
                            >
                              {m}
                            </th>
                          );
                        })}
                        <th className="px-2 py-3 text-right font-semibold min-w-[95px] bg-gray-800 whitespace-nowrap">
                          Total Ano
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {DFC_LINHAS.map((linha, rowIdx) => {
                        if (linha.tipo === "secao") {
                          const c = SECAO_COR[linha.cor] || SECAO_COR.emerald;
                          return (
                            <tr key={rowIdx} className={cn("border-b", c.bg, c.border)}>
                              <td
                                colSpan={14}
                                className={cn(
                                  "sticky left-0 z-10 px-4 py-2.5 font-bold text-xs tracking-widest border-l-4",
                                  c.bg, c.text, c.border, c.left
                                )}
                                style={{ boxShadow: "2px 0 4px rgba(0,0,0,0.04)" }}
                              >
                                {linha.label}
                              </td>
                            </tr>
                          );
                        }

                        if (linha.tipo === "subtotal") {
                          const c = SECAO_COR[linha.cor] || SECAO_COR.emerald;
                          const totalVal = (dfcTotais[linha.key] as number) ?? 0;
                          return (
                            <tr key={rowIdx} className={cn("border-b", c.bg, c.border)}>
                              <td
                                className={cn(
                                  "sticky left-0 z-10 px-3 py-2.5 font-bold text-xs border-r border-l-4",
                                  c.bg, c.text, c.border, c.left
                                )}
                                style={{ boxShadow: "2px 0 4px rgba(0,0,0,0.06)" }}
                              >
                                {linha.label}
                              </td>
                              {dfcData.map((mes, i) => {
                                const v = mes[linha.key] as number;
                                const isCurrent = isCurrentYear && i === mesAtualIdx;
                                const cls = v >= 0 ? "text-emerald-700" : "text-red-600";
                                return (
                                  <td
                                    key={i}
                                    className={cn(
                                      "px-2 py-2.5 text-right font-bold border-r tabular-nums",
                                      cls, c.border,
                                      isCurrent && "opacity-90"
                                    )}
                                    suppressHydrationWarning
                                  >
                                    {v === 0 ? "—" : formatCurrency(v)}
                                  </td>
                                );
                              })}
                              <td className={cn(
                                "px-2 py-2.5 text-right font-bold tabular-nums",
                                (totalVal >= 0 ? "text-emerald-700" : "text-red-600"), c.bg
                              )}>
                                {totalVal === 0 ? "—" : formatCurrency(totalVal)}
                              </td>
                            </tr>
                          );
                        }

                        if (linha.tipo === "total") {
                          const totalVal = (dfcTotais[linha.key] as number) ?? 0;
                          return (
                            <tr key={rowIdx} className="bg-gray-900 border-b border-gray-800">
                              <td
                                className="sticky left-0 z-10 bg-gray-900 px-3 py-3 font-bold text-white border-r border-gray-700 border-l-4 border-l-violet-400 text-xs tracking-wide"
                                style={{ boxShadow: "2px 0 4px rgba(0,0,0,0.2)" }}
                              >
                                {linha.label}
                              </td>
                              {dfcData.map((mes, i) => {
                                const v = mes[linha.key] as number;
                                const isCurrent = isCurrentYear && i === mesAtualIdx;
                                return (
                                  <td
                                    key={i}
                                    className={cn(
                                      "px-2 py-3 text-right font-bold border-r border-gray-800 tabular-nums",
                                      v >= 0 ? "text-emerald-400" : "text-red-400",
                                      isCurrent && "bg-gray-800"
                                    )}
                                    suppressHydrationWarning
                                  >
                                    {v === 0 ? "—" : formatCurrency(v)}
                                  </td>
                                );
                              })}
                              <td className={cn(
                                "px-2 py-3 text-right font-bold bg-gray-800 tabular-nums",
                                totalVal >= 0 ? "text-emerald-400" : "text-red-400"
                              )}>
                                {totalVal === 0 ? "—" : formatCurrency(totalVal)}
                              </td>
                            </tr>
                          );
                        }

                        if (linha.tipo === "saldo") {
                          const isFinal = linha.key === "saldoFinal";
                          const totalVal = (dfcTotais[linha.key] as number) ?? 0;
                          return (
                            <tr key={rowIdx} className={cn("border-b", isFinal ? "bg-slate-100 border-slate-300" : "bg-slate-50 border-slate-200")}>
                              <td
                                className={cn(
                                  "sticky left-0 z-10 px-3 py-2.5 font-semibold border-r text-xs",
                                  isFinal
                                    ? "bg-slate-100 text-slate-800 border-slate-300 border-l-4 border-l-slate-500"
                                    : "bg-slate-50 text-slate-700 border-slate-200"
                                )}
                                style={{ boxShadow: "2px 0 4px rgba(0,0,0,0.05)" }}
                              >
                                {linha.label}
                              </td>
                              {dfcData.map((mes, i) => {
                                const v = mes[linha.key] as number;
                                const isCurrent = isCurrentYear && i === mesAtualIdx;
                                return (
                                  <td
                                    key={i}
                                    className={cn(
                                      "px-2 py-2.5 text-right border-r border-slate-200 tabular-nums",
                                      isFinal ? "font-bold" : "font-medium",
                                      v >= 0 ? "text-slate-700" : "text-red-600",
                                      isCurrent && "bg-blue-50"
                                    )}
                                    suppressHydrationWarning
                                  >
                                    {v === 0 ? "—" : formatCurrency(v)}
                                  </td>
                                );
                              })}
                              <td className={cn(
                                "px-2 py-2.5 text-right tabular-nums bg-slate-200",
                                isFinal ? "font-bold" : "font-medium",
                                totalVal >= 0 ? "text-slate-800" : "text-red-700"
                              )}>
                                {totalVal === 0 ? "—" : formatCurrency(totalVal)}
                              </td>
                            </tr>
                          );
                        }

                        // tipo === "item"
                        const totalVal = (dfcTotais[(linha as { key: DFCKey }).key] as number) ?? 0;
                        const linhaItem = linha as { tipo: "item"; label: string; key: DFCKey; positivo: boolean };
                        return (
                          <tr key={rowIdx} className="bg-white hover:bg-gray-50/60 border-b border-gray-100">
                            <td
                              className="sticky left-0 z-10 bg-white hover:bg-gray-50/60 px-3 py-2 text-gray-600 border-r border-gray-200 pl-7"
                              style={{ boxShadow: "2px 0 4px rgba(0,0,0,0.04)" }}
                            >
                              {linhaItem.label}
                            </td>
                            {dfcData.map((mes, i) => {
                              const { display, cls } = dfcCelula(linhaItem, mes);
                              const isCurrent = isCurrentYear && i === mesAtualIdx;
                              return (
                                <td
                                  key={i}
                                  className={cn(
                                    "px-2 py-2 text-right border-r border-gray-100 tabular-nums",
                                    cls,
                                    isCurrent && "bg-blue-50/40"
                                  )}
                                  suppressHydrationWarning
                                >
                                  {display}
                                </td>
                              );
                            })}
                            <td className={cn(
                              "px-2 py-2 text-right font-semibold bg-gray-50 tabular-nums",
                              linhaItem.positivo
                                ? totalVal > 0 ? "text-emerald-700" : "text-gray-400"
                                : totalVal > 0 ? "text-red-600" : "text-gray-400"
                            )}>
                              {totalVal === 0 ? "—" : formatCurrency(totalVal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
