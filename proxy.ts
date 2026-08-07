import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

/**
 * Rotas públicas — não exigem autenticação.
 */
const publicPaths = ["/login", "/api/auth/login"];

/**
 * Proxy (middleware) do Next.js 16.
 *
 * Protege tanto páginas quanto APIs:
 * - Páginas sem token → redirect para /login
 * - APIs sem token → 401 JSON
 * - Rotas públicas → sempre passam
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rotas públicas sempre passam
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get("auth-token")?.value;
  const isValid = token ? verifyToken(token) : null;

  // APIs protegidas retornam 401 JSON em vez de redirect
  if (pathname.startsWith("/api/")) {
    if (!isValid) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Páginas protegidas redirecionam para login
  if (!isValid) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
