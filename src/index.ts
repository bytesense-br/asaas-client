// Cliente compartilhado da API Asaas — extraído do Morux em 2026-07-24 pra
// reaproveitar entre Morux e Nortis (ambos cobram via Asaas) sem duplicar
// manutenção. Documentação: https://docs.asaas.com/
// Ambientes: https://sandbox.asaas.com (homologação) / https://www.asaas.com (produção)

export interface AsaasConfig {
  apiKey: string;
  baseUrl?: string;
}

export type AsaasCobranca = {
  id: string;
  status: string;
  invoiceUrl: string;
  pixQrCodeUrl?: string;
  pixCopiaECola?: string;
  dueDate: string;
  value: number;
};

export type AsaasWebhookPayload = {
  event: string;
  payment: {
    id: string;
    externalReference?: string;
    status: string;
    value: number;
    paymentDate?: string;
    /** Preenchido quando a cobrança foi gerada por uma assinatura. */
    subscription?: string;
    /** Só vem em cobrança de cartão — últimos 4 dígitos e bandeira. */
    creditCard?: { creditCardNumber?: string; creditCardBrand?: string };
  };
};

/**
 * Eventos de cobrança que interessam a um fluxo de assinatura. A lista completa
 * é bem maior (chargeback, estorno, dunning, split) — ver
 * https://docs.asaas.com/docs/webhook-para-cobrancas
 *
 * Atenção ao par CONFIRMED/RECEIVED: `PAYMENT_CONFIRMED` significa que o
 * pagamento foi confirmado mas o saldo ainda NÃO está disponível;
 * `PAYMENT_RECEIVED` é quando o dinheiro cai. Para liberar acesso a um produto,
 * CONFIRMED já basta — esperar RECEIVED atrasa o cliente sem motivo.
 */
export type AsaasEventoCobranca =
  | "PAYMENT_CREATED"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_OVERDUE"
  | "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED"
  | "PAYMENT_REFUNDED"
  | "PAYMENT_CHARGEBACK_REQUESTED"
  | "PAYMENT_DELETED";

export type AsaasCiclo =
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "BIMONTHLY"
  | "QUARTERLY"
  | "SEMIANNUALLY"
  | "YEARLY";

export type AsaasBillingType = "BOLETO" | "CREDIT_CARD" | "PIX" | "UNDEFINED";

/**
 * Desconto de assinatura no Asaas — CUIDADO, a semântica não é a que a maioria
 * dos gateways usa para cupom promocional.
 *
 * Aqui o desconto vale para TODAS as cobranças do ciclo, e `dueDateLimitDays` é
 * "quantos dias antes do vencimento o desconto ainda se aplica" (desconto por
 * pontualidade), não "por quantos ciclos o cupom vale". O Asaas NÃO tem o
 * conceito de "desconto nos N primeiros ciclos".
 *
 * Para cupom que expira depois de N cobranças, o controle tem que ser seu:
 * criar a assinatura com o desconto e removê-lo via update quando a contagem de
 * cobranças pagas atingir o limite.
 * Ref: https://docs.asaas.com/reference/criar-nova-assinatura
 */
export type AsaasDesconto = {
  value: number;
  type: "FIXED" | "PERCENTAGE";
  /** 0 = desconto vale até a data de vencimento. */
  dueDateLimitDays?: number;
};

export type AsaasCartao = {
  holderName: string;
  number: string;
  /** 2 dígitos. */
  expiryMonth: string;
  /** 4 dígitos. */
  expiryYear: string;
  ccv: string;
};

export type AsaasTitularCartao = {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  phone: string;
  addressComplement?: string;
  mobilePhone?: string;
};

export type AsaasTokenCartao = {
  creditCardNumber: string;
  creditCardBrand: string;
  creditCardToken: string;
};

