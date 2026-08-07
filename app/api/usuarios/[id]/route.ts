import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, hashPassword } from "@/lib/auth";
import { podeExecutar } from "@/lib/permissoes";
import { deixariaSemAdmin } from "@/lib/usuarios";

/** Sinaliza, de dentro da transação, que a operação deixaria a base sem ADMIN. */
class UltimoAdminError extends Error {}

const ERRO_ULTIMO_ADMIN =
  "Este é o único ADMIN do sistema. Promova outro usuário a ADMIN antes de alterar ou excluir este.";

function requireAdmin(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!podeExecutar(user.role, "usuario:gerenciar")) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  return user;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const { name, email, role, password } = await req.json();

  if (!name || !email || !role) {
    return NextResponse.json({ error: "Nome, e-mail e perfil são obrigatórios" }, { status: 400 });
  }

  const roles = ["ADMIN", "GESTOR", "OPERADOR"];
  if (!roles.includes(role)) {
    return NextResponse.json({ error: "Perfil inválido" }, { status: 400 });
  }

  const emailConflict = await prisma.user.findFirst({
    where: { email, NOT: { id } },
  });
  if (emailConflict) {
    return NextResponse.json({ error: "E-mail já em uso por outro usuário" }, { status: 409 });
  }

  const data: Record<string, unknown> = { name, email, role };
  if (password && password.trim().length > 0) {
    if (password.length < 6) {
      return NextResponse.json({ error: "Senha deve ter no mínimo 6 caracteres" }, { status: 400 });
    }
    data.password = await hashPassword(password);
  }

  try {
    const usuario = await prisma.$transaction(async (tx) => {
      // FOR UPDATE trava as linhas de ADMIN durante a transação. Sem ele, dois
      // rebaixamentos simultâneos passariam na checagem — cada um enxergando o
      // outro como o ADMIN remanescente — e juntos zerariam a conta.
      const admins = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "User" WHERE "role" = 'ADMIN'::"Role" FOR UPDATE
      `;

      if (
        deixariaSemAdmin({
          alvoEhAdmin: admins.some((a) => a.id === id),
          papelNovo: role,
          totalAdmins: admins.length,
        })
      ) {
        throw new UltimoAdminError();
      }

      return tx.user.update({
        where: { id },
        data,
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });
    });

    return NextResponse.json(usuario);
  } catch (err) {
    if (err instanceof UltimoAdminError) {
      return NextResponse.json({ error: ERRO_ULTIMO_ADMIN }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  if (auth.userId === id) {
    return NextResponse.json({ error: "Você não pode excluir sua própria conta" }, { status: 400 });
  }

  // Hoje o bloqueio de auto-exclusão acima já impede que a exclusão zere os
  // ADMINs (quem executa sempre permanece). A checagem é repetida aqui para
  // que a invariante não dependa dessa outra regra continuar existindo.
  try {
    await prisma.$transaction(async (tx) => {
      const admins = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "User" WHERE "role" = 'ADMIN'::"Role" FOR UPDATE
      `;

      if (
        deixariaSemAdmin({
          alvoEhAdmin: admins.some((a) => a.id === id),
          papelNovo: null,
          totalAdmins: admins.length,
        })
      ) {
        throw new UltimoAdminError();
      }

      await tx.user.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UltimoAdminError) {
      return NextResponse.json({ error: ERRO_ULTIMO_ADMIN }, { status: 409 });
    }
    throw err;
  }
}
