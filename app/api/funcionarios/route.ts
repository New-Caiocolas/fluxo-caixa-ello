import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { podeExecutar } from "@/lib/permissoes";

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filialId = searchParams.get("filialId");
  const apenasAtivos = searchParams.get("ativo") !== "false";

  const where: Record<string, unknown> = {};
  if (filialId) where.filialId = filialId;
  if (apenasAtivos) where.ativo = true;

  const funcionarios = await prisma.funcionario.findMany({
    where,
    include: { filial: true },
    orderBy: [{ filialId: "asc" }, { nome: "asc" }],
  });

  return NextResponse.json(funcionarios);
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!podeExecutar(user.role, "funcionario:criar")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const { filialId, nome, cargo, salarioBase, trienio, admissao } = body;

  const func = await prisma.funcionario.create({
    data: {
      filialId,
      nome,
      cargo,
      salarioBase,
      trienio: trienio || 0,
      admissao: new Date(admissao),
    },
    include: { filial: true },
  });

  return NextResponse.json(func, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!podeExecutar(user.role, "funcionario:editar")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const body = await req.json();
  const func = await prisma.funcionario.update({
    where: { id },
    data: {
      ...body,
      admissao: body.admissao ? new Date(body.admissao) : undefined,
    },
    include: { filial: true },
  });

  return NextResponse.json(func);
}
