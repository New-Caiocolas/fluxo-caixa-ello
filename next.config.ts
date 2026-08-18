import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fixa a raiz de rastreamento no diretório do projeto. Sem isso o Next
  // infere a raiz procurando lockfiles acima e, se houver um package-lock.json
  // solto num diretório pai (ex.: na home do usuário), ele elege esse pai como
  // raiz — e a saída standalone sai aninhada em .next/standalone/<caminho>/…,
  // sem server.js na raiz, quebrando o COPY do Dockerfile.
  // O fallback cobre runtimes onde import.meta.dirname não existe (Node < 20.11
  // ou config carregada como CJS): o Next resolve next.config a partir do cwd,
  // então na prática cwd é a raiz do projeto.
  outputFileTracingRoot: import.meta.dirname ?? process.cwd(),

  serverExternalPackages: ["@prisma/client", "bcryptjs"],

  // Gera .next/standalone — um servidor mínimo com só os arquivos que as rotas
  // realmente usam, sem precisar de node_modules na imagem. É o que permite a
  // imagem Docker enxuta usada no ZimaOS. Na Vercel a opção era desnecessária.
  output: "standalone",

  // @prisma/client está em serverExternalPackages, ou seja, não é empacotado —
  // precisa existir em node_modules em tempo de execução. O client gerado mora
  // em .prisma/client, que o rastreamento nem sempre alcança sozinho por ser
  // carregado dinamicamente. Sem isso o container sobe e quebra na 1ª query.
  outputFileTracingIncludes: {
    "/*": ["node_modules/.prisma/client/**/*"],
  },
};

export default nextConfig;
