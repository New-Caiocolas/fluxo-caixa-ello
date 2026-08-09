"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency, mesNome, cn } from "@/lib/utils";
import { useAuth } from "@/lib/context/AuthContext";
import { Plus, Users, AlertTriangle, Pencil, X, Save, UserPen } from "lucide-react";
import { format } from "date-fns";

interface FolhaItem {
  funcionarioId: string;
  funcionario: {
    nome: string;
    cargo: string;
    filial: { nome: string };
    filialId: string;
  };
  salarioBase: number;
  comissao: number;
  trienio: number;
  dsr: number;
  totalBruto: number;
  inssPatronal: number;
  entidades: number;
  fgts: number;
  totalEncargos: number;
  totalPagar: number;
}

interface PorFilial {
  filialId: string;
  filialNome: string;
  itens: FolhaItem[];
  totalBruto: number;
  totalEncargos: number;
  totalPagar: number;
}

interface FolhaData {
  funcionarios: Array<{
    id: string;
    nome: string;
    cargo: string;
    salarioBase: number;
    trienio: number;
    filial: { nome: string };
  }>;
  folhaItens: FolhaItem[];
  porFilial: PorFilial[];
  totais: { totalBruto: number; totalEncargos: number; totalPagar: number };
}

interface FuncForm {
  filialId: string;
  nome: string;
  cargo: string;
  salarioBase: number;
  trienio: number;
  admissao: string;
}

function calcularFolha(salarioBase: number, trienioPerc: number, comissao: number) {
  const trienio = salarioBase * trienioPerc;
  const baseComDSR = salarioBase + comissao + trienio;
  const dsr = (baseComDSR / 30) * 4;
  const totalBruto = baseComDSR + dsr;
  const inssPatronal = totalBruto * 0.20;
  const entidades = totalBruto * 0.058;
  const fgts = totalBruto * 0.085;
  const totalEncargos = inssPatronal + entidades + fgts;
  const totalPagar = totalBruto + totalEncargos;
  return { trienio, dsr, totalBruto, inssPatronal, entidades, fgts, totalEncargos, totalPagar };
}

