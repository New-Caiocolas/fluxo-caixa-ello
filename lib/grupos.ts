import type { Classificacao } from "@/lib/categorias";

export const CLASSIFICACOES: readonly Classificacao[] = [
  "RECEBIMENTO",
  "CUSTO_OPERACIONAL",
  "RESULTADO_FINANCEIRO",
  "INVESTIMENTO",
  "NEUTRO",
] as const;

export const TIPOS = ["ENTRADA", "SAIDA"] as const;
export type Tipo = (typeof TIPOS)[number];

/**
 * Direção obrigatória de cada classificação.
 *
 * `null` = aceita as duas. RESULTADO_FINANCEIRO é o caso legítimo (juros
 * recebidos x juros pagos convivem); NEUTRO fica fora dos indicadores, então
 * a direção não muda conta nenhuma.
 */
const DIRECAO_EXIGIDA: Record<Classificacao, Tipo | null> = {
  RECEBIMENTO: "ENTRADA",
  CUSTO_OPERACIONAL: "SAIDA",
  INVESTIMENTO: "SAIDA",
  RESULTADO_FINANCEIRO: null,
  NEUTRO: null,
};

export interface GrupoValidado {
  nome: string;
  tipo: Tipo;
  classificacao: Classificacao;
  permiteAmbosTipos: boolean;
  ordem: number;
  ativo: boolean;
}

export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string };

function textoLimpo(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Valida a entrada de criação/edição de grupo.
 *
 * A checagem que mais importa é a coerência entre `tipo` e `classificacao`: um
 * grupo de SAIDA classificado como RECEBIMENTO somaria receita a cada despesa
 * lançada, e o erro só apareceria como número errado no relatório — sem exceção,
 * sem log, sem nada que aponte a causa.
 */
export function validarGrupo(entrada: unknown): Resultado<GrupoValidado> {
  const e = (entrada ?? {}) as Record<string, unknown>;

  const nome = textoLimpo(e.nome);
  if (!nome) return { ok: false, erro: "Informe o nome do grupo" };
  if (nome.length > 60) return { ok: false, erro: "O nome do grupo deve ter no máximo 60 caracteres" };

  const tipo = textoLimpo(e.tipo) as Tipo;
  if (!TIPOS.includes(tipo)) {
    return { ok: false, erro: "Tipo inválido: use ENTRADA ou SAIDA" };
  }

  const classificacao = textoLimpo(e.classificacao) as Classificacao;
  if (!CLASSIFICACOES.includes(classificacao)) {
    return { ok: false, erro: "Classificação inválida" };
  }

  const exigida = DIRECAO_EXIGIDA[classificacao];
  if (exigida && tipo !== exigida) {
    return {
      ok: false,
      erro: `Um grupo classificado como ${classificacao} precisa ser do tipo ${exigida}`,
    };
  }

  const permiteAmbosTipos = e.permiteAmbosTipos === true;
  if (permiteAmbosTipos && classificacao !== "RESULTADO_FINANCEIRO") {
    return {
      ok: false,
      erro: "Só grupos de resultado financeiro podem aceitar lançamentos nas duas direções",
    };
  }

  const ordemBruta = Number(e.ordem);
  const ordem = Number.isFinite(ordemBruta) && ordemBruta > 0 ? Math.trunc(ordemBruta) : 999;

  return {
    ok: true,
    dados: {
      nome,
      tipo,
      classificacao,
      permiteAmbosTipos,
      ordem,
      ativo: e.ativo === undefined ? true : e.ativo === true,
    },
  };
}

export interface SubgrupoValidado {
  nome: string;
  ordem: number;
  ativo: boolean;
}

export function validarSubgrupo(entrada: unknown): Resultado<SubgrupoValidado> {
  const e = (entrada ?? {}) as Record<string, unknown>;

  const nome = textoLimpo(e.nome);
  if (!nome) return { ok: false, erro: "Informe o nome da subcategoria" };
  if (nome.length > 60) return { ok: false, erro: "O nome deve ter no máximo 60 caracteres" };

  const ordemBruta = Number(e.ordem);
  const ordem = Number.isFinite(ordemBruta) && ordemBruta > 0 ? Math.trunc(ordemBruta) : 999;

  return {
    ok: true,
    dados: { nome, ordem, ativo: e.ativo === undefined ? true : e.ativo === true },
  };
}
