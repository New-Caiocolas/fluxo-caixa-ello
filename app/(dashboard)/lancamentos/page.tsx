"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { AbaDiarios } from "@/components/lancamentos/AbaDiarios";
import { AbaFaturamento } from "@/components/lancamentos/AbaFaturamento";
import { AbaFolha } from "@/components/lancamentos/AbaFolha";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "diarios", label: "Lançamentos Diários" },
  { id: "faturamento", label: "Faturamento" },
  { id: "folha", label: "Folha de Pagamento" },
] as const;

type Aba = (typeof TABS)[number]["id"];

export default function LancamentosPage() {
  const [aba, setAba] = useState<Aba>("diarios");

  return (
    <div>
      <Header title="Lançamentos" subtitle="Diários, faturamento e folha de pagamento" />

      {/* Abas */}
      <div className="bg-white border-b border-gray-200 px-6">
        <nav className="flex gap-1 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setAba(tab.id)}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                aba === tab.id
                  ? "border-emerald-500 text-emerald-700"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {aba === "diarios" && <AbaDiarios />}
        {aba === "faturamento" && <AbaFaturamento />}
        {aba === "folha" && <AbaFolha />}
      </div>
    </div>
  );
}
