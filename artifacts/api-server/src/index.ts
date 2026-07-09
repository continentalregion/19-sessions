import { runMigrations } from "stripe-replit-sync";
import app from "./app";
import { logger } from "./lib/logger";
import { getStripeSync } from "./lib/stripeClient";

async function initStripe(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error("DATABASE_URL required");
  }

  await runMigrations({ databaseUrl });

  const stripeSync = await getStripeSync();

  const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0];
  if (domain) {
    await stripeSync.findOrCreateManagedWebhook(`https://${domain}/api/stripe/webhook`);
  } else {
    logger.warn("REPLIT_DOMAINS not set — skipping managed webhook setup");
  }

  await stripeSync.syncBackfill();
  logger.info("Stripe sync initialized");
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

initStripe()
  .catch((err) => {
    logger.error({ err }, "Stripe initialization failed");
  })
  .finally(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
    });
  });
