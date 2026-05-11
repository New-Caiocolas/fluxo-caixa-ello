"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { GRUPOS } from "@/lib/categorias";
import { useFiliais } from "@/lib/hooks/useFilial";
import { Lancamento, LancamentoForm } from "@/types";
import { format } from "date-fns";

interface FormLancamentoProps {
  initial?: Lancamento;
  onSave: (data: LancamentoForm) => Promise<void>;
  onCancel: () => void;
  defaultData?: string;
  defaultFilialId?: string;
}

export function FormLancamento({
  initial,
  onSave,
  onCancel,
  defaultData,
  defaultFilialId,
}: FormLancamentoProps) {
  const { filiais } = useFiliais();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<LancamentoForm>({
    filialId: initial?.filialId || defaultFilialId || "",
    data: initial?.data
      ? format(new Date(initial.data), "yyyy-MM-dd")
      : defaultData || format(new Date(), "yyyy-MM-dd"),
    grupoId: initial?.grupoId || 1,
    subgrupoId: initial?.subgrupoId || "",
    descricao: initial?.descricao || "",
    valor: initial?.valor || 0,
    tipo: initial?.tipo || "ENTRADA",
    observacao: initial?.observacao || "",
  });

  const grupoSelecionado = GRUPOS.find((g) => g.id === Number(form.grupoId));

  useEffect(() => {
    const g = GRUPOS.find((g) => g.id === Number(form.grupoId));
    if (g) {
      setForm((f) => ({ ...f, tipo: g.tipo === "ENTRADA" ? "ENTRADA" : "SAIDA", subgrupoId: "" }));
    }
  }, [form.grupoId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.filialId) { setError("Selecione a filial"); return; }
    if (!form.descricao) { setError("Informe a descrição"); return; }
    if (!form.valor || form.valor <= 0) { setError("Informe o valor"); return; }

    setLoading(true);
    try {
      await onSave({ ...form, grupoId: Number(form.grupoId), valor: Number(form.valor) });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filial *</label>
          <select
            value={form.filialId}
            onChange={(e) => setForm((f) => ({ ...f, filialId: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Selecione...</option>
            {filiais.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
          <input
            type="date"
            value={form.data}
            onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            suppressHydrationWarning
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Grupo *</label>
          <select
            value={form.grupoId}
            onChange={(e) => setForm((f) => ({ ...f, grupoId: Number(e.target.value) }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {GRUPOS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.id} – {g.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subcategoria</label>
          <select
            value={form.subgrupoId}
            onChange={(e) => setForm((f) => ({ ...f, subgrupoId: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Geral (sem subcategoria)</option>
            {grupoSelecionado?.subgrupos.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
        <input
          type="text"
          value={form.descricao}
          onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
          placeholder="Ex: Pagamento fornecedor João"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Valor *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.valor || ""}
            onChange={(e) => setForm((f) => ({ ...f, valor: Number(e.target.value) }))}
            placeholder="0,00"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
          <div className="flex gap-3 mt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="ENTRADA"
                checked={form.tipo === "ENTRADA"}
                onChange={() => setForm((f) => ({ ...f, tipo: "ENTRADA" }))}
                className="accent-emerald-600"
              />
              <span className="text-sm text-emerald-700 font-medium">Entrada</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="SAIDA"
                checked={form.tipo === "SAIDA"}
                onChange={() => setForm((f) => ({ ...f, tipo: "SAIDA" }))}
                className="accent-red-500"
              />
              <span className="text-sm text-red-700 font-medium">Saída</span>
            </label>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
        <textarea
          value={form.observacao}
          onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading}>
          {initial ? "Atualizar" : "Salvar Lançamento"}
        </Button>
      </div>
    </form>
  );
}
