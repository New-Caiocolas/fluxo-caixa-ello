-- CreateEnum
CREATE TYPE "Classificacao" AS ENUM ('RECEBIMENTO', 'CUSTO_OPERACIONAL', 'RESULTADO_FINANCEIRO', 'INVESTIMENTO', 'NEUTRO');

-- AlterTable
ALTER TABLE "Grupo" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "classificacao" "Classificacao" NOT NULL DEFAULT 'NEUTRO',
ADD COLUMN     "permiteAmbosTipos" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Subgrupo" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

-- Backfill: os grupos já existentes não podem ficar com o default NEUTRO, ou
-- sairiam de todos os indicadores. Os valores abaixo reproduzem exatamente o
-- que estava hardcoded em lib/utils.ts antes desta migration:
--   fluxo operacional = recebimentos - grupos 4..12
--   fluxo livre       = fluxo operacional + grupo 13 - grupo 14
UPDATE "Grupo" SET "classificacao" = 'RECEBIMENTO'          WHERE "id" = 1;
UPDATE "Grupo" SET "classificacao" = 'CUSTO_OPERACIONAL'    WHERE "id" BETWEEN 4 AND 12;
UPDATE "Grupo" SET "classificacao" = 'RESULTADO_FINANCEIRO' WHERE "id" = 13;
UPDATE "Grupo" SET "classificacao" = 'INVESTIMENTO'         WHERE "id" = 14;

-- Grupo 13 (Receitas/Despesas Financeiras) tem subgrupos nas duas direções.
UPDATE "Grupo" SET "permiteAmbosTipos" = true WHERE "id" = 13;
