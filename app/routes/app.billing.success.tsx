/**
 * Shopify Billing Confirmation / Success Route
 */
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Banner,
  Box,
  Badge,
  Divider,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { CheckIcon } from "@shopify/polaris-icons";
import { authenticate, PLAN_STARTER, PLAN_GROWTH, PLAN_PRO } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const url = new URL(request.url);
  const planParam = url.searchParams.get("plan");

  // Verify active billing with Shopify API
  let activeCharge: any = null;
  try {
    const { hasActivePayment, appSubscriptions } = await billing.check();

    if (hasActivePayment && appSubscriptions && appSubscriptions.length > 0) {
      activeCharge = appSubscriptions[0];

      // Query GraphQL for full period end date
      let periodEnd: Date | null = null;
      try {
        const response = await admin.graphql(`
          query {
            currentAppInstallation {
              activeSubscriptions {
                id
                name
                status
                test
                currentPeriodEnd
              }
            }
          }
        `);
        const jsonRes = await response.json();
        const subs = jsonRes?.data?.currentAppInstallation?.activeSubscriptions;
        if (subs && subs.length > 0 && subs[0].currentPeriodEnd) {
          periodEnd = new Date(subs[0].currentPeriodEnd);
        }
      } catch {
        // Fallback default 30 days
        periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }

      // Map plan name to planId
      let planId = planParam || "growth";
      if (activeCharge.name.includes("Starter")) planId = "starter";
      else if (activeCharge.name.includes("Growth")) planId = "growth";
      else if (activeCharge.name.includes("Pro")) planId = "pro";

      // Persist active subscription in database
      await prisma.subscription.upsert({
        where: { shop },
        create: {
          shop,
          planId,
          planName: activeCharge.name,
          status: "ACTIVE",
          shopifyChargeId: String(activeCharge.id),
          shopifyPlan: activeCharge.name,
          currentPeriodEnd: periodEnd,
        },
        update: {
          planId,
          planName: activeCharge.name,
          status: "ACTIVE",
          shopifyChargeId: String(activeCharge.id),
          shopifyPlan: activeCharge.name,
          currentPeriodEnd: periodEnd,
        },
      });
    }
  } catch (err) {
    console.error("Billing check error on success route:", err);
  }

  const subscription = await prisma.subscription.findUnique({
    where: { shop },
  });

  return json({
    shop,
    planName: subscription?.planName || activeCharge?.name || "Growth Plan",
    planId: subscription?.planId || "growth",
    status: subscription?.status || "ACTIVE",
    shopifyChargeId: subscription?.shopifyChargeId || activeCharge?.id || null,
  });
};

export default function BillingSuccessPage() {
  const { planName, shopifyChargeId } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <Page>
      <TitleBar title="Subscription Activated" />
      <BlockStack gap="500">
        <Banner title="Subscription Successfully Activated!" tone="success">
          <p>
            Thank you for subscribing to <strong>{planName}</strong>. Your account is now fully active with unlimited AI audits and store scans.
          </p>
        </Banner>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingLg" as="h2">Plan Details</Text>
                  <Badge tone="success">Active</Badge>
                </InlineStack>

                <Divider />

                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text variant="bodyMd" tone="subdued" as="span">Plan</Text>
                    <Text variant="bodyMd" fontWeight="semibold" as="span">{planName}</Text>
                  </InlineStack>

                  <InlineStack align="space-between">
                    <Text variant="bodyMd" tone="subdued" as="span">Billing Cycle</Text>
                    <Text variant="bodyMd" as="span">Every 30 Days (Recurring)</Text>
                  </InlineStack>

                  {shopifyChargeId && (
                    <InlineStack align="space-between">
                      <Text variant="bodyMd" tone="subdued" as="span">Shopify Charge ID</Text>
                      <Text variant="bodySm" tone="subdued" as="span">{shopifyChargeId}</Text>
                    </InlineStack>
                  )}
                </BlockStack>

                <Box paddingBlockStart="300">
                  <InlineStack gap="300">
                    <Button variant="primary" size="large" onClick={() => navigate("/app")}>
                      Go to Dashboard & Scan Store
                    </Button>
                    <Button size="large" onClick={() => navigate("/app/products")}>
                      View Products Optimizer
                    </Button>
                  </InlineStack>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
