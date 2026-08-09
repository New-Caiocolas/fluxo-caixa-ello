"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useFilialAtiva, useFiliais } from "@/lib/hooks/useFilial";
import { useAuth } from "@/lib/context/AuthContext";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { buscarJson } from "@/lib/buscarJson";
import { AvisoErro } from "@/components/ui/AvisoErro";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Plus, AlertTriangle, Edit, Trash2 } from "lucide-react";

interface ComparativoItem {
  mes: string; competencia: string; faturado: number; recebido: number;
  custoDireto: number; inadimplencia: number; margemContribuicao: number;
  percentMargem: number; percentInadimplencia: number;
}
interface FaturamentoItem {
  id: string; filialId: string; competencia: string; valorNF: number;
  descricao?: string; filial: { nome: string };
}

const formVazio = {
  filialId: "", competencia: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
  valorNF: 0, descricao: "",
};

export function AbaFaturamento() {
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "GESTOR";
  const { filialAtiva } = useFilialAtiva();
  const { filiais } = useFiliais();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [comparativo, setComparativo] = useState<ComparativoItem[]>([]);
  const [faturamentos, setFaturamentos] = useState<FaturamentoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<FaturamentoItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(formVazio);
  const [salvando, setSalvando] = useState(false);

  const fetchFaturamento = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ano: String(ano) });
      if (filialAtiva) params.set("filialId", filialAtiva);
      const r = await buscarJson<{ comparativo: ComparativoItem[]; faturamentos: FaturamentoItem[] }>(
        `/api/faturamento?${params}`
      );
      if (r.ok) { setComparativo(r.dados.comparativo); setFaturamentos(r.dados.faturamentos); }
      else setErroCarga(r.erro);
    } finally { setLoading(false); }
  }, [filialAtiva, ano]);

  useEffect(() => { fetchFaturamento(); }, [fetchFaturamento]);

  function abrirNovo() {
    setEditItem(null);
    setForm(formVazio);
    setModalOpen(true);
  }

  function abrirEdicao(item: FaturamentoItem) {
    setEditItem(item);
    setForm({ filialId: item.filialId, competencia: item.competencia, valorNF: item.valorNF, descricao: item.descricao || "" });
    setModalOpen(true);
  }

  async function handleSalvar() {
    setSalvando(true);
    try {
      const url = editItem ? `/api/faturamento/${editItem.id}` : "/api/faturamento";
      const method = editItem ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, valorNF: Number(form.valorNF) }),
      });
      if (res.ok) { setModalOpen(false); setEditItem(null); fetchFaturamento(); }
    } finally { setSalvando(false); }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/faturamento/${id}`, { method: "DELETE" });
    if (res.ok) { setDeleteId(null); fetchFaturamento(); }
  }

  const totalFaturado = comparativo.reduce((a, m) => a + m.faturado, 0);
  const totalRecebido = comparativo.reduce((a, m) => a + m.recebido, 0);
  const totalMargem = comparativo.reduce((a, m) => a + m.margemContribuicao, 0);
  const percentMargemMedia = totalRecebido > 0 ? (totalMargem / totalRecebido) * 100 : 0;

  return (
    <>
      {erroCarga && <AvisoErro mensagem={erroCarga} onTentarNovamente={fetchFaturamento} />}
      <div className="flex items-center gap-4">
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          suppressHydrationWarning>
          {[2023,2024,2025,2026].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {canEdit && (
          <Button className="ml-auto" onClick={abrirNovo}><Plus size={16} /> Lançar NF</Button>
        )}
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

      {/* Tabela comparativa */}
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

      {/* Tabela de registros individuais */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Registros de NF</h3>
        </div>
        {/* Cartões — abaixo de sm */}
        <div className="sm:hidden divide-y divide-gray-100">
          {loading ? (
            <div className="py-8 text-center">
              <div className="inline-block w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : faturamentos.length === 0 ? (
            <p className="py-8 text-center text-gray-400 text-sm">Nenhum registro encontrado</p>
          ) : (
            faturamentos.map((f) => (
              <div key={f.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-gray-900 min-w-0 break-words">
                    {f.descricao || "Sem descrição"}
                  </p>
                  <p className="text-sm font-semibold text-blue-600 whitespace-nowrap">
                    {formatCurrency(Number(f.valorNF))}
                  </p>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {f.filial?.nome} · {f.competencia}
                </p>
                {canEdit && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => abrirEdicao(f)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs text-blue-600 hover:bg-blue-50"
                    >
                      <Edit size={14} /> Editar
                    </button>
                    <button
                      onClick={() => setDeleteId(f.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={14} /> Excluir
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="overflow-x-auto hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Filial</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Competência</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Descrição</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Valor NF</th>
                {canEdit && <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={canEdit ? 5 : 4} className="text-center py-8 text-gray-400">
                  <div className="inline-block w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </td></tr>
              ) : faturamentos.length === 0 ? (
                <tr><td colSpan={canEdit ? 5 : 4} className="text-center py-8 text-gray-400 text-sm">Nenhum registro encontrado</td></tr>
              ) : faturamentos.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{f.filial?.nome}</td>
                  <td className="px-4 py-3 text-gray-600">{f.competencia}</td>
                  <td className="px-4 py-3 text-gray-500">{f.descricao || "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-600">{formatCurrency(Number(f.valorNF))}</td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => abrirEdicao(f)}
                          className="p-2.5 sm:p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
                          title="Editar"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteId(f.id)}
                          className="p-2.5 sm:p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal criar/editar */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null); }}
        title={editItem ? "Editar NF" : "Lançar Nota Fiscal"} size="md">
        <div className="space-y-4">
          <div>
            <label htmlFor="fat-filial" className="block text-sm font-medium text-gray-700 mb-1">Filial *</label>
            <select id="fat-filial" value={form.filialId} onChange={(e) => setForm((f) => ({ ...f, filialId: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">Selecione...</option>
              {filiais.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="fat-competencia" className="block text-sm font-medium text-gray-700 mb-1">Competência *</label>
            <input id="fat-competencia" type="month" value={form.competencia} onChange={(e) => setForm((f) => ({ ...f, competencia: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              suppressHydrationWarning />
          </div>
          <div>
            <label htmlFor="fat-valor-da" className="block text-sm font-medium text-gray-700 mb-1">Valor da NF *</label>
            <input id="fat-valor-da" type="number" step="0.01" min="0" value={form.valorNF || ""}
              onChange={(e) => setForm((f) => ({ ...f, valorNF: Number(e.target.value) }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label htmlFor="fat-descricao" className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <input id="fat-descricao" type="text" value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setModalOpen(false); setEditItem(null); }}>Cancelar</Button>
            <Button loading={salvando} onClick={handleSalvar}>
              {editItem ? "Salvar Alterações" : "Salvar"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirmar exclusão" size="sm">
        <p className="text-gray-600 text-sm mb-6">
          Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => deleteId && handleDelete(deleteId)}>Excluir</Button>
        </div>
      </Modal>
    </>
  );
}
