# asaas-client — instruções para o Claude Code

Cliente compartilhado da API Asaas. **Não é um projeto isolado**: o que muda aqui
entra em três produtos diferentes, mantidos em sessões separadas que não veem o
histórico uma da outra.

## Antes de alterar qualquer coisa

1. Leia o `CHANGELOG.md` — é o estado atual consolidado, incluindo o que já foi
   decidido e por quê.
2. `git log --oneline -15` — as mensagens de commit explicam o motivo de cada
   escolha, não só o que mudou.
3. Confirme que a mudança é **aditiva** para quem já usa (ver invariantes abaixo).

## Depois de alterar

1. Entrada nova no `CHANGELOG.md`, com o **porquê** e o que o consumidor precisa
   fazer se atualizar.
2. Bump da versão no `package.json`.
3. `npx tsc --noEmit`.
4. Commit, push e **tag** (`git tag v0.5.0 && git push origin v0.5.0`) — os
   consumidores fixam por tag, então sem tag a versão não chega a ninguém.

## Quem consome, e em que versão

| Projeto | Caminho | Versão fixada | Disponível | Usa |
|---|---|---|---|---|
| Morux | `C:\Projeto Morux\web` | v0.5.0 | v0.6.1 | cobrança avulsa (PIX + boleto), subcontas, split, webhook |
| Nortis | `C:\Projeto Nortis` | v0.1.0 | v0.6.1 | cobrança PIX, webhook |
| Vitta | `C:\projeto Vitta\vitta_web` | **v0.6.1** | v0.6.1 | assinaturas recorrentes, cartão |

"Versão fixada" é o que está no `package.json` do consumidor **hoje** — conferido
em 2026-08-12. "Disponível" é a última tag publicada aqui. As duas colunas
divergindo é o estado normal. **Vitta migrado para a v0.6.1 em 2026-08-12**
(`tsc --noEmit` e `next build` passando); Morux e Nortis seguem atrasados.

⚠️ **`npm install` sozinho NÃO troca a versão.** Com dependência de git, o npm vê
o `resolved` fixo no `package-lock.json` e considera a dependência satisfeita:
trocar a tag no `package.json` e rodar `npm install` deixa o código **antigo** em
`node_modules`, sem erro nenhum. Force com:

```
npm install "asaas-client@github:bytesense-br/asaas-client#vX.Y.Z"
```

E confira que pegou, antes de acreditar que migrou:

```
node -p "require('asaas-client/package.json').version"
```

Cada consumidor fixa a versão no `package.json`
(`github:bytesense-br/asaas-client#v0.4.0`). Isso é deliberado: sem pin, um
`npm install` qualquer puxa o HEAD do branch e um produto passa a rodar código
que ninguém decidiu adotar. **Atualizar é ato explícito** — trocar a tag,
reinstalar e testar aquele produto.

Ao publicar uma versão nova, mexa só na coluna "Disponível". A coluna "Versão
fixada" muda depois de o consumidor realmente ter sido migrado, não na hora do
bump — e o jeito de conferir é ler o `package.json` dele, não confiar nesta
tabela.

### O que Morux e Nortis ainda não pegaram (v0.6.0 e v0.6.1)

Correções, sem feature nova: duplicata de cliente quando o CPF vem com máscara,
CPF vazando na mensagem de erro (e daí no log do consumidor), `buscarPixQrCode`
estourando com o título já criado, histórico de assinatura truncado na décima
cobrança, `204` quebrando `cancelarAssinatura`, e ausência de timeout. Detalhe e
motivo de cada uma no `CHANGELOG.md`.

Ao migrar, atenção a duas mudanças de comportamento:

- `buscarPixQrCode` deixou de estourar quando o `/pixQrCode` falha; agora devolve
  `pixQrCodeUrl`/`pixCopiaECola` como `undefined`. Se algum `try/catch` usa a
  exceção como sinal de falha, precisa passar a checar o campo.