export type AsaasAssinatura = {
  id: string;
  customer: string;
  status: "ACTIVE" | "EXPIRED" | "INACTIVE";
  billingType: AsaasBillingType;
  cycle: AsaasCiclo;
  value: number;
  nextDueDate: string;
  externalReference?: string | null;
  description?: string | null;
  deleted?: boolean;
};

/** Item de `GET /subscriptions/{id}/payments`. */
export type AsaasCobrancaResumo = {
  id: string;
  customer: string;
  value: number;
  status: string;
  dueDate: string;
  paymentDate?: string | null;
  billingType: AsaasBillingType;
  invoiceUrl?: string;
};

/**
 * Divisão automática do valor recebido entre carteiras Asaas. Calculado sobre o
 * valor LÍQUIDO da cobrança (depois das taxas do Asaas). Regra da API: a
 * carteira de quem emite a cobrança nunca entra no split — o emissor recebe
 * automaticamente o que não foi distribuído.
 * Ref: https://docs.asaas.com/docs/split-de-pagamentos
 */
export type AsaasSplit = {
  walletId: string;
  fixedValue?: number;
  percentualValue?: number;
};

export type AsaasWebhookConfig = {
  name: string;
  url: string;
  email: string;
  /** 32-255 caracteres, exigência da API. Volta no header `asaas-access-token`. */
  authToken: string;
  events: string[];
};

export type AsaasSubcontaParams = {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone: string;
  /** Faturamento/renda mensal em reais. Obrigatório pela API. */
  incomeValue: number;
  address: string;
  addressNumber: string;
  province: string; // bairro
  postalCode: string;
  companyType?: "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";
  complement?: string;
  phone?: string;
  site?: string;
  /** Registrados já na criação — evita perder evento entre criar e configurar. */
  webhooks?: AsaasWebhookConfig[];
};

/**
 * Documento exigido pelo compliance do Asaas para aprovar uma subconta.
 *
 * Regra que mais importa: quando `onboardingUrl` vem preenchido, o envio TEM
 * que acontecer por aquele link — POST no endpoint de upload é rejeitado nesse
 * caso. Só documento sem `onboardingUrl` aceita envio via API.
 * Ref: https://docs.asaas.com/docs/detalhamento-do-fluxo-de-aprovacao-de-subcontas
 */
export type AsaasDocumentoPendente = {
  id: string;
  status: "NOT_SENT" | "PENDING" | "APPROVED" | "REJECTED" | "IGNORED";
  /** IDENTIFICATION | IDENTIFICATION_SELFIE | MINUTES_OF_ELECTION | CUSTOM | ... */
  type: string;
  title: string;
  description: string;
  responsible?: { name: string; type: string[] } | null;
  onboardingUrl?: string | null;
  onboardingUrlExpirationDate?: string | null;
};

export type AsaasDocumentosPendentes = {
  rejectReasons: string | null;
  data: AsaasDocumentoPendente[];
};

export type AsaasSubconta = {
  id: string;
  walletId: string;
  /**
   * Só existe nesta resposta. O Asaas nunca mais devolve essa chave em
   * nenhuma consulta — quem chama precisa persistir na hora, num cofre.
   */
  apiKey: string;
};

