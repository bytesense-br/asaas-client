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
| Vitta | `C:\projeto Vitta\vitta_web` | v0.4.0 | v0.6.1 | assinaturas recorrentes, cartão |

"Versão fixada" é o que está no `package.json` do consumidor **hoje** — conferido
em 2026-08-12. "Disponível" é a última tag publicada aqui. As duas colunas
divergindo é o estado normal: **nenhum dos três migrou para a v0.6.x.**

Cada consumidor fixa a versão no `package.json`
(`github:bytesense-br/asaas-client#v0.4.0`). Isso é deliberado: sem pin, um
`npm install` qualquer puxa o HEAD do branch e um produto passa a rodar código
que ninguém decidiu adotar. **Atualizar é ato explícito** — trocar a tag,
reinstalar e testar aquele produto.

Ao publicar uma versão nova, mexa só na coluna "Disponível". A coluna "Versão
fixada" muda depois de o consumidor realmente ter sido migrado, não na hora do
bump — e o jeito de conferir é ler o `package.json` dele, não confiar nesta
tabela.

### O que está parado na fila (v0.6.0 e v0.6.1)

Correções, sem feature nova: duplicata de cliente quando o CPF vem com máscara,
CPF vazando na mensagem de erro (e daí no log do consumidor), `buscarPixQrCode`
estourando com o título já criado, histórico de assinatura truncado na décima
cobrança, `204` quebrando `cancelarAssinatura`, e ausência de timeout. Detalhe e
motivo de cada uma no `CHANGELOG.md`.

Ao migrar, atenção a duas mudanças de comportamento:

- **Vitta** — `buscarPixQrCode` deixou de estourar quando o `/pixQrCode` falha;
  agora devolve `pixQrCodeUrl`/`pixCopiaECola` como `undefined`. Se algum
  `try/catch` de lá usa a exceção como sinal de falha, precisa passar a checar o
  campo. É o consumidor que mais ganha (a paginação corrigida também é dele) e o
  único que exige revisão de código antes de trocar a tag.
- **Todos** — toda requisição passou a ter teto de 30s
  (`criarClienteAsaas({ timeoutMs })` ajusta).

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

Nada aqui foi exercitado contra a API real do Asaas em produção. O que existe:

- Morux validou PIX ponta a ponta **em sandbox**, com webhook real (v0.1.0).
- Subconta, split e boleto registrado **nunca rodaram nem em sandbox** —
  dependem de a conta raiz PJ da ByteSense existir. Validados só por tipagem,
  build e leitura do contrato documentado.
- Assinaturas e cartão: idem, sem execução real.
- Correções da v0.6.x: verificadas com `fetch` stubado (30 casos — normalização
  de CPF, redação da mensagem de erro, tolerância a falha, paginação, `204`,
  timeout). Prova a lógica, não o contrato.

**Não há chave de sandbox do Asaas disponível** (confirmado em 2026-08-12), então
"roda em sandbox para conferir" não é um caminho aberto — não adianta propor.
O que dá para fazer é teste com `fetch` stubado, e o que ele nunca cobre é o
formato real da resposta do Asaas. Quando o formato importar, a fonte é a doc:
[listagem e paginação](https://docs.asaas.com/reference/listagem-e-paginacao) já
resolveu um caso assim — confirmou `hasMore`, o teto `limit=100`, e revelou que o
`limit` padrão é 10, o que tornava o truncamento do histórico bem pior do que se
supunha.

Ao mexer em algo desta lista, não presuma que o comportamento atual já foi
confirmado na prática — o contrato veio da documentação.
