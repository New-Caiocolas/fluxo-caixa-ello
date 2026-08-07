import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, hashPassword } from "@/lib/auth";
import { podeExecutar } from "@/lib/permissoes";

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

  const usuario = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return NextResponse.json(usuario);
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

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
