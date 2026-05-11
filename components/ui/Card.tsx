import { cn } from "@/lib/utils";

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className, children }: CardProps) {
  return (
    <div className={cn("bg-white rounded-xl border border-gray-200 shadow-sm", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: CardProps) {
  return (
    <div className={cn("px-6 py-4 border-b border-gray-100", className)}>
      {children}
    </div>
  );
}

export function CardContent({ className, children }: CardProps) {
  return <div className={cn("px-6 py-4", className)}>{children}</div>;
}

export function CardTitle({ className, children }: CardProps) {
  return (
    <h3 className={cn("text-sm font-semibold text-gray-700 uppercase tracking-wide", className)}>
      {children}
    </h3>
  );
}
