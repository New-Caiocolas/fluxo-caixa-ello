-- Fecha o acesso da API pública (PostgREST) às tabelas da aplicação.
--
-- POR QUE ISTO É NECESSÁRIO
-- O Supabase define default privileges concedendo acesso aos roles `anon` e
-- `authenticated` sobre tabelas criadas no schema public. O Prisma conecta como
-- `postgres` e cria as tabelas ali — então elas nascem acessíveis pela API
-- REST, que é pública e usa uma chave anon publicável por design.
--
-- Este projeto NÃO usa PostgREST: todo acesso a dados passa por Prisma, com
-- autenticação própria (JWT). A API REST é superfície de ataque pura, sem
-- contrapartida. Este script a fecha.
--
-- Rodar DEPOIS de `prisma migrate deploy` e ANTES de carregar os dados.
-- É idempotente: pode rodar de novo a cada migration que crie tabelas.

begin;

-- ── Camada 1: remover os privilégios ──────────────────────────────────────
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
revoke usage on schema public from anon, authenticated;

-- Sem isto, a próxima migration cria tabelas já acessíveis de novo — o revoke
-- acima só alcança o que existe hoje.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;

-- ── Camada 2: RLS ligada, sem policy ──────────────────────────────────────
-- RLS sem nenhuma policy nega tudo. Não afeta a aplicação: o dono da tabela
-- é isento de RLS por padrão, e o Prisma conecta justamente como `postgres`,
-- que é quem criou as tabelas.
--
-- Existe como segunda camada porque as duas falham de formas diferentes: um
-- GRANT acidental numa migration futura ainda esbarraria na RLS.
do $$
declare t record;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename <> '_prisma_migrations'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

commit;

-- Conferência: deve listar todas as tabelas com rowsecurity = true.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
