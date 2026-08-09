"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/context/AuthContext";
import { formatDate } from "@/lib/utils";
import { buscarJson } from "@/lib/buscarJson";
import { AvisoErro } from "@/components/ui/AvisoErro";
import { Plus, Edit, Trash2, ShieldCheck, User, Eye, EyeOff } from "lucide-react";

interface Usuario {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface Form {
  name: string;
  email: string;
  password: string;
  role: string;
}

const PERFIS = [
  { value: "ADMIN", label: "Administrador", desc: "Acesso total, incluindo gestão de usuários" },
  { value: "GESTOR", label: "Gestor", desc: "Acesso a todos os módulos, sem gestão de usuários" },
  { value: "OPERADOR", label: "Operador", desc: "Lançamentos e consultas básicas" },
];

const badgeRole: Record<string, "success" | "info" | "neutral"> = {
  ADMIN: "success",
  GESTOR: "info",
  OPERADOR: "neutral",
};

const formVazio: Form = { name: "", email: "", password: "", role: "OPERADOR" };

export default function UsuariosPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(formVazio);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  useEffect(() => {
    if (user && user.role !== "ADMIN") router.replace("/dashboard");
  }, [user, router]);

  const fetchUsuarios = useCallback(async () => {
    setLoading(true);
    setErroCarga(null);
    try {
      const r = await buscarJson<Usuario[]>("/api/usuarios");
      if (r.ok) setUsuarios(r.dados);
      else setErroCarga(r.erro);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsuarios(); }, [fetchUsuarios]);

  function abrirCriar() {
    setEditando(null);
    setForm(formVazio);
    setErro("");
    setMostrarSenha(false);
    setModalOpen(true);
  }

  function abrirEditar(u: Usuario) {
    setEditando(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role });
    setErro("");
    setMostrarSenha(false);
    setModalOpen(true);
  }

