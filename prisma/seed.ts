import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { GRUPOS } from "../lib/categorias";
import { META_PADRAO } from "../lib/utils";
import * as dotenv from "dotenv";
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Iniciando seed...");

  // Usuário admin
  const adminPass = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@ello.com" },
    update: {},
    create: { name: "Administrador ELLO", email: "admin@ello.com", password: adminPass, role: "ADMIN" },
  });
  console.log("Usuário admin criado:", admin.email);

  // Filiais
  const filiais = await Promise.all([
    prisma.filial.upsert({ where: { codigo: "ELLO-01" }, update: {}, create: { nome: "ELLO Matriz", codigo: "ELLO-01" } }),
    prisma.filial.upsert({ where: { codigo: "IMP-01" }, update: {}, create: { nome: "Imperatriz", codigo: "IMP-01" } }),
    prisma.filial.upsert({ where: { codigo: "FAZ-01" }, update: {}, create: { nome: "Faz do Brasil", codigo: "FAZ-01" } }),
  ]);
  console.log("Filiais criadas:", filiais.map((f) => f.nome).join(", "));

  // Grupos e Subgrupos
  for (const g of GRUPOS) {
    // classificacao e permiteAmbosTipos entram aqui explicitamente: sem eles o
    // grupo nasceria NEUTRO (default do schema) e ficaria fora dos indicadores.
    const dados = {
      nome: g.nome,
      tipo: g.tipo,
      ordem: g.ordem,
      classificacao: g.classificacao,
      permiteAmbosTipos: g.permiteAmbosTipos ?? false,
    };
    await prisma.grupo.upsert({
      where: { id: g.id },
      update: dados,
      create: { id: g.id, ...dados },
    });
    for (const s of g.subgrupos) {
      await prisma.subgrupo.upsert({
        where: { id: s.id },
        update: { nome: s.nome, ordem: s.ordem },
        create: { id: s.id, grupoId: g.id, nome: s.nome, ordem: s.ordem },
      });
    }
  }
  console.log("Grupos e subgrupos criados");

  // Metas por filial (Fluxo Livre e Custo Direto), com os valores padrão da empresa.
  // Cada filial pode ajustar depois em Configurações.
  for (const filial of filiais) {
    await prisma.meta.upsert({
      where: { filialId_tipo: { filialId: filial.id, tipo: "FLUXO_LIVRE" } },
      update: {},
      create: {
        filialId: filial.id,
        tipo: "FLUXO_LIVRE",
        nome: "Fluxo Livre",
        descricao: "Fluxo de Caixa Livre como percentual do Recebimento",
        valorMeta: META_PADRAO.FLUXO_LIVRE,
        operador: ">=",
        baseCalculo: "RECEBIMENTO",
      },
    });
    await prisma.meta.upsert({
      where: { filialId_tipo: { filialId: filial.id, tipo: "CUSTO_DIRETO" } },
      update: {},
      create: {
        filialId: filial.id,
        tipo: "CUSTO_DIRETO",
        nome: "Custo Direto",
        descricao: "Custo Direto (Grupo 4) como percentual do Faturamento",
        valorMeta: META_PADRAO.CUSTO_DIRETO,
        operador: "<=",
        baseCalculo: "FATURAMENTO",
      },
    });
  }
  console.log("Metas padrão criadas por filial");

  // Funcionários de exemplo
  const funcData = [
    { nome: "Carlos Silva", cargo: "Gerente Operacional", salarioBase: 4500, filialId: filiais[0].id, trienio: 0.06 },
    { nome: "Ana Costa", cargo: "Assistente Administrativo", salarioBase: 2200, filialId: filiais[0].id, trienio: 0.03 },
    { nome: "Pedro Oliveira", cargo: "Vendedor", salarioBase: 1800, filialId: filiais[1].id, trienio: 0 },
    { nome: "Maria Santos", cargo: "Operacional", salarioBase: 1600, filialId: filiais[2].id, trienio: 0 },
  ];

  for (const f of funcData) {
    const exists = await prisma.funcionario.findFirst({ where: { nome: f.nome, filialId: f.filialId } });
    if (!exists) {
      await prisma.funcionario.create({ data: { ...f, admissao: new Date("2022-01-01") } });
    }
  }
  console.log("Funcionários de exemplo criados");

  // Lançamentos demo (mês atual)
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const competencia = `${ano}-${mes}`;

  const lancamentosDemo = [
    { filialId: filiais[0].id, data: new Date(`${ano}-${mes}-01`), grupoId: 1, subgrupoId: "1-2", descricao: "Recebimento PIX cliente A", valor: 15000, tipo: "ENTRADA" as const },
    { filialId: filiais[0].id, data: new Date(`${ano}-${mes}-03`), grupoId: 1, subgrupoId: "1-1", descricao: "Boleto vencimento", valor: 8500, tipo: "ENTRADA" as const },
    { filialId: filiais[0].id, data: new Date(`${ano}-${mes}-05`), grupoId: 1, subgrupoId: "1-3", descricao: "Cartão crédito vendas", valor: 6200, tipo: "ENTRADA" as const },
    { filialId: filiais[1].id, data: new Date(`${ano}-${mes}-02`), grupoId: 1, subgrupoId: "1-2", descricao: "Recebimento PIX Imperatriz", valor: 9800, tipo: "ENTRADA" as const },
    { filialId: filiais[0].id, data: new Date(`${ano}-${mes}-04`), grupoId: 4, subgrupoId: "4-1", descricao: "Compra mercadoria fornecedor B", valor: 7200, tipo: "SAIDA" as const },
    { filialId: filiais[0].id, data: new Date(`${ano}-${mes}-06`), grupoId: 4, subgrupoId: "4-3", descricao: "Frete entrega cliente", valor: 350, tipo: "SAIDA" as const },
    { filialId: filiais[0].id, data: new Date(`${ano}-${mes}-05`), grupoId: 7, subgrupoId: "7-8", descricao: "Aluguel sede", valor: 2800, tipo: "SAIDA" as const },
    { filialId: filiais[0].id, data: new Date(`${ano}-${mes}-05`), grupoId: 7, subgrupoId: "7-1", descricao: "Software gestão", valor: 450, tipo: "SAIDA" as const },
    { filialId: filiais[0].id, data: new Date(`${ano}-${mes}-05`), grupoId: 8, subgrupoId: "8-1", descricao: "Folha de pagamento", valor: 12000, tipo: "SAIDA" as const },
    { filialId: filiais[0].id, data: new Date(`${ano}-${mes}-07`), grupoId: 8, subgrupoId: "8-2", descricao: "FGTS mês", valor: 960, tipo: "SAIDA" as const },
    { filialId: filiais[0].id, data: new Date(`${ano}-${mes}-10`), grupoId: 11, subgrupoId: "11-1", descricao: "PIS competência", valor: 380, tipo: "SAIDA" as const },
    { filialId: filiais[0].id, data: new Date(`${ano}-${mes}-10`), grupoId: 11, subgrupoId: "11-2", descricao: "COFINS competência", valor: 1750, tipo: "SAIDA" as const },
  ];

  let criados = 0;
  for (const l of lancamentosDemo) {
    const exists = await prisma.lancamento.findFirst({ where: { filialId: l.filialId, descricao: l.descricao, competencia } });
    if (!exists) {
      await prisma.lancamento.create({ data: { ...l, competencia, userId: admin.id } });
      criados++;
    }
  }
  console.log(`${criados} lançamentos demo criados para ${competencia}`);

  const fatExistente = await prisma.faturamento.findFirst({ where: { filialId: filiais[0].id, competencia } });
  if (!fatExistente) {
    await prisma.faturamento.create({ data: { filialId: filiais[0].id, competencia, valorNF: 35000, descricao: "NFs emitidas mês demo" } });
    console.log("Faturamento demo criado");
  }

  console.log("\nSeed concluído!");
  console.log("Login: admin@ello.com / Senha: admin123");
}

main()
  .catch((e) => { console.error("Erro no seed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
