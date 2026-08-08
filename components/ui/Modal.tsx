"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useId } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeMap = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
};

/**
 * Diálogo — caixa centralizada no desktop, folha ancorada embaixo no celular.
 *
 * A folha não é enfeite: num formulário centralizado, o teclado virtual cobre
 * metade da tela e empurra os campos para fora. Ancorada embaixo, ela cresce
 * até 92vh e rola por dentro, mantendo o campo em foco acima do teclado.
 *
 * A altura acompanha o conteúdo, então uma confirmação curta vira uma folha
 * baixa em vez de ocupar a tela inteira à toa.
 */
export function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  const tituloId = useId();

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className={cn(
          "relative bg-white w-full overflow-auto shadow-2xl",
          // Celular: folha colada embaixo, cantos arredondados só no topo.
          "max-h-[92vh] rounded-t-2xl",
          // Desktop: volta a ser caixa centralizada, como antes.
          "sm:mx-4 sm:max-h-[90vh] sm:rounded-xl",
          sizeMap[size]
        )}
      >
        {/* Alça — sinaliza no celular que isto é uma folha, não a tela inteira */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>

        {/* Cabeçalho fixo: em formulário longo, o título e o fechar somem ao rolar */}
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 id={tituloId} className="text-lg font-semibold text-gray-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Fechar"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* pb extra no celular para o último campo não encostar na borda inferior */}
        <div className="px-6 py-4 pb-6 sm:pb-4">{children}</div>
      </div>
    </div>
  );
}