- Toda requisição passou a ter teto de 30s (`criarClienteAsaas({ timeoutMs })`
  ajusta).

**Duplicata de cliente — quem está exposto:** só quem manda `cpfCnpj` com
máscara. O Vitta já normalizava por conta própria (`limparCpfCnpj`), então nunca
foi afetado. Ao migrar Morux e Nortis, olhar como cada um monta esse campo antes
de assumir que o bug os atingia.

**O que a migração do Vitta ensinou** (2026-08-12, o único feito até aqui): o
ganho real estava em `buscarPixQrCode` dentro de `assinar/actions.ts`. Um
`/pixQrCode` que falhasse derrubava o `catch` do fluxo inteiro e a tela dizia
"não foi possível criar a assinatura" — com a assinatura já criada, o registro
gravado e o cupom já incrementado. O usuário tentava de novo e duplicava tudo.
A correção transforma isso em `ok: true` com o `invoiceUrl` de fallback. Vale
procurar o mesmo padrão no Morux e no Nortis: **`catch` amplo em volta de um
fluxo que já teve efeito colateral** é onde essa classe de correção paga.

Nada disso foi exercitado contra a API real — ver "Estado de teste" abaixo.

## Invariantes — o que não pode quebrar

- **`criarCobrancaPix` não muda de assinatura nem de comportamento.** Nortis e
  Vitta dependem dela. Precisou de outra forma de pagamento? Use
  `criarCobranca({ formaPagamento })`, que é o caminho generalizado.
- **Nada de `console.log`/logger aqui.** É biblioteca; quem loga é o consumidor.
- **Sem dependências.** O pacote não importa nada — roda em Node e em runtime de
  edge (o `verificarWebhookAsaas` faz comparação em tempo constante na mão em vez
  de usar `crypto.timingSafeEqual` justamente por isso).
- **Buscas complementares depois de criar um pagamento são tolerantes a falha.**
  O título já existe no Asaas quando elas rodam; estourar deixaria uma cobrança
  órfã na conta do cliente. Devolva o campo vazio e ofereça um jeito de reler.
- **Nada de schema, migration ou regra de negócio de produto aqui.** Este pacote
  é o cliente HTTP da API Asaas e mais nada — `cobrancas.asaas_id`, faturas,
  planos, tudo isso pertence ao produto.

## Onde NÃO editar

O Morux tem um adaptador fino em `web/src/lib/pagamento/asaas.ts` que só
reexporta daqui. Corrigir lá em vez de aqui recria a duplicação que motivou a
extração — e o Nortis e o Vitta não recebem a correção.

## Estado de teste

Nada aqui foi exercitado contra a API real do Asaas **em produção**. Contra o
**sandbox**, boa parte já rodou — a lista abaixo diz exatamente o quê, e o que
ainda é presunção:

- Morux validou PIX ponta a ponta **em sandbox**, com webhook real (v0.1.0).
- **Boleto registrado rodou de verdade contra o sandbox em 2026-08-12** (v0.5.0):
  `criarCobranca` com `UNDEFINED` devolveu `linhaDigitavel`, `codigoBarras`,
  `nossoNumero` e `boletoUrl` preenchidos pelo endpoint `identificationField`,
  junto do PIX. O contrato dos campos de boleto está confirmado, não presumido.
- Subconta e split **nunca rodaram** — dependem de conta PJ. Em 2026-08-12,
  `POST /accounts` no sandbox voltou **403: "Contas de pessoa física (CPF) não
  podem criar subcontas"**. Ajustar "Modelo da operação" para "BaaS do Asaas" no
  painel é necessário, mas não contorna o CPF.
- **Assinaturas rodaram contra o sandbox em 2026-08-12** (v0.6.1): `criarAssinatura`
  PIX/`MONTHLY` volta `ACTIVE` e **já nasce com a primeira cobrança**, então
  `listarCobrancasDaAssinatura` devolve 1 item na hora — o `if (!primeira)` dos
  consumidores é defesa, não caminho comum. `buscarPixQrCode` nessa cobrança
  devolve copia-e-cola válido, e `cancelarAssinatura` volta
  `{ deleted: true, id }`.
