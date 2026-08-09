"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/lib/context/AuthContext";
import { formatDate, META_PADRAO } from "@/lib/utils";
import { Meta } from "@/types";
import { SecaoCategorias } from "@/components/configuracoes/SecaoCategorias";
import { Building2, Plus, Users, ShieldCheck, Trash2, TriangleAlert, Target } from "lucide-react";

interface Filial { id: string; nome: string; codigo: string; ativa: boolean; createdAt: string; }

const TIPOS_META = [
  { tipo: "FLUXO_LIVRE" as const, label: "Fluxo Livre", prefixo: "≥", sufixo: "do Recebimento" },
  { tipo: "CUSTO_DIRETO" as const, label: "Custo Direto", prefixo: "≤", sufixo: "do Faturamento" },
];

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const canEditMetas = user?.role === "ADMIN" || user?.role === "GESTOR";
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [modalFilialOpen, setModalFilialOpen] = useState(false);
  const [filialForm, setFilialForm] = useState({ nome: "", codigo: "" });
  const [salvando, setSalvando] = useState(false);

  // Metas por filial
  const [metas, setMetas] = useState<Meta[]>([]);
  const [editando, setEditando] = useState<string | null>(null); // `${filialId}-${tipo}`
  const [valorEdit, setValorEdit] = useState("");
  const [salvandoMeta, setSalvandoMeta] = useState(false);

  // Limpar base
  const [modalLimparOpen, setModalLimparOpen] = useState(false);
  const [confirmacaoTexto, setConfirmacaoTexto] = useState("");
  const [limpando, setLimpando] = useState(false);
  const [resultadoLimpeza, setResultadoLimpeza] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    fetch("/api/filiais").then((r) => r.json()).then(setFiliais);
  }, []);

  const fetchMetas = useCallback(async () => {
    const res = await fetch("/api/metas");
    if (res.ok) setMetas(await res.json());
  }, []);

  useEffect(() => { fetchMetas(); }, [fetchMetas]);

  function getMeta(filialId: string, tipo: string): Meta | undefined {
    return metas.find((m) => m.filialId === filialId && m.tipo === tipo);
  }

  function iniciarEdicaoMeta(filialId: string, tipo: "FLUXO_LIVRE" | "CUSTO_DIRETO") {
    if (!canEditMetas) return;
    const m = getMeta(filialId, tipo);
    const padrao = tipo === "FLUXO_LIVRE" ? META_PADRAO.FLUXO_LIVRE : META_PADRAO.CUSTO_DIRETO;
    setValorEdit(String(m?.valorMeta ?? padrao));
    setEditando(`${filialId}-${tipo}`);
  }

  async function salvarMeta(filialId: string, tipoInfo: (typeof TIPOS_META)[number]) {
    const valor = Number(valorEdit);
    if (Number.isNaN(valor) || valor < 0) { setEditando(null); return; }
    setSalvandoMeta(true);
    try {
      const existente = getMeta(filialId, tipoInfo.tipo);
      if (existente) {
        await fetch(`/api/metas/${existente.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ valorMeta: valor }),
        });
      } else {
        await fetch("/api/metas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filialId,
            tipo: tipoInfo.tipo,
            nome: tipoInfo.label,
            valorMeta: valor,
            operador: tipoInfo.tipo === "FLUXO_LIVRE" ? ">=" : "<=",
            baseCalculo: tipoInfo.tipo === "FLUXO_LIVRE" ? "RECEBIMENTO" : "FATURAMENTO",
          }),
        });
      }
      await fetchMetas();
    } finally {
      setSalvandoMeta(false);
      setEditando(null);
    }
  }

  async function toggleMetaAtiva(meta: Meta) {
    if (!canEditMetas) return;
    await fetch(`/api/metas/${meta.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativa: !meta.ativa }),
    });
    fetchMetas();
  }

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
    <div className="p-4 sm:p-6 space-y-6">
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

      {/* Metas configuradas — por filial */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Target size={18} className="text-emerald-600" />
          <h3 className="font-semibold text-gray-900">Metas e Alertas por Filial</h3>
          {!canEditMetas && (
            <span className="ml-auto text-xs text-gray-400">Somente ADMIN e GESTOR podem editar</span>
          )}
        </div>
        <div className="divide-y divide-gray-100">
          {filiais.map((filial) => (
            <div key={filial.id} className="px-6 py-4 flex flex-wrap items-center gap-6">
              <p className="font-medium text-gray-900 min-w-[140px]">{filial.nome}</p>
              <div className="flex flex-wrap gap-6">
                {TIPOS_META.map((tipoInfo) => {
                  const meta = getMeta(filial.id, tipoInfo.tipo);
                  const chave = `${filial.id}-${tipoInfo.tipo}`;
                  const valorAtual = meta?.valorMeta ?? (tipoInfo.tipo === "FLUXO_LIVRE" ? META_PADRAO.FLUXO_LIVRE : META_PADRAO.CUSTO_DIRETO);
                  const ativa = meta?.ativa ?? true;
                  return (
                    <div key={chave} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {tipoInfo.label} {tipoInfo.prefixo}
                      </span>
                      {editando === chave ? (
                        <input
                          type="number"
                          autoFocus
                          min="0"
                          step="1"
                          value={valorEdit}
                          disabled={salvandoMeta}
                          onChange={(e) => setValorEdit(e.target.value)}
                          onBlur={() => salvarMeta(filial.id, tipoInfo)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            if (e.key === "Escape") setEditando(null);
                          }}
                          className="w-16 border border-emerald-300 rounded px-1.5 py-0.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                      ) : (
                        <button
                          type="button"
                          disabled={!canEditMetas}
                          onClick={() => iniciarEdicaoMeta(filial.id, tipoInfo.tipo)}
                          className={`text-sm font-semibold px-1.5 py-0.5 rounded ${
                            ativa ? "text-emerald-700" : "text-gray-400 line-through"
                          } ${canEditMetas ? "hover:bg-emerald-50 cursor-pointer" : "cursor-default"}`}
                        >
                          {valorAtual}%
                        </button>
                      )}
                      <span className="text-xs text-gray-400">{tipoInfo.sufixo}</span>
                      {meta && canEditMetas && (
                        <button
                          type="button"
                          title={ativa ? "Meta ativa — clique para desativar" : "Meta inativa — clique para ativar"}
                          onClick={() => toggleMetaAtiva(meta)}
                          // min-h-6 garante os 24px mínimos de alvo de toque
                          // (WCAG 2.5.8); antes o botão tinha 19px de altura.
                          className={`text-[10px] font-medium px-2 py-1 min-h-6 rounded-full ${
                            ativa ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {ativa ? "Ativo" : "Inativo"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {filiais.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">Cadastre uma filial para configurar metas</div>
          )}
        </div>
      </div>

      {/* Plano de contas — ADMIN e GESTOR editam */}
      <SecaoCategorias />

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
              <label htmlFor="cfg-digite-confirmar" className="block text-sm font-medium text-gray-700 mb-1">
                Digite <span className="font-mono bg-gray-100 px-1 rounded text-red-600">CONFIRMAR</span> para prosseguir
              </label>
              <input id="cfg-digite-confirmar"
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
            <label htmlFor="cfg-nome" className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input id="cfg-nome" type="text" value={filialForm.nome}
              onChange={(e) => setFilialForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: ELLO Matriz"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label htmlFor="cfg-codigo" className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
            <input id="cfg-codigo" type="text" value={filialForm.codigo}
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
