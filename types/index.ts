export interface Filial {
  id: string;
  nome: string;
  codigo: string;
  ativa: boolean;
}

export interface LancamentoForm {
  filialId: string;
  data: string;
  grupoId: number;
  subgrupoId?: string;
  descricao: string;
  valor: number;
  tipo: "ENTRADA" | "SAIDA";
  observacao?: string;
}

export interface Lancamento {
  id: string;
  filialId: string;
  filial: Filial;
  data: string;
  grupoId: number;
  subgrupoId?: string;
  descricao: string;
  valor: number;
  tipo: "ENTRADA" | "SAIDA";
  observacao?: string;
  competencia: string;
  createdAt: string;
  grupo: { id: number; nome: string; tipo: string };
  subgrupo?: { id: string; nome: string };
  user: { id: string; name: string };
}

export interface SaldoDiario {
  data: string;
  saldoInicial: number;
  saldoFinal: number;
  totalEntradas: number;
  totalSaidas: number;
}

export interface DashboardKPI {
  totalRecebimento: number;
  totalFaturamento: number;
  fluxoOperacional: number;
  fluxoLivre: number;
  percentFluxoLivre: number;
  percentCustoDireto: number;
  saldoAtual: number;
}

export interface MensalData {
  grupos: GrupoMensal[];
  diasNoMes: number;
  totalRecebimento: number;
  saldoInicial: number;
  saldoFinal: number;
  fluxoOperacional: number;
  fluxoLivre: number;
}

export interface GrupoMensal {
  grupoId: number;
  grupoNome: string;
  tipo: string;
  total: number;
  percentRecebimento: number;
  subgrupos: SubgrupoMensal[];
  porDia: Record<number, number>;
}

export interface SubgrupoMensal {
  subgrupoId: string;
  subgrupoNome: string;
  total: number;
  percentRecebimento: number;
  porDia: Record<number, number>;
}

export interface AnualData {
  grupos: GrupoAnual[];
  porMes: Record<string, MesResumo>;
}

export interface GrupoAnual {
  grupoId: number;
  grupoNome: string;
  tipo: string;
  total: number;
  porMes: Record<string, number>;
}

export interface MesResumo {
  competencia: string;
  totalEntradas: number;
  totalSaidas: number;
  fluxoOperacional: number;
  fluxoLivre: number;
  percentFluxoLivre: number;
}

export interface Funcionario {
  id: string;
  filialId: string;
  filial: Filial;
  nome: string;
  cargo: string;
  salarioBase: number;
  trienio: number;
  ativo: boolean;
  admissao: string;
}

export interface FolhaCalculo {
  funcionario: Funcionario;
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

export interface FaturamentoItem {
  id: string;
  filialId: string;
  competencia: string;
  valorNF: number;
  descricao?: string;
}

export interface Meta {
  id: string;
  filialId: string;
  filial: Filial;
  tipo: "FLUXO_LIVRE" | "CUSTO_DIRETO";
  nome: string;
  descricao?: string;
  valorMeta: number;
  operador: string;
  baseCalculo: string;
  ativa: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "GESTOR" | "OPERADOR";
}
