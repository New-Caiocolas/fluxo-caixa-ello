import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fluxo de Caixa | Grupo ELLO",
  description: "Sistema de gestão de fluxo de caixa do Grupo ELLO",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
