"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, PlusCircle, Calendar, BarChart3 } from "lucide-react";

/**
 * Barra de navegação inferior — só no celular.
 *
 * Leva os quatro destinos de uso diário a um toque, em vez do ciclo abrir
 * gaveta → escolher → fechar. Configurações e Usuários ficam de fora de
 * propósito: são telas de manutenção, visitadas raramente, e continuam na
 * gaveta — cinco ou seis itens aqui deixariam cada alvo estreito demais.
 *
 * Fica embaixo porque é onde o polegar alcança; o topo da tela é a região
 * mais difícil de tocar com uma mão só.
 */
const itens = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/lancamentos", label: "Lançar", icon: PlusCircle },
  { href: "/mensal", label: "Mensal", icon: Calendar },
  { href: "/consolidado", label: "Anual", icon: BarChart3 },
];

export function BarraInferior() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      // pb-safe acomoda o indicador de gestos do iPhone, que sobreporia o
      // último item numa barra colada na borda.
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex">
        {itens.map((item) => {
          const Icon = item.icon;
          const ativo = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 h-14 text-[11px]",
                  ativo ? "text-emerald-600" : "text-gray-400"
                )}
              >
                <Icon size={20} className="shrink-0" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
