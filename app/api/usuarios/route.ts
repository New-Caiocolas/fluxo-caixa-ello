import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, hashPassword } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email";

function requireAdmin(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  return user;
}

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const usuarios = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(usuarios);
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { name, email, password, role } = await req.json();

  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: "Todos os campos são obrigatórios" }, { status: 400 });
  }

  const roles = ["ADMIN", "GESTOR", "OPERADOR"];
  if (!roles.includes(role)) {
    return NextResponse.json({ error: "Perfil inválido" }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });
  }

  const hashed = await hashPassword(password);
  const usuario = await prisma.user.create({
    data: { name, email, password: hashed, role, mustChangePassword: true },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  // Aguarda o envio antes de retornar — funções serverless encerram ao enviar a resposta
  try {
    await sendWelcomeEmail({ name, email, password, role });
  } catch (err) {
    console.error("[POST /api/usuarios] Falha no e-mail de boas-vindas:", err);
  }

  return NextResponse.json(usuario, { status: 201 });
}
