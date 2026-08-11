# Changelog — asaas-client

Toda alteração aqui afeta **três produtos ao mesmo tempo** (ver `CLAUDE.md`).
Registre a mudança e o motivo antes de publicar, e bumpe a versão — é por este
arquivo que a próxima sessão, vinda de qualquer projeto, entende o que já foi
decidido e não reescreve o que está de pé.

Formato: versão, data, o que mudou, **por quê**, e o que o consumidor precisa
fazer se atualizar.

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
