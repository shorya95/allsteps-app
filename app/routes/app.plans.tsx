/**
 * Plans & Pricing Page with Free Bypass Plan Support
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
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
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { CheckIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const subscription = await prisma.subscription.findUnique({
    where: { shop },
  });

  return json({
    shop,
    currentPlanId: subscription?.status === "ACTIVE" ? subscription.planId : null,
    currentPlanName: subscription?.status === "ACTIVE" ? subscription.planName : null,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();

  const intent = formData.get("intent") as string;
  const planId = formData.get("planId") as string;
  const planName = formData.get("planName") as string;

  if (intent === "select_plan" && planId && planName) {
    await prisma.subscription.upsert({
      where: { shop },
      create: {
        shop,
        planId,
        planName,
        status: "ACTIVE",
      },
      update: {
        planId,
        planName,
        status: "ACTIVE",
      },
    });

    return redirect("/app");
  }

  if (intent === "clear_plan") {
    await prisma.subscription.deleteMany({
      where: { shop },
    });
    return json({ success: true });
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
    buttonText: "Choose Starter",
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
    buttonText: "Choose Growth",
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
    buttonText: "Choose Pro",
    buttonVariant: "secondary",
  },
];

export default function PlansPage() {
  const { currentPlanId, currentPlanName } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";

  return (
    <Page
      backAction={{ content: "Dashboard", url: "/app" }}
      title="Plans & Pricing"
    >
      <TitleBar title="Plans & Pricing" />
      <BlockStack gap="600">
        {/* Status Banner */}
        {currentPlanId ? (
          <Banner title={`Active Plan: ${currentPlanName || currentPlanId.toUpperCase()}`} tone="success">
            <p>
              Your store has an active plan. You can scan your store, analyze top-selling products, and apply optimizations.
            </p>
          </Banner>
        ) : (
          <Banner title="Choose a plan to get started" tone="warning">
            <p>
              No plan is currently selected. Choose our <strong>Free Plan</strong> to bypass and get started immediately, or pick a plan below.
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
            const isCurrent = plan.id === currentPlanId;
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
                        {isCurrent ? "Current Plan (Active)" : plan.buttonText}
                      </Button>
                    </fetcher.Form>
                  </Box>
                </BlockStack>
              </Card>
            );
          })}
        </div>

        {/* Reset Plan button for testing */}
        {currentPlanId && (
          <Box paddingBlockStart="200">
            <InlineStack align="end">
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="clear_plan" />
                <Button variant="plain" tone="critical" submit loading={isSubmitting}>
                  Reset / Clear Active Plan (Test Mode)
                </Button>
              </fetcher.Form>
            </InlineStack>
          </Box>
        )}

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
                      What does the Free Plan include?
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      The Free Plan allows you to immediately bypass any gating, scan your store, analyze products using Gemini AI, and apply 1-click optimizations.
                    </Text>
                  </BlockStack>

                  <BlockStack gap="100">
                    <Text variant="bodyMd" fontWeight="semibold" as="p">
                      Can I undo changes made by the AI optimizer?
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      Yes! Every recommendation applied to your store is logged in our database with the exact &quot;before&quot; state. You can click Undo at any time to restore your original content.
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
