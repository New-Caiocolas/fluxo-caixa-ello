"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { Filial } from "@/types";

interface FilialContextType {
  filialAtiva: string;
  setFilial: (id: string) => void;
  filiais: Filial[];
  loadingFiliais: boolean;
}

const FilialContext = createContext<FilialContextType | null>(null);

export function FilialProvider({ children }: { children: React.ReactNode }) {
  const [filialAtiva, setFilialAtiva] = useState<string>("");
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [loadingFiliais, setLoadingFiliais] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("filialAtiva");
    if (saved) setFilialAtiva(saved);
  }, []);

  useEffect(() => {
    fetch("/api/filiais")
      .then((r) => r.json())
      .then((data) => { setFiliais(data); setLoadingFiliais(false); })
      .catch(() => setLoadingFiliais(false));
  }, []);

  function setFilial(id: string) {
    setFilialAtiva(id);
    localStorage.setItem("filialAtiva", id);
  }

  return (
    <FilialContext.Provider value={{ filialAtiva, setFilial, filiais, loadingFiliais }}>
      {children}
    </FilialContext.Provider>
  );
}

export function useFilialContext() {
  const ctx = useContext(FilialContext);
  if (!ctx) throw new Error("useFilialContext deve ser usado dentro de FilialProvider");
  return ctx;
}
