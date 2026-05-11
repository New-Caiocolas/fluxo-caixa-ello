"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { useFilialAtiva } from "@/lib/hooks/useFilial";
import { formatCurrency, formatPercent, mesNome } from "@/lib/utils";
import { GRUPOS } from "@/lib/categorias";
import {
  ChevronDown,
  ChevronRight,
  Download,
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MensalResponse {
  competencia: string;
  filialId: string;
  diasNoMes: number;
  saldoInicialMes: number;
  saldoFinalMes: number;
  totalRecebimento: number;
  fluxoOperacional: number;
  fluxoLivre: number;
  saldoPorDia: Record<number, { inicial: number; final: number }>;
  grupos: Record<number, {
    nome: string;
    tipo: string;
    subgrupos: Record<string, { nome: string; porDia: Record<number, number>; total: number }>;
    porDia: Record<number, number>;
    total: number;
  }>;
}

export default function MensalPage() {
  const { filialAtiva } = useFilialAtiva();
  const hoje = new Date();
  const [competencia, setCompetencia] = useState(
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`
  );
  const [data, setData] = useState<MensalResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const fetchMensal = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ filialId: filialAtiva, competencia });
      const res = await fetch(`/api/saldos?${params}`, { method: "PUT" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [filialAtiva, competencia]);

  useEffect(() => { fetchMensal(); }, [fetchMensal]);

  function toggleGrupo(grupoId: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(grupoId)) next.delete(grupoId);
      else next.add(grupoId);
      return next;
    });
  }

  const [ano, mes] = competencia.split("-").map(Number);
  const diasNoMes = data?.diasNoMes || new Date(ano, mes, 0).getDate();
  const dias = Array.from({ length: diasNoMes }, (_, i) => i + 1);

  const isCurrentMonth = ano === hoje.getFullYear() && mes === hoje.getMonth() + 1;
  const diaHoje = hoje.getDate();

  function cellValue(grupoId: number, dia: number): number {
    return data?.grupos[grupoId]?.porDia[dia] || 0;
  }

  function subCellValue(grupoId: number, subId: string, dia: number): number {
    return data?.grupos[grupoId]?.subgrupos[subId]?.porDia[dia] || 0;
  }

  const totalRecebimento = data?.totalRecebimento || 0;

  function exportCSV() {
    if (!data) return;
    const rows: string[][] = [];
    const header = ["Categoria", "Total", "%Receb.", ...dias.map((d) => String(d))];
    rows.push(header);

    for (const g of GRUPOS) {
      const gData = data.grupos[g.id];
      if (!gData) continue;
      const gRow = [
        g.nome,
        String(gData.total.toFixed(2)),
        totalRecebimento > 0 ? ((gData.total / totalRecebimento) * 100).toFixed(1) + "%" : "0%",
        ...dias.map((d) => String((gData.porDia[d] || 0).toFixed(2))),
      ];
      rows.push(gRow);
      for (const [sId, sData] of Object.entries(gData.subgrupos)) {
        const sRow = [
          `  ${sData.nome}`,
          String(sData.total.toFixed(2)),
          totalRecebimento > 0 ? ((sData.total / totalRecebimento) * 100).toFixed(1) + "%" : "0%",
          ...dias.map((d) => String((sData.porDia[d] || 0).toFixed(2))),
        ];
        rows.push(sRow);
      }
    }

    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fluxo-${competencia}.csv`;
    a.click();
  }

  const kpiItems = [
    {
      label: "Saldo Inicial",
      value: data?.saldoInicialMes || 0,
      neutral: true,
      icon: Wallet,
    },
    {
      label: "Recebimento",
      value: data?.totalRecebimento || 0,
      neutral: false,
      icon: TrendingUp,
    },
    {
      label: "Fluxo Operacional",
      value: data?.fluxoOperacional || 0,
      neutral: false,
      icon: BarChart2,
    },
    {
      label: "Fluxo Livre",
      value: data?.fluxoLivre || 0,
      neutral: false,
      icon: Zap,
    },
    {
      label: "Saldo Final",
      value: data?.saldoFinalMes || 0,
      neutral: false,
      icon: data?.saldoFinalMes !== undefined && data.saldoFinalMes >= 0 ? TrendingUp : TrendingDown,
      bold: true,
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <Header
        title={`Visão Mensal — ${mesNome(mes)} ${ano}`}
        subtitle="Lançamentos diários por categoria"
      />

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="month"
          value={competencia}
          onChange={(e) => setCompetencia(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          suppressHydrationWarning
        />
        {!filialAtiva && (
          <span className="text-xs text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200 font-medium">
            Consolidado — todas as filiais
          </span>
        )}
        <div className="ml-auto flex gap-3">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download size={14} /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpiItems.map((item) => {
          const isPos = item.neutral ? null : item.value >= 0;
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className={cn(
                "rounded-xl border border-l-4 p-4 transition-shadow hover:shadow-sm",
                item.neutral
                  ? "bg-white border-gray-200 border-l-gray-300"
                  : isPos
                  ? item.bold
                    ? "bg-emerald-50 border-emerald-200 border-l-emerald-500"
                    : "bg-white border-gray-200 border-l-emerald-400"
                  : "bg-red-50 border-red-100 border-l-red-400"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500 leading-tight">{item.label}</p>
                <Icon
                  size={14}
                  className={cn(
                    "shrink-0 ml-1",
                    item.neutral
                      ? "text-gray-400"
                      : isPos
                      ? "text-emerald-500"
                      : "text-red-400"
                  )}
                />
              </div>
              <p
                className={cn(
                  "text-sm font-bold tabular-nums",
                  item.neutral
                    ? "text-gray-800"
                    : isPos
                    ? "text-emerald-700"
                    : "text-red-600"
                )}
              >
                {formatCurrency(item.value)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Tabela principal */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Carregando...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse" suppressHydrationWarning>
              <thead>
                <tr className="bg-gray-900 text-white">
                  <th className="sticky left-0 z-20 bg-gray-900 text-left px-3 py-3 font-semibold min-w-[220px] border-r border-gray-700">
                    Categoria
                  </th>
                  <th className="px-2 py-3 text-right font-semibold min-w-[90px] border-r border-gray-700 whitespace-nowrap">
                    Total Mês
                  </th>
                  <th className="px-2 py-3 text-right font-semibold min-w-[60px] border-r border-gray-700 whitespace-nowrap">
                    % Receb.
                  </th>
                  {dias.map((d) => {
                    const isToday = isCurrentMonth && d === diaHoje;
                    return (
                      <th
                        key={d}
                        className={cn(
                          "px-1.5 py-3 text-center font-medium min-w-[55px] border-r border-gray-700 last:border-r-0",
                          isToday && "bg-emerald-600 text-white font-bold"
                        )}
                        suppressHydrationWarning
                      >
                        {d}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Saldo Inicial */}
                <tr className="bg-slate-50 border-b border-slate-200">
                  <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2.5 font-semibold text-slate-700 border-r border-slate-200"
                    style={{ boxShadow: "2px 0 4px rgba(0,0,0,0.06)" }}>
                    Saldo Inicial
                  </td>
                  <td className="px-2 py-2.5 text-right font-semibold text-slate-700 border-r border-slate-200">
                    {formatCurrency(data?.saldoInicialMes || 0)}
                  </td>
                  <td className="px-2 py-2.5 border-r border-slate-100" />
                  {dias.map((d) => {
                    const isToday = isCurrentMonth && d === diaHoje;
                    return (
                      <td
                        key={d}
                        className={cn(
                          "px-1.5 py-2.5 text-right text-slate-500 border-r border-slate-100 last:border-r-0",
                          isToday && "bg-amber-50"
                        )}
                        suppressHydrationWarning
                      >
                        {d === 1 ? formatCurrency(data?.saldoInicialMes || 0) : ""}
                      </td>
                    );
                  })}
                </tr>

                {/* Grupos */}
                {GRUPOS.map((g) => {
                  const gData = data?.grupos[g.id];
                  const isEntrada = g.tipo === "ENTRADA";
                  const isCollapsed = collapsed.has(g.id);
                  const subgrupoIds = gData ? Object.keys(gData.subgrupos) : [];

                  return (
                    <React.Fragment key={`grupo-${g.id}`}>
                      <tr
                        className={cn(
                          "border-b cursor-pointer",
                          isEntrada
                            ? "bg-emerald-50 hover:bg-emerald-100/80 border-emerald-200"
                            : "bg-red-50 hover:bg-red-100/80 border-red-200"
                        )}
                        onClick={() => toggleGrupo(g.id)}
                      >
                        <td
                          className={cn(
                            "sticky left-0 z-10 px-3 py-2.5 font-semibold border-r",
                            isEntrada
                              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                              : "bg-red-50 text-red-900 border-red-200"
                          )}
                          style={{ boxShadow: "2px 0 4px rgba(0,0,0,0.06)" }}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              "flex items-center justify-center w-4 h-4 rounded",
                              isEntrada ? "text-emerald-600" : "text-red-500"
                            )}>
                              {subgrupoIds.length > 0 ? (
                                isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />
                              ) : (
                                <span className="w-3.5" />
                              )}
                            </span>
                            <span className="text-xs">{g.id} — {g.nome}</span>
                          </div>
                        </td>
                        <td className={cn(
                          "px-2 py-2.5 text-right font-bold border-r tabular-nums",
                          isEntrada ? "text-emerald-700 border-emerald-200" : "text-red-700 border-red-200"
                        )}>
                          {gData ? formatCurrency(gData.total) : "—"}
                        </td>
                        <td className={cn(
                          "px-2 py-2.5 text-right border-r",
                          isEntrada ? "text-emerald-600 border-emerald-200" : "text-red-600 border-red-200"
                        )}>
                          {gData && totalRecebimento > 0
                            ? formatPercent((gData.total / totalRecebimento) * 100)
                            : "—"}
                        </td>
                        {dias.map((d) => {
                          const isToday = isCurrentMonth && d === diaHoje;
                          const v = cellValue(g.id, d);
                          return (
                            <td
                              key={d}
                              className={cn(
                                "px-1.5 py-2.5 text-right border-r last:border-r-0 tabular-nums",
                                isEntrada ? "text-emerald-700 border-emerald-100" : "text-red-700 border-red-100",
                                isToday && "bg-amber-50"
                              )}
                              suppressHydrationWarning
                            >
                              {v > 0 ? formatCurrency(v) : ""}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Subgrupos */}
                      {!isCollapsed && subgrupoIds.map((sId) => {
                        const sData = gData?.subgrupos[sId];
                        if (!sData) return null;
                        return (
                          <tr
                            key={`sub-${g.id}-${sId}`}
                            className="bg-white hover:bg-gray-50/80 border-b border-gray-100"
                          >
                            <td
                              className={cn(
                                "sticky left-0 z-10 bg-white px-3 py-2 text-gray-600 border-r border-gray-200 border-l-2",
                                isEntrada ? "border-l-emerald-300" : "border-l-red-300"
                              )}
                              style={{ boxShadow: "2px 0 4px rgba(0,0,0,0.06)" }}
                            >
                              <span className="pl-5 text-gray-500">{sData.nome}</span>
                            </td>
                            <td className="px-2 py-2 text-right text-gray-700 border-r border-gray-100 tabular-nums">
                              {formatCurrency(sData.total)}
                            </td>
                            <td className="px-2 py-2 text-right text-gray-400 border-r border-gray-100">
                              {totalRecebimento > 0
                                ? formatPercent((sData.total / totalRecebimento) * 100)
                                : "—"}
                            </td>
                            {dias.map((d) => {
                              const isToday = isCurrentMonth && d === diaHoje;
                              const v = subCellValue(g.id, sId, d);
                              return (
                                <td
                                  key={d}
                                  className={cn(
                                    "px-1.5 py-2 text-right text-gray-500 border-r border-gray-100 last:border-r-0 tabular-nums",
                                    isToday && "bg-amber-50"
                                  )}
                                  suppressHydrationWarning
                                >
                                  {v > 0 ? formatCurrency(v) : ""}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}

                {/* Indicadores calculados */}
                {[
                  {
                    label: "Resultado Bruto",
                    value: data
                      ? data.totalRecebimento - (data.grupos[4]?.total || 0) - (data.grupos[5]?.total || 0)
                      : 0,
                    bg: "bg-violet-50",
                    textLabel: "text-violet-900",
                    textValue: "text-violet-700",
                    border: "border-violet-200",
                    borderLeft: "border-l-violet-500",
                  },
                  {
                    label: "Fluxo Caixa Operacional",
                    value: data?.fluxoOperacional || 0,
                    bg: "bg-blue-50",
                    textLabel: "text-blue-900",
                    textValue: "text-blue-700",
                    border: "border-blue-200",
                    borderLeft: "border-l-blue-500",
                  },
                  {
                    label: "Fluxo Caixa Livre",
                    value: data?.fluxoLivre || 0,
                    bg: "bg-emerald-100",
                    textLabel: "text-emerald-900",
                    textValue: "text-emerald-800",
                    border: "border-emerald-200",
                    borderLeft: "border-l-emerald-600",
                  },
                  {
                    label: "% Fluxo Livre s/ Recebimento",
                    value: data && data.totalRecebimento > 0
                      ? (data.fluxoLivre / data.totalRecebimento) * 100
                      : 0,
                    isPercent: true,
                    bg: "bg-gray-100",
                    textLabel: "text-gray-700",
                    textValue: "text-gray-700",
                    border: "border-gray-200",
                    borderLeft: "border-l-gray-400",
                  },
                  {
                    label: "Saldo Final",
                    value: data?.saldoFinalMes || 0,
                    bg: "bg-gray-900",
                    textLabel: "text-gray-100",
                    textValue: "text-white",
                    border: "border-gray-800",
                    borderLeft: "border-l-emerald-400",
                  },
                ].map((row) => (
                  <tr key={row.label} className={cn("border-b", row.bg, row.border)}>
                    <td
                      className={cn(
                        "sticky left-0 z-10 px-3 py-3 font-bold border-r border-l-4 text-xs",
                        row.bg, row.textLabel, row.border, row.borderLeft
                      )}
                      style={{ boxShadow: "2px 0 4px rgba(0,0,0,0.08)" }}
                    >
                      {row.label}
                    </td>
                    <td className={cn("px-2 py-3 text-right font-bold border-r tabular-nums", row.textValue, row.border)}>
                      {row.isPercent ? formatPercent(row.value) : formatCurrency(row.value)}
                    </td>
                    <td className={cn("px-2 py-3 border-r", row.border)} />
                    {dias.map((d) => (
                      <td key={d} className={cn("px-1.5 py-3 border-r last:border-r-0", row.border)} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
