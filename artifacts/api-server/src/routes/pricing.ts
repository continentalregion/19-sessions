import { Router, type IRouter } from "express";
import { and, eq, gte, lt } from "drizzle-orm";
import {
  db,
  pricingStateTable,
  subscriptionsTable,
  workoutSessionsTable,
  type InsertPricingState,
} from "@workspace/db";
import {
  GetPricingStateResponse,
  CreatePricingCheckoutBody,
  CreatePricingCheckoutResponse,
  CreatePricingPortalSessionBody,
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
    avgReliabilityScoreMonth: null,
    subscriptionStartedAt: new Date(),
    cycleMonthCounter: 0,
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

router.get("/pricing/state/:userId", async (req, res): Promise<void> => {
  const raw = req.params["userId"];
  const userId = Array.isArray(raw) ? raw[0] : raw;
  if (!userId) {
    res.status(400).json({ error: "userId is required" });
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
      cycleMonthCounter: state.cycleMonthCounter,
      subscriptionStartedAt: state.subscriptionStartedAt
        ? state.subscriptionStartedAt.toISOString()
        : null,
      lastMonthCompleted: state.lastMonthCompleted,
      avgReliabilityScoreMonth: state.avgReliabilityScoreMonth,
      subscriptionStatus: subscription?.status ?? null,
    }),
  );
});

router.post("/pricing/checkout", async (req, res): Promise<void> => {
  const parsed = CreatePricingCheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid checkout body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { userId, email } = parsed.data;

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

router.post("/pricing/portal", async (req, res): Promise<void> => {
  const parsed = CreatePricingPortalSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [subscription] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, parsed.data.userId));

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

  let advancedCount = 0;
  let doubleAdvancedCount = 0;
  let regressedCount = 0;
  let resetCount = 0;
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
    const avgReliabilityScoreMonth =
      sessions.length > 0
        ? sessions.reduce((sum, s) => sum + s.reliabilityScore, 0) / sessions.length
        : null;

    const result = evaluateMonth({
      currentLevel: state.currentLevel,
      cycleMonthCounter: state.cycleMonthCounter,
      sessionsCompletedMonth,
      avgReliabilityScoreMonth,
    });

    if (result.transition === "advanced_double") doubleAdvancedCount++;
    else if (result.transition === "advanced_single") advancedCount++;
    else if (result.transition === "regressed") regressedCount++;
    if (result.cycleReset) resetCount++;
    if (result.nextLevel === state.currentLevel && !result.cycleReset) unchangedCount++;

    await db
      .update(pricingStateTable)
      .set({
        currentLevel: result.nextLevel,
        cycleMonthCounter: result.nextCycleMonthCounter,
        lastMonthCompleted: sessionsCompletedMonth >= 19,
        avgReliabilityScoreMonth,
        ...(result.cycleReset ? { subscriptionStartedAt: new Date() } : {}),
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
      advancedCount,
      doubleAdvancedCount,
      regressedCount,
      resetCount,
      unchangedCount,
    }),
  );
});

export default router;
