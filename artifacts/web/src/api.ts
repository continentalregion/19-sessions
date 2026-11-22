export type Offer = {
  feeCents: number;
  commissionCents: number;
  poolCents: number;
  installmentCents: number[];
  requiredSessionsPerMonth: number;
  minMinutesPerSession: number;
  termsVersion: string;
};

export type LedgerRow = {
  installmentIndex: number;
  amountCents: number;
  validSessions: number;
  outcome: "payable" | "paid_out" | "forfeited";
};

export type ContractStatus = {
  contract: {
    id: number;
    status: "pending_payment" | "active" | "completed" | "canceled";
    feeCents: number;
    commissionCents: number;
    poolCents: number;
    startAt: string | null;
  };
  installmentCents: number[];
  ledger: LedgerRow[];
  totals: { earnedCents: number; forfeitedCents: number };
  currentMonth: {
    installmentIndex: number;
    start: string;
    end: string;
    validSessions: number;
    strengthSessions: number;
    requiredSessions: number;
    minStrengthSessions: number;
    installmentCents: number;
  } | null;
};

export type TokenGetter = () => Promise<string | null>;

async function call<T>(
  path: string,
  getToken: TokenGetter | null,
  init: { method?: string; body?: unknown } = {},
): Promise<{ status: number; data: T | null }> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (getToken) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`/api${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = res.headers.get("content-type")?.includes("application/json")
    ? ((await res.json()) as T)
    : null;
  return { status: res.status, data };
}

export const getOffer = () => call<Offer>("/contract/offer", null);
export const getStatus = (t: TokenGetter) => call<ContractStatus>("/contract/status", t);
export const startCheckout = (t: TokenGetter) =>
  call<{ url: string }>("/contract/checkout", t, { method: "POST", body: { acceptTerms: true } });
export const confirmCheckout = (t: TokenGetter, sessionId: string) =>
  call<{ status: string }>("/contract/confirm", t, { method: "POST", body: { sessionId } });

export const eur = (cents: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
