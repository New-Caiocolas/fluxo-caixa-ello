"use client";

import { useFilialContext } from "@/lib/context/FilialContext";

export function useFilialAtiva() {
  const { filialAtiva, setFilial } = useFilialContext();
  return { filialAtiva, setFilial };
}

export function useFiliais() {
  const { filiais, loadingFiliais: loading } = useFilialContext();
  return { filiais, loading };
}
