import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { podeExecutar } from "@/lib/permissoes";
import { validarGrupo } from "@/lib/grupos";

/**
 * PUT /api/grupos/[id]
 *
 * Edita um grupo. Desativar é feito por aqui (`ativo: false`) — não existe
 * DELETE: Lancamento tem FK RESTRICT para Grupo, então apagar um grupo com
 * histórico é impossível, e apagar um sem histórico só criaria buracos na
 * numeração sem ganho nenhum.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!podeExecutar(user.role, "categoria:gerenciar")) {
    return NextResponse.json({ error: "Sem permissão para gerenciar categorias" }, { status: 403 });
  }

  const { id } = await params;
  const grupoId = Number(id);
  if (!Number.isInteger(grupoId)) {
    return NextResponse.json({ error: "Grupo inválido" }, { status: 400 });
  }

  const existente = await prisma.grupo.findUnique({ where: { id: grupoId } });
  if (!existente) {
    return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 });
  }

  const validacao = validarGrupo(await req.json());
  if (!validacao.ok) {
    return NextResponse.json({ error: validacao.erro }, { status: 400 });
  }

  // Trocar o tipo de um grupo que já tem lançamentos inverteria o sinal de todo
  // o histórico de uma vez — o saldo de meses fechados mudaria sozinho.
  if (validacao.dados.tipo !== existente.tipo) {
    const emUso = await prisma.lancamento.count({ where: { grupoId } });
    if (emUso > 0) {
      return NextResponse.json(
        {
          error: `Não é possível mudar o tipo: o grupo já tem ${emUso} lançamento(s), e a alteração inverteria o sinal do histórico. Crie um grupo novo e desative este.`,
        },
        { status: 409 }
      );
    }
  }

  const grupo = await prisma.grupo.update({
    where: { id: grupoId },
    data: validacao.dados,
    include: { subgrupos: { orderBy: { ordem: "asc" } } },
  });

  return NextResponse.json(grupo);
}
