-- Corrige três problemas levantados sobre os dados de produção.
--
-- 1. PRECISÃO MONETÁRIA
--    As colunas de dinheiro estavam em DECIMAL(65,30) — o padrão do Prisma
--    quando não se declara @db.Decimal. Efeito real medido no backup de
--    2026-08-19: 125 valores em Saldo carregavam ruído de ponto flutuante
--    (ex.: 8766.299999999999 onde o correto é 8766.30). O ALTER arredonda e
--    corrige esses valores.
--
--    Funcionario.trienio e Meta.valorMeta NÃO são dinheiro, são percentuais
--    (0.03 = 3%; 25 = 25%). Vão para (5,4) e (5,2) — aplicar (14,2) neles
--    transformaria um triênio de 1,5% em 2%.
--
--    Em FolhaItem os valores têm até 14 casas por serem resultado de divisão
--    (dsr = base/30*7) gravado sem arredondar. O arredondamento muda os totais
--    em no máximo R$ 0,025 na folha inteira — folha se paga em centavos.
--
-- 2. UNICIDADE
--    Verificado no backup: nenhuma duplicata existente, então as constraints
--    entram sem conflito.
--
-- 3. ÍNDICES DE CHAVE ESTRANGEIRA
--    O Postgres não indexa FK automaticamente. AuditLog só cresce e não tinha
--    índice nenhum além da PK.

-- AlterTable
ALTER TABLE "Faturamento" ALTER COLUMN "valorNF" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "FolhaItem" ALTER COLUMN "salarioBase" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "comissao" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "trienio" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "dsr" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "totalBruto" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "inssPatronal" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "entidades" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "fgts" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "totalEncargos" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "totalPagar" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Funcionario" ALTER COLUMN "salarioBase" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "trienio" SET DATA TYPE DECIMAL(5,4);

-- AlterTable
ALTER TABLE "Lancamento" ALTER COLUMN "valor" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Meta" ALTER COLUMN "valorMeta" SET DATA TYPE DECIMAL(5,2);

-- AlterTable
ALTER TABLE "Saldo" ALTER COLUMN "saldoInicial" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "saldoFinal" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "totalEntradas" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "totalSaidas" SET DATA TYPE DECIMAL(14,2);

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_lancamentoId_idx" ON "AuditLog"("lancamentoId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Folha_competencia_key" ON "Folha"("competencia");

-- CreateIndex
CREATE INDEX "FolhaItem_funcionarioId_idx" ON "FolhaItem"("funcionarioId");

-- CreateIndex
CREATE UNIQUE INDEX "FolhaItem_folhaId_funcionarioId_key" ON "FolhaItem"("folhaId", "funcionarioId");

-- CreateIndex
CREATE INDEX "Funcionario_filialId_idx" ON "Funcionario"("filialId");

-- CreateIndex
CREATE INDEX "Subgrupo_grupoId_idx" ON "Subgrupo"("grupoId");

