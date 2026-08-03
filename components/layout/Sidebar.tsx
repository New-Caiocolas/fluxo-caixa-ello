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
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lancamentos", label: "Lançamentos", icon: PlusCircle },
  { href: "/mensal", label: "Visão Mensal", icon: Calendar },
  { href: "/consolidado", label: "Consolidado Anual", icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

const adminItems = [
  { href: "/usuarios", label: "Usuários", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "h-screen bg-gray-900 text-white flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Building2 className="text-emerald-400" size={24} />
            <div>
              <p className="font-bold text-sm leading-tight">Grupo ELLO</p>
              <p className="text-xs text-gray-400">Fluxo de Caixa</p>
            </div>
          </div>
        )}
        {collapsed && <Building2 className="text-emerald-400 mx-auto" size={24} />}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-gray-700 transition-colors ml-auto"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors",
                active
                  ? "bg-emerald-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={20} className="shrink-0" />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          );
        })}

        {user?.role === "ADMIN" && (
          <>
            {!collapsed && (
              <p className="text-xs text-gray-500 uppercase tracking-wider px-6 pt-4 pb-1">Admin</p>
            )}
            {adminItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors",
                    active
                      ? "bg-emerald-600 text-white"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon size={20} className="shrink-0" />
                  {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User */}
      <div className="border-t border-gray-700 p-4">
        {!collapsed && (
          <div className="mb-3">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        )}
        <button
          onClick={logout}
          className={cn(
            "flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors w-full",
            collapsed ? "justify-center" : ""
          )}
          title="Sair"
        >
          <LogOut size={18} />
          {!collapsed && <span className="text-sm">Sair</span>}
        </button>
      </div>
    </aside>
  );
}
