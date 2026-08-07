import { defineConfig } from "prisma/config";
import "dotenv/config";

// Migrations exigem uma conexão que aceite prepared statements e advisory
// locks — o pooler de transação (PgBouncer) não suporta nenhum dos dois e o
// CLI trava indefinidamente. Por isso usamos DIRECT_URL aqui, e não a
// DATABASE_URL do runtime. O fallback mantém `prisma generate` funcionando
// em ambientes que não precisam migrar (ex.: build na Vercel).
const migrateUrl =
  process.env.DIRECT_URL ?? (process.env.DATABASE_URL ?? "").split("?")[0];

export default defineConfig({
  datasource: {
    url: migrateUrl,
  },
});
