-- Chave de deduplicação do extrato importado.
--
-- A coluna anterior guardava o FITID puro. Extratos reais mostraram que ele
-- NÃO é único: num arquivo da Caixa com 65 transações havia só 53 FITIDs
-- distintos, porque o campo espelha o CHECKNUM — `424065` aparecia cinco
-- vezes com valores e datas diferentes, e duas transações traziam FITID `0`.
-- O índice único teria descartado 12 lançamentos em silêncio.
--
-- A chave agora combina FITID, data, valor e descrição, que juntos
-- identificam a transação. Conferido nos dois bancos em uso: 65/65 e 247/247
-- chaves distintas.
--
-- O DROP é seguro: nada foi importado ainda, a coluna está inteiramente nula.

-- DropIndex
DROP INDEX "Lancamento_fitid_key";

-- AlterTable
ALTER TABLE "Lancamento" DROP COLUMN "fitid",
ADD COLUMN     "chaveImportacao" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Lancamento_chaveImportacao_key" ON "Lancamento"("chaveImportacao");

