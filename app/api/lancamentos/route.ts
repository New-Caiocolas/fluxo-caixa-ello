import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { getCompetencia } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filialId = searchParams.get("filialId");
  const competencia = searchParams.get("competencia");
  const data = searchParams.get("data");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  const where: Record<string, unknown> = {};
  if (filialId) where.filialId = filialId;
  if (data) {
    where.data = {
      gte: new Date(data + "T00:00:00.000Z"),
      lte: new Date(data + "T23:59:59.999Z"),
    };
  } else if (competencia) {
    where.competencia = competencia;
  }

  const [lancamentos, total] = await Promise.all([
    prisma.lancamento.findMany({
      where,
      include: {
        filial: true,
        grupo: true,
        subgrupo: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: [{ data: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.lancamento.count({ where }),
  ]);

  return NextResponse.json({
    data: lancamentos,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (user.role === "OPERADOR") return NextResponse.json({ error: "Sem permissão para criar lançamentos" }, { status: 403 });

  try {
    const body = await req.json();
    const { filialId, data, grupoId, subgrupoId, descricao, valor, tipo, observacao } = body;

    if (!filialId || !data || !grupoId || !descricao || !valor || !tipo) {
      return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }

    const dataObj = new Date(data);
    const competencia = getCompetencia(dataObj);

    const lancamento = await prisma.lancamento.create({
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
        userId: user.userId,
      },
      include: {
        filial: true,
        grupo: true,
        subgrupo: true,
        user: { select: { id: true, name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        lancamentoId: lancamento.id,
        acao: "CREATE",
        dadosDepois: body,
      },
    });

    return NextResponse.json(lancamento, { status: 201 });
  } catch (error) {
    console.error("Error creating lancamento:", error);
    return NextResponse.json({ error: "Erro ao criar lançamento" }, { status: 500 });
  }
}
