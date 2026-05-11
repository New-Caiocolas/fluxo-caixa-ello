import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  title: string;
  value: number;
  format?: "currency" | "percent";
  icon: LucideIcon;
  iconColor?: string;
  trend?: number;
  alert?: boolean;
  subtitle?: string;
}

export function KPICard({
  title,
  value,
  format = "currency",
  icon: Icon,
  iconColor = "text-emerald-500",
  trend,
  alert,
  subtitle,
}: KPICardProps) {
  const formatted =
    format === "currency" ? formatCurrency(value) : formatPercent(value);

  return (
    <div
      className={cn(
        "bg-white rounded-xl border shadow-sm p-6",
        alert ? "border-red-300 bg-red-50" : "border-gray-200"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <div className={cn("p-2 rounded-lg bg-gray-50", iconColor)}>
          <Icon size={20} />
        </div>
      </div>

      <p
        className={cn(
          "text-2xl font-bold",
          alert ? "text-red-600" : value >= 0 ? "text-gray-900" : "text-red-600"
        )}
      >
        {formatted}
      </p>

      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}

      {trend !== undefined && (
        <div
          className={cn(
            "flex items-center gap-1 mt-2 text-xs font-medium",
            trend >= 0 ? "text-emerald-600" : "text-red-500"
          )}
        >
          {trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{formatPercent(Math.abs(trend))} vs mês anterior</span>
        </div>
      )}
    </div>
  );
}
