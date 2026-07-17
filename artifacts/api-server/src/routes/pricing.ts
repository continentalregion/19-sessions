import { Router, type IRouter, type RequestHandler } from "express";
import { and, eq, gte, lt } from "drizzle-orm";
import { getAuth, clerkClient } from "@clerk/express";
import {
  db,
  pricingStateTable,
  subscriptionsTable,
  workoutSessionsTable,
  type InsertPricingState,
} from "@workspace/db";
import {
  GetPricingStateResponse,
  CreatePricingCheckoutResponse,
  CreatePricingPortalSessionResponse,
  RunPricingCycleResponse,
} from "@workspace/api-zod";
import { getUncachableStripeClient } from "../lib/stripeClient";
import {
  displayLevel,
  evaluateMonth,
  previousCalendarMonthRange,
  priceForLevel,
} from "../lib/pricingStateMachine";

const router: IRouter = Router();

/**
 * All /pricing/* endpoints below (except the cron-only cycle-all) derive
 * userId exclusively from the verified Clerk session via getAuth(req) --
 * never from req.body/req.params/req.query. This is a deliberate security
 * boundary: a client-supplied userId would let anyone read/modify/cancel
 * another user's subscription (IDOR).
 *
 * Deliberately NOT using @clerk/express's requireAuth() middleware here: in
 * dev instances it performs a browser "handshake" redirect (302) on
 * missing/invalid tokens instead of a plain 401, which breaks API/mobile
 * clients that expect JSON. Checking getAuth(req) manually keeps these
 * endpoints pure JSON API routes.
 */
const requireAuth: RequestHandler = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
};

async function getOrCreatePricingState(userId: string) {
  const [existing] = await db
    .select()
    .from(pricingStateTable)
    .where(eq(pricingStateTable.userId, userId));

  if (existing) {
    return existing;
  }

  const defaults: InsertPricingState = {
    userId,
    currentLevel: 0,
    lastMonthCompleted: false,
    subscriptionStartedAt: new Date(),
  };

  const [created] = await db
    .insert(pricingStateTable)
    .values(defaults)
    .onConflictDoNothing({ target: pricingStateTable.userId })
    .returning();

  if (created) {
    return created;
  }

  // Lost a create race — someone else inserted first; read it back.
  const [row] = await db
    .select()
    .from(pricingStateTable)
    .where(eq(pricingStateTable.userId, userId));

  return row!;
}

router.get("/pricing/state", requireAuth, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const state = await getOrCreatePricingState(userId);

  const [subscription] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));

  res.json(
    GetPricingStateResponse.parse({
      userId: state.userId,
      currentLevel: state.currentLevel,
      displayLevel: displayLevel(state.currentLevel),
      priceEur: priceForLevel(state.currentLevel),
      subscriptionStartedAt: state.subscriptionStartedAt
        ? state.subscriptionStartedAt.toISOString()
        : null,
      lastMonthCompleted: state.lastMonthCompleted,
      subscriptionStatus: subscription?.status ?? null,
    }),
  );
});

router.post("/pricing/checkout", requireAuth, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const clerkUser = await clerkClient.users.getUser(userId);
  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) {
    req.log.error({ userId }, "Clerk user has no email address");
    res.status(400).json({ error: "Account has no email address on file" });
    return;
  }

  const state = await getOrCreatePricingState(userId);
  const stripe = await getUncachableStripeClient();

  let [subscription] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));

  let customerId = subscription?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { userId },
    });
    customerId = customer.id;
  }

  const price = await stripe.prices.search({
    query: `metadata['level']:'${state.currentLevel}' AND active:'true'`,
  });
  const priceId = price.data[0]?.id;
  if (!priceId) {
    req.log.error(
      { level: state.currentLevel },
      "No Stripe price found for pricing level — run the seed-pricing-products script",
    );
    res.status(400).json({
      error:
        "Pricing products are not set up yet. Run scripts/seed-pricing-products before checkout.",
    });
    return;
  }

  const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0];
  const baseUrl = domain ? `https://${domain}` : `http://localhost:${process.env["PORT"]}`;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/api/pricing/checkout-success?userId=${encodeURIComponent(userId)}`,
    cancel_url: `${baseUrl}/api/pricing/checkout-cancel`,
    subscription_data: { metadata: { userId } },
    metadata: { userId },
  });

  await db
    .insert(subscriptionsTable)
    .values({
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: (session.subscription as string) ?? "",
      status: "incomplete",
    })
    .onConflictDoUpdate({
      target: subscriptionsTable.userId,
      set: { stripeCustomerId: customerId },
    });

  res.json(CreatePricingCheckoutResponse.parse({ url: session.url ?? "" }));
});

router.post("/pricing/portal", requireAuth, async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [subscription] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));

  if (!subscription) {
    res.status(404).json({ error: "No Stripe customer for this user" });
    return;
  }

  const stripe = await getUncachableStripeClient();
  const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0];
  const baseUrl = domain ? `https://${domain}` : `http://localhost:${process.env["PORT"]}`;

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${baseUrl}/api/pricing/portal-return`,
  });

  res.json(CreatePricingPortalSessionResponse.parse({ url: session.url }));
});

router.post("/pricing/cycle-all", async (req, res): Promise<void> => {
  const cronSecret = process.env["CRON_SECRET"];
  const provided = req.headers["x-cron-secret"];
  if (!cronSecret || provided !== cronSecret) {
    res.status(401).json({ error: "Missing or invalid cron secret" });
    return;
  }

  const { start, end } = previousCalendarMonthRange(new Date());

  const states = await db.select().from(pricingStateTable);

  let improvedCount = 0;
  let regressedCount = 0;
  let unchangedCount = 0;

  const stripe = await getUncachableStripeClient();

  for (const state of states) {
    const sessions = await db
      .select()
      .from(workoutSessionsTable)
      .where(
        and(
          eq(workoutSessionsTable.userId, state.userId),
          eq(workoutSessionsTable.isValid, true),
          gte(workoutSessionsTable.createdAt, start),
          lt(workoutSessionsTable.createdAt, end),
        ),
      );

    const sessionsCompletedMonth = sessions.length;

    const result = evaluateMonth({ sessionsCompletedMonth });

    if (result.nextLevel < state.currentLevel) improvedCount++;
    else if (result.nextLevel > state.currentLevel) regressedCount++;
    else unchangedCount++;

    await db
      .update(pricingStateTable)
      .set({
        currentLevel: result.nextLevel,
        lastMonthCompleted: sessionsCompletedMonth >= 19,
      })
      .where(eq(pricingStateTable.userId, state.userId));

    if (result.nextLevel !== state.currentLevel) {
      const [subscription] = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.userId, state.userId));

      if (subscription?.stripeSubscriptionId && subscription.status === "active") {
        const newPrice = await stripe.prices.search({
          query: `metadata['level']:'${result.nextLevel}' AND active:'true'`,
        });
        const newPriceId = newPrice.data[0]?.id;
        if (newPriceId) {
          const sub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
          const itemId = sub.items.data[0]?.id;
          if (itemId) {
            await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
              items: [{ id: itemId, price: newPriceId }],
              proration_behavior: "none",
            });
          }
        } else {
          req.log.warn(
            { level: result.nextLevel },
            "No Stripe price found for new pricing level during cycle run",
          );
        }
      }
    }
  }

  res.json(
    RunPricingCycleResponse.parse({
      processedCount: states.length,
      improvedCount,
      regressedCount,
      unchangedCount,
    }),
  );
});

export default router;