  async function salvar() {
    setErro("");
    if (!form.name.trim() || !form.email.trim()) {
      setErro("Nome e e-mail são obrigatórios.");
      return;
    }
    if (!editando && !form.password.trim()) {
      setErro("A senha é obrigatória para novos usuários.");
      return;
    }
    if (form.password && form.password.length < 6) {
      setErro("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setSalvando(true);
    try {
      const url = editando ? `/api/usuarios/${editando.id}` : "/api/usuarios";
      const method = editando ? "PATCH" : "POST";
      const body = editando
        ? { name: form.name, email: form.email, role: form.role, password: form.password || undefined }
        : form;

      const r = await buscarJson(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) { setErro(r.erro); return; }

      setModalOpen(false);
      fetchUsuarios();
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: string) {
    const r = await buscarJson(`/api/usuarios/${id}`, { method: "DELETE" });
    if (!r.ok) { setErroExclusao(r.erro); return; }
    setDeleteId(null);
    fetchUsuarios();
  }

  if (user?.role !== "ADMIN") return null;

  const deletando = usuarios.find((u) => u.id === deleteId);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Header title="Gerenciamento de Usuários" subtitle="Cadastre e gerencie perfis de acesso ao sistema" />

      {erroCarga && <AvisoErro mensagem={erroCarga} onTentarNovamente={fetchUsuarios} />}

      {/* Cartões de resumo */}
      <div className="grid grid-cols-3 gap-4">
        {PERFIS.map((p) => {
          const count = usuarios.filter((u) => u.role === p.value).length;
          return (
            <div key={p.value} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">{p.label}</p>
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <p className="text-xs text-gray-400 mt-1">{p.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">
            {usuarios.length} {usuarios.length === 1 ? "usuário cadastrado" : "usuários cadastrados"}
          </h3>
          <Button onClick={abrirCriar}>
            <Plus size={16} /> Novo Usuário
          </Button>
        </div>

        {/* Cartões — abaixo de sm */}
        <div className="sm:hidden divide-y divide-gray-100">
          {usuarios.length === 0 ? (
            <p className="py-12 text-center text-gray-400 text-sm">Nenhum usuário cadastrado</p>
          ) : (
            usuarios.map((u) => (
              <div key={u.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 break-words">
                      {u.name}
                      {u.id === user?.id && (
                        <span className="ml-1.5 text-xs text-emerald-600">você</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 break-all">{u.email}</p>
                  </div>
                  <Badge variant={badgeRole[u.role] ?? "neutral"}>
                    {PERFIS.find((p) => p.value === u.role)?.label ?? u.role}
                  </Badge>
                </div>

                <p className="mt-1 text-xs text-gray-400">
                  Cadastrado em {formatDate(u.createdAt)}
                </p>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => abrirEditar(u)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs text-blue-600 hover:bg-blue-50"
                  >
                    <Edit size={14} /> Editar
                  </button>
                  <button
                    onClick={() => { setErroExclusao(null); setDeleteId(u.id); }}
                    disabled={u.id === user?.id}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={u.id === user?.id ? "Não é possível excluir sua própria conta" : undefined}
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="overflow-x-auto hidden sm:block">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Usuário</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">E-mail</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Perfil</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Cadastrado em</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  </td>
                </tr>
              ) : usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <User size={14} className="text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{u.name}</p>
                        {u.id === user?.id && (
                          <p className="text-xs text-emerald-600">você</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck size={13} className={
                        u.role === "ADMIN" ? "text-emerald-600" :
                        u.role === "GESTOR" ? "text-blue-500" : "text-gray-400"
                      } />
                      <Badge variant={badgeRole[u.role] ?? "neutral"}>
                        {PERFIS.find((p) => p.value === u.role)?.label ?? u.role}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(u.createdAt)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => abrirEditar(u)}
                        className="p-2.5 sm:p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
                        title="Editar"
                      >
                        <Edit size={15} />
                      </button>
                      <button
                        onClick={() => { setErroExclusao(null); setDeleteId(u.id); }}
                        disabled={u.id === user?.id}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={u.id === user?.id ? "Não é possível excluir sua própria conta" : "Excluir"}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal criar/editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? "Editar Usuário" : "Novo Usuário"}
        size="sm"
      >
        <div className="space-y-4">
          {/* Nome */}
          <div>
            <label htmlFor="usr-nome" className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input id="usr-nome"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nome completo"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* E-mail */}
          <div>
            <label htmlFor="usr-e-mail" className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
            <input id="usr-e-mail"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="usuario@empresa.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Senha */}
          <div>
            <label htmlFor="usr-senha" className="block text-sm font-medium text-gray-700 mb-1">
              Senha {editando ? "(deixe em branco para manter)" : "*"}
            </label>
            <div className="relative">
              <input id="usr-senha"
                type={mostrarSenha ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={editando ? "Nova senha (opcional)" : "Mínimo 6 caracteres"}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {mostrarSenha ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Perfil — fieldset/legend em vez de label: o rótulo descreve o grupo
              de opções, e não um campo único ao qual um htmlFor pudesse apontar.
              Cada opção já é um label envolvendo seu próprio radio. */}
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-2">Perfil de acesso *</legend>
            <div className="space-y-2">
              {PERFIS.map((p) => (
                <label
                  key={p.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    form.role === p.value
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={p.value}
                    checked={form.role === p.value}
                    onChange={() => setForm((f) => ({ ...f, role: p.value }))}
                    className="mt-0.5 accent-emerald-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.label}</p>
                    <p className="text-xs text-gray-500">{p.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          {erro && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{erro}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button loading={salvando} onClick={salvar}>
              {editando ? "Salvar alterações" : "Criar usuário"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Excluir usuário"
        size="sm"
      >
        <p className="text-sm text-gray-600 mb-2">
          Tem certeza que deseja excluir o usuário{" "}
          <span className="font-semibold text-gray-900">{deletando?.name}</span>?
        </p>
        <p className="text-xs text-gray-400 mb-6">
          Esta ação não pode ser desfeita. Os lançamentos criados por este usuário serão mantidos.
        </p>
          {erroExclusao && (
            <p role="alert" className="text-sm text-red-600">{erroExclusao}</p>
          )}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => deleteId && excluir(deleteId)}>Excluir</Button>
        </div>
      </Modal>
    </div>
  );
}
