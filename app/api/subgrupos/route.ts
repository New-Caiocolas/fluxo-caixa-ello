import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { podeExecutar } from "@/lib/permissoes";
import { validarSubgrupo } from "@/lib/grupos";

/**
 * POST /api/subgrupos
 *
 * Cria uma subcategoria dentro de um grupo. Diferente de Grupo, Subgrupo.id é
 * cuid gerado pelo Prisma — não precisa de sequência manual.
 */
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!podeExecutar(user.role, "categoria:gerenciar")) {
    return NextResponse.json({ error: "Sem permissão para gerenciar categorias" }, { status: 403 });
  }

  const body = await req.json();
  const grupoId = Number(body?.grupoId);
  if (!Number.isInteger(grupoId)) {
    return NextResponse.json({ error: "Informe o grupo da subcategoria" }, { status: 400 });
  }

  const grupo = await prisma.grupo.findUnique({
    where: { id: grupoId },
    select: { ativo: true },
  });
  if (!grupo) {
    return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 });
  }
  if (!grupo.ativo) {
    return NextResponse.json(
      { error: "Não é possível adicionar subcategoria a um grupo desativado" },
      { status: 400 }
    );
  }

  const validacao = validarSubgrupo(body);
  if (!validacao.ok) {
    return NextResponse.json({ error: validacao.erro }, { status: 400 });
  }

  const subgrupo = await prisma.subgrupo.create({
    data: { grupoId, ...validacao.dados },
  });

  return NextResponse.json(subgrupo, { status: 201 });
}
