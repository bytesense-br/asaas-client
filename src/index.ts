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
  };
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
  };
}

// Checagem do token de autenticidade do webhook Asaas (header
// `asaas-access-token`) — centralizado aqui porque já foi encontrado um bug
// de segurança real no Morux onde essa checagem estava comentada.
export function verificarWebhookAsaas(
  headerToken: string | null,
  secretConfigurado: string | undefined
): boolean {
  return !!secretConfigurado && headerToken === secretConfigurado;
}
