"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency, mesNome } from "@/lib/utils";
import { Plus, Users, AlertTriangle } from "lucide-react";
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

export default function FolhaPage() {
  const hoje = new Date();
  const [competencia, setCompetencia] = useState(
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`
  );
  const [data, setData] = useState<FolhaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filiais, setFiliais] = useState<Array<{ id: string; nome: string }>>([]);
  const [modalFuncOpen, setModalFuncOpen] = useState(false);
  const [funcForm, setFuncForm] = useState<FuncForm>({
    filialId: "", nome: "", cargo: "", salarioBase: 0, trienio: 0,
    admissao: format(new Date(), "yyyy-MM-dd"),
  });
  const [salvandoFunc, setSalvandoFunc] = useState(false);

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

  async function salvarFuncionario() {
    setSalvandoFunc(true);
    try {
      const res = await fetch("/api/funcionarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(funcForm),
      });
      if (res.ok) {
        setModalFuncOpen(false);
        fetchFolha();
      }
    } finally {
      setSalvandoFunc(false);
    }
  }

  const [ano, mes] = competencia.split("-").map(Number);

  return (
    <div className="p-6 space-y-6">
      <Header
        title={`Folha de Pagamento — ${mesNome(mes)} ${ano}`}
        subtitle="Cálculo de salários, encargos e totais por filial"
      />

      <div className="flex flex-wrap items-center gap-4">
        <input
          type="month"
          value={competencia}
          onChange={(e) => setCompetencia(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          suppressHydrationWarning
        />
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => setModalFuncOpen(true)}
        >
          <Plus size={14} /> Cadastrar Funcionário
        </Button>
      </div>

      {/* Totais gerais */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">Total Bruto (todos funcionários)</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.totais.totalBruto)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">Total Encargos (INSS + FGTS)</p>
            <p className="text-2xl font-bold text-orange-600">{formatCurrency(data.totais.totalEncargos)}</p>
          </div>
          <div className="bg-white rounded-xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm text-red-600 mb-1 font-medium flex items-center gap-1">
              <AlertTriangle size={14} /> Total a Pagar (Empresa)
            </p>
            <p className="text-2xl font-bold text-red-700">{formatCurrency(data.totais.totalPagar)}</p>
          </div>
        </div>
      )}

      {/* Por filial */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data?.porFilial.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Nenhum funcionário cadastrado</p>
          <Button className="mt-4" onClick={() => setModalFuncOpen(true)}>
            <Plus size={16} /> Cadastrar primeiro funcionário
          </Button>
        </div>
      ) : (
        data?.porFilial.map((filial) => (
          <div key={filial.filialId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base">{filial.filialNome}</h3>
              <div className="flex gap-6 text-sm">
                <span>Bruto: <span className="font-semibold text-emerald-300">{formatCurrency(filial.totalBruto)}</span></span>
                <span>Encargos: <span className="font-semibold text-orange-300">{formatCurrency(filial.totalEncargos)}</span></span>
                <span>Total: <span className="font-bold text-red-300">{formatCurrency(filial.totalPagar)}</span></span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Funcionário</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Cargo</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Salário Base</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Comissão</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Triênio</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">DSR</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Total Bruto</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">INSS Pat.</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Entidades</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">FGTS</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Total Encargos</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase bg-red-50 text-red-700">Total a Pagar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filial.itens.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{item.funcionario.nome}</td>
                      <td className="px-4 py-3 text-gray-500">{item.funcionario.cargo}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.salarioBase)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.comissao)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.trienio)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.dsr)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(item.totalBruto)}</td>
                      <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(item.inssPatronal)}</td>
                      <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(item.entidades)}</td>
                      <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(item.fgts)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-orange-700">{formatCurrency(item.totalEncargos)}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-700 bg-red-50">{formatCurrency(item.totalPagar)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-900 text-white font-bold">
                    <td colSpan={6} className="px-4 py-3">TOTAL {filial.filialNome.toUpperCase()}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(filial.totalBruto)}</td>
                    <td colSpan={3} />
                    <td className="px-4 py-3 text-right text-orange-300">{formatCurrency(filial.totalEncargos)}</td>
                    <td className="px-4 py-3 text-right text-red-300">{formatCurrency(filial.totalPagar)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {/* Modal cadastro funcionário */}
      <Modal open={modalFuncOpen} onClose={() => setModalFuncOpen(false)} title="Cadastrar Funcionário" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filial *</label>
              <select
                value={funcForm.filialId}
                onChange={(e) => setFuncForm((f) => ({ ...f, filialId: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Selecione...</option>
                {filiais.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Admissão *</label>
              <input
                type="date"
                value={funcForm.admissao}
                onChange={(e) => setFuncForm((f) => ({ ...f, admissao: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input
              type="text"
              value={funcForm.nome}
              onChange={(e) => setFuncForm((f) => ({ ...f, nome: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cargo *</label>
            <input
              type="text"
              value={funcForm.cargo}
              onChange={(e) => setFuncForm((f) => ({ ...f, cargo: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salário Base *</label>
              <input
                type="number"
                step="0.01"
                value={funcForm.salarioBase || ""}
                onChange={(e) => setFuncForm((f) => ({ ...f, salarioBase: Number(e.target.value) }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Triênio (% decimal, ex: 0.03)</label>
              <input
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
            <Button variant="outline" onClick={() => setModalFuncOpen(false)}>Cancelar</Button>
            <Button loading={salvandoFunc} onClick={salvarFuncionario}>Salvar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
