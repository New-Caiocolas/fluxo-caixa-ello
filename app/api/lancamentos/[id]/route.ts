import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { getCompetencia } from "@/lib/utils";
import { resolverTipoLancamento } from "@/lib/lancamentos";
import { podeExecutar } from "@/lib/permissoes";

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
  // OPERADOR pode editar lançamentos (só não cria nem exclui) — decisão de 2026-05-27.
  if (!podeExecutar(user.role, "lancamento:editar")) return NextResponse.json({ error: "Sem permissão para editar lançamentos" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { filialId, data, grupoId, subgrupoId, descricao, valor, tipo, observacao } = body;

  const existing = await prisma.lancamento.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const tipoFinal = resolverTipoLancamento(Number(grupoId), tipo);
  if (!tipoFinal) {
    return NextResponse.json({ error: "Grupo ou tipo de lançamento inválido" }, { status: 400 });
  }

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
      tipo: tipoFinal,
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
  if (!podeExecutar(user.role, "lancamento:excluir")) return NextResponse.json({ error: "Sem permissão para excluir lançamentos" }, { status: 403 });

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