export function AbaFolha() {
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "GESTOR";

  const hoje = new Date();
  const [competencia, setCompetencia] = useState(
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`
  );
  const [data, setData] = useState<FolhaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filiais, setFiliais] = useState<Array<{ id: string; nome: string }>>([]);
  const [modalFuncOpen, setModalFuncOpen] = useState(false);
  const [funcEditandoId, setFuncEditandoId] = useState<string | null>(null);
  const [funcForm, setFuncForm] = useState<FuncForm>({
    filialId: "", nome: "", cargo: "", salarioBase: 0, trienio: 0,
    admissao: format(new Date(), "yyyy-MM-dd"),
  });
  const [salvandoFunc, setSalvandoFunc] = useState(false);

  // Modo edição
  const [modoEdicao, setModoEdicao] = useState(false);
  const [comissoesEdit, setComissoesEdit] = useState<Record<string, number>>({});
  const [salvandoFolha, setSalvandoFolha] = useState(false);

  // Memória de cálculo aberta por funcionário no resumo mobile.
  const [detalheAberto, setDetalheAberto] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/filiais").then((r) => r.json()).then(setFiliais);
  }, []);

  const fetchFolha = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ competencia });
      const res = await fetch(`/api/folha?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [competencia]);

  useEffect(() => { fetchFolha(); }, [fetchFolha]);

  // Ao entrar em modo edição, popula comissões com valores atuais
  function entrarEdicao() {
    if (!data) return;
    const map: Record<string, number> = {};
    for (const item of data.folhaItens) {
      map[item.funcionarioId] = item.comissao || 0;
    }
    setComissoesEdit(map);
    setModoEdicao(true);
  }

  function cancelarEdicao() {
    setModoEdicao(false);
    setComissoesEdit({});
  }

  // Recalcula itens com comissões editadas
  function getItensCalculados(): FolhaItem[] {
    if (!data) return [];
    return data.folhaItens.map((item) => {
      const comissao = modoEdicao
        ? (comissoesEdit[item.funcionarioId] ?? item.comissao)
        : item.comissao;
      const calc = calcularFolha(item.salarioBase, 0, comissao);
      // triênio já está no salárioBase efetivo (veio da API), recalcula do zero
      // Na edição recalculamos passando trienio=0 pois o totalBruto já vem calculado
      // Melhor: buscar a % de triênio do funcionário
      // Para simplificar, usamos o triênio existente no item e recalculamos apenas pelo comissão
      const trienioVal = item.trienio; // mantém triênio calculado
      const baseComDSR = item.salarioBase + comissao + trienioVal;
      const dsr = (baseComDSR / 30) * 4;
      const totalBruto = baseComDSR + dsr;
      const inssPatronal = totalBruto * 0.20;
      const entidades = totalBruto * 0.058;
      const fgts = totalBruto * 0.085;
      const totalEncargos = inssPatronal + entidades + fgts;
      const totalPagar = totalBruto + totalEncargos;
      return { ...item, comissao, dsr, totalBruto, inssPatronal, entidades, fgts, totalEncargos, totalPagar };
    });
  }

  async function salvarFolha() {
    if (!data) return;
    setSalvandoFolha(true);
    try {
      const itens = getItensCalculados().map((item) => ({
        funcionarioId: item.funcionarioId,
        salarioBase: item.salarioBase,
        comissao: item.comissao,
        trienio: item.trienio,
        dsr: item.dsr,
        totalBruto: item.totalBruto,
        inssPatronal: item.inssPatronal,
        entidades: item.entidades,
        fgts: item.fgts,
        totalEncargos: item.totalEncargos,
        totalPagar: item.totalPagar,
      }));
      const res = await fetch("/api/folha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competencia, itens }),
      });
      if (res.ok) {
        setModoEdicao(false);
        setComissoesEdit({});
        await fetchFolha();
      }
    } finally {
      setSalvandoFolha(false);
    }
  }

  function abrirCadastro() {
    setFuncEditandoId(null);
    setFuncForm({ filialId: "", nome: "", cargo: "", salarioBase: 0, trienio: 0, admissao: format(new Date(), "yyyy-MM-dd") });
    setModalFuncOpen(true);
  }

  function abrirEdicaoFuncionario(item: FolhaItem) {
    // Busca os dados completos do funcionário na lista
    const func = data?.funcionarios.find((f) => f.id === item.funcionarioId);
    if (!func) return;
    setFuncEditandoId(item.funcionarioId);
    setFuncForm({
      filialId: item.funcionario.filialId,
      nome: func.nome,
      cargo: func.cargo,
      salarioBase: func.salarioBase,
      trienio: func.trienio,
      admissao: format(new Date(), "yyyy-MM-dd"), // fallback; admissão não vem na listagem
    });
    setModalFuncOpen(true);
  }

  async function salvarFuncionario() {
    setSalvandoFunc(true);
    try {
      const url = funcEditandoId
        ? `/api/funcionarios?id=${funcEditandoId}`
        : "/api/funcionarios";
      const method = funcEditandoId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(funcForm),
      });
      if (res.ok) {
        setModalFuncOpen(false);
        setFuncEditandoId(null);
        fetchFolha();
      }
    } finally {
      setSalvandoFunc(false);
    }
  }

  // Gera itens para exibição (calculados no modo edição, originais no modo leitura)
  const itensExibicao = modoEdicao ? getItensCalculados() : (data?.folhaItens ?? []);

  // Reagrupa por filial para exibição
  const porFilialExibicao = (() => {
    const map: Record<string, PorFilial> = {};
    for (const item of itensExibicao) {
      const fId = item.funcionario.filialId;
      if (!map[fId]) {
        map[fId] = { filialId: fId, filialNome: item.funcionario.filial.nome, itens: [], totalBruto: 0, totalEncargos: 0, totalPagar: 0 };
      }
      map[fId].itens.push(item);
      map[fId].totalBruto += item.totalBruto;
      map[fId].totalEncargos += item.totalEncargos;
      map[fId].totalPagar += item.totalPagar;
    }
    return Object.values(map);
  })();

  const totaisExibicao = {
    totalBruto: itensExibicao.reduce((s, i) => s + i.totalBruto, 0),
    totalEncargos: itensExibicao.reduce((s, i) => s + i.totalEncargos, 0),
    totalPagar: itensExibicao.reduce((s, i) => s + i.totalPagar, 0),
  };

  const [ano, mes] = competencia.split("-").map(Number);

  return (
    <>
      <div className="-mt-2 mb-2">
        <p className="text-sm text-gray-500">
          Folha de Pagamento — {mesNome(mes)} {ano}. Cálculo de salários, encargos e totais por filial.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <input
          type="month"
          value={competencia}
          onChange={(e) => { setCompetencia(e.target.value); cancelarEdicao(); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          suppressHydrationWarning
          disabled={modoEdicao}
        />

        <div className="ml-auto flex items-center gap-2">
          {canEdit && !modoEdicao && data && data.folhaItens.length > 0 && (
            <Button variant="outline" size="sm" onClick={entrarEdicao}>
              <Pencil size={14} /> Editar Folha
            </Button>
          )}
          {modoEdicao && (
            <>
              <Button variant="outline" size="sm" onClick={cancelarEdicao}>
                <X size={14} /> Cancelar
              </Button>
              <Button size="sm" loading={salvandoFolha} onClick={salvarFolha}>
                <Save size={14} /> Salvar Folha
              </Button>
            </>
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={abrirCadastro}>
              <Plus size={14} /> Cadastrar Funcionário
            </Button>
          )}
        </div>
      </div>

      {/* Banner modo edição */}
      {modoEdicao && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-2 text-amber-800 text-sm">
          <Pencil size={15} />
          <span>
            <strong>Modo edição ativo</strong> — edite as comissões e clique em{" "}
            <strong>Salvar Folha</strong> para confirmar.
          </span>
        </div>
      )}

      {/* Totais gerais */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">Total Bruto (todos funcionários)</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totaisExibicao.totalBruto)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">Total Encargos (INSS + FGTS)</p>
            <p className="text-2xl font-bold text-orange-600">{formatCurrency(totaisExibicao.totalEncargos)}</p>
          </div>
          <div className="bg-white rounded-xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm text-red-600 mb-1 font-medium flex items-center gap-1">
              <AlertTriangle size={14} /> Total a Pagar (Empresa)
            </p>
            <p className="text-2xl font-bold text-red-700">{formatCurrency(totaisExibicao.totalPagar)}</p>
          </div>
        </div>
      )}

      {/* Por filial */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : porFilialExibicao.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Nenhum funcionário cadastrado</p>
          {canEdit && (
            <Button className="mt-4" onClick={abrirCadastro}>
              <Plus size={16} /> Cadastrar primeiro funcionário
            </Button>
          )}
        </div>
      ) : (
        porFilialExibicao.map((filial) => (
          <div key={filial.filialId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base">{filial.filialNome}</h3>
              <div className="flex gap-6 text-sm">
                <span>Bruto: <span className="font-semibold text-emerald-300">{formatCurrency(filial.totalBruto)}</span></span>
                <span>Encargos: <span className="font-semibold text-orange-300">{formatCurrency(filial.totalEncargos)}</span></span>
                <span>Total: <span className="font-bold text-red-300">{formatCurrency(filial.totalPagar)}</span></span>
              </div>
            </div>
            {/* Cartões — abaixo de lg.
                A folha é o caso híbrido: parece lista, mas as 12 colunas são a
                decomposição de um cálculo. Por isso o cartão mostra só o que se
                consulta de fato (nome, cargo, total a pagar) e guarda a memória
                de cálculo atrás do toque. No modo de edição a comissão sobe para
                o cartão, já que é o único campo editável. */}
            <div className="lg:hidden divide-y divide-gray-100">
              {filial.itens.map((item, i) => {
                const chave = `${filial.filialId}-${item.funcionarioId}`;
                const aberto = detalheAberto.has(chave);
                const linhas: Array<[string, number, string?]> = [
                  ["Salário base", item.salarioBase],
                  ["Comissão", item.comissao],
                  ["Triênio", item.trienio],
                  ["DSR", item.dsr],
                  ["Total bruto", item.totalBruto, "font-semibold text-gray-900"],
                  ["INSS patronal", item.inssPatronal, "text-orange-600"],
                  ["Entidades", item.entidades, "text-orange-600"],
                  ["FGTS", item.fgts, "text-orange-600"],
                  ["Total encargos", item.totalEncargos, "font-semibold text-orange-700"],
                ];

                return (
                  <div key={i} className={cn("p-4", modoEdicao && "bg-amber-50/40")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 break-words">
                          {item.funcionario.nome}
                        </p>
                        <p className="text-xs text-gray-500">{item.funcionario.cargo}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] text-gray-400">Total a pagar</p>
                        <p className="text-sm font-bold text-red-700 tabular-nums">
                          {formatCurrency(item.totalPagar)}
                        </p>
                      </div>
                    </div>

                    {modoEdicao && (
                      <div className="mt-3 flex items-center gap-2">
                        <label
                          htmlFor={`comissao-${chave}`}
                          className="text-xs text-amber-800 shrink-0"
                        >
                          Comissão
                        </label>
                        <input
                          id={`comissao-${chave}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={comissoesEdit[item.funcionarioId] ?? item.comissao}
                          onChange={(e) =>
                            setComissoesEdit((prev) => ({
                              ...prev,
                              [item.funcionarioId]: Number(e.target.value),
                            }))
                          }
                          className="flex-1 min-w-0 text-right border border-amber-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                        />
                      </div>
                    )}

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setDetalheAberto((atual) => {
                            const novo = new Set(atual);
                            if (novo.has(chave)) novo.delete(chave);
                            else novo.add(chave);
                            return novo;
                          })
                        }
                        aria-expanded={aberto}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        {aberto ? "Ocultar cálculo" : "Ver cálculo"}
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => abrirEdicaoFuncionario(item)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs text-emerald-600 hover:bg-emerald-50"
                        >
                          Editar cadastro
                        </button>
                      )}
                    </div>

                    {aberto && (
                      <div className="mt-3 bg-gray-50 rounded-lg p-3">
                        {linhas.map(([rotulo, valor, cls]) => (
                          <div key={rotulo} className="flex justify-between gap-3 py-0.5">
                            <span className="text-xs text-gray-600">{rotulo}</span>
                            <span className={cn("text-xs tabular-nums text-gray-700", cls)}>
                              {formatCurrency(valor)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="overflow-x-auto hidden lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Funcionário</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Cargo</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Salário Base</th>
                    <th className={`text-right px-4 py-3 text-xs font-semibold uppercase ${modoEdicao ? "text-amber-700 bg-amber-50" : "text-gray-600"}`}>
                      {modoEdicao ? "Comissão ✏️" : "Comissão"}
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Triênio</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">DSR</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Total Bruto</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">INSS Pat.</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Entidades</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">FGTS</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Total Encargos</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-red-700 uppercase bg-red-50">Total a Pagar</th>
                    {canEdit && <th className="px-4 py-3 w-10" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filial.itens.map((item, i) => (
                    <tr key={i} className={`${modoEdicao ? "hover:bg-amber-50" : "hover:bg-gray-50"}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{item.funcionario.nome}</td>
                      <td className="px-4 py-3 text-gray-500">{item.funcionario.cargo}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.salarioBase)}</td>
                      <td className={`px-4 py-3 text-right ${modoEdicao ? "bg-amber-50" : ""}`}>
                        {modoEdicao ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={comissoesEdit[item.funcionarioId] ?? item.comissao}
                            onChange={(e) =>
                              setComissoesEdit((prev) => ({
                                ...prev,
                                [item.funcionarioId]: Number(e.target.value),
                              }))
                            }
                            className="w-28 text-right border border-amber-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                          />
                        ) : (
                          formatCurrency(item.comissao)
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.trienio)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.dsr)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(item.totalBruto)}</td>
                      <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(item.inssPatronal)}</td>
                      <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(item.entidades)}</td>
                      <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(item.fgts)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-orange-700">{formatCurrency(item.totalEncargos)}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-700 bg-red-50">{formatCurrency(item.totalPagar)}</td>
                      {canEdit && (
                        <td className="px-4 py-3 text-center">
                          <button
                            title="Editar funcionário"
                            onClick={() => abrirEdicaoFuncionario(item)}
                            className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-emerald-600 transition-colors"
                          >
                            <UserPen size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr className="bg-gray-900 text-white font-bold">
                    <td colSpan={6} className="px-4 py-3">TOTAL {filial.filialNome.toUpperCase()}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(filial.totalBruto)}</td>
                    <td colSpan={3} />
                    <td className="px-4 py-3 text-right text-orange-300">{formatCurrency(filial.totalEncargos)}</td>
                    <td className="px-4 py-3 text-right text-red-300">{formatCurrency(filial.totalPagar)}</td>
                    {canEdit && <td />}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {/* Modal cadastro funcionário */}
      <Modal open={modalFuncOpen} onClose={() => { setModalFuncOpen(false); setFuncEditandoId(null); }} title={funcEditandoId ? "Editar Funcionário" : "Cadastrar Funcionário"} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="func-filial" className="block text-sm font-medium text-gray-700 mb-1">Filial *</label>
              <select id="func-filial"
                value={funcForm.filialId}
                onChange={(e) => setFuncForm((f) => ({ ...f, filialId: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Selecione...</option>
                {filiais.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="func-data-admissao" className="block text-sm font-medium text-gray-700 mb-1">Data Admissão *</label>
              <input id="func-data-admissao"
                type="date"
                value={funcForm.admissao}
                onChange={(e) => setFuncForm((f) => ({ ...f, admissao: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div>
            <label htmlFor="func-nome" className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input id="func-nome"
              type="text"
              value={funcForm.nome}
              onChange={(e) => setFuncForm((f) => ({ ...f, nome: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="func-cargo" className="block text-sm font-medium text-gray-700 mb-1">Cargo *</label>
            <input id="func-cargo"
              type="text"
              value={funcForm.cargo}
              onChange={(e) => setFuncForm((f) => ({ ...f, cargo: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="func-salario-base" className="block text-sm font-medium text-gray-700 mb-1">Salário Base *</label>
              <input id="func-salario-base"
                type="number"
                step="0.01"
                value={funcForm.salarioBase || ""}
                onChange={(e) => setFuncForm((f) => ({ ...f, salarioBase: Number(e.target.value) }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="func-trienio-decimal" className="block text-sm font-medium text-gray-700 mb-1">Triênio (% decimal, ex: 0.03)</label>
              <input id="func-trienio-decimal"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={funcForm.trienio || ""}
                onChange={(e) => setFuncForm((f) => ({ ...f, trienio: Number(e.target.value) }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setModalFuncOpen(false); setFuncEditandoId(null); }}>Cancelar</Button>
            <Button loading={salvandoFunc} onClick={salvarFuncionario}>{funcEditandoId ? "Salvar Alterações" : "Cadastrar"}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
