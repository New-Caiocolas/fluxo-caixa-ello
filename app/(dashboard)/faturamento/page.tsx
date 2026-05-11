"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useFilialAtiva, useFiliais } from "@/lib/hooks/useFilial";
import { formatCurrency, formatPercent } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Plus, AlertTriangle } from "lucide-react";

interface ComparativoItem {
  mes: string; competencia: string; faturado: number; recebido: number;
  custoDireto: number; inadimplencia: number; margemContribuicao: number;
  percentMargem: number; percentInadimplencia: number;
}
interface FaturamentoItem {
  id: string; filialId: string; competencia: string; valorNF: number;
  descricao?: string; filial: { nome: string };
}

export default function FaturamentoPage() {
  const { filialAtiva } = useFilialAtiva();
  const { filiais } = useFiliais();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [comparativo, setComparativo] = useState<ComparativoItem[]>([]);
  const [faturamentos, setFaturamentos] = useState<FaturamentoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    filialId: "", competencia: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
    valorNF: 0, descricao: "",
  });
  const [salvando, setSalvando] = useState(false);

  const fetchFaturamento = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ano: String(ano) });
      if (filialAtiva) params.set("filialId", filialAtiva);
      const res = await fetch(`/api/faturamento?${params}`);
      if (res.ok) { const json = await res.json(); setComparativo(json.comparativo); setFaturamentos(json.faturamentos); }
    } finally { setLoading(false); }
  }, [filialAtiva, ano]);

  useEffect(() => { fetchFaturamento(); }, [fetchFaturamento]);

  async function handleSalvar() {
    setSalvando(true);
    try {
      const res = await fetch("/api/faturamento", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, valorNF: Number(form.valorNF) }),
      });
      if (res.ok) { setModalOpen(false); fetchFaturamento(); }
    } finally { setSalvando(false); }
  }

  const totalFaturado = comparativo.reduce((a, m) => a + m.faturado, 0);
  const totalRecebido = comparativo.reduce((a, m) => a + m.recebido, 0);
  const totalMargem = comparativo.reduce((a, m) => a + m.margemContribuicao, 0);
  const percentMargemMedia = totalRecebido > 0 ? (totalMargem / totalRecebido) * 100 : 0;

  return (
    <div className="p-6 space-y-6">
      <Header title={`Faturamento vs Recebimento — ${ano}`} subtitle="Inadimplência e margem de contribuição" />
      <div className="flex items-center gap-4">
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          suppressHydrationWarning>
          {[2023,2024,2025,2026].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <Button className="ml-auto" onClick={() => setModalOpen(true)}><Plus size={16} /> Lançar NF</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Faturado Ano", value: totalFaturado, color: "text-gray-900" },
          { label: "Recebido Ano", value: totalRecebido, color: "text-emerald-600" },
          { label: "Inadimplência", value: totalFaturado - totalRecebido, color: "text-orange-700", alert: true },
          { label: "Margem Média", value: percentMargemMedia, color: "text-violet-700", pct: true },
        ].map((item) => (
          <div key={item.label} className={`bg-white rounded-xl border p-5 ${item.alert ? "border-orange-200 bg-orange-50" : "border-gray-200"}`}>
            <p className={`text-xs uppercase font-medium mb-1 flex items-center gap-1 ${item.alert ? "text-orange-600" : "text-gray-500"}`}>
              {item.alert && <AlertTriangle size={12} />}{item.label}
            </p>
            <p className={`text-xl font-bold ${item.color}`}>{item.pct ? formatPercent(item.value) : formatCurrency(item.value)}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Evolução Mensal</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={comparativo}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            <Legend />
            <Line type="monotone" dataKey="faturado" name="Faturado" stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="recebido" name="Recebido" stroke="#10b981" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="margemContribuicao" name="Margem" stroke="#8b5cf6" strokeWidth={2} dot={false} strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b"><h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Tabela Comparativa</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                {["Mês","Faturado","Recebido","Inadim. %","Custo Direto","Margem Contrib.","% Margem"].map((h) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-600 uppercase ${h==="Mês"?"text-left":"text-right"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {comparativo.map((row) => (
                <tr key={row.competencia} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{row.mes}</td>
                  <td className="px-4 py-3 text-right text-blue-600">{row.faturado>0?formatCurrency(row.faturado):"—"}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{row.recebido>0?formatCurrency(row.recebido):"—"}</td>
                  <td className={`px-4 py-3 text-right font-medium ${row.percentInadimplencia>5?"text-red-600":"text-gray-600"}`}>
                    {row.faturado>0?formatPercent(row.percentInadimplencia):"—"}
                  </td>
                  <td className="px-4 py-3 text-right text-red-600">{row.custoDireto>0?formatCurrency(row.custoDireto):"—"}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${row.margemContribuicao>=0?"text-violet-700":"text-red-700"}`}>
                    {row.recebido>0?formatCurrency(row.margemContribuicao):"—"}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${row.percentMargem>=50?"text-emerald-600":row.percentMargem>=30?"text-yellow-600":"text-red-600"}`}>
                    {row.recebido>0?formatPercent(row.percentMargem):"—"}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-900 text-white font-bold">
                <td className="px-4 py-3">TOTAL ANO</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totalFaturado)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totalRecebido)}</td>
                <td className="px-4 py-3 text-right">{totalFaturado>0?formatPercent(((totalFaturado-totalRecebido)/totalFaturado)*100):"—"}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(comparativo.reduce((a,m)=>a+m.custoDireto,0))}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totalMargem)}</td>
                <td className="px-4 py-3 text-right">{formatPercent(percentMargemMedia)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Lançar Nota Fiscal" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filial *</label>
            <select value={form.filialId} onChange={(e) => setForm((f) => ({ ...f, filialId: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">Selecione...</option>
              {filiais.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Competência *</label>
            <input type="month" value={form.competencia} onChange={(e) => setForm((f) => ({ ...f, competencia: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              suppressHydrationWarning />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor da NF *</label>
            <input type="number" step="0.01" min="0" value={form.valorNF||""}
              onChange={(e) => setForm((f) => ({ ...f, valorNF: Number(e.target.value) }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <input type="text" value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button loading={salvando} onClick={handleSalvar}>Salvar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
