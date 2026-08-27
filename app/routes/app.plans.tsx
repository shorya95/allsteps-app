/**
 * Plans & Pricing Page
 */
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
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
  List,
  Icon,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { CheckIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  return json({
    shop,
    currentPlanId: "growth", // default active plan
  });
};

interface PlanTier {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  popular?: boolean;
  features: string[];
  buttonText: string;
  buttonVariant: "primary" | "secondary" | "plain";
}

const PLANS: PlanTier[] = [
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
    buttonText: "Current Plan",
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
  const { currentPlanId } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<string>(currentPlanId);

  return (
    <Page
      backAction={{ content: "Dashboard", url: "/app" }}
      title="Plans & Pricing"
    >
      <TitleBar title="Plans & Pricing" />
      <BlockStack gap="600">
        {/* Banner */}
        <Banner title="AllSteps AI Optimization Plans" tone="info">
          <p>
            Choose the plan that fits your catalog size and velocity. All plans include full Gemini AI analysis and reversible 1-click changes.
          </p>
        </Banner>

        {/* Pricing Cards Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "20px",
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
                    {plan.popular && <Badge tone="success">Most Popular</Badge>}
                    {isCurrent && !plan.popular && <Badge tone="info">Active</Badge>}
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
                    <Button
                      fullWidth
                      variant={isCurrent ? "primary" : plan.buttonVariant}
                      disabled={isCurrent}
                      onClick={() => setSelectedPlan(plan.id)}
                    >
                      {isCurrent ? "Current Plan (Active)" : plan.buttonText}
                    </Button>
                  </Box>
                </BlockStack>
              </Card>
            );
          })}
        </div>

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
                      Can I undo changes made by the AI optimizer?
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      Yes! Every recommendation applied to your store is logged in our database with the exact &quot;before&quot; state. You can click Undo at any time to restore your original content.
                    </Text>
                  </BlockStack>

                  <BlockStack gap="100">
                    <Text variant="bodyMd" fontWeight="semibold" as="p">
                      How does AllSteps calculate product sales ranking?
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      We query your Shopify store&apos;s paid order line items via the GraphQL Admin API, calculating total units sold and gross revenue per product so you focus on top performers first.
                    </Text>
                  </BlockStack>

                  <BlockStack gap="100">
                    <Text variant="bodyMd" fontWeight="semibold" as="p">
                      How do I switch or cancel plans?
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      You can upgrade, downgrade, or cancel at any time directly through the Shopify App subscription portal without any lock-in contracts.
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
