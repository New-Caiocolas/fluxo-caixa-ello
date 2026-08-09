"use client";

import { TriangleAlert, RefreshCw } from "lucide-react";

interface AvisoErroProps {
  mensagem: string;
  onTentarNovamente?: () => void;
}

/**
 * Estado de erro de carregamento.
 *
 * Existe porque tela vazia é ambígua: quem olha não sabe se não há dados no
 * período ou se a busca falhou. O botão de repetir importa tanto quanto a
 * mensagem — falha de rede costuma ser passageira, e sem ele a única saída é
 * recarregar a página inteira.
 */
export function AvisoErro({ mensagem, onTentarNovamente }: AvisoErroProps) {
  return (
    <div
      role="alert"
      className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3"
    >
      <TriangleAlert size={18} className="text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-red-800">{mensagem}</p>
        {onTentarNovamente && (
          <button
            type="button"
            onClick={onTentarNovamente}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-red-700 hover:text-red-900 underline underline-offset-2"
          >
            <RefreshCw size={13} aria-hidden="true" />
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}
