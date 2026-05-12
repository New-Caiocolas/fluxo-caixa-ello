"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/lib/context/AuthContext";
import { formatDate } from "@/lib/utils";
import { Building2, Plus, Users, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";

interface Filial { id: string; nome: string; codigo: string; ativa: boolean; createdAt: string; }

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [modalFilialOpen, setModalFilialOpen] = useState(false);
  const [filialForm, setFilialForm] = useState({ nome: "", codigo: "" });
  const [salvando, setSalvando] = useState(false);

  // Limpar base
  const [modalLimparOpen, setModalLimparOpen] = useState(false);
  const [confirmacaoTexto, setConfirmacaoTexto] = useState("");
  const [limpando, setLimpando] = useState(false);
  const [resultadoLimpeza, setResultadoLimpeza] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    fetch("/api/filiais").then((r) => r.json()).then(setFiliais);
  }, []);

  async function limparBase() {
    setLimpando(true);
    try {
      const res = await fetch("/api/admin/limpar-base", { method: "DELETE" });
      const json = await res.json();
      if (res.ok) {
        setResultadoLimpeza(json.deletados);
        setConfirmacaoTexto("");
      }
    } finally {
      setLimpando(false);
    }
  }

  async function criarFilial() {
    setSalvando(true);
    try {
      const res = await fetch("/api/filiais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filialForm),
      });
      if (res.ok) {
        setModalFilialOpen(false);
        setFilialForm({ nome: "", codigo: "" });
        fetch("/api/filiais").then((r) => r.json()).then(setFiliais);
      }
    } finally { setSalvando(false); }
  }

  return (
    <div className="p-6 space-y-6">
      <Header title="Configurações" subtitle="Filiais, usuários e preferências do sistema" />

      {/* Filiais */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-emerald-600" />
            <h3 className="font-semibold text-gray-900">Filiais cadastradas</h3>
          </div>
          {user?.role === "ADMIN" && (
            <Button size="sm" onClick={() => setModalFilialOpen(true)}>
              <Plus size={14} /> Nova Filial
            </Button>
          )}
        </div>
        <div className="divide-y divide-gray-100">
          {filiais.map((f) => (
            <div key={f.id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{f.nome}</p>
                <p className="text-sm text-gray-500">Código: <span className="font-mono">{f.codigo}</span> · Criada em {formatDate(f.createdAt)}</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${f.ativa ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                {f.ativa ? "Ativa" : "Inativa"}
              </span>
            </div>
          ))}
          {filiais.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">Nenhuma filial cadastrada</div>
          )}
        </div>
      </div>

      {/* Informações do usuário */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Users size={18} className="text-blue-600" />
          <h3 className="font-semibold text-gray-900">Minha Conta</h3>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">Nome</span>
            <span className="text-sm font-medium text-gray-900">{user?.name}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">E-mail</span>
            <span className="text-sm font-medium text-gray-900">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-500">Perfil de acesso</span>
            <span className="text-sm font-medium text-gray-900 flex items-center gap-1">
              <ShieldCheck size={14} className="text-emerald-600" />
              {user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Metas configuradas */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Metas e Alertas</h3>
        </div>
        <div className="px-6 py-4 space-y-3">
          {[
            { meta: "Fluxo Livre ≥ 25% do Recebimento", status: "Ativo", color: "text-emerald-600" },
            { meta: "Custo Direto ≤ 50% do Faturamento", status: "Ativo", color: "text-emerald-600" },
            { meta: "Inadimplência ≤ 5% do Faturamento", status: "Ativo", color: "text-emerald-600" },
          ].map((item) => (
            <div key={item.meta} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-700">{item.meta}</span>
              <span className={`text-xs font-medium ${item.color}`}>{item.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Zona de Perigo — somente ADMIN */}
      {user?.role === "ADMIN" && (
        <div className="bg-white rounded-xl border-2 border-red-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-red-100 flex items-center gap-2 bg-red-50">
            <TriangleAlert size={18} className="text-red-600" />
            <h3 className="font-semibold text-red-700">Zona de Perigo</h3>
            <span className="ml-auto text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Apenas Administrador</span>
          </div>
          <div className="px-6 py-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-gray-900">Limpar base de dados</p>
              <p className="text-sm text-gray-500 mt-0.5">
                Remove <strong>todos os lançamentos, saldos, folhas e faturamentos</strong>. Usuários, filiais, grupos e funcionários são mantidos.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => { setModalLimparOpen(true); setResultadoLimpeza(null); setConfirmacaoTexto(""); }}
            >
              <Trash2 size={14} /> Limpar Base
            </Button>
          </div>
        </div>
      )}

      {/* Modal confirmação de limpeza */}
      <Modal open={modalLimparOpen} onClose={() => setModalLimparOpen(false)} title="Limpar Base de Dados" size="sm">
        {resultadoLimpeza ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="font-semibold text-emerald-800 mb-2">Base limpa com sucesso!</p>
              <ul className="text-sm text-emerald-700 space-y-1">
                {Object.entries(resultadoLimpeza).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span className="capitalize">{k}</span>
                    <span className="font-mono font-bold">{v} registros</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setModalLimparOpen(false)}>Fechar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
              <TriangleAlert size={20} className="text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">
                <p className="font-semibold mb-1">Esta ação é irreversível.</p>
                <p>Todos os <strong>lançamentos, saldos, folhas de pagamento e faturamentos</strong> serão apagados permanentemente. Não é possível desfazer.</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Digite <span className="font-mono bg-gray-100 px-1 rounded text-red-600">CONFIRMAR</span> para prosseguir
              </label>
              <input
                type="text"
                value={confirmacaoTexto}
                onChange={(e) => setConfirmacaoTexto(e.target.value)}
                placeholder="CONFIRMAR"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 font-mono"
                autoComplete="off"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setModalLimparOpen(false)}>Cancelar</Button>
              <Button
                loading={limpando}
                disabled={confirmacaoTexto !== "CONFIRMAR"}
                onClick={limparBase}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-40"
              >
                <Trash2 size={14} /> Limpar Tudo
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={modalFilialOpen} onClose={() => setModalFilialOpen(false)} title="Nova Filial" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input type="text" value={filialForm.nome}
              onChange={(e) => setFilialForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: ELLO Matriz"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
            <input type="text" value={filialForm.codigo}
              onChange={(e) => setFilialForm((f) => ({ ...f, codigo: e.target.value.toUpperCase() }))}
              placeholder="Ex: ELLO-01"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setModalFilialOpen(false)}>Cancelar</Button>
            <Button loading={salvando} onClick={criarFilial}>Criar Filial</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
