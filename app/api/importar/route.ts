import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { podeExecutar } from "@/lib/permissoes";
import { decodificarOFX, parseOFX } from "@/lib/ofx";
import { construirIndice, sugerir } from "@/lib/classificador";
import { getCompetencia } from "@/lib/utils";

/** Extrato grande é raro; o teto evita esgotar memória com upload acidental. */
const LIMITE_BYTES = 5 * 1024 * 1024;

/**
 * Lê um extrato OFX e devolve a prévia da importação — nada é gravado aqui.
 *
 * A gravação fica no PUT, depois da revisão humana. Importar direto no upload
 * pouparia um passo, mas colocaria lançamentos no caixa sem ninguém conferir a
 * classificação sugerida.
 */
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!podeExecutar(user.role, "lancamento:criar")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const form = await req.formData();
  const arquivo = form.get("arquivo");
  const filialId = String(form.get("filialId") ?? "");

  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: "Envie o arquivo OFX" }, { status: 400 });
  }
  if (!filialId) {
    return NextResponse.json({ error: "Escolha a filial" }, { status: 400 });
  }
  if (arquivo.size > LIMITE_BYTES) {
    return NextResponse.json({ error: "Arquivo acima de 5 MB" }, { status: 400 });
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const transacoes = parseOFX(decodificarOFX(buffer));

  if (transacoes.length === 0) {
    return NextResponse.json(
      { error: "Nenhuma transação encontrada. O arquivo é um extrato OFX?" },
      { status: 400 }
    );
  }

  // Uma consulta só para as duas coisas: montar o índice de classificação e
  // saber o que já foi importado. Buscar por transação faria N consultas.
  const [historico, jaImportados] = await Promise.all([
    prisma.lancamento.findMany({
      where: { filialId },
      select: { descricao: true, grupoId: true, subgrupoId: true },
      orderBy: { data: "desc" },
      take: 5000,
    }),
    prisma.lancamento.findMany({
      where: { chaveImportacao: { in: transacoes.map((t) => t.chave) } },
      select: { chaveImportacao: true },
    }),
  ]);

  const indice = construirIndice(historico);
  const duplicados = new Set(jaImportados.map((l) => l.chaveImportacao));

  const linhas = transacoes.map((t) => {
    const s = sugerir(indice, t.descricao);
    return {
      chave: t.chave,
      fitid: t.fitid,
      data: t.data.toISOString(),
      competencia: getCompetencia(t.data),
      valor: t.valor,
      tipo: t.tipo,
      descricao: t.descricao,
      duplicado: duplicados.has(t.chave),
      sugestao: s,
    };
  });

  return NextResponse.json({
    total: linhas.length,
    duplicados: linhas.filter((l) => l.duplicado).length,
    classificados: linhas.filter((l) => l.sugestao && !l.duplicado).length,
    linhas,
  });
}

interface LinhaConfirmada {
  chave: string;
  data: string;
  valor: number;
  tipo: "ENTRADA" | "SAIDA";
  descricao: string;
  grupoId: number;
  subgrupoId?: string | null;
  observacao?: string | null;
}

/**
 * Grava as linhas revisadas.
 *
 * Vai em uma transação: metade dos lançamentos importados é pior que nenhum,
 * porque o caixa fica com um valor plausível e errado, sem ninguém perceber.
 *
 * `skipDuplicates` faz o índice único do fitid virar rede de proteção real —
 * se o mesmo extrato for enviado duas vezes em paralelo, a segunda gravação
 * ignora o que já entrou em vez de estourar erro no meio.
 */
export async function PUT(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!podeExecutar(user.role, "lancamento:criar")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { filialId, linhas } = (await req.json()) as {
    filialId?: string;
    linhas?: LinhaConfirmada[];
  };

  if (!filialId || !Array.isArray(linhas) || linhas.length === 0) {
    return NextResponse.json({ error: "Nada para importar" }, { status: 400 });
  }

  // Confia no cliente para a classificação — que é revisada por uma pessoa —
  // mas não para valor, tipo ou grupo: esses definem o caixa e precisam existir.
  const invalida = linhas.find(
    (l) =>
      !l.chave ||
      !l.descricao ||
      !Number.isFinite(l.valor) ||
      l.valor <= 0 ||
      !Number.isInteger(l.grupoId) ||
      (l.tipo !== "ENTRADA" && l.tipo !== "SAIDA")
  );
  if (invalida) {
    return NextResponse.json(
      { error: `Linha inválida: ${invalida.descricao || invalida.chave}` },
      { status: 400 }
    );
  }

  const gruposValidos = new Set(
    (await prisma.grupo.findMany({ select: { id: true } })).map((g) => g.id)
  );
  const grupoInexistente = linhas.find((l) => !gruposValidos.has(l.grupoId));
  if (grupoInexistente) {
    return NextResponse.json(
      { error: `Grupo ${grupoInexistente.grupoId} não existe` },
      { status: 400 }
    );
  }

  const resultado = await prisma.lancamento.createMany({
    data: linhas.map((l) => {
      const data = new Date(l.data);
      return {
        filialId,
        data,
        competencia: getCompetencia(data),
        grupoId: l.grupoId,
        subgrupoId: l.subgrupoId || null,
        descricao: l.descricao,
        valor: l.valor,
        tipo: l.tipo,
        observacao: l.observacao || null,
        userId: user.userId,
        chaveImportacao: l.chave,
      };
    }),
    skipDuplicates: true,
  });

  return NextResponse.json({
    criados: resultado.count,
    ignorados: linhas.length - resultado.count,
  });
}
