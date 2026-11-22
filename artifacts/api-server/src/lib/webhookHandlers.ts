import { constructStripeEvent, getStripeSync } from "./stripeClient";
import { activateFromCheckoutSession } from "./contractService";
import { logger } from "./logger";

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. " +
          "Received type: " +
          typeof payload +
          ". " +
          "This usually means express.json() parsed the body before reaching this handler. " +
          "FIX: Ensure webhook route is registered BEFORE app.use(express.json()).",
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
    logger.info("Processed Stripe webhook event");

    // Activate annual contracts as soon as Stripe confirms payment, even if the
    // user never returns to the site.
    const event = await constructStripeEvent(payload, signature);
    if (
      event &&
      (event.type === "checkout.session.completed" ||
        event.type === "checkout.session.async_payment_succeeded")
    ) {
      const contract = await activateFromCheckoutSession(event.data.object);
      if (contract) logger.info({ contractId: contract.id }, "Annual contract activated");
    }
  }
}
