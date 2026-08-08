"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  PlusCircle,
  Calendar,
  BarChart3,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Building2,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lancamentos", label: "Lançamentos", icon: PlusCircle },
  { href: "/mensal", label: "Visão Mensal", icon: Calendar },
  { href: "/consolidado", label: "Consolidado Anual", icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

const adminItems = [{ href: "/usuarios", label: "Usuários", icon: Users }];

/**
 * Navegação lateral.
 *
 * No desktop (lg+) ocupa uma coluna fixa e pode ser recolhida a só ícones.
 * Abaixo disso vira gaveta sobreposta: os 256px da barra deixariam 119px de
 * conteúdo numa tela de 375px, o que inviabiliza qualquer tabela.
 *
 * O estado `recolhido` vale só no desktop; na gaveta o menu abre sempre
 * completo, já que ali o espaço não é disputado.
 */
export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [recolhido, setRecolhido] = useState(false);
  const [aberto, setAberto] = useState(false);

  // Fecha a gaveta ao trocar de página — senão ela continuaria por cima do
  // conteúdo recém-carregado.
  useEffect(() => {
    setAberto(false);
  }, [pathname]);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  function itemLink(item: (typeof navItems)[number]) {
    const Icon = item.icon;
    const ativo = pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={ativo ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors",
          ativo ? "bg-emerald-600 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
        )}
        title={recolhido ? item.label : undefined}
      >
        <Icon size={20} className="shrink-0" />
        {/* No mobile o rótulo aparece sempre: `recolhido` é estado de desktop. */}
        <span className={cn("text-sm font-medium", recolhido && "lg:hidden")}>{item.label}</span>
      </Link>
    );
  }

  return (
    <>
      {/* Barra superior — só no mobile, para dar lugar ao botão do menu */}
      <header className="lg:hidden fixed top-0 inset-x-0 h-14 z-30 bg-gray-900 text-white flex items-center gap-3 px-4">
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="p-2 -ml-2 rounded hover:bg-gray-800"
          aria-label="Abrir menu"
          aria-expanded={aberto}
        >
          <Menu size={22} />
        </button>
        <Building2 className="text-emerald-400" size={20} />
        <p className="font-bold text-sm">Grupo ELLO</p>
      </header>

      {/* Fundo escurecido da gaveta */}
      {aberto && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setAberto(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "bg-gray-900 text-white flex flex-col",
          // Mobile: gaveta sobreposta, fora da tela até abrir.
          //
          // A posição é animada por `left`, não por translate: as utilidades de
          // translate do Tailwind v4 passam por custom properties e, ao alternar
          // as classes aqui, o valor antigo (-100%) permanecia computado mesmo
          // com a classe já removida do elemento. `left` é resolvido direto.
          "fixed inset-y-0 z-50 w-64 transition-[left] duration-300",
          aberto ? "left-0" : "-left-64",
          // Desktop: volta a ser coluna no fluxo. Em `static`, `left` não tem
          // efeito, então a classe de mobile fica inerte aqui.
          "lg:static lg:h-screen lg:transition-all",
          recolhido ? "lg:w-16" : "lg:w-64"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className={cn("flex items-center gap-2", recolhido && "lg:hidden")}>
            <Building2 className="text-emerald-400" size={24} />
            <div>
              <p className="font-bold text-sm leading-tight">Grupo ELLO</p>
              <p className="text-xs text-gray-400">Fluxo de Caixa</p>
            </div>
          </div>
          {recolhido && <Building2 className="text-emerald-400 mx-auto hidden lg:block" size={24} />}

          {/* Recolher é ação de desktop; no mobile o mesmo canto fecha a gaveta. */}
          <button
            onClick={() => setRecolhido(!recolhido)}
            className="hidden lg:block p-1 rounded hover:bg-gray-700 transition-colors ml-auto"
            aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
          >
            {recolhido ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <button
            onClick={() => setAberto(false)}
            className="lg:hidden p-2 -mr-2 rounded hover:bg-gray-700 ml-auto"
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map(itemLink)}

          {user?.role === "ADMIN" && (
            <>
              <p
                className={cn(
                  "text-xs text-gray-500 uppercase tracking-wider px-6 pt-4 pb-1",
                  recolhido && "lg:hidden"
                )}
              >
                Admin
              </p>
              {adminItems.map(itemLink)}
            </>
          )}
        </nav>

        <div className="border-t border-gray-700 p-4">
          <div className={cn("mb-3", recolhido && "lg:hidden")}>
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className={cn(
              "flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors w-full",
              recolhido && "lg:justify-center"
            )}
            title="Sair"
          >
            <LogOut size={18} />
            <span className={cn("text-sm", recolhido && "lg:hidden")}>Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
