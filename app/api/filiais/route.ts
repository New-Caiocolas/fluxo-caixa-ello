import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { ehAdmin } from "@/lib/permissoes";

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const filiais = await prisma.filial.findMany({
    where: { ativa: true },
    orderBy: { nome: "asc" },
  });

  return NextResponse.json(filiais);
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user || !ehAdmin(user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { nome, codigo } = await req.json();
  const filial = await prisma.filial.create({ data: { nome, codigo } });
  return NextResponse.json(filial, { status: 201 });
}
