import Stripe from "stripe";

/**
 * Creates the "19 Sessions Membership" product and its 12 recurring monthly
 * prices (one per pricing level, 0-11) in Stripe.
 *
 * Idempotent: skips creation if the product already exists, and only creates
 * prices for levels that don't already have an active price.
 *
 * Run with: pnpm --filter @workspace/scripts run seed-pricing-products
 */

const PRODUCT_NAME = "19 Sessions Membership";

// Keep in sync with artifacts/api-server/src/lib/pricingStateMachine.ts
const PRICING_LEVELS_EUR: readonly number[] = [
  139, 130, 121, 112, 103, 94, 86, 77, 68, 59, 50, 41,
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
        "19 Sessions monthly membership. Price depends on the member's current pricing level (0-11), which moves each month based on session completion and reliability score.",
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
      nickname: `Level ${level + 1} (€${priceEur}/mo)`,
    });

    console.log(`Created level ${level} price: €${priceEur}/mo (${price.id})`);
  }

  console.log("Done. Webhooks will sync this data to the stripe.* tables automatically.");
}

main().catch((error) => {
  console.error("Error seeding pricing products:", error.message ?? error);
  process.exit(1);
});