export function criarClienteAsaas(config: AsaasConfig) {
  const baseUrl = config.baseUrl ?? "https://sandbox.asaas.com/api/v3";

  async function asaasRequest(method: string, path: string, body?: unknown) {
    if (!config.apiKey) throw new Error("Asaas apiKey não configurada.");

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        access_token: config.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Asaas ${method} ${path} → ${res.status}: ${text}`);
    }
    return res.json();
  }

  return {
    async criarOuBuscarCliente(params: {
      nome: string;
      cpfCnpj: string;
      email?: string;
      telefone?: string;
    }): Promise<string> {
      const lista = await asaasRequest("GET", `/customers?cpfCnpj=${params.cpfCnpj}`);
      if (lista.data?.length > 0) return lista.data[0].id as string;

      const cliente = await asaasRequest("POST", "/customers", {
        name: params.nome,
        cpfCnpj: params.cpfCnpj,
        email: params.email,
        mobilePhone: params.telefone,
        notificationDisabled: false,
      });
      return cliente.id as string;
    },

    /**
     * Cria uma subconta vinculada a esta conta (que passa a ser a conta raiz).
     * Só conta PJ pode criar subconta — conta CPF recebe erro da API.
     * Ref: https://docs.asaas.com/docs/criacao-de-subcontas
     */
    async criarSubconta(params: AsaasSubcontaParams): Promise<AsaasSubconta> {
      const conta = await asaasRequest("POST", "/accounts", params);

      // A chave vem em `accessToken.apiKey` no contrato documentado, mas
      // respostas antigas trazem `apiKey` na raiz — aceita as duas.
      const apiKey: string | undefined = conta.apiKey ?? conta.accessToken?.apiKey;
      if (!apiKey) {
        throw new Error(
          `Asaas criou a subconta ${conta.id} mas não devolveu apiKey. ` +
            `Essa chave não é recuperável por consulta — use o endpoint de chaves de API da subconta.`
        );
      }

      return { id: conta.id as string, walletId: conta.walletId as string, apiKey };
    },

    /**
     * Documentos que o Asaas ainda espera para aprovar ESTA conta — precisa ser
     * chamado com a chave da própria subconta, não com a da conta raiz.
     *
     * Depois de criar a subconta, esperar pelo menos 15s antes de chamar: a
     * validação na Receita Federal roda nesse intervalo e a lista vem vazia
     * (ou incompleta) se a consulta chegar antes.
     */
    async listarDocumentosPendentes(): Promise<AsaasDocumentosPendentes> {
      const resposta = await asaasRequest("GET", "/myAccount/documents");
      return {
        rejectReasons: resposta.rejectReasons ?? null,
        data: (resposta.data ?? []) as AsaasDocumentoPendente[],
      };
    },

    async criarCobrancaPix(params: {
      clienteId: string;
      valor: number;
      vencimento: string; // YYYY-MM-DD
      descricao: string;
      externalReference?: string;
      split?: AsaasSplit[];
    }): Promise<AsaasCobranca> {
      const cobranca = await asaasRequest("POST", "/payments", {
        customer: params.clienteId,
        billingType: "PIX",
        value: params.valor,
        dueDate: params.vencimento,
        description: params.descricao,
        externalReference: params.externalReference,
        split: params.split?.length ? params.split : undefined,
      });

      const pix = await asaasRequest("GET", `/payments/${cobranca.id}/pixQrCode`);

      return {
        id: cobranca.id,
        status: cobranca.status,
        invoiceUrl: cobranca.invoiceUrl,
        pixQrCodeUrl: pix.encodedImage ? `data:image/png;base64,${pix.encodedImage}` : undefined,
        pixCopiaECola: pix.payload,
        dueDate: cobranca.dueDate,
        value: cobranca.value,
      };
    },

    async buscarPixQrCode(paymentId: string): Promise<AsaasCobranca> {
      const [pagamento, pix] = await Promise.all([
        asaasRequest("GET", `/payments/${paymentId}`),
        asaasRequest("GET", `/payments/${paymentId}/pixQrCode`),
      ]);

      return {
        id: pagamento.id,
        status: pagamento.status,
        invoiceUrl: pagamento.invoiceUrl,
        pixQrCodeUrl: pix.encodedImage ? `data:image/png;base64,${pix.encodedImage}` : undefined,
        pixCopiaECola: pix.payload,
        dueDate: pagamento.dueDate,
        value: pagamento.value,
      };
    },

    // ─── Assinaturas recorrentes ──────────────────────────────────────────────

    /**
     * Troca dados de cartão por um token reutilizável, para não guardar cartão
     * no seu banco. Se você captura o cartão na sua própria interface, HTTPS é
     * obrigatório — o Asaas bloqueia a conta para cartão caso contrário.
     * Ref: https://docs.asaas.com/reference/credit-card-tokenization
     */
    async tokenizarCartao(params: {
      clienteId: string;
      cartao: AsaasCartao;
      titular: AsaasTitularCartao;
      /** IP real do comprador. Nunca o IP do servidor — o Asaas usa em antifraude. */
      ipComprador: string;
    }): Promise<AsaasTokenCartao> {
      const r = await asaasRequest("POST", "/creditCard/tokenizeCreditCard", {
        customer: params.clienteId,
        creditCard: params.cartao,
        creditCardHolderInfo: params.titular,
        remoteIp: params.ipComprador,
      });

      return {
        creditCardNumber: r.creditCardNumber,
        creditCardBrand: r.creditCardBrand,
        creditCardToken: r.creditCardToken,
      };
    },

    /**
     * Cria uma assinatura recorrente. Diferente de gateways que exigem cadastrar
     * planos no painel, aqui valor e ciclo vão direto na chamada.
     *
     * Cartão: em caso de recusa a assinatura NÃO é persistida e a API devolve
     * 400 — ou seja, `criarAssinatura` lançar erro em cartão normalmente
     * significa transação negada, não falha de integração.
     *
     * PIX/BOLETO: a assinatura é criada e a primeira cobrança fica pendente. Use
     * `listarCobrancasDaAssinatura` + `buscarPixQrCode` para exibir o QR Code.
     *
     * Ref: https://docs.asaas.com/reference/criar-nova-assinatura
     */
    async criarAssinatura(params: {
      clienteId: string;
      valor: number;
      /** YYYY-MM-DD — vencimento da PRIMEIRA cobrança. */
      primeiroVencimento: string;
      formaPagamento: AsaasBillingType;
      /** Padrão MONTHLY. */
      ciclo?: AsaasCiclo;
      descricao?: string;
      /** Seu identificador. É por aqui que o webhook volta a apontar pro seu registro. */
      externalReference?: string;
      desconto?: AsaasDesconto;
      split?: AsaasSplit[];
      /** Preferir token a mandar cartão cru. Substitui `cartao` + `titular`. */
      cartaoToken?: string;
      cartao?: AsaasCartao;
      titular?: AsaasTitularCartao;
      /** Obrigatório quando a forma de pagamento é cartão. */
      ipComprador?: string;
      /** Encerra a assinatura após N cobranças. */
      maxPagamentos?: number;
    }): Promise<AsaasAssinatura> {
      const corpo: Record<string, unknown> = {
        customer: params.clienteId,
        billingType: params.formaPagamento,
        value: params.valor,
        nextDueDate: params.primeiroVencimento,
        cycle: params.ciclo ?? "MONTHLY",
        description: params.descricao,
        externalReference: params.externalReference,
        discount: params.desconto,
        maxPayments: params.maxPagamentos,
        split: params.split?.length ? params.split : undefined,
      };

      if (params.formaPagamento === "CREDIT_CARD") {
        if (!params.ipComprador) {
          throw new Error(
            "Asaas: ipComprador é obrigatório em assinatura por cartão (usar o IP do comprador, não o do servidor)."
          );
        }
        if (params.cartaoToken) {
          corpo.creditCardToken = params.cartaoToken;
        } else if (params.cartao && params.titular) {
          corpo.creditCard = params.cartao;
          corpo.creditCardHolderInfo = params.titular;
        } else {
          throw new Error(
            "Asaas: assinatura por cartão exige cartaoToken, ou cartao + titular."
          );
        }
        corpo.remoteIp = params.ipComprador;
      }

      return (await asaasRequest("POST", "/subscriptions", corpo)) as AsaasAssinatura;
    },

    async buscarAssinatura(assinaturaId: string): Promise<AsaasAssinatura> {
      return (await asaasRequest("GET", `/subscriptions/${assinaturaId}`)) as AsaasAssinatura;
    },

    /**
     * Cobranças geradas por uma assinatura. Serve para pegar a primeira cobrança
     * (e daí o QR Code do PIX) logo após criar, e para conferir histórico.
     * Ref: https://docs.asaas.com/reference/listar-cobrancas-de-uma-assinatura
     */
    async listarCobrancasDaAssinatura(
      assinaturaId: string,
      status?: string
    ): Promise<AsaasCobrancaResumo[]> {
      const query = status ? `?status=${encodeURIComponent(status)}` : "";
      const r = await asaasRequest("GET", `/subscriptions/${assinaturaId}/payments${query}`);
      return (r.data ?? []) as AsaasCobrancaResumo[];
    },

    /**
     * Alterações na assinatura. O uso mais comum aqui é encerrar um cupom
     * promocional: o Asaas não tem "desconto pelos N primeiros ciclos", então
     * quem controla a contagem é você — ao atingir o limite, chamar com
     * `desconto: { value: 0, type: "FIXED" }` para zerar.
     *
     * `atualizarPendentes: true` propaga a mudança para cobranças já geradas e
     * ainda não pagas; sem isso a alteração só vale da próxima em diante.
     * Ref: https://docs.asaas.com/reference/atualizar-assinatura-existente
     */
    async atualizarAssinatura(
      assinaturaId: string,
      params: {
        valor?: number;
        formaPagamento?: AsaasBillingType;
        ciclo?: AsaasCiclo;
        proximoVencimento?: string;
        descricao?: string;
        externalReference?: string;
        desconto?: AsaasDesconto;
        status?: "ACTIVE" | "INACTIVE";
        atualizarPendentes?: boolean;
      }
    ): Promise<AsaasAssinatura> {
      const corpo: Record<string, unknown> = {
        value: params.valor,
        billingType: params.formaPagamento,
        cycle: params.ciclo,
        nextDueDate: params.proximoVencimento,
        description: params.descricao,
        externalReference: params.externalReference,
        discount: params.desconto,
        status: params.status,
        updatePendingPayments: params.atualizarPendentes,
      };

      return (await asaasRequest("PUT", `/subscriptions/${assinaturaId}`, corpo)) as AsaasAssinatura;
    },

    /**
     * Remoção é DEFINITIVA: nenhuma cobrança nova é gerada e as pendentes são
     * apagadas (as já pagas ficam no histórico financeiro). Não existe
     * "reativar" — para pausar sem perder a assinatura, use
     * `atualizarAssinatura(id, { status: "INACTIVE" })`.
     * Ref: https://docs.asaas.com/reference/remover-assinatura
     */
    async cancelarAssinatura(assinaturaId: string): Promise<{ deleted: boolean; id: string }> {
      const r = await asaasRequest("DELETE", `/subscriptions/${assinaturaId}`);
      return { deleted: !!r.deleted, id: r.id as string };
    },
  };
}

// Checagem do token de autenticidade do webhook Asaas (header
// `asaas-access-token`) — centralizado aqui porque já foi encontrado um bug
// de segurança real no Morux onde essa checagem estava comentada.
export function verificarWebhookAsaas(
  headerToken: string | null,
  secretConfigurado: string | undefined
): boolean {
  if (!secretConfigurado || !headerToken) return false;
  return comparacaoEmTempoConstante(headerToken, secretConfigurado);
}

/**
 * Comparação que não vaza, pelo tempo de execução, quantos caracteres iniciais
 * bateram — com `===` dá pra descobrir o token byte a byte medindo a resposta.
 *
 * Implementado na mão em vez de `crypto.timingSafeEqual` porque este pacote não
 * importa nada e roda tanto em Node quanto em runtimes de edge.
 *
 * O tamanho da string ainda vaza, o que é aceitável: o token é de configuração
 * e tem tamanho fixo (o Asaas exige 32-255 caracteres).
 */
function comparacaoEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) {
    diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diferenca === 0;
}
