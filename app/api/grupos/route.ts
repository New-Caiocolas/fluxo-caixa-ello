import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { podeExecutar } from "@/lib/permissoes";
import { validarGrupo } from "@/lib/grupos";

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const grupos = await prisma.grupo.findMany({
    orderBy: { ordem: "asc" },
    include: {
      subgrupos: { orderBy: { ordem: "asc" } },
    },
  });

  return NextResponse.json(grupos);
}

/**
 * Chave arbitrária para o advisory lock que serializa a criação de grupos.
 * Só precisa ser estável e não colidir com outros usos de lock no banco.
 */
const LOCK_CRIACAO_GRUPO = 4815162342;

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!podeExecutar(user.role, "categoria:gerenciar")) {
    return NextResponse.json({ error: "Sem permissão para gerenciar categorias" }, { status: 403 });
  }

  const validacao = validarGrupo(await req.json());
  if (!validacao.ok) {
    return NextResponse.json({ error: validacao.erro }, { status: 400 });
  }

  const grupo = await prisma.$transaction(async (tx) => {
    // Grupo.id é INTEGER sem autoincremento — o id vem de MAX(id)+1, e sem
    // serializar isso duas criações simultâneas leriam o mesmo MAX e a segunda
    // estouraria violação de chave primária. O advisory lock é liberado no
    // commit/rollback da transação.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_CRIACAO_GRUPO}::bigint)`;

    const maior = await tx.grupo.aggregate({ _max: { id: true } });
    const id = (maior._max.id ?? 0) + 1;

    return tx.grupo.create({
      data: { id, ...validacao.dados },
      include: { subgrupos: true },
    });
  });

  return NextResponse.json(grupo, { status: 201 });
}
