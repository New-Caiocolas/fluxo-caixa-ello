export interface SubgrupoData {
  id: string;
  nome: string;
  ordem: number;
}

/** Como o grupo entra nos indicadores. Espelha o enum Classificacao do Prisma. */
export type Classificacao =
  | "RECEBIMENTO"
  | "CUSTO_OPERACIONAL"
  | "RESULTADO_FINANCEIRO"
  | "INVESTIMENTO"
  | "NEUTRO";

export interface GrupoData {
  id: number;
  nome: string;
  tipo: "ENTRADA" | "SAIDA";
  ordem: number;
  classificacao: Classificacao;
  subgrupos: SubgrupoData[];
  /** Grupo com subgrupos legitimamente de ambas as direções (ex.: juros pagos x recebidos).
   * Quando true, o tipo do lançamento é escolhido pelo usuário; quando false/ausente,
   * o backend sempre deriva o tipo a partir de `tipo` do grupo, ignorando o que vier do cliente. */
  permiteAmbosTipos?: boolean;
}

export const GRUPOS: GrupoData[] = [
  {
    id: 1,
    nome: "Recebimentos",
    tipo: "ENTRADA",
    ordem: 1,
    classificacao: "RECEBIMENTO",
    subgrupos: [
      { id: "1-1", nome: "Boleto", ordem: 1 },
      { id: "1-2", nome: "PIX", ordem: 2 },
      { id: "1-3", nome: "Cartão Crédito", ordem: 3 },
      { id: "1-4", nome: "Cartão Débito", ordem: 4 },
      { id: "1-5", nome: "Transferência", ordem: 5 },
      { id: "1-6", nome: "Dinheiro", ordem: 6 },
      { id: "1-7", nome: "Outras Entradas", ordem: 7 },
    ],
  },
  {
    id: 4,
    nome: "Custos Diretos",
    tipo: "SAIDA",
    ordem: 2,
    classificacao: "CUSTO_OPERACIONAL",
    subgrupos: [
      { id: "4-1", nome: "Mercadoria/Insumo", ordem: 1 },
      { id: "4-2", nome: "Mercadoria/Revenda", ordem: 2 },
      { id: "4-3", nome: "Fretes", ordem: 3 },
    ],
  },
  {
    id: 5,
    nome: "Mão de Obra Direta",
    tipo: "SAIDA",
    ordem: 3,
    classificacao: "CUSTO_OPERACIONAL",
    subgrupos: [
      { id: "5-1", nome: "Salários Produção", ordem: 1 },
      { id: "5-2", nome: "Encargos Produção", ordem: 2 },
      { id: "5-3", nome: "Horas Extras", ordem: 3 },
    ],
  },
  {
    id: 6,
    nome: "Materiais Indiretos",
    tipo: "SAIDA",
    ordem: 4,
    classificacao: "CUSTO_OPERACIONAL",
    subgrupos: [
      { id: "6-1", nome: "Água", ordem: 1 },
      { id: "6-2", nome: "Energia Elétrica", ordem: 2 },
      { id: "6-3", nome: "Combustível", ordem: 3 },
      { id: "6-4", nome: "Manutenção Predial", ordem: 4 },
      { id: "6-5", nome: "Manutenção Equipamentos", ordem: 5 },
      { id: "6-6", nome: "Manutenção Veículos", ordem: 6 },
      { id: "6-7", nome: "Seguros", ordem: 7 },
      { id: "6-8", nome: "Terceiros Operacionais", ordem: 8 },
      { id: "6-9", nome: "Uniformes/EPI", ordem: 9 },
      { id: "6-10", nome: "Material de Limpeza Op.", ordem: 10 },
      { id: "6-11", nome: "Ferramentas", ordem: 11 },
      { id: "6-12", nome: "Embalagens", ordem: 12 },
      { id: "6-13", nome: "Locação Equipamentos", ordem: 13 },
      { id: "6-14", nome: "Pedágios/Estacionamentos", ordem: 14 },
      { id: "6-15", nome: "Outros Materiais Indiretos", ordem: 15 },
    ],
  },
  {
    id: 7,
    nome: "Despesas Administrativas",
    tipo: "SAIDA",
    ordem: 5,
    classificacao: "CUSTO_OPERACIONAL",
    subgrupos: [
      { id: "7-1", nome: "TI / Sistemas", ordem: 1 },
      { id: "7-2", nome: "Telefonia / Internet", ordem: 2 },
      { id: "7-3", nome: "Limpeza Escritório", ordem: 3 },
      { id: "7-4", nome: "Material Escritório", ordem: 4 },
      { id: "7-5", nome: "Serviços Jurídicos", ordem: 5 },
      { id: "7-6", nome: "Serviços Contábeis", ordem: 6 },
      { id: "7-7", nome: "Consultoria", ordem: 7 },
      { id: "7-8", nome: "Aluguel", ordem: 8 },
      { id: "7-9", nome: "Condomínio", ordem: 9 },
      { id: "7-10", nome: "Correios / Fretes ADM", ordem: 10 },
      { id: "7-11", nome: "Viagens / Hospedagem", ordem: 11 },
      { id: "7-12", nome: "Alimentação ADM", ordem: 12 },
      { id: "7-13", nome: "Outras Despesas ADM", ordem: 13 },
    ],
  },
  {
    id: 8,
    nome: "Despesas com Pessoal ADM",
    tipo: "SAIDA",
    ordem: 6,
    classificacao: "CUSTO_OPERACIONAL",
    subgrupos: [
      { id: "8-1", nome: "Salários ADM", ordem: 1 },
      { id: "8-2", nome: "FGTS", ordem: 2 },
      { id: "8-3", nome: "INSS Patronal", ordem: 3 },
      { id: "8-4", nome: "Férias", ordem: 4 },
      { id: "8-5", nome: "13º Salário", ordem: 5 },
      { id: "8-6", nome: "Rescisão", ordem: 6 },
      { id: "8-7", nome: "Vale Alimentação", ordem: 7 },
      { id: "8-8", nome: "Vale Transporte", ordem: 8 },
      { id: "8-9", nome: "Plano de Saúde", ordem: 9 },
      { id: "8-10", nome: "Outros Benefícios", ordem: 10 },
    ],
  },
  {
    id: 9,
    nome: "Pró-Labore Diretoria",
    tipo: "SAIDA",
    ordem: 7,
    classificacao: "CUSTO_OPERACIONAL",
    subgrupos: [
      { id: "9-1", nome: "Pró-Labore Sócio 1", ordem: 1 },
      { id: "9-2", nome: "Pró-Labore Sócio 2", ordem: 2 },
      { id: "9-3", nome: "Pró-Labore Sócio 3", ordem: 3 },
    ],
  },
  {
    id: 10,
    nome: "Despesas Comerciais",
    tipo: "SAIDA",
    ordem: 8,
    classificacao: "CUSTO_OPERACIONAL",
    subgrupos: [
      { id: "10-1", nome: "Comissões Vendas", ordem: 1 },
      { id: "10-2", nome: "Publicidade / Marketing", ordem: 2 },
      { id: "10-3", nome: "Sistema CRM", ordem: 3 },
      { id: "10-4", nome: "Sistema ERP", ordem: 4 },
      { id: "10-5", nome: "Outras Desp. Comerciais", ordem: 5 },
    ],
  },
  {
    id: 11,
    nome: "Impostos sobre Vendas",
    tipo: "SAIDA",
    ordem: 9,
    classificacao: "CUSTO_OPERACIONAL",
    subgrupos: [
      { id: "11-1", nome: "PIS", ordem: 1 },
      { id: "11-2", nome: "COFINS", ordem: 2 },
      { id: "11-3", nome: "ICMS", ordem: 3 },
      { id: "11-4", nome: "ICMS ST", ordem: 4 },
      { id: "11-5", nome: "DIFAL", ordem: 5 },
    ],
  },
  {
    id: 12,
    nome: "Outros Impostos",
    tipo: "SAIDA",
    ordem: 10,
    classificacao: "CUSTO_OPERACIONAL",
    subgrupos: [
      { id: "12-1", nome: "IRPJ", ordem: 1 },
      { id: "12-2", nome: "CSLL", ordem: 2 },
      { id: "12-3", nome: "IPTU", ordem: 3 },
      { id: "12-4", nome: "ISSQN", ordem: 4 },
      { id: "12-5", nome: "IPI", ordem: 5 },
      { id: "12-6", nome: "IRRF", ordem: 6 },
    ],
  },
  {
    id: 13,
    nome: "Receitas/Despesas Financeiras",
    tipo: "SAIDA",
    ordem: 11,
    classificacao: "RESULTADO_FINANCEIRO",
    permiteAmbosTipos: true,
    subgrupos: [
      { id: "13-1", nome: "Empréstimos Recebidos", ordem: 1 },
      { id: "13-2", nome: "Amortizações", ordem: 2 },
      { id: "13-3", nome: "Juros Recebidos", ordem: 3 },
      { id: "13-4", nome: "Juros Pagos", ordem: 4 },
      { id: "13-5", nome: "Tarifas Bancárias", ordem: 5 },
      { id: "13-6", nome: "IOF", ordem: 6 },
    ],
  },
  {
    id: 14,
    nome: "Investimentos",
    tipo: "SAIDA",
    ordem: 12,
    classificacao: "INVESTIMENTO",
    subgrupos: [
      { id: "14-1", nome: "Máquinas e Equipamentos", ordem: 1 },
      { id: "14-2", nome: "Veículos", ordem: 2 },
      { id: "14-3", nome: "Obras e Reformas", ordem: 3 },
      { id: "14-4", nome: "Empréstimos LP Concedidos", ordem: 4 },
    ],
  },
];

export function getGrupoById(id: number): GrupoData | undefined {
  return GRUPOS.find((g) => g.id === id);
}

export function getSubgrupoById(
  grupoId: number,
  subgrupoId: string
): SubgrupoData | undefined {
  const grupo = getGrupoById(grupoId);
  return grupo?.subgrupos.find((s) => s.id === subgrupoId);
}
