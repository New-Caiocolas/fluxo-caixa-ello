import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { podeExecutar } from "@/lib/permissoes";
import { validarSubgrupo } from "@/lib/grupos";

/**
 * PUT /api/subgrupos/[id]
 *
 * Edita ou desativa (`ativo: false`) uma subcategoria. Sem DELETE, mesma razão
 * do grupo: Lancamento referencia Subgrupo e o histórico precisa continuar
 * legível. O grupo dono não muda — mover lançamentos entre grupos alteraria os
 * indicadores de meses já fechados.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!podeExecutar(user.role, "categoria:gerenciar")) {
    return NextResponse.json({ error: "Sem permissão para gerenciar categorias" }, { status: 403 });
  }

  const { id } = await params;

  const existente = await prisma.subgrupo.findUnique({ where: { id } });
  if (!existente) {
    return NextResponse.json({ error: "Subcategoria não encontrada" }, { status: 404 });
  }

  const validacao = validarSubgrupo(await req.json());
  if (!validacao.ok) {
    return NextResponse.json({ error: validacao.erro }, { status: 400 });
  }

  const subgrupo = await prisma.subgrupo.update({
    where: { id },
    data: validacao.dados,
  });

  return NextResponse.json(subgrupo);
}
