import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { podeExecutar } from "@/lib/permissoes";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!podeExecutar(user.role, "faturamento:editar")) return NextResponse.json({ error: "Sem permissão para editar faturamento" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { filialId, competencia, valorNF, descricao } = body;

  if (!filialId || !competencia || !valorNF) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  const existing = await prisma.faturamento.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const updated = await prisma.faturamento.update({
    where: { id },
    data: { filialId, competencia, valorNF: Number(valorNF), descricao: descricao || null },
    include: { filial: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!podeExecutar(user.role, "faturamento:excluir")) return NextResponse.json({ error: "Sem permissão para excluir faturamento" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.faturamento.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  await prisma.faturamento.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
