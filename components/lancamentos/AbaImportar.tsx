"use client";

import { useRef, useState } from "react";
import { Upload, CheckCircle2, AlertTriangle, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AvisoErro } from "@/components/ui/AvisoErro";
import { useFilialAtiva } from "@/lib/hooks/useFilial";
import { useGrupos } from "@/lib/hooks/useGrupos";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Sugestao {
  grupoId: number;
  subgrupoId: string | null;
  confianca: "alta" | "media";
  baseadoEm: string;
  ambiguo: boolean;
}

interface Linha {
  fitid: string;
  data: string;
  competencia: string;
  valor: number;
  tipo: "ENTRADA" | "SAIDA";
  descricao: string;
  duplicado: boolean;
  sugestao: Sugestao | null;
  /** Escolha do usuário; começa na sugestão e sobrepõe a partir da edição. */
  grupoId?: number;
  subgrupoId?: string | null;
}

/**
 * Importação de extrato OFX.
 *
 * O fluxo é sempre prévia → revisão → gravação. Gravar direto no upload
 * pouparia um passo, mas colocaria dinheiro no caixa sem ninguém conferir a
 * classificação — e um erro aqui só apareceria semanas depois, na conciliação.
 */
export function AbaImportar() {
  const { filialAtiva } = useFilialAtiva();
  const { grupos } = useGrupos();
  const inputRef = useRef<HTMLInputElement>(null);

  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  async function enviarArquivo(arquivo: File) {
    if (!filialAtiva) {
      setErro("Selecione uma filial antes de importar.");
      return;
    }
    setCarregando(true);
    setErro(null);
    setResultado(null);

    const form = new FormData();
    form.append("arquivo", arquivo);
    form.append("filialId", filialAtiva);

    try {
      const r = await fetch("/api/importar", { method: "POST", body: form });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "Falha ao ler o arquivo");
      setLinhas(
        (json.linhas as Linha[]).map((l) => ({
          ...l,
          grupoId: l.sugestao?.grupoId,
          subgrupoId: l.sugestao?.subgrupoId ?? null,
        }))
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao ler o arquivo");
    } finally {
      setCarregando(false);
    }
  }

  async function confirmar() {
    if (!linhas || !filialAtiva) return;

    // Duplicadas e não classificadas ficam de fora: importar sem grupo jogaria
    // o valor para fora de todos os indicadores, sumindo do relatório.
    const aGravar = linhas.filter((l) => !l.duplicado && l.grupoId);
    if (aGravar.length === 0) {
      setErro("Nenhuma linha classificada para importar.");
      return;
    }

    setGravando(true);
    setErro(null);
    try {
      const r = await fetch("/api/importar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filialId: filialAtiva, linhas: aGravar }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "Falha ao gravar");
      setResultado(
        `${json.criados} lançamento(s) importado(s).` +
          (json.ignorados ? ` ${json.ignorados} já existiam e foram ignorados.` : "")
      );
      setLinhas(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao gravar");
    } finally {
      setGravando(false);
    }
  }

  const novas = linhas?.filter((l) => !l.duplicado) ?? [];
  const semClassificacao = novas.filter((l) => !l.grupoId).length;
  const duplicadas = (linhas?.length ?? 0) - novas.length;

  return (
    <div className="space-y-4">
      {erro && <AvisoErro mensagem={erro} />}

      {resultado && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
          <CheckCircle2 size={16} />
          {resultado}
        </div>
      )}

      {!linhas && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <Upload className="mx-auto text-gray-400" size={32} />
          <p className="mt-3 text-sm text-gray-600">
            Envie o extrato em <strong>OFX</strong>, exportado pelo internet banking.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Data, valor e descrição vêm do arquivo. O sistema sugere a categoria
            pelo histórico, e nada é gravado antes da sua conferência.
          </p>
          <input
            ref={inputRef}
            id="arquivo-ofx"
            type="file"
            accept=".ofx,.OFX"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) enviarArquivo(f);
            }}
          />
          <label htmlFor="arquivo-ofx" className="mt-4 inline-block">
            <span className="inline-flex min-h-11 items-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 cursor-pointer">
              {carregando ? "Lendo arquivo..." : "Escolher arquivo OFX"}
            </span>
          </label>
        </div>
      )}

      {linhas && (
        <>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-lg bg-gray-100 px-3 py-2">{novas.length} nova(s)</span>
            {duplicadas > 0 && (
              <span className="flex items-center gap-1 rounded-lg bg-blue-50 text-blue-700 px-3 py-2">
                <Copy size={14} /> {duplicadas} já importada(s)
              </span>
            )}
            {semClassificacao > 0 && (
              <span className="flex items-center gap-1 rounded-lg bg-amber-50 text-amber-800 px-3 py-2">
                <AlertTriangle size={14} /> {semClassificacao} sem categoria
              </span>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Descrição</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2">Categoria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {linhas.map((l, i) => (
                  <tr
                    key={l.fitid}
                    className={
                      l.duplicado
                        ? "bg-gray-50 text-gray-400"
                        : !l.grupoId
                          ? "bg-amber-50"
                          : ""
                    }
                  >
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(l.data)}</td>
                    <td className="px-3 py-2">
                      {l.descricao}
                      {l.duplicado && <span className="ml-2 text-xs">(já importada)</span>}
                      {!l.duplicado && l.sugestao?.ambiguo && (
                        <span className="ml-2 text-xs text-amber-700">
                          histórico divergente — confira
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-3 py-2 text-right whitespace-nowrap ${
                        l.tipo === "ENTRADA" ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {l.tipo === "SAIDA" ? "−" : ""}
                      {formatCurrency(l.valor)}
                    </td>
                    <td className="px-3 py-2">
                      <label className="sr-only" htmlFor={`grupo-${l.fitid}`}>
                        Categoria de {l.descricao}
                      </label>
                      <select
                        id={`grupo-${l.fitid}`}
                        disabled={l.duplicado}
                        value={l.grupoId ?? ""}
                        onChange={(e) => {
                          const v = e.target.value ? Number(e.target.value) : undefined;
                          setLinhas((atual) =>
                            atual!.map((x, j) =>
                              j === i ? { ...x, grupoId: v, subgrupoId: null } : x
                            )
                          );
                        }}
                        className="min-h-11 w-full rounded border border-gray-300 px-2 text-sm disabled:bg-gray-100"
                      >
                        <option value="">Escolher…</option>
                        {grupos.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.id} — {g.nome}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={confirmar} loading={gravando}>
              Importar {novas.filter((l) => l.grupoId).length} lançamento(s)
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setLinhas(null);
                setErro(null);
              }}
            >
              Cancelar
            </Button>
          </div>

          {semClassificacao > 0 && (
            <p className="text-xs text-gray-500">
              As {semClassificacao} linhas sem categoria não serão importadas.
              Classifique-as agora ou lance-as manualmente depois.
            </p>
          )}
        </>
      )}
    </div>
  );
}
