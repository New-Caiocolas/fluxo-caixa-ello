/**
 * Sugere grupo e subgrupo de um lançamento a partir do histórico.
 *
 * Medido na base de produção em 2026-08: 209 de 210 descrições distintas
 * sempre caíram no mesmo grupo. A classificação é quase determinística, então
 * casar pela descrição resolve a maior parte do trabalho manual — sem
 * heurística complicada nem dependência de terceiros.
 *
 * Nunca inventa: quando não há base, devolve null e a linha vai para revisão
 * humana. Num sistema financeiro, classificar errado em silêncio é pior que
 * pedir confirmação.
 */

export interface LancamentoHistorico {
  descricao: string;
  grupoId: number;
  subgrupoId: string | null;
}

export type Confianca = "alta" | "media";

export interface Sugestao {
  grupoId: number;
  subgrupoId: string | null;
  confianca: Confianca;
  /** Descrição do histórico que originou a sugestão, para a tela explicar. */
  baseadoEm: string;
  /** true quando o histórico dessa descrição aponta para mais de um grupo. */
  ambiguo: boolean;
}

/** Maiúsculas, espaços colapsados, sem acento nem pontuação. */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Forma reduzida: sem números, para casar "PIX ENVIADO JOAO 12/07" com
 * "PIX ENVIADO JOAO 03/08". Datas e documentos variam a cada transação e
 * impediriam o casamento exato.
 */
function semNumeros(s: string): string {
  return normalizar(s).replace(/\b\d+\b/g, "").replace(/\s+/g, " ").trim();
}

type Contagem = Map<string, { grupoId: number; subgrupoId: string | null; n: number; original: string }>;

export interface Indice {
  exato: Contagem;
  reduzido: Contagem;
}

function acumular(mapa: Contagem, chave: string, l: LancamentoHistorico) {
  if (!chave) return;
  // A chave inclui a classificação: assim o mesmo texto com dois grupos vira
  // duas entradas, e dá para detectar ambiguidade em vez de escolher no escuro.
  const id = `${chave}\u0000${l.grupoId}\u0000${l.subgrupoId ?? ""}`;
  const atual = mapa.get(id);
  if (atual) atual.n++;
  else mapa.set(id, { grupoId: l.grupoId, subgrupoId: l.subgrupoId, n: 1, original: l.descricao });
}

export function construirIndice(historico: LancamentoHistorico[]): Indice {
  const exato: Contagem = new Map();
  const reduzido: Contagem = new Map();
  for (const l of historico) {
    if (!l.descricao) continue;
    acumular(exato, normalizar(l.descricao), l);
    acumular(reduzido, semNumeros(l.descricao), l);
  }
  return { exato, reduzido };
}

function melhor(mapa: Contagem, chave: string) {
  if (!chave) return null;
  const prefixo = `${chave}\u0000`;
  const candidatos = [...mapa.entries()]
    .filter(([id]) => id.startsWith(prefixo))
    .map(([, v]) => v)
    .sort((a, b) => b.n - a.n);

  if (candidatos.length === 0) return null;
  return { escolha: candidatos[0], ambiguo: candidatos.length > 1 };
}

export function sugerir(indice: Indice, descricao: string): Sugestao | null {
  if (!descricao) return null;

  const porExato = melhor(indice.exato, normalizar(descricao));
  if (porExato) {
    return {
      grupoId: porExato.escolha.grupoId,
      subgrupoId: porExato.escolha.subgrupoId,
      confianca: porExato.ambiguo ? "media" : "alta",
      baseadoEm: porExato.escolha.original,
      ambiguo: porExato.ambiguo,
    };
  }

  // Sem casamento exato, tenta ignorando números — mas a confiança cai, porque
  // o texto não é idêntico ao que já foi classificado por uma pessoa.
  const porReduzido = melhor(indice.reduzido, semNumeros(descricao));
  if (porReduzido) {
    return {
      grupoId: porReduzido.escolha.grupoId,
      subgrupoId: porReduzido.escolha.subgrupoId,
      confianca: "media",
      baseadoEm: porReduzido.escolha.original,
      ambiguo: porReduzido.ambiguo,
    };
  }

  return null;
}
