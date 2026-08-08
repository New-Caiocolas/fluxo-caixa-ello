"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { FormLancamento } from "@/components/lancamentos/FormLancamento";
import { useFilialAtiva } from "@/lib/hooks/useFilial";
import { useAuth } from "@/lib/context/AuthContext";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Lancamento, LancamentoForm } from "@/types";
import { Plus, Edit, Trash2, Search, Filter } from "lucide-react";
import { format } from "date-fns";

export function AbaDiarios() {
  const { user } = useAuth();
  // OPERADOR pode editar lançamentos, mas não criar nem excluir (decisão de 2026-05-27).
  const canCreate = user?.role === "ADMIN" || user?.role === "GESTOR";
  const canEdit = user?.role === "ADMIN" || user?.role === "GESTOR" || user?.role === "OPERADOR";
  const canDelete = user?.role === "ADMIN" || user?.role === "GESTOR";
  const { filialAtiva } = useFilialAtiva();
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Lancamento | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const hoje = format(new Date(), "yyyy-MM-dd");
  const [filtros, setFiltros] = useState({
    competencia: format(new Date(), "yyyy-MM"),
    data: "",
  });

  const fetchLancamentos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (filialAtiva) params.set("filialId", filialAtiva);
      if (filtros.data) params.set("data", filtros.data);
      else if (filtros.competencia) params.set("competencia", filtros.competencia);

      const res = await fetch(`/api/lancamentos?${params}`);
      const json = await res.json();
      setLancamentos(json.data || []);
      setTotal(json.total || 0);
    } finally {
      setLoading(false);
    }
  }, [filialAtiva, filtros, page]);

  useEffect(() => { setPage(1); }, [filialAtiva]);
  useEffect(() => { fetchLancamentos(); }, [fetchLancamentos]);

  async function handleSave(data: LancamentoForm) {
    const url = editItem ? `/api/lancamentos/${editItem.id}` : "/api/lancamentos";
    const method = editItem ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao salvar");
    }

    setModalOpen(false);
    setEditItem(undefined);
    fetchLancamentos();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/lancamentos/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDeleteId(null);
      fetchLancamentos();
    }
  }

  const totaisVisiveis = lancamentos.reduce(
    (acc, l) => {
      if (l.tipo === "ENTRADA") acc.entradas += Number(l.valor);
      else acc.saidas += Number(l.valor);
      return acc;
    },
    { entradas: 0, saidas: 0 }
  );

  return (
    <>
      {/* Filtros e ação */}
      <div className="flex flex-wrap items-center gap-4 bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <input
            type="month"
            value={filtros.competencia}
            onChange={(e) => { setFiltros((f) => ({ ...f, competencia: e.target.value, data: "" })); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            suppressHydrationWarning
          />
        </div>
        <div className="flex items-center gap-2">
          <Search size={16} className="text-gray-400" />
          <input
            type="date"
            value={filtros.data}
            onChange={(e) => { setFiltros((f) => ({ ...f, data: e.target.value, competencia: "" })); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Filtrar por data"
          />
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-500">Entradas: <span className="text-emerald-600 font-semibold">{formatCurrency(totaisVisiveis.entradas)}</span></p>
            <p className="text-xs text-gray-500">Saídas: <span className="text-red-600 font-semibold">{formatCurrency(totaisVisiveis.saidas)}</span></p>
          </div>
          {canCreate && (
            <Button onClick={() => { setEditItem(undefined); setModalOpen(true); }}>
              <Plus size={16} /> Novo Lançamento
            </Button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Cartões — abaixo de sm. Um lançamento é um registro independente, então
            empilhar não perde comparação lateral nenhuma; a tabela de 7 colunas
            obrigaria a rolar de lado para ler uma linha só. */}
        <div className="sm:hidden divide-y divide-gray-100">
          {loading ? (
            <div className="py-12 text-center">
              <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : lancamentos.length === 0 ? (
            <p className="py-12 text-center text-gray-400 text-sm">Nenhum lançamento encontrado</p>
          ) : (
            lancamentos.map((l) => (
              <div key={l.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-gray-900 min-w-0 break-words">
                    {l.descricao}
                  </p>
                  <p
                    className={`text-sm font-semibold whitespace-nowrap ${
                      l.tipo === "ENTRADA" ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {l.tipo === "ENTRADA" ? "+" : "−"}
                    {formatCurrency(Number(l.valor))}
                  </p>
                </div>

                <p className="mt-1 text-xs text-gray-500">
                  {formatDate(l.data)} · {l.grupo?.nome}
                  {l.subgrupo && ` · ${l.subgrupo.nome}`}
                </p>
                <p className="text-xs text-gray-400">{l.filial?.nome || "—"}</p>

                {canEdit && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => { setEditItem(l); setModalOpen(true); }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs text-blue-600 hover:bg-blue-50"
                    >
                      <Edit size={14} /> Editar
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => setDeleteId(l.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={14} /> Excluir
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="overflow-x-auto hidden sm:block">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Filial</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Categoria</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Descrição</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Valor</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Tipo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  </td>
                </tr>
              ) : lancamentos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                    Nenhum lançamento encontrado
                  </td>
                </tr>
              ) : (
                lancamentos.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {formatDate(l.data)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {l.filial?.nome || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>
                        <p className="text-gray-700 font-medium">{l.grupo?.nome}</p>
                        {l.subgrupo && (
                          <p className="text-xs text-gray-400">{l.subgrupo.nome}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-[200px] truncate">
                      {l.descricao}
                    </td>
                    <td className={`px-4 py-3 text-sm font-semibold text-right whitespace-nowrap ${
                      l.tipo === "ENTRADA" ? "text-emerald-600" : "text-red-600"
                    }`}>
                      {l.tipo === "ENTRADA" ? "+" : "−"}{formatCurrency(Number(l.valor))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={l.tipo === "ENTRADA" ? "success" : "danger"}>
                        {l.tipo === "ENTRADA" ? "Entrada" : "Saída"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canEdit && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setEditItem(l); setModalOpen(true); }}
                            className="p-2.5 sm:p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
                            title="Editar"
                          >
                            <Edit size={15} />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => setDeleteId(l.id)}
                              className="p-2.5 sm:p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {total > 50 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">{total} registros</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                Anterior
              </Button>
              <span className="text-sm text-gray-600 px-2 py-1">Página {page}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={lancamentos.length < 50}>
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de lançamento */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditItem(undefined); }}
        title={editItem ? "Editar Lançamento" : "Novo Lançamento"}
        size="lg"
      >
        <FormLancamento
          initial={editItem}
          onSave={handleSave}
          onCancel={() => { setModalOpen(false); setEditItem(undefined); }}
          defaultData={hoje}
          defaultFilialId={filialAtiva}
        />
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Confirmar exclusão"
        size="sm"
      >
        <p className="text-gray-600 text-sm mb-6">
          Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => deleteId && handleDelete(deleteId)}>
            Excluir
          </Button>
        </div>
      </Modal>
    </>
  );
}
