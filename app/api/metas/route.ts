import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

const TIPOS_VALIDOS = ["FLUXO_LIVRE", "CUSTO_DIRETO"] as const;

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filialId = searchParams.get("filialId");

  const metas = await prisma.meta.findMany({
    where: filialId ? { filialId } : undefined,
    include: { filial: true },
    orderBy: [{ filialId: "asc" }, { tipo: "asc" }],
  });

  return NextResponse.json(metas);
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (user.role === "OPERADOR") return NextResponse.json({ error: "Sem permissão para configurar metas" }, { status: 403 });

  const body = await req.json();
  const { filialId, tipo, nome, descricao, valorMeta, operador, baseCalculo } = body;

  if (!filialId || !tipo || !nome || valorMeta === undefined || !operador || !baseCalculo) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json({ error: "Tipo de meta inválido" }, { status: 400 });
  }

  const filial = await prisma.filial.findUnique({ where: { id: filialId } });
  if (!filial) return NextResponse.json({ error: "Filial não encontrada" }, { status: 400 });

  try {
    const meta = await prisma.meta.create({
      data: { filialId, tipo, nome, descricao: descricao || null, valorMeta, operador, baseCalculo },
      include: { filial: true },
    });
    return NextResponse.json(meta, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Já existe uma meta desse tipo para essa filial" }, { status: 409 });
  }
}
