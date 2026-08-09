"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/lib/context/AuthContext";
import { useGrupos, type GrupoAPI } from "@/lib/hooks/useGrupos";
import type { Classificacao } from "@/lib/categorias";
import { CLASSIFICACOES } from "@/lib/grupos";
import { buscarJson } from "@/lib/buscarJson";
import { ChevronDown, ChevronRight, FolderTree, Plus, Pencil } from "lucide-react";

/**
 * Texto de cada classificação na UI.
 *
 * O `efeito` não é enfeite: escolher errado aqui não gera erro nenhum — só faz
 * o dinheiro entrar na conta errada (ou em conta nenhuma, no caso de NEUTRO) e
 * o problema aparece semanas depois como número torto no relatório.
 */
const EXPLICACAO: Record<Classificacao, { label: string; efeito: string; direcao?: "ENTRADA" | "SAIDA" }> = {
  RECEBIMENTO: {
    label: "Recebimento",
    efeito: "Entra como receita e forma a base do fluxo operacional.",
    direcao: "ENTRADA",
  },
  CUSTO_OPERACIONAL: {
    label: "Custo operacional",
    efeito: "Subtrai do fluxo operacional. É o caso da maioria das despesas.",
    direcao: "SAIDA",
  },
  RESULTADO_FINANCEIRO: {
    label: "Resultado financeiro",
    efeito:
      "Fica fora do fluxo operacional e entra no fluxo livre com sinal — permite juros recebidos e pagos no mesmo grupo.",
  },
  INVESTIMENTO: {
    label: "Investimento",
    efeito: "Fica fora do fluxo operacional e subtrai do fluxo livre.",
    direcao: "SAIDA",
  },
  NEUTRO: {
    label: "Neutro",
    efeito:
      "Não entra em nenhum indicador. Os lançamentos existem no histórico mas não afetam fluxo operacional nem livre.",
  },
};

interface FormGrupo {
  nome: string;
  tipo: "ENTRADA" | "SAIDA";
  classificacao: Classificacao;
  permiteAmbosTipos: boolean;
  ordem: string;
}

const formVazio: FormGrupo = {
  nome: "",
  tipo: "SAIDA",
  classificacao: "CUSTO_OPERACIONAL",
  permiteAmbosTipos: false,
  ordem: "",
};

