import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { getCompetencia } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const lancamento = await prisma.lancamento.findUnique({
    where: { id },
    include: { filial: true, grupo: true, subgrupo: true, user: { select: { id: true, name: true } } },
  });

  if (!lancamento) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(lancamento);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { filialId, data, grupoId, subgrupoId, descricao, valor, tipo, observacao } = body;

  const existing = await prisma.lancamento.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const dataObj = new Date(data);
  const competencia = getCompetencia(dataObj);

  const updated = await prisma.lancamento.update({
    where: { id },
    data: {
      filialId,
      data: dataObj,
      grupoId: Number(grupoId),
      subgrupoId: subgrupoId || null,
      descricao,
      valor,
      tipo,
      observacao: observacao || null,
      competencia,
    },
    include: { filial: true, grupo: true, subgrupo: true, user: { select: { id: true, name: true } } },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.userId,
      lancamentoId: id,
      acao: "UPDATE",
      dadosAntes: existing as object,
      dadosDepois: body,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.lancamento.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  await prisma.auditLog.updateMany({
    where: { lancamentoId: id },
    data: { lancamentoId: null },
  });

  await prisma.lancamento.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      userId: user.userId,
      acao: "DELETE",
      dadosAntes: existing as object,
    },
  });

  return NextResponse.json({ ok: true });
}
