"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/lib/context/AuthContext";
import { formatDate } from "@/lib/utils";
import { Building2, Plus, Users, ShieldCheck } from "lucide-react";

interface Filial { id: string; nome: string; codigo: string; ativa: boolean; createdAt: string; }

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [modalFilialOpen, setModalFilialOpen] = useState(false);
  const [filialForm, setFilialForm] = useState({ nome: "", codigo: "" });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetch("/api/filiais").then((r) => r.json()).then(setFiliais);
  }, []);

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
