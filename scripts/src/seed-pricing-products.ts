import Stripe from "stripe";

/**
 * Creates the "19 Sessions BOSU Membership" product and its 11 recurring
 * monthly prices (one per pricing level, 0-10) in Stripe.
 *
 * Price table — based on previous month's valid session count:
 *   Level 0: €250/mo  — sessions ≤ 8
 *   Level 1: €139/mo  — sessions = 9
 *   Level 2:  €79/mo  — sessions = 10
 *   Level 3:  €47/mo  — sessions = 11
 *   Level 4:  €30/mo  — sessions = 12
 *   Level 5:  €21/mo  — sessions = 13
 *   Level 6:  €16/mo  — sessions = 14
 *   Level 7:  €13/mo  — sessions = 15
 *   Level 8:  €12/mo  — sessions = 16
 *   Level 9:  €11/mo  — sessions = 17
 *   Level 10: €10/mo  — sessions ≥ 18
 *
 * Idempotent: skips creation if the product already exists, and only creates
 * prices for levels that don't already have an active price.
 *
 * Run with: pnpm --filter @workspace/scripts run seed-pricing-products
 */

const PRODUCT_NAME = "19 Sessions BOSU Membership";

// Keep in sync with artifacts/api-server/src/lib/pricingStateMachine.ts
const PRICING_LEVELS_EUR: readonly number[] = [
  250, 139, 79, 47, 30, 21, 16, 13, 12, 11, 10,
];

async function getStripeCredentials(): Promise<string> {
  const hostname = process.env["REPLIT_CONNECTORS_HOSTNAME"];
  const xReplitToken = process.env["REPL_IDENTITY"]
    ? "repl " + process.env["REPL_IDENTITY"]
    : process.env["WEB_REPL_RENEWAL"]
      ? "depl " + process.env["WEB_REPL_RENEWAL"]
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "Missing Replit environment variables. Ensure the Stripe integration is connected.",
    );
  }

  const resp = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!resp.ok) {
    throw new Error(`Failed to fetch Stripe credentials: ${resp.status} ${resp.statusText}`);
  }

  const data = (await resp.json()) as {
    items?: { settings?: { secret?: string } }[];
  };
  const secretKey = data.items?.[0]?.settings?.secret;
  if (!secretKey) {
    throw new Error("Stripe integration not connected or missing secret key.");
  }
  return secretKey;
}

async function main(): Promise<void> {
  const secretKey = await getStripeCredentials();
  const stripe = new Stripe(secretKey);

  console.log(`Ensuring product "${PRODUCT_NAME}" exists...`);

  const existingProducts = await stripe.products.search({
    query: `name:'${PRODUCT_NAME}' AND active:'true'`,
  });

  const product =
    existingProducts.data[0] ??
    (await stripe.products.create({
      name: PRODUCT_NAME,
      description:
        "19 Sessions BOSU monthly membership. Price is recalculated each month based on valid session count: level 0 (≤8 sessions) = €250/mo down to level 10 (≥18 sessions) = €10/mo.",
    }));

  console.log(`Product ready: ${product.name} (${product.id})`);

  for (let level = 0; level < PRICING_LEVELS_EUR.length; level++) {
    const priceEur = PRICING_LEVELS_EUR[level];
    const existing = await stripe.prices.search({
      query: `product:'${product.id}' AND metadata['level']:'${level}' AND active:'true'`,
    });

    if (existing.data.length > 0) {
      console.log(`Level ${level} price already exists (${existing.data[0]?.id}) — skipping.`);
      continue;
    }

    const price = await stripe.prices.create({
      product: product.id,
      currency: "eur",
      unit_amount: (priceEur as number) * 100,
      recurring: { interval: "month" },
      metadata: { level: String(level) },
      nickname: `Level ${level} (€${priceEur}/mo, sessions ${level === 0 ? "≤8" : level === 10 ? "≥18" : String(level + 8)})`,
    });

    console.log(`Created level ${level} price: €${priceEur}/mo (${price.id})`);
  }

  console.log("Done. Webhooks will sync this data to the stripe.* tables automatically.");
}

main().catch((error) => {
  console.error("Error seeding pricing products:", error.message ?? error);
  process.exit(1);
});
