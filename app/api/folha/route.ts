import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { calcularFolha } from "@/lib/folha";
import { podeExecutar } from "@/lib/permissoes";
function toNum(d: unknown): number {
  return d ? Number(d) : 0;
}

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const competencia = searchParams.get("competencia");
  const filialId = searchParams.get("filialId");

  const funcionariosWhere: Record<string, unknown> = { ativo: true };
  if (filialId) funcionariosWhere.filialId = filialId;

  const funcionarios = await prisma.funcionario.findMany({
    where: funcionariosWhere,
    include: { filial: true },
    orderBy: [{ filialId: "asc" }, { nome: "asc" }],
  });

  // Busca folha existente ou calcula
  let folhaItens: Record<string, unknown>[] = [];

  if (competencia) {
    const folha = await prisma.folha.findFirst({
      where: { competencia },
      include: {
        itens: {
          include: {
            funcionario: { include: { filial: true } },
          },
        },
      },
    });

    if (folha) {
      folhaItens = folha.itens.map((item) => ({
        ...item,
        salarioBase: toNum(item.salarioBase),
        comissao: toNum(item.comissao),
        trienio: toNum(item.trienio),
        dsr: toNum(item.dsr),
        totalBruto: toNum(item.totalBruto),
        inssPatronal: toNum(item.inssPatronal),
        entidades: toNum(item.entidades),
        fgts: toNum(item.fgts),
        totalEncargos: toNum(item.totalEncargos),
        totalPagar: toNum(item.totalPagar),
      }));
    } else {
      // Calcula baseado nos funcionários
      folhaItens = funcionarios.map((f) => {
        const calc = calcularFolha(toNum(f.salarioBase), toNum(f.trienio), 0);
        return {
          funcionarioId: f.id,
          funcionario: f,
          salarioBase: toNum(f.salarioBase),
          comissao: 0,
          ...calc,
        };
      });
    }
  }

  // Agrupa por filial
  const porFilial: Record<string, {
    filialId: string;
    filialNome: string;
    itens: typeof folhaItens;
    totalBruto: number;
    totalEncargos: number;
    totalPagar: number;
  }> = {};

  for (const item of folhaItens) {
    const func = (item as { funcionario: { filialId: string; filial: { nome: string } } }).funcionario;
    const fId = func.filialId;
    if (!porFilial[fId]) {
      porFilial[fId] = {
        filialId: fId,
        filialNome: func.filial.nome,
        itens: [],
        totalBruto: 0,
        totalEncargos: 0,
        totalPagar: 0,
      };
    }
    porFilial[fId].itens.push(item);
    porFilial[fId].totalBruto += (item as { totalBruto: number }).totalBruto || 0;
    porFilial[fId].totalEncargos += (item as { totalEncargos: number }).totalEncargos || 0;
    porFilial[fId].totalPagar += (item as { totalPagar: number }).totalPagar || 0;
  }

  return NextResponse.json({
    funcionarios,
    folhaItens,
    porFilial: Object.values(porFilial),
    totais: {
      totalBruto: folhaItens.reduce((acc, i) => acc + ((i as { totalBruto: number }).totalBruto || 0), 0),
      totalEncargos: folhaItens.reduce((acc, i) => acc + ((i as { totalEncargos: number }).totalEncargos || 0), 0),
      totalPagar: folhaItens.reduce((acc, i) => acc + ((i as { totalPagar: number }).totalPagar || 0), 0),
    },
  });
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!podeExecutar(user.role, "folha:editar")) return NextResponse.json({ error: "Sem permissão para editar a folha" }, { status: 403 });

  const { competencia, itens } = await req.json();

  const folha = await prisma.folha.upsert({
    where: { id: `${competencia}` },
    create: { id: competencia, competencia },
    update: { competencia },
  });

  // Remove itens anteriores e recria
  await prisma.folhaItem.deleteMany({ where: { folhaId: folha.id } });

  const created = await prisma.folhaItem.createMany({
    data: itens.map((item: Record<string, unknown>) => ({
      folhaId: folha.id,
      ...item,
    })),
  });

  return NextResponse.json({ folha, itens: created });
}
