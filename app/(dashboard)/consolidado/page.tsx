"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { useFilialAtiva } from "@/lib/hooks/useFilial";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { GRUPOS } from "@/lib/categorias";
import {
  Download,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface AnualData {
  competencia: string;
  totalEntradas: number;
  totalSaidas: number;
  fluxoOperacional: number;
  fluxoLivre: number;
  percentFluxoLivre: number;
  porGrupo: Record<number, number>;
}

export default function ConsolidadoPage() {
  const { filialAtiva } = useFilialAtiva();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [data, setData] = useState<AnualData[]>([]);
  const [loading, setLoading] = useState(false);

  const zero: AnualData = {
    competencia: "",
    totalEntradas: 0,
    totalSaidas: 0,
    fluxoOperacional: 0,
    fluxoLivre: 0,
    percentFluxoLivre: 0,
    porGrupo: {},
  };

  const fetchConsolidado = useCallback(async () => {
    setLoading(true);
    try {
      const competencias = Array.from({ length: 12 }, (_, i) =>
        `${ano}-${String(i + 1).padStart(2, "0")}`
      );

      const results = await Promise.all(
        competencias.map(async (comp) => {
          const params = new URLSearchParams({ filialId: filialAtiva, competencia: comp });
          const res = await fetch(`/api/saldos?${params}`, { method: "PUT" });
          if (!res.ok) return { ...zero, competencia: comp };
          const json = await res.json();
          const porGrupo: Record<number, number> = {};
          for (const [gId, gData] of Object.entries(json.grupos || {})) {
            porGrupo[Number(gId)] = (gData as { total: number }).total || 0;
          }
          return {
            competencia: comp,
            totalEntradas: json.totalRecebimento || 0,
            totalSaidas: Object.entries(json.grupos || {})
              .filter(([g]) => Number(g) !== 1)
              .reduce((a, [, g]) => a + ((g as { total: number }).total || 0), 0),
            fluxoOperacional: json.fluxoOperacional || 0,
            fluxoLivre: json.fluxoLivre || 0,
            percentFluxoLivre:
              json.totalRecebimento > 0
                ? (json.fluxoLivre / json.totalRecebimento) * 100
                : 0,
            porGrupo,
          };
        })
      );
      setData(results);
    } finally {
      setLoading(false);
    }
  }, [filialAtiva, ano]);

  useEffect(() => { fetchConsolidado(); }, [fetchConsolidado]);

  function getGrupoTotal(grupoId: number): number {
    return data.reduce((acc, m) => acc + (m.porGrupo[grupoId] || 0), 0);
  }

  function exportCSV() {
    const rows: string[][] = [];
    rows.push(["Categoria", ...MESES, "Total Ano"]);

    for (const g of GRUPOS) {
      const row = [
        `${g.id} — ${g.nome}`,
        ...data.map((m) => (m.porGrupo[g.id] || 0).toFixed(2)),
        getGrupoTotal(g.id).toFixed(2),
      ];
      rows.push(row);
    }

    rows.push([
      "Fluxo Operacional",
      ...data.map((m) => m.fluxoOperacional.toFixed(2)),
      data.reduce((a, m) => a + m.fluxoOperacional, 0).toFixed(2),
    ]);
    rows.push([
      "Fluxo Livre",
      ...data.map((m) => m.fluxoLivre.toFixed(2)),
      data.reduce((a, m) => a + m.fluxoLivre, 0).toFixed(2),
    ]);
    rows.push([
      "% Fluxo Livre",
      ...data.map((m) => formatPercent(m.percentFluxoLivre)),
      "",
    ]);

    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consolidado-${ano}.csv`;
    a.click();
  }

  const totalAnual = {
    entradas: data.reduce((a, m) => a + m.totalEntradas, 0),
    saidas: data.reduce((a, m) => a + m.totalSaidas, 0),
    fluxoOp: data.reduce((a, m) => a + m.fluxoOperacional, 0),
    fluxoLivre: data.reduce((a, m) => a + m.fluxoLivre, 0),
  };

  const hoje = new Date();
  const isCurrentYear = ano === hoje.getFullYear();
  const mesAtual = hoje.getMonth(); // 0-based

  const mesesComDados = data.filter((m) => m.totalEntradas > 0).length;
  const mesesMeta = data.filter((m) => m.percentFluxoLivre >= 25).length;

  return (
    <div className="p-6 space-y-5">
      <Header title={`Consolidado Anual — ${ano}`} subtitle="Visão por mês de todas as categorias" />

      {/* Controles */}
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
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportCSV}>
          <Download size={14} /> Exportar CSV
        </Button>
      </div>

      {/* KPI cards anuais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-l-4 border-gray-200 border-l-emerald-500 bg-emerald-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">Total Recebimentos</p>
            <TrendingUp size={14} className="text-emerald-500" />
          </div>
          <p className="text-base font-bold text-emerald-700 tabular-nums">{formatCurrency(totalAnual.entradas)}</p>
          <p className="text-xs text-gray-400 mt-1">{mesesComDados} meses c/ movimento</p>
        </div>

        <div className="rounded-xl border border-l-4 border-gray-200 border-l-red-400 bg-red-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">Total Saídas</p>
            <TrendingDown size={14} className="text-red-400" />
          </div>
          <p className="text-base font-bold text-red-700 tabular-nums">{formatCurrency(totalAnual.saidas)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {totalAnual.entradas > 0
              ? formatPercent((totalAnual.saidas / totalAnual.entradas) * 100) + " s/ recebimentos"
              : "—"}
          </p>
        </div>

        <div className={cn(
          "rounded-xl border border-l-4 p-4",
          totalAnual.fluxoOp >= 0
            ? "border-gray-200 border-l-blue-500 bg-blue-50"
            : "border-red-100 border-l-red-400 bg-red-50"
        )}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">Fluxo Operacional</p>
            <BarChart2 size={14} className={totalAnual.fluxoOp >= 0 ? "text-blue-500" : "text-red-400"} />
          </div>
          <p className={cn("text-base font-bold tabular-nums", totalAnual.fluxoOp >= 0 ? "text-blue-700" : "text-red-600")}>
            {formatCurrency(totalAnual.fluxoOp)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Acumulado do ano</p>
        </div>

        <div className={cn(
          "rounded-xl border border-l-4 p-4",
          totalAnual.fluxoLivre >= 0
            ? "border-gray-200 border-l-violet-500 bg-violet-50"
            : "border-red-100 border-l-red-400 bg-red-50"
        )}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">Fluxo Livre Acumulado</p>
            <Zap size={14} className={totalAnual.fluxoLivre >= 0 ? "text-violet-500" : "text-red-400"} />
          </div>
          <p className={cn("text-base font-bold tabular-nums", totalAnual.fluxoLivre >= 0 ? "text-violet-700" : "text-red-600")}>
            {formatCurrency(totalAnual.fluxoLivre)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {totalAnual.entradas > 0
              ? formatPercent((totalAnual.fluxoLivre / totalAnual.entradas) * 100) + " s/ recebimentos"
              : "—"}
          </p>
        </div>
      </div>

      {/* Grid de metas mensais */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Meta Fluxo Livre ≥ 25% por mês</p>
          <span className={cn(
            "text-xs font-medium px-2.5 py-1 rounded-full",
            mesesMeta >= 8 ? "bg-emerald-100 text-emerald-700" : mesesMeta >= 4 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
          )}>
            {mesesMeta}/12 meses atingidos
          </span>
        </div>
        <div className="grid grid-cols-6 lg:grid-cols-12 gap-2">
          {MESES.map((mes, i) => {
            const m = data[i];
            const pct = m?.percentFluxoLivre || 0;
            const fluxoOk = pct >= 25;
            const isCurrent = isCurrentYear && i === mesAtual;
            return (
              <div
                key={mes}
                className={cn(
                  "rounded-lg border p-2 text-center transition-shadow",
                  fluxoOk
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-red-50 border-red-200",
                  isCurrent && "ring-2 ring-offset-1 ring-blue-400"
                )}
                suppressHydrationWarning
              >
                <p className="text-xs font-semibold text-gray-600 mb-1">{mes}</p>
                <div className="flex justify-center mb-1">
                  {fluxoOk
                    ? <CheckCircle2 size={14} className="text-emerald-500" />
                    : <XCircle size={14} className="text-red-400" />
                  }
                </div>
                <p className={cn("text-xs font-bold tabular-nums", fluxoOk ? "text-emerald-700" : "text-red-600")}>
                  {formatPercent(pct)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Carregando {12} competências...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse" suppressHydrationWarning>
              <thead>
                <tr className="bg-gray-900 text-white">
                  <th className="sticky left-0 z-20 bg-gray-900 text-left px-3 py-3 font-semibold min-w-[200px] border-r border-gray-700">
                    Categoria
                  </th>
                  {MESES.map((m, i) => {
                    const isCurrent = isCurrentYear && i === mesAtual;
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
                {/* TOTAL RECEBIMENTOS */}
                <tr className="bg-emerald-100 border-b border-emerald-300">
                  <td
                    className="sticky left-0 z-10 bg-emerald-100 px-3 py-2.5 font-bold text-emerald-900 border-r border-emerald-300 border-l-4 border-l-emerald-500 text-xs tracking-wide"
                    style={{ boxShadow: "2px 0 4px rgba(0,0,0,0.06)" }}
                  >
                    TOTAL RECEBIMENTOS
                  </td>
                  {data.map((m, i) => {
                    const isCurrent = isCurrentYear && i === mesAtual;
                    return (
                      <td
                        key={i}
                        className={cn(
                          "px-2 py-2.5 text-right font-bold text-emerald-700 border-r border-emerald-200 tabular-nums",
                          isCurrent && "bg-emerald-200"
                        )}
                        suppressHydrationWarning
                      >
                        {m.totalEntradas > 0 ? formatCurrency(m.totalEntradas) : "—"}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2.5 text-right font-bold text-emerald-700 bg-emerald-200 tabular-nums">
                    {formatCurrency(totalAnual.entradas)}
                  </td>
                </tr>

                {GRUPOS.filter((g) => g.tipo === "ENTRADA").map((g) => (
                  <tr key={g.id} className="border-b border-gray-100 hover:bg-emerald-50/40">
                    <td
                      className="sticky left-0 z-10 bg-white hover:bg-emerald-50/40 px-3 py-2 text-gray-600 border-r border-gray-200 border-l-2 border-l-emerald-300"
                      style={{ boxShadow: "2px 0 4px rgba(0,0,0,0.06)" }}
                    >
                      <span className="pl-4">{g.nome}</span>
                    </td>
                    {data.map((m, i) => {
                      const isCurrent = isCurrentYear && i === mesAtual;
                      return (
                        <td
                          key={i}
                          className={cn(
                            "px-2 py-2 text-right text-emerald-600 border-r border-gray-100 tabular-nums",
                            isCurrent && "bg-blue-50/50"
                          )}
                          suppressHydrationWarning
                        >
                          {(m.porGrupo[g.id] || 0) > 0 ? formatCurrency(m.porGrupo[g.id]) : "—"}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-right font-semibold text-emerald-600 bg-gray-50 tabular-nums">
                      {formatCurrency(getGrupoTotal(g.id))}
                    </td>
                  </tr>
                ))}

                {/* TOTAL SAÍDAS */}
                <tr className="bg-red-100 border-b border-red-300">
                  <td
                    className="sticky left-0 z-10 bg-red-100 px-3 py-2.5 font-bold text-red-900 border-r border-red-300 border-l-4 border-l-red-500 text-xs tracking-wide"
                    style={{ boxShadow: "2px 0 4px rgba(0,0,0,0.06)" }}
                  >
                    TOTAL SAÍDAS
                  </td>
                  {data.map((m, i) => {
                    const isCurrent = isCurrentYear && i === mesAtual;
                    return (
                      <td
                        key={i}
                        className={cn(
                          "px-2 py-2.5 text-right font-bold text-red-700 border-r border-red-200 tabular-nums",
                          isCurrent && "bg-red-200"
                        )}
                        suppressHydrationWarning
                      >
                        {m.totalSaidas > 0 ? formatCurrency(m.totalSaidas) : "—"}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2.5 text-right font-bold text-red-700 bg-red-200 tabular-nums">
                    {formatCurrency(totalAnual.saidas)}
                  </td>
                </tr>

                {GRUPOS.filter((g) => g.tipo === "SAIDA").map((g) => (
                  <tr key={g.id} className="border-b border-gray-100 hover:bg-red-50/40">
                    <td
                      className="sticky left-0 z-10 bg-white hover:bg-red-50/40 px-3 py-2 text-gray-600 border-r border-gray-200 border-l-2 border-l-red-300"
                      style={{ boxShadow: "2px 0 4px rgba(0,0,0,0.06)" }}
                    >
                      <span className="pl-4">{g.nome}</span>
                    </td>
                    {data.map((m, i) => {
                      const isCurrent = isCurrentYear && i === mesAtual;
                      return (
                        <td
                          key={i}
                          className={cn(
                            "px-2 py-2 text-right text-red-600 border-r border-gray-100 tabular-nums",
                            isCurrent && "bg-blue-50/50"
                          )}
                          suppressHydrationWarning
                        >
                          {(m.porGrupo[g.id] || 0) > 0 ? formatCurrency(m.porGrupo[g.id]) : "—"}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-right font-semibold text-red-600 bg-gray-50 tabular-nums">
                      {formatCurrency(getGrupoTotal(g.id))}
                    </td>
                  </tr>
                ))}

                {/* Fluxo Operacional */}
                {[
                  {
                    label: "Fluxo Operacional",
                    key: "fluxoOperacional" as const,
                    total: totalAnual.fluxoOp,
                    bg: "bg-blue-50",
                    bgCurrent: "bg-blue-100",
                    bgTotal: "bg-blue-100",
                    textLabel: "text-blue-900",
                    textValue: "text-blue-700",
                    border: "border-blue-200",
                    borderLeft: "border-l-blue-500",
                  },
                  {
                    label: "Fluxo Livre",
                    key: "fluxoLivre" as const,
                    total: totalAnual.fluxoLivre,
                    bg: "bg-violet-50",
                    bgCurrent: "bg-violet-100",
                    bgTotal: "bg-violet-100",
                    textLabel: "text-violet-900",
                    textValue: "text-violet-700",
                    border: "border-violet-200",
                    borderLeft: "border-l-violet-500",
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
                    {data.map((m, i) => {
                      const isCurrent = isCurrentYear && i === mesAtual;
                      const v = m[row.key];
                      return (
                        <td
                          key={i}
                          className={cn(
                            "px-2 py-3 text-right font-semibold border-r tabular-nums",
                            v >= 0 ? row.textValue : "text-red-600",
                            isCurrent ? row.bgCurrent : row.bg,
                            row.border
                          )}
                          suppressHydrationWarning
                        >
                          {formatCurrency(v)}
                        </td>
                      );
                    })}
                    <td className={cn("px-2 py-3 text-right font-bold tabular-nums", row.bgTotal, row.textValue)}>
                      {formatCurrency(row.total)}
                    </td>
                  </tr>
                ))}

                {/* % Fluxo Livre */}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <td
                    className="sticky left-0 z-10 bg-gray-50 px-3 py-3 font-bold text-gray-700 border-r border-gray-200 border-l-4 border-l-gray-400 text-xs"
                    style={{ boxShadow: "2px 0 4px rgba(0,0,0,0.06)" }}
                  >
                    % Fluxo Livre s/ Receb. <span className="font-normal text-gray-400">(meta: ≥25%)</span>
                  </td>
                  {data.map((m, i) => {
                    const ok = m.percentFluxoLivre >= 25;
                    const isCurrent = isCurrentYear && i === mesAtual;
                    return (
                      <td
                        key={i}
                        className={cn(
                          "px-2 py-3 text-right font-bold border-r border-gray-100 tabular-nums",
                          ok ? "text-emerald-600" : "text-red-500",
                          isCurrent && "bg-blue-50"
                        )}
                        suppressHydrationWarning
                      >
                        {formatPercent(m.percentFluxoLivre)}
                      </td>
                    );
                  })}
                  <td className="px-2 py-3 text-right font-bold text-gray-700 bg-gray-100 tabular-nums">
                    {totalAnual.entradas > 0
                      ? formatPercent((totalAnual.fluxoLivre / totalAnual.entradas) * 100)
                      : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