export function SecaoCategorias() {
  const { user } = useAuth();
  const podeEditar = user?.role === "ADMIN" || user?.role === "GESTOR";

  const { grupos, carregando, erro, recarregar } = useGrupos();
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());

  const [modalGrupo, setModalGrupo] = useState(false);
  const [editandoGrupo, setEditandoGrupo] = useState<GrupoAPI | null>(null);
  const [form, setForm] = useState<FormGrupo>(formVazio);

  const [modalSub, setModalSub] = useState<{ grupo: GrupoAPI; subId?: string } | null>(null);
  const [nomeSub, setNomeSub] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState("");
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  function alternar(id: number) {
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function abrirNovoGrupo() {
    setEditandoGrupo(null);
    setForm(formVazio);
    setErroForm("");
    setModalGrupo(true);
  }

  function abrirEdicaoGrupo(g: GrupoAPI) {
    setEditandoGrupo(g);
    setForm({
      nome: g.nome,
      tipo: g.tipo,
      classificacao: g.classificacao,
      permiteAmbosTipos: g.permiteAmbosTipos,
      ordem: String(g.ordem),
    });
    setErroForm("");
    setModalGrupo(true);
  }

  // A classificação manda na direção: escolher "Recebimento" e deixar o tipo em
  // SAIDA seria recusado pelo backend, então o formulário já ajusta.
  function escolherClassificacao(c: Classificacao) {
    const direcao = EXPLICACAO[c].direcao;
    setForm((f) => ({
      ...f,
      classificacao: c,
      tipo: direcao ?? f.tipo,
      permiteAmbosTipos: c === "RESULTADO_FINANCEIRO" ? f.permiteAmbosTipos : false,
    }));
  }

  async function salvarGrupo() {
    setErroForm("");
    if (!form.nome.trim()) {
      setErroForm("Informe o nome do grupo");
      return;
    }
    setSalvando(true);
    try {
      const url = editandoGrupo ? `/api/grupos/${editandoGrupo.id}` : "/api/grupos";
      const res = await fetch(url, {
        method: editandoGrupo ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome,
          tipo: form.tipo,
          classificacao: form.classificacao,
          permiteAmbosTipos: form.permiteAmbosTipos,
          ordem: form.ordem ? Number(form.ordem) : undefined,
          ativo: editandoGrupo ? editandoGrupo.ativo : true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErroForm(json.error || "Erro ao salvar");
        return;
      }
      setModalGrupo(false);
      recarregar();
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivoGrupo(g: GrupoAPI) {
    setErroAcao(null);
    const r = await buscarJson(`/api/grupos/${g.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: g.nome,
        tipo: g.tipo,
        classificacao: g.classificacao,
        permiteAmbosTipos: g.permiteAmbosTipos,
        ordem: g.ordem,
        ativo: !g.ativo,
      }),
    });
    if (!r.ok) {
      setErroAcao(r.erro);
      return;
    }
    recarregar();
  }

  async function salvarSubgrupo() {
    if (!modalSub || !nomeSub.trim()) return;
    setSalvando(true);
    setErroForm("");
    try {
      const editando = modalSub.subId;
      const res = await fetch(editando ? `/api/subgrupos/${editando}` : "/api/subgrupos", {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grupoId: modalSub.grupo.id, nome: nomeSub, ativo: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErroForm(json.error || "Erro ao salvar");
        return;
      }
      setModalSub(null);
      setNomeSub("");
      recarregar();
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivoSub(subId: string, nome: string, ativo: boolean) {
    setErroAcao(null);
    const r = await buscarJson(`/api/subgrupos/${subId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, ativo: !ativo }),
    });
    if (!r.ok) {
      setErroAcao(r.erro);
      return;
    }
    recarregar();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <FolderTree size={18} className="text-emerald-600" />
        <h3 className="font-semibold text-gray-900">Grupos e Subcategorias</h3>
        {podeEditar ? (
          <Button size="sm" className="ml-auto" onClick={abrirNovoGrupo}>
            <Plus size={14} className="mr-1" />
            Novo Grupo
          </Button>
        ) : (
          <span className="ml-auto text-xs text-gray-400">Somente ADMIN e GESTOR podem editar</span>
        )}
      </div>

      {erro && <p className="px-6 py-4 text-sm text-red-600">{erro}</p>}
      {erroAcao && (
        <p role="alert" className="px-6 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">
          {erroAcao}
        </p>
      )}
      {carregando && <p className="px-6 py-4 text-sm text-gray-500">Carregando…</p>}

      <div className="divide-y divide-gray-100">
        {grupos.map((g) => {
          const aberto = expandidos.has(g.id);
          return (
            <div key={g.id}>
              <div className="px-6 py-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => alternar(g.id)}
                  // O ícone tem 16px; o padding leva o alvo de toque aos 24px
                  // mínimos sem mudar o tamanho aparente do chevron.
                  className="p-1 -m-1 text-gray-400 hover:text-gray-600"
                  aria-label={aberto ? "Recolher subcategorias" : "Expandir subcategorias"}
                >
                  {aberto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                <span className="text-xs text-gray-400 w-6">{g.id}</span>

                <div className="min-w-0 flex-1">
                  <p className={`font-medium truncate ${g.ativo ? "text-gray-900" : "text-gray-400 line-through"}`}>
                    {g.nome}
                  </p>
                  <p className="text-xs text-gray-500">
                    {EXPLICACAO[g.classificacao].label} · {g.tipo === "ENTRADA" ? "Entrada" : "Saída"}
                    {g.permiteAmbosTipos && " · aceita as duas direções"}
                    {" · "}
                    {g.subgrupos.length} subcategoria{g.subgrupos.length === 1 ? "" : "s"}
                  </p>
                </div>

                {podeEditar && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => abrirEdicaoGrupo(g)}
                      className="p-2 text-gray-400 hover:text-emerald-600"
                      title="Editar grupo"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => alternarAtivoGrupo(g)}
                      className={`text-xs px-2 py-1 min-h-6 rounded ${
                        g.ativo ? "text-emerald-700 hover:bg-emerald-50" : "text-gray-500 hover:bg-gray-100"
                      }`}
                      title={g.ativo ? "Desativar (some dos formulários)" : "Reativar"}
                    >
                      {g.ativo ? "Ativo" : "Inativo"}
                    </button>
                  </div>
                )}
              </div>

              {aberto && (
                <div className="bg-gray-50 px-6 py-3 pl-16 space-y-2">
                  {g.subgrupos.length === 0 && (
                    <p className="text-xs text-gray-400">Nenhuma subcategoria.</p>
                  )}
                  {g.subgrupos.map((s) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <span className={`text-sm flex-1 ${s.ativo ? "text-gray-700" : "text-gray-400 line-through"}`}>
                        {s.nome}
                      </span>
                      {podeEditar && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setModalSub({ grupo: g, subId: s.id });
                              setNomeSub(s.nome);
                              setErroForm("");
                            }}
                            className="p-2 text-gray-400 hover:text-emerald-600"
                            title="Renomear"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => alternarAtivoSub(s.id, s.nome, s.ativo)}
                            className="text-xs px-2 py-1 min-h-6 rounded text-gray-500 hover:bg-gray-200"
                          >
                            {s.ativo ? "Ativa" : "Inativa"}
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                  {podeEditar && g.ativo && (
                    <button
                      type="button"
                      onClick={() => {
                        setModalSub({ grupo: g });
                        setNomeSub("");
                        setErroForm("");
                      }}
                      className="text-xs text-emerald-600 hover:underline"
                    >
                      + Adicionar subcategoria
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal de grupo */}
      <Modal
        open={modalGrupo}
        onClose={() => setModalGrupo(false)}
        title={editandoGrupo ? `Editar Grupo ${editandoGrupo.id}` : "Novo Grupo"}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="grupo-nome" className="block text-sm font-medium text-gray-700 mb-1">
              Nome *
            </label>
            <input
              id="grupo-nome"
              value={form.nome}
              maxLength={60}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-1">
              Como entra no cálculo *
            </legend>
            <div className="space-y-2">
              {CLASSIFICACOES.map((c) => (
                <label
                  key={c}
                  className={`flex gap-2 p-2 rounded-lg border cursor-pointer ${
                    form.classificacao === c ? "border-emerald-500 bg-emerald-50" : "border-gray-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="classificacao"
                    className="mt-1"
                    checked={form.classificacao === c}
                    onChange={() => escolherClassificacao(c)}
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">{EXPLICACAO[c].label}</span>
                    <span className="block text-xs text-gray-500">{EXPLICACAO[c].efeito}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="grupo-tipo" className="block text-sm font-medium text-gray-700 mb-1">
              Direção dos lançamentos
            </label>
            <select
              id="grupo-tipo"
              value={form.tipo}
              disabled={!!EXPLICACAO[form.classificacao].direcao}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as "ENTRADA" | "SAIDA" }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="ENTRADA">Entrada</option>
              <option value="SAIDA">Saída</option>
            </select>
            {EXPLICACAO[form.classificacao].direcao && (
              <p className="text-xs text-gray-500 mt-1">
                Definida pela classificação escolhida.
              </p>
            )}
          </div>

          {form.classificacao === "RESULTADO_FINANCEIRO" && (
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.permiteAmbosTipos}
                onChange={(e) => setForm((f) => ({ ...f, permiteAmbosTipos: e.target.checked }))}
              />
              <span className="text-sm text-gray-700">
                Aceitar entrada e saída no mesmo grupo
                <span className="block text-xs text-gray-500">
                  Quem lança escolhe a direção — como em juros recebidos e juros pagos.
                </span>
              </span>
            </label>
          )}

          <div>
            <label htmlFor="grupo-ordem" className="block text-sm font-medium text-gray-700 mb-1">
              Ordem de exibição
            </label>
            <input
              id="grupo-ordem"
              type="number"
              min="1"
              value={form.ordem}
              placeholder="999"
              onChange={(e) => setForm((f) => ({ ...f, ordem: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {editandoGrupo && (
            <p className="text-xs text-gray-500">
              Se o grupo já tiver lançamentos, a direção não pode mudar — isso inverteria o sinal
              de todo o histórico.
            </p>
          )}

          {erroForm && <p className="text-sm text-red-600">{erroForm}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalGrupo(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarGrupo} loading={salvando}>
              Salvar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de subcategoria */}
      <Modal
        open={!!modalSub}
        onClose={() => setModalSub(null)}
        title={modalSub?.subId ? "Renomear Subcategoria" : "Nova Subcategoria"}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">Grupo: {modalSub?.grupo.nome}</p>
          <div>
            <label htmlFor="sub-nome" className="block text-sm font-medium text-gray-700 mb-1">
              Nome *
            </label>
            <input
              id="sub-nome"
              value={nomeSub}
              maxLength={60}
              onChange={(e) => setNomeSub(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          {erroForm && <p className="text-sm text-red-600">{erroForm}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalSub(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarSubgrupo} loading={salvando}>
              Salvar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
