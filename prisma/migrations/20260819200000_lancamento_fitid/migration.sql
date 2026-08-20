-- Deduplicação de extrato importado.
--
-- FITID é o identificador que o banco atribui a cada transação no OFX,
-- estável entre exportações. Guardá-lo com índice único faz o banco recusar
-- a segunda importação do mesmo lançamento, em vez de confiar em quem opera
-- lembrar até onde já importou.
--
-- Nulo nos lançamentos digitados à mão — e o UNIQUE do Postgres permite
-- múltiplos NULLs, então os 541 registros existentes não conflitam entre si.

-- AlterTable
ALTER TABLE "Lancamento" ADD COLUMN     "fitid" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Lancamento_fitid_key" ON "Lancamento"("fitid");

