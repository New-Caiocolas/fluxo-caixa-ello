import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const grupos = await prisma.grupo.findMany({
    orderBy: { ordem: "asc" },
    include: {
      subgrupos: { orderBy: { ordem: "asc" } },
    },
  });

  return NextResponse.json(grupos);
}
