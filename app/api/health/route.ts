import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Sem isto o Next tenta pré-renderizar a rota durante o build — e a consulta
// ao banco rodaria na camada de build do Docker, que não alcança o Postgres.
export const dynamic = "force-dynamic";

/**
 * Health check do container, consumido pelo HEALTHCHECK do Docker.
 *
 * Verifica o banco de verdade, e não só se o processo está de pé: o modo de
 * falha real no ZimaOS é o app subir antes do Postgres (ou o Postgres cair
 * sozinho) e responder erro em toda tela. Um check que só confirmasse o
 * processo vivo marcaria esse estado como saudável.
 *
 * Pública por necessidade — o Docker consulta sem cookie. Por isso responde
 * só "ok" ou "degradado": nada de versão, host ou mensagem de erro do banco,
 * que seriam reconhecimento gratuito para quem achar a URL pelo túnel.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "degradado" }, { status: 503 });
  }
}
