"use client";

import { useCallback, useEffect, useState } from "react";
import type { Classificacao } from "@/lib/categorias";

export interface SubgrupoAPI {
  id: string;
  grupoId: number;
  nome: string;
  ordem: number;
  ativo: boolean;
}

export interface GrupoAPI {
  id: number;
  nome: string;
  tipo: "ENTRADA" | "SAIDA";
  ordem: number;
  classificacao: Classificacao;
  permiteAmbosTipos: boolean;
  ativo: boolean;
  subgrupos: SubgrupoAPI[];
}

/**
 * Carrega grupos e subgrupos de /api/grupos.
 *
 * Substitui o array estático de `lib/categorias.ts` nas telas: com grupos
 * configuráveis, o que está no banco é a verdade — o arquivo virou só semente.
 *
 * Devolve a lista completa, inclusive inativos, porque as telas de histórico
 * (mensal, consolidado) precisam exibir lançamentos antigos de grupos já
 * desativados. Quem monta formulário deve usar `apenasAtivos`.
 */
export function useGrupos() {
  const [grupos, setGrupos] = useState<GrupoAPI[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/grupos");
      if (!res.ok) {
        setErro("Não foi possível carregar as categorias");
        return;
      }
      setGrupos(await res.json());
    } catch {
      setErro("Não foi possível carregar as categorias");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    buscar();
  }, [buscar]);

  return { grupos, carregando, erro, recarregar: buscar };
}

/** Só o que pode receber lançamento novo — grupos e subgrupos ativos. */
export function apenasAtivos(grupos: GrupoAPI[]): GrupoAPI[] {
  return grupos
    .filter((g) => g.ativo)
    .map((g) => ({ ...g, subgrupos: g.subgrupos.filter((s) => s.ativo) }));
}
