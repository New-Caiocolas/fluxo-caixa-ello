# senior/ — web service `com.ello.metrics`

Gerador do `.ssf` que este projeto importa no Senior para obter dados
financeiros. O provedor `com.ello.metrics` é **separado** do
`com.ello.coletor` — mexer aqui não afeta o almoxarifado.

## Arquivos

| Arquivo | O que é |
|---|---|
| `com.ello.metrics.base.ssf` | Export original do Senior. **Fonte da verdade e rollback.** |
| `com.ello.metrics.novo.ssf` | Gerado por `build.mjs`. É o que se importa. |
| `build.mjs` | Aplica as alterações. Sempre parte do base. |
| `ssf-lib.mjs` | Leitura/escrita do formato `.ssf` |
| `mostrar-regra.mjs` | Imprime a regra LSP de uma porta |

## Uso

```bash
npm run senior:build
```

Sempre reescreve `com.ello.metrics.novo.ssf` a partir do base — nunca aplica
patch sobre patch. Rodar duas vezes dá o mesmo resultado.

Conferir antes de importar:

```bash
node senior/mostrar-regra.mjs senior/com.ello.metrics.novo.ssf ConsultarFinanceiro
```

## As quatro portas

| Porta | Retorna | Tabelas |
|---|---|---|
| `ConsultarFinanceiro` | contas a pagar | `E501TCP` + `E095FOR` |
| `ConsultarContasReceber` | contas a receber | `E301TCR` + `E085CLI` |
| `ConsultarFaturamento` | faturamento diário + impostos | `E140NFV` |
| `ConsultarCMV` | custo das saídas de venda | `E210MVP` |

Endpoint (funciona pela internet, sem VPN):
`https://webp02.seniorcloud.com.br:30301/g5-senior-services/sapiens_Synccom_ello_metrics`

Autenticação G5 clássica: `user`/`password` do SGU no envelope, `encryption = 0`.
Credenciais em `.env` (`SENIOR_ENDPOINT`, `SENIOR_USER`, `SENIOR_PASSWORD`).

## Alteração aplicada hoje

`ConsultarFinanceiro` passa a devolver o **histórico do título** (`t.HisTit`),
que é onde a natureza do gasto está escrita — "Ref. Material p/ Revenda",
"Ref. Serviço Prestado PJ", "Ref. Frete de Saída". São ~18 categorias, e três
delas cobrem 69% dos títulos. É a base da classificação contábil.

O `ctafin`, que parecia servir para isso, está zerado em 80% dos títulos e só
cobre empréstimo e imposto.

### Por que na coluna `centroCusto`

O histórico é devolvido em `centroCusto`, e não numa coluna nova. Motivo: o
`ssf-lib` não decodifica o layout de grid destas portas — elas não vieram do
mesmo molde das do coletor —, e criar coluna às cegas corromperia o arquivo.
A `centroCusto` já existia no grid e **nunca era preenchida**: o SELECT sequer
a trazia, e vinha nula nos 11.295 títulos.

É um remendo. O certo é acrescentar uma coluna `historico` pelo editor do
Senior; quando isso acontecer, ajuste `build.mjs` e apague este parágrafo.

## Antes de importar

- **Importação é mudança em produção.** As portas entram para todo mundo ao
  mesmo tempo. O `com.ello.metrics` também alimenta o dashboard do
  commission-compass.
- **Rollback:** reimportar `com.ello.metrics.base.ssf`.
- Se `HisTit` não for o nome certo do campo em `E501TCP`, a porta não compila
  e a importação falha inteira — falha segura, sem corromper dado.
- Depois de importar, o Senior pede para executar e publicar **duas vezes**.

## Sondar se uma porta está no ar

Credencial falsa distingue os casos, sem tocar em nada:

- *"Credenciais inválidas"* → publicada e funcionando
- *"A porta X não foi encontrada"* → não publicada
- *"não está disponível para o módulo Sapiens"* → publicada, ainda propagando

## Origem

O formato `.ssf` foi descoberto por engenharia reversa no repositório
**Coletor-ello** (`tools/ssf.mjs`), validado nas 32 portas do coletor.
`ssf-lib.mjs` é um subconjunto copiado de lá para este projeto rodar sozinho.
O guia de armadilhas do LSP está em `Coletor-ello/senior/Guia para webservice
grupoello.md` — leitura obrigatória antes de escrever regra nova.
