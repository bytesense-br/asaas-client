# Changelog — asaas-client

Toda alteração aqui afeta **três produtos ao mesmo tempo** (ver `CLAUDE.md`).
Registre a mudança e o motivo antes de publicar, e bumpe a versão — é por este
arquivo que a próxima sessão, vinda de qualquer projeto, entende o que já foi
decidido e não reescreve o que está de pé.

Formato: versão, data, o que mudou, **por quê**, e o que o consumidor precisa
fazer se atualizar.

## 0.6.1 — 2026-08-12

- `listarCobrancasDaAssinatura` avança o `offset` pelo tamanho da página
  recebida, em vez de um passo fixo de 100.

**Por quê**: a paginação da v0.6.0 foi escrita sem confirmação do contrato. A doc
([listagem e paginação](https://docs.asaas.com/reference/listagem-e-paginacao))
confirma o campo `hasMore` e o teto de `limit=100`, mas `offset` é posição de
**item**, não índice de página — e nada garante que toda página venha cheia. Com
passo fixo, uma página curta com `hasMore` faria o `offset` saltar por cima dos
itens da diferença, que é exatamente o truncamento silencioso que a v0.6.0 foi
corrigir.

A mesma leitura da doc mostrou que o bug original era pior do que se estimava: o
`limit` padrão da API é **10**, não 100. Antes da v0.6.0 o histórico de uma
assinatura era cortado na décima cobrança — menos de um ano numa mensal.

**Ao atualizar**: nada muda para quem já está na v0.6.0. Não há mudança de
assinatura nem de comportamento observável fora do cenário de página curta.

## 0.6.0 — 2026-08-12

Correções encontradas em varredura do código, sem feature nova.

- `criarOuBuscarCliente` normaliza o `cpfCnpj` para só dígitos antes de buscar e
  de criar. A busca do Asaas é literal: `"123.456.789-00"` não achava o cliente
  cadastrado como `"12345678900"` e criava um **segundo cadastro para a mesma
  pessoa** — a duplicata que a função existe para evitar.
- A mensagem de erro de `asaasRequest` não inclui mais a query string
  (`/customers?…`). Ela carregava o CPF/CNPJ, e como esta biblioteca não loga,
  quem loga é o consumidor — dado pessoal ia parar no log da aplicação.
- `buscarPixQrCode` ficou **tolerante a falha** na busca do QR, igual às demais
  buscas complementares. O `GET /payments/{id}` continua estourando.
- `listarCobrancasDaAssinatura` pagina até o fim (`limit`/`offset`, guiado por
  `hasMore`). Antes devolvia só a primeira página, truncando o histórico de uma
  assinatura antiga sem nenhum sinal de que faltava coisa.
- Resposta sem corpo (`204`) não estoura mais no `res.json()`. Um
  `cancelarAssinatura` bem-sucedido virava "Unexpected end of JSON input".
- `AsaasConfig.timeoutMs` (padrão **30s**) passa a valer para toda requisição.
- `buscarDadosCobranca` assume `UNDEFINED` quando a resposta não traz
  `billingType`, em vez de não buscar complemento nenhum em silêncio.

**Por quê**: o pacote nunca foi exercitado contra a API real (ver `CLAUDE.md`), e
todos esses defeitos são invisíveis por tipagem e build — só aparecem em leitura
ou em produção. Os três primeiros afetam correção ou privacidade; o timeout fecha
o buraco que a tolerância a falha deixa aberto: ela protege contra *erro*, não
contra *lentidão*, e uma busca complementar pendurada segura o `criarCobranca`
inteiro apesar do `.catch` — justamente a cobrança órfã que se quer evitar.

**Ao atualizar** — duas mudanças de comportamento observável:

1. **`buscarPixQrCode` não estoura mais** quando `/pixQrCode` falha; devolve
   `pixQrCodeUrl`/`pixCopiaECola` como `undefined`. Quem dependia da exceção para
   detectar falha precisa passar a checar o campo. Afeta o **Vitta**, que chega
   nessa função pelo fluxo de assinatura.
2. **Toda requisição agora tem teto de 30s.** Chamada que hoje demora mais que
   isso passa a rejeitar. Ajuste com `criarClienteAsaas({ timeoutMs })` se algum
   fluxo precisar de mais.

`criarCobrancaPix` mantém assinatura e comportamento, com a ressalva do timeout
acima, que vale para todas as chamadas.

**Estado de teste**: verificado com `fetch` stubado (28 casos: normalização,
redação do erro, tolerância, paginação, `204`, timeout). Continua **sem execução
contra a API real** — não há chave de sandbox disponível. O formato das respostas
do Asaas segue vindo da documentação, então a paginação por `hasMore` é
defensiva: se a API não expuser esse campo, o comportamento é idêntico ao de
antes.

## 0.5.0 — 2026-08-11

- `criarCobranca({ formaPagamento })` generaliza a criação de cobrança.
  `UNDEFINED` deixa o mesmo título pagável por PIX **ou** boleto registrado.
- `AsaasCobranca` ganhou `boletoUrl`, `linhaDigitavel`, `codigoBarras` e
  `nossoNumero`, lidos do endpoint `identificationField`.
- `buscarDadosCobranca(paymentId)` relê uma cobrança com tudo que a forma de
  pagamento dela oferece.

**Por quê**: o Morux precisava emitir boleto de verdade para o condomínio piloto
— muito condômino ainda paga no banco, e até aqui o "boleto" do Morux era um PDF
com ficha de compensação simulada, sem banco emissor.

**Ao atualizar**: nada quebra. `criarCobrancaPix` continua com a mesma
assinatura e o mesmo comportamento (billingType PIX). As buscas complementares
(QR, linha digitável) são **tolerantes a falha** de propósito: o pagamento já
existe no Asaas quando elas rodam, então estourar deixaria um título órfão. Se
um campo vier vazio, releia com `buscarDadosCobranca`.

## 0.4.0 — 2026-08-11

- Assinaturas recorrentes: `criarAssinatura`, `atualizarAssinatura`,
  `cancelarAssinatura`, `listarCobrancasDaAssinatura`.
- Suporte a cartão (token ou cartão cru + titular), com `ipComprador`
  obrigatório em assinatura por cartão — exigência do Asaas.
- `verificarWebhookAsaas` passou a comparar em tempo constante.

**Por quê**: o Vitta cobra por assinatura mensal. A comparação em tempo constante
veio de um bug de segurança real já encontrado no Morux, onde a checagem do token
de webhook estava comentada.

## 0.3.0 — 2026-08-09

- `listarDocumentosPendentes()` — documentos que o compliance do Asaas ainda
  espera para aprovar a subconta. Precisa ser chamado com a chave da própria
  subconta, não com a da raiz, e depois de ~15s da criação (a validação na
  Receita roda nesse intervalo).

## 0.2.0 — 2026-08-09

- `criarSubconta` e `split` opcional em `criarCobrancaPix`.

**Por quê**: no Morux, cada condomínio precisa receber na conta do próprio CNPJ,
com a ByteSense retendo a taxa de integração via split — em vez de todo o
dinheiro cair numa conta única.

## 0.1.0 — 2026-07-24

- Extração do cliente Asaas de dentro do Morux: `criarOuBuscarCliente`,
  `criarCobrancaPix`, `buscarPixQrCode`, `verificarWebhookAsaas`.

**Por quê**: o Nortis ia duplicar a mesma integração do zero.
