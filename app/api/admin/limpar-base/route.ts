import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { podeExecutar } from "@/lib/permissoes";

export async function DELETE(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!podeExecutar(user.role, "base:limpar")) return NextResponse.json({ error: "Acesso restrito ao Administrador" }, { status: 403 });

  // Deleta em ordem respeitando foreign keys
  const [auditLogs, folhaItens, folhas, lancamentos, saldos, faturamentos] = await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.folhaItem.deleteMany(),
    prisma.folha.deleteMany(),
    prisma.lancamento.deleteMany(),
    prisma.saldo.deleteMany(),
    prisma.faturamento.deleteMany(),
  ]);

  return NextResponse.json({
    ok: true,
    deletados: {
      auditLogs: auditLogs.count,
      folhaItens: folhaItens.count,
      folhas: folhas.count,
      lancamentos: lancamentos.count,
      saldos: saldos.count,
      faturamentos: faturamentos.count,
    },
    mantidos: ["Usuários", "Filiais", "Grupos", "Subgrupos", "Funcionários", "Metas"],
  });
}
