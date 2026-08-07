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
  if (!podeExecutar(user.role, "meta:configurar")) return NextResponse.json({ error: "Sem permissão para configurar metas" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { valorMeta, ativa } = body;

  const existing = await prisma.meta.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  if (valorMeta !== undefined && (typeof valorMeta !== "number" || valorMeta < 0)) {
    return NextResponse.json({ error: "valorMeta inválido" }, { status: 400 });
  }

  const meta = await prisma.meta.update({
    where: { id },
    data: {
      ...(valorMeta !== undefined ? { valorMeta } : {}),
      ...(ativa !== undefined ? { ativa: Boolean(ativa) } : {}),
    },
    include: { filial: true },
  });

  return NextResponse.json(meta);
}