- **A tolerância a falha foi provada contra a API real** (v0.6.1), não só em stub:
  numa cobrança `CREDIT_CARD` o `GET /payments/{id}/pixQrCode` responde
  **400 "Esta cobrança não permite pagamentos via Pix."** `buscarPixQrCode`
  resolve com `pixCopiaECola`/`pixQrCodeUrl` em `undefined` e `invoiceUrl` +
  `dueDate` preenchidos. Em v0.4.0 esse mesmo caso virava exceção.
- Correções da v0.6.x: 30 casos com `fetch` stubado (normalização de CPF, redação
  da mensagem de erro, tolerância, paginação, `204`, timeout) **mais** execução
  real em sandbox das correções 2, 3 e 7. A redação da query foi confirmada de
  verdade: um `POST /customers` com CPF inválido devolve mensagem sem o CPF.

**Duas coisas que só a execução real mostrou** — e que contrariam o que se supunha:

- `DELETE /subscriptions/{id}` devolve **200 com corpo** `{"deleted":true,"id":…}`,
  **não `204`**. A defesa contra corpo vazio na v0.6.0 é preventiva, não conserto
  de bug ativo: `cancelarAssinatura` nunca esteve quebrado nesse endpoint.
- `formaPagamento: "UNDEFINED"` tem **valor mínimo de R$ 30,00** — abaixo disso o
  `POST /payments` volta 400 ("O valor mínimo para cobranças com a forma de
  pagamento Pergunte ao Cliente é R$ 30,00"). Não vale para `PIX` nem `BOLETO`
  puros. Quem usa `UNDEFINED` com ticket baixo precisa saber disso.

E uma que **desmente uma suposição minha**: o `/pixQrCode` responde 200 com PIX
válido até para cobrança `BOLETO`. O Asaas gera PIX para quase tudo — o único
caso de falha encontrado foi `CREDIT_CARD`. O cenário do bug do Vitta é mais raro
do que a v0.6.0 supunha, mas continua real (timeout, 5xx, rede).

**Existe chave de sandbox** — está em `C:\Projeto Morux\web\.env.local`
(`ASAAS_API_KEY`, prefixo `$aact_hmlg…`, com `ASAAS_BASE_URL` apontando para
`https://sandbox.asaas.com/api/v3`). Uma versão anterior deste arquivo afirmava
o contrário; foi corrigido em 2026-08-12 depois de rodar contra o sandbox de
fato. Dois utilitários do Morux exercitam o pacote sem precisar de conta PJ:
`web/scripts/asaas-diagnostico.ts` (read-only: tipo da conta, situação
cadastral, carteira) e `web/scripts/asaas-qa-local.ts --emitir` (emite de
verdade apontando um condomínio de QA para a chave de sandbox).

Para o que ainda não dá para executar, a fonte é a doc:
[listagem e paginação](https://docs.asaas.com/reference/listagem-e-paginacao) já
resolveu um caso assim — confirmou `hasMore`, o teto `limit=100`, e revelou que o
`limit` padrão é 10, o que tornava o truncamento do histórico bem pior do que se
supunha. Em 2026-08-12 a resposta real confirmou o envelope:
`{ hasMore, totalCount, limit, offset }` em
`GET /subscriptions/{id}/payments`. O que **não** foi exercitado é a virada de
página — a assinatura de teste tinha 1 cobrança, então `hasMore: false`. O laço
de `listarCobrancasDaAssinatura` com mais de 100 itens continua sem execução real.

O que ainda não rodou contra API nenhuma: **subconta e split** (barrados por conta
CPF), **cartão de crédito de fato** (a cobrança `CREDIT_CARD` foi criada, mas
nenhum pagamento foi tokenizado ou capturado) e o **timeout** de 30s, que só foi
provado em stub. Ao mexer nesses, o contrato vem da documentação, não de prova.
