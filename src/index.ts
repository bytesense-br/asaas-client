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

    async criarCobrancaPix(params: {
      clienteId: string;
      valor: number;
      vencimento: string; // YYYY-MM-DD
      descricao: string;
      externalReference?: string;
    }): Promise<AsaasCobranca> {
      const cobranca = await asaasRequest("POST", "/payments", {
        customer: params.clienteId,
        billingType: "PIX",
        value: params.valor,
        dueDate: params.vencimento,
        description: params.descricao,
        externalReference: params.externalReference,
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
