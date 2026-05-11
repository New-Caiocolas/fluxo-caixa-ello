import { defineConfig } from "prisma/config";
import "dotenv/config";

// Para migrations/db push, usa o pooler de transação sem parâmetros de pgbouncer
const migrateUrl = (process.env.DATABASE_URL ?? "").split("?")[0];

export default defineConfig({
  datasource: {
    url: migrateUrl,
  },
});
