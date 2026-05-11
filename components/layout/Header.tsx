"use client";

import { useFiliais, useFilialAtiva } from "@/lib/hooks/useFilial";
import { Bell } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { filiais } = useFiliais();
  const { filialAtiva, setFilial } = useFilialAtiva();

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500" suppressHydrationWarning>{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* Seletor de filial */}
        <select
          value={filialAtiva}
          onChange={(e) => setFilial(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Todas as filiais</option>
          {filiais.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>

        <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <Bell size={20} className="text-gray-600" />
        </button>
      </div>
    </header>
  );
}
