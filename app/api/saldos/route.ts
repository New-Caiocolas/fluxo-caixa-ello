import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filialId = searchParams.get("filialId");
  const competencia = searchParams.get("competencia");

  if (!filialId || !competencia) {
    return NextResponse.json({ error: "filialId e competencia são obrigatórios" }, { status: 400 });
  }

  const saldos = await prisma.saldo.findMany({
    where: { filialId, competencia },
    orderBy: { data: "asc" },
  });

  return NextResponse.json(saldos);
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { filialId, data, saldoInicial } = await req.json();
  const dataObj = new Date(data);
  const ano = dataObj.getUTCFullYear();
  const mes = String(dataObj.getUTCMonth() + 1).padStart(2, "0");
  const competencia = `${ano}-${mes}`;

  const saldo = await prisma.saldo.upsert({
    where: { filialId_data: { filialId, data: dataObj } },
    create: { filialId, data: dataObj, saldoInicial, competencia },
    update: { saldoInicial },
  });

  return NextResponse.json(saldo);
}
