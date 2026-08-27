/**
 * Plans & Pricing Page with Live Shopify Billing API + Free Plan Bypass
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  BlockStack,
  InlineStack,
  Box,
  Badge,
  Banner,
  Divider,
  Icon,
  Modal,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { CheckIcon, AlertTriangleIcon } from "@shopify/polaris-icons";
import {
  authenticate,
  PLAN_STARTER,
  PLAN_GROWTH,
  PLAN_PRO,
} from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing, admin } = await authenticate.admin(request);
  const shop = session.shop;

  let subscription = await prisma.subscription.findUnique({
    where: { shop },
  });

  // Verify live Shopify billing status
  let shopifyActiveSub: any = null;
  try {
    const { hasActivePayment, appSubscriptions } = await billing.check();
    if (hasActivePayment && appSubscriptions && appSubscriptions.length > 0) {
      shopifyActiveSub = appSubscriptions[0];

      // Sync with database if needed
      if (!subscription || subscription.status !== "ACTIVE") {
        let planId = "growth";
        if (shopifyActiveSub.name.includes("Starter")) planId = "starter";
        else if (shopifyActiveSub.name.includes("Pro")) planId = "pro";

        subscription = await prisma.subscription.upsert({
          where: { shop },
          create: {
            shop,
            planId,
            planName: shopifyActiveSub.name,
            status: "ACTIVE",
            shopifyChargeId: String(shopifyActiveSub.id),
            shopifyPlan: shopifyActiveSub.name,
          },
          update: {
            planId,
            planName: shopifyActiveSub.name,
            status: "ACTIVE",
            shopifyChargeId: String(shopifyActiveSub.id),
            shopifyPlan: shopifyActiveSub.name,
          },
        });
      }
    }
  } catch (err) {
    console.warn("Could not check Shopify billing:", err);
  }

  return json({
    shop,
    currentPlanId: subscription?.status === "ACTIVE" ? subscription.planId : null,
    currentPlanName: subscription?.status === "ACTIVE" ? subscription.planName : null,
    shopifyChargeId: subscription?.shopifyChargeId || shopifyActiveSub?.id || null,
    currentPeriodEnd: subscription?.currentPeriodEnd || null,
    status: subscription?.status || "NO_PLAN",
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();

  const intent = formData.get("intent") as string;
  const planId = formData.get("planId") as string;
  const planName = formData.get("planName") as string;

  // 1. Free Plan Selection (Bypass Shopify Billing)
  if (intent === "select_plan" && planId === "free") {
    await prisma.subscription.upsert({
      where: { shop },
      create: {
        shop,
        planId: "free",
        planName: "Free Plan (Bypass)",
        status: "ACTIVE",
      },
      update: {
        planId: "free",
        planName: "Free Plan (Bypass)",
        status: "ACTIVE",
      },
    });

    return redirect("/app");
  }

  // 2. Paid Plan Selection (Redirect to Shopify Billing Approval Screen)
  if (intent === "select_plan" && (planId === "starter" || planId === "growth" || planId === "pro")) {
    let shopifyPlanName = PLAN_GROWTH;
    if (planId === "starter") shopifyPlanName = PLAN_STARTER;
    if (planId === "pro") shopifyPlanName = PLAN_PRO;

    const requestUrl = new URL(request.url);
    const returnUrl = `${requestUrl.origin}/app/billing/success?plan=${planId}`;

    const isTestBilling = process.env.SHOPIFY_USE_TEST_CHARGES === "true" || process.env.NODE_ENV !== "production";

    console.log("🚀 Redirecting to Shopify Billing Request:", {
      shopifyPlanName,
      isTestBilling,
      returnUrl,
    });

    return await billing.request({
      plan: shopifyPlanName as any,
      isTest: isTestBilling,
      returnUrl,
    });
  }

  // 3. Cancel Subscription
  if (intent === "cancel_plan") {
    try {
      const { hasActivePayment, appSubscriptions } = await billing.check();
      if (hasActivePayment && appSubscriptions && appSubscriptions.length > 0) {
        const activeSub = appSubscriptions[0];
        await billing.cancel({
          subscriptionId: activeSub.id,
          isTest: process.env.NODE_ENV !== "production",
          prorate: true,
        });
      }
    } catch (err) {
      console.warn("Could not cancel on Shopify API:", err);
    }

    await prisma.subscription.updateMany({
      where: { shop },
      data: { status: "CANCELLED" },
    });

    return redirect("/app/plans");
  }

  return json({ error: "Invalid intent" }, { status: 400 });
};

interface PlanTier {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  popular?: boolean;
  isFree?: boolean;
  features: string[];
  buttonText: string;
  buttonVariant: "primary" | "secondary" | "plain";
}

const PLANS: PlanTier[] = [
  {
    id: "free",
    name: "Free Plan",
    price: "$0",
    period: "forever",
    isFree: true,
    description: "Free access to bypass and unlock all store audits, scans & CRO/AEO optimizations.",
    features: [
      "Instant Store Scan & Health Score",
      "Full Product Sales Ranking",
      "Gemini 2.0 Flash AI Analyses",
      "1-Click Apply & Reversible Undo",
      "No Credit Card Required (Bypass)",
    ],
    buttonText: "Choose Free Plan",
    buttonVariant: "primary",
  },
  {
    id: "starter",
    name: "Starter",
    price: "$19",
    period: "/ month",
    description: "Essential CRO & AEO analysis for new stores getting initial traction.",
    features: [
      "Up to 25 Product AI Analyses / month",
      "Sales Velocity Ranking",
      "Google Gemini 2.0 AI Engine",
      "Basic Title & SEO Meta Suggestions",
      "1-Click Apply & Revert",
      "Standard Email Support",
    ],
    buttonText: "Upgrade to Starter",
    buttonVariant: "secondary",
  },
  {
    id: "growth",
    name: "Growth",
    price: "$49",
    period: "/ month",
    popular: true,
    description: "Comprehensive optimization toolkit for growing multi-product brands.",
    features: [
      "Unlimited Product AI Analyses",
      "Full CRO & AEO Multi-point Audit",
      "Deep Description & Hook Rewriting",
      "Schema Markup & Featured Snippet Hints",
      "Instant 1-Click Changes with Full Undo History",
      "Store Screenshot & Speed Insights",
      "Priority Merchant Support",
    ],
    buttonText: "Upgrade to Growth",
    buttonVariant: "primary",
  },
  {
    id: "pro",
    name: "Pro & Scale",
    price: "$99",
    period: "/ month",
    description: "Advanced optimization & automated recommendations for top-volume merchants.",
    features: [
      "Everything in Growth",
      "Automated Weekly Catalog Rescans",
      "Competitor Value Proposition Analysis",
      "Batch Multi-Product 1-Click Apply",
      "A/B Testing Integration & Tracking",
      "Dedicated CRO Specialist Review",
    ],
    buttonText: "Upgrade to Pro",
    buttonVariant: "secondary",
  },
];

export default function PlansPage() {
  const { currentPlanId, currentPlanName, shopifyChargeId, currentPeriodEnd, status } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";

  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const formattedPeriodEnd = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <Page
      backAction={{ content: "Dashboard", url: "/app" }}
      title="Plans & Pricing"
    >
      <TitleBar title="Plans & Pricing" />
      <BlockStack gap="600">
        {/* Active Plan Management Card */}
        {currentPlanId && status === "ACTIVE" ? (
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="headingMd" as="h2">Current Subscription</Text>
                    <Badge tone="success">Active</Badge>
                  </InlineStack>
                  <Text variant="bodySm" tone="subdued" as="p">
                    {`You are currently subscribed to the ${currentPlanName || currentPlanId.toUpperCase()}`}
                    {formattedPeriodEnd ? ` · Renews on ${formattedPeriodEnd}` : ""}
                  </Text>
                </BlockStack>

                <Button
                  variant="plain"
                  tone="critical"
                  onClick={() => setCancelModalOpen(true)}
                >
                  Cancel Subscription
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        ) : (
          <Banner title="Choose a plan to get started" tone="warning">
            <p>
              No active subscription found. Select the <strong>Free Plan</strong> to bypass and test for free, or choose a plan below to activate real Shopify billing.
            </p>
          </Banner>
        )}

        {/* Pricing Cards Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "16px",
          }}
        >
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlanId && status === "ACTIVE";
            return (
              <Card key={plan.id}>
                <BlockStack gap="400">
                  {/* Header */}
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="headingLg" as="h3">{plan.name}</Text>
                    {plan.popular && <Badge tone="success">Popular</Badge>}
                    {plan.isFree && <Badge tone="info">Free Bypass</Badge>}
                    {isCurrent && <Badge tone="success">Active</Badge>}
                  </InlineStack>

                  {/* Price */}
                  <BlockStack gap="100">
                    <InlineStack gap="100" blockAlign="baseline">
                      <Text variant="heading2xl" as="span">{plan.price}</Text>
                      <Text variant="bodySm" tone="subdued" as="span">{plan.period}</Text>
                    </InlineStack>
                    <Text variant="bodySm" tone="subdued" as="p">{plan.description}</Text>
                  </BlockStack>

                  <Divider />

                  {/* Features */}
                  <BlockStack gap="200">
                    <Text variant="bodySm" fontWeight="semibold" as="span">Included Features:</Text>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {plan.features.map((feat, idx) => (
                        <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                          <div style={{ color: "#2C6ECB", flexShrink: 0, marginTop: "2px" }}>
                            <Icon source={CheckIcon} tone="info" />
                          </div>
                          <Text variant="bodySm" as="span">{feat}</Text>
                        </div>
                      ))}
                    </div>
                  </BlockStack>

                  <Box paddingBlockStart="200">
                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="select_plan" />
                      <input type="hidden" name="planId" value={plan.id} />
                      <input type="hidden" name="planName" value={plan.name} />
                      <Button
                        fullWidth
                        variant={isCurrent ? "secondary" : plan.buttonVariant}
                        disabled={isCurrent || isSubmitting}
                        submit
                        loading={isSubmitting && fetcher.formData?.get("planId") === plan.id}
                      >
                        {isCurrent ? "Active Plan" : plan.buttonText}
                      </Button>
                    </fetcher.Form>
                  </Box>
                </BlockStack>
              </Card>
            );
          })}
        </div>

        {/* Cancellation Confirmation Modal */}
        <Modal
          open={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          title="Cancel Subscription?"
          primaryAction={{
            content: "Yes, Cancel Subscription",
            destructive: true,
            onAction: () => {
              const form = new FormData();
              form.append("intent", "cancel_plan");
              fetcher.submit(form, { method: "post" });
              setCancelModalOpen(false);
            },
          }}
          secondaryActions={[
            {
              content: "Keep Subscription",
              onAction: () => setCancelModalOpen(false),
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <Text as="p">
                Are you sure you want to cancel your subscription? You will lose access to automated catalog scans and new AI product optimizations.
              </Text>
              <Text as="p" tone="subdued">
                You can reactivate or choose another plan at any time.
              </Text>
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* FAQ Section */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h3">Frequently Asked Questions</Text>
                <Divider />
                <BlockStack gap="300">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" fontWeight="semibold" as="p">
                      How does Shopify Billing work?
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      Paid plans are charged directly via Shopify&apos;s native 30-day recurring app subscription. All charges appear on your regular Shopify invoice.
                    </Text>
                  </BlockStack>

                  <BlockStack gap="100">
                    <Text variant="bodyMd" fontWeight="semibold" as="p">
                      What is the Free Plan?
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      The Free Plan allows you to immediately bypass any gating, scan your store, analyze products using Gemini AI, and apply 1-click optimizations without entering credit card details.
                    </Text>
                  </BlockStack>

                  <BlockStack gap="100">
                    <Text variant="bodyMd" fontWeight="semibold" as="p">
                      Can I cancel anytime?
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      Yes! You can cancel your subscription at any time with one click from this page or through the Shopify App Store settings.
                    </Text>
                  </BlockStack>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
