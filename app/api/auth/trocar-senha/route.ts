import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, hashPassword, comparePassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { novaSenha, confirmarSenha, senhaAtual } = await req.json();

  if (!novaSenha || !confirmarSenha) {
    return NextResponse.json({ error: "Nova senha e confirmação são obrigatórias" }, { status: 400 });
  }

  if (novaSenha !== confirmarSenha) {
    return NextResponse.json({ error: "As senhas não coincidem" }, { status: 400 });
  }

  if (novaSenha.length < 6) {
    return NextResponse.json({ error: "A senha deve ter no mínimo 6 caracteres" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  // Se não é primeiro acesso, exige a senha atual
  if (!user.mustChangePassword) {
    if (!senhaAtual) {
      return NextResponse.json({ error: "Senha atual é obrigatória" }, { status: 400 });
    }
    const valid = await comparePassword(senhaAtual, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 });
    }
  }

  const hashed = await hashPassword(novaSenha);
  await prisma.user.update({
    where: { id: payload.userId },
    data: { password: hashed, mustChangePassword: false },
  });

  return NextResponse.json({ ok: true });
}
