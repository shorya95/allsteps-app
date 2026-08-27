/**
 * Plans & Billing Page — Classic AllSteps Design
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit, useActionData, useNavigation } from "@remix-run/react";
import React, { useState, useCallback, useMemo } from "react";
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  BlockStack,
  InlineGrid,
  InlineStack,
  Box,
  Badge,
  Banner,
  Divider,
  Icon,
  Modal,
  Frame,
  Loading,
} from "@shopify/polaris";
import { CheckIcon, XSmallIcon, ArrowLeftIcon } from "@shopify/polaris-icons";
import { authenticate, PLAN_BASIC, PLAN_PRO } from "../shopify.server";
import { BILLING_PLANS, getPlanById } from "../config/billing";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing, admin } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const isFirstTime = url.searchParams.get("firstTime") === "true";
  const isCancelled = url.searchParams.get("cancelled") === "true";
  const isExpired = url.searchParams.get("expired") === "true";
  const isRequired = url.searchParams.get("required") === "true";

  let subscription = await prisma.subscription.findUnique({
    where: { shop },
  });

  let hasActivePayment = false;
  let shopifySubscriptionData: any = null;

  try {
    const billingCheck = await billing.check();
    hasActivePayment = billingCheck.hasActivePayment;

    if (hasActivePayment && billingCheck.appSubscriptions && billingCheck.appSubscriptions.length > 0) {
      const active = billingCheck.appSubscriptions[0];

      try {
        const response = await admin.graphql(`
          query {
            currentAppInstallation {
              activeSubscriptions {
                id
                name
                status
                test
                createdAt
                currentPeriodEnd
              }
            }
          }
        `);
        const data = await response.json();
        const subs = data?.data?.currentAppInstallation?.activeSubscriptions;
        if (subs && subs.length > 0) {
          shopifySubscriptionData = subs[0];
        }
      } catch (err) {
        console.warn("GraphQL subscription query error:", err);
      }

      // Sync database if not present or inactive
      if (!subscription || subscription.status !== "ACTIVE") {
        let planId = "basic";
        if (active.name.includes("Enterprise") || active.name.includes("pro")) planId = "pro";

        subscription = await prisma.subscription.upsert({
          where: { shop },
          create: {
            shop,
            planId,
            planName: active.name,
            status: "ACTIVE",
            shopifyChargeId: String(active.id),
            shopifyPlan: active.name,
            currentPeriodEnd: shopifySubscriptionData?.currentPeriodEnd ? new Date(shopifySubscriptionData.currentPeriodEnd) : null,
          },
          update: {
            planId,
            planName: active.name,
            status: "ACTIVE",
            shopifyChargeId: String(active.id),
            shopifyPlan: active.name,
            currentPeriodEnd: shopifySubscriptionData?.currentPeriodEnd ? new Date(shopifySubscriptionData.currentPeriodEnd) : null,
          },
        });
      }
    }
  } catch (billingError) {
    console.warn("Billing check error:", billingError);
  }

  const currentPlan = subscription?.status === "ACTIVE" ? subscription.planId : "none";

  return json({
    subscription,
    hasActivePayment,
    shopifySubscriptionData,
    currentPlan,
    plans: Object.values(BILLING_PLANS),
    isFirstTime,
    isRequired,
    isExpired,
    isCancelled,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();

  const planId = formData.get("planId") as string;
  const actionType = formData.get("action") as string;

  // Handle Cancellation
  if (actionType === "cancel") {
    try {
      const billingCheck = await billing.check();
      if (billingCheck.hasActivePayment && billingCheck.appSubscriptions.length > 0) {
        const activeSub = billingCheck.appSubscriptions[0];
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

    return redirect("/app/plans?cancelled=true");
  }

  // Handle Free Bypass Plan
  if (planId === "free") {
    await prisma.subscription.upsert({
      where: { shop },
      create: {
        shop,
        planId: "free",
        planName: "Free (Bypass)",
        status: "ACTIVE",
      },
      update: {
        planId: "free",
        planName: "Free (Bypass)",
        status: "ACTIVE",
      },
    });

    return redirect("/app");
  }

  // Handle Paid Plan (Shopify Billing Request)
  if (planId === "basic" || planId === "pro") {
    const plan = BILLING_PLANS[planId];
    if (!plan) {
      return json({ error: true, message: "Invalid plan selected" }, { status: 400 });
    }

    const shopifyPlanName = planId === "basic" ? PLAN_BASIC : PLAN_PRO;
    const requestUrl = new URL(request.url);
    const returnUrl = `${requestUrl.origin}/app/billing/success?plan=${planId}`;
    const isTestBilling = process.env.SHOPIFY_USE_TEST_CHARGES === "true" || process.env.NODE_ENV !== "production";

    console.log("🚀 Making Shopify Billing Request:", {
      plan: shopifyPlanName,
      isTest: isTestBilling,
      returnUrl,
    });

    return await billing.request({
      plan: shopifyPlanName as any,
      isTest: isTestBilling,
      returnUrl,
    });
  }

  return json({ error: true, message: "No plan selected" }, { status: 400 });
};

export default function PlansPage() {
  const loaderData = useLoaderData<typeof loader>();
  const {
    subscription,
    shopifySubscriptionData,
    currentPlan,
    plans,
    isFirstTime,
    isExpired,
    isCancelled,
    isRequired,
  } = loaderData;

  const navigate = useNavigate();
  const submit = useSubmit();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const [showWelcomeBanner, setShowWelcomeBanner] = useState(true);
  const [showExpiredBanner, setShowExpiredBanner] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const showWelcomeExperience = isFirstTime || isCancelled || currentPlan === "none" || isRequired;

  const planHierarchy: Record<string, number> = {
    free: 0,
    basic: 1,
    pro: 2,
  };

  const getButtonText = (targetPlan: any, isCurrentPlan: boolean) => {
    if (isCurrentPlan) {
      if (subscription?.status === "CANCELLED" || isCancelled) {
        return "Cancelled Plan";
      }
      return "Current Plan";
    }

    if (targetPlan.id === "free") {
      return "Choose Free Plan (Bypass)";
    }

    const currentLevel = planHierarchy[currentPlan] ?? -1;
    const targetLevel = planHierarchy[targetPlan.id] ?? -1;

    if (currentPlan === "none" || currentPlan === null || currentLevel === -1) {
      return `Select ${targetPlan.name}`;
    }

    if (targetLevel > currentLevel) {
      return `Upgrade to ${targetPlan.name}`;
    } else if (targetLevel < currentLevel) {
      return `Downgrade to ${targetPlan.name}`;
    }
    return `Select ${targetPlan.name}`;
  };

  const handleSelectPlan = (planId: string) => {
    if (planId === currentPlan && currentPlan !== "none" && subscription?.status !== "CANCELLED") {
      return;
    }
    const formData = new FormData();
    formData.append("planId", planId);
    submit(formData, { method: "post" });
  };

  const handleConfirmCancel = () => {
    setShowCancelModal(false);
    const formData = new FormData();
    formData.append("action", "cancel");
    submit(formData, { method: "post" });
  };

  const pageTitle = isRequired
    ? "Select Your Plan"
    : showWelcomeExperience
    ? "Welcome to AllSteps!"
    : isExpired
    ? "Plan Expired - Renew Now"
    : "Plans & Billing";

  const pageSubtitle = isRequired
    ? "Please select a plan to continue using AllSteps"
    : showWelcomeExperience
    ? "Choose your plan to start optimizing your store"
    : isExpired
    ? "Your subscription has expired. Renew to continue using AllSteps."
    : "Choose the perfect plan for your store";

  const showBackButton = !showWelcomeExperience && !isExpired && !isRequired;
  const isSubmitting = navigation.state === "submitting";

  return (
    <Frame>
      {isSubmitting && <Loading />}
      <Page>
        <Box paddingBlockStart="400" paddingBlockEnd="800">
          <BlockStack gap="600">
            {/* Header with Title and Back button */}
            <Box paddingBlockEnd="400">
              <InlineStack gap="400" blockAlign="center">
                {showBackButton && (
                  <Button
                    icon={ArrowLeftIcon}
                    onClick={() => navigate("/app")}
                    accessibilityLabel="Back to dashboard"
                  />
                )}
                <div>
                  <Text as="h1" variant="headingLg" fontWeight="semibold">
                    {pageTitle}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {pageSubtitle}
                  </Text>
                </div>
              </InlineStack>
            </Box>

            <BlockStack gap="600">
              {/* Welcome & First Time User Banner */}
              {showWelcomeExperience && showWelcomeBanner && (
                <Banner
                  title={isCancelled ? "🎉 Ready to optimize again?" : "🎉 Welcome to AllSteps!"}
                  tone="success"
                  onDismiss={() => setShowWelcomeBanner(false)}
                >
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd">
                      {isCancelled
                        ? "Your subscription has been cancelled. Select a plan below to continue optimizing your store and generating CRO/AEO improvements."
                        : "Your store optimization journey starts here! AllSteps uses Gemini AI to scan your Shopify store and rank your products by revenue."}
                    </Text>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      Ready to turn your store into a conversion machine? Choose your plan below! 👇
                    </Text>
                  </BlockStack>
                </Banner>
              )}

              {/* Expired Plan Banner */}
              {isExpired && showExpiredBanner && (
                <Banner
                  title="⚠️ Your plan has expired"
                  tone="warning"
                  onDismiss={() => setShowExpiredBanner(false)}
                >
                  <Text as="p" variant="bodyMd">
                    Your subscription has expired. Renew your subscription below to restore full access.
                  </Text>
                </Banner>
              )}

              {/* Active Subscription Management Card */}
              {!showWelcomeExperience && currentPlan !== "none" && subscription && (
                <BlockStack gap="400">
                  <Text variant="headingLg" as="h2">
                    Subscription Management
                  </Text>

                  <Card>
                    <BlockStack gap="500">
                      <Box>
                        <BlockStack gap="400">
                          <Text variant="headingMd" as="h3">Current Subscription</Text>
                          <InlineStack gap="200" blockAlign="center">
                            {subscription?.status === "CANCELLED" || isCancelled ? (
                              <Badge tone="critical">
                                {`${BILLING_PLANS[currentPlan]?.name || currentPlan} (Cancelled)`}
                              </Badge>
                            ) : (
                              <Badge tone="success">
                                {`${BILLING_PLANS[currentPlan]?.name || currentPlan}`}
                              </Badge>
                            )}
                            {(() => {
                              const price = BILLING_PLANS[currentPlan]?.price || 0;
                              return price > 0 ? (
                                <Text variant="bodyMd" tone="subdued" as="span">
                                  ${price}/month
                                </Text>
                              ) : (
                                <Text variant="bodyMd" tone="subdued" as="span">
                                  Free (Bypass Mode)
                                </Text>
                              );
                            })()}
                          </InlineStack>

                          {/* Subscription Dates */}
                          <InlineGrid columns={{ xs: 1, md: 2 }} gap="500">
                            <Box>
                              <BlockStack gap="100">
                                <Text variant="bodyMd" fontWeight="semibold" as="p">
                                  Started On
                                </Text>
                                <Text variant="bodyLg" as="p">
                                  {shopifySubscriptionData?.createdAt
                                    ? new Date(shopifySubscriptionData.createdAt).toLocaleDateString()
                                    : subscription?.createdAt
                                    ? new Date(subscription.createdAt).toLocaleDateString()
                                    : "Today"}
                                </Text>
                              </BlockStack>
                            </Box>

                            <Box>
                              <BlockStack gap="100">
                                <Text variant="bodyMd" fontWeight="semibold" as="p">
                                  Next Billing Date
                                </Text>
                                <Text variant="bodyLg" as="p">
                                  {shopifySubscriptionData?.currentPeriodEnd
                                    ? new Date(shopifySubscriptionData.currentPeriodEnd).toLocaleDateString()
                                    : subscription?.currentPeriodEnd
                                    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                                    : "Recurring every 30 days"}
                                </Text>
                              </BlockStack>
                            </Box>
                          </InlineGrid>
                        </BlockStack>
                      </Box>

                      <Divider />

                      {/* Cancel Subscription Action */}
                      {subscription?.status !== "CANCELLED" && !isCancelled && (
                        <Box>
                          <BlockStack gap="300">
                            <Box width="fit-content">
                              <Button
                                variant="secondary"
                                onClick={() => setShowCancelModal(true)}
                              >
                                Cancel Subscription
                              </Button>
                            </Box>
                            <Text variant="bodySm" tone="subdued" as="p">
                              Cancel your subscription — access continues until your billing period ends.
                            </Text>
                          </BlockStack>
                        </Box>
                      )}
                    </BlockStack>
                  </Card>
                </BlockStack>
              )}

              {/* What You'll Get Section */}
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingLg" as="h2" alignment="center">
                    🚀 What You Get With AllSteps
                  </Text>

                  <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
                    <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                      <BlockStack gap="200" align="center">
                        <Text variant="headingMd" as="h3">🔍 AI Store & Product Audit</Text>
                        <Text variant="bodyMd" alignment="center" tone="subdued" as="p">
                          Our AI scans your entire store, prioritizing products by sales velocity and conversion lift potential.
                        </Text>
                      </BlockStack>
                    </Box>

                    <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                      <BlockStack gap="200" align="center">
                        <Text variant="headingMd" as="h3">⚡ Gemini 2.0 Recommendations</Text>
                        <Text variant="bodyMd" alignment="center" tone="subdued" as="p">
                          Get persuasive titles, structured descriptions, benefit bullet points, and AI search (AEO) readiness tags.
                        </Text>
                      </BlockStack>
                    </Box>

                    <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                      <BlockStack gap="200" align="center">
                        <Text variant="headingMd" as="h3">📈 1-Click Apply & Revert</Text>
                        <Text variant="bodyMd" alignment="center" tone="subdued" as="p">
                          Push improvements directly to your live Shopify product pages in 1 click, with full before/after history and instant undo.
                        </Text>
                      </BlockStack>
                    </Box>
                  </InlineGrid>
                </BlockStack>
              </Card>

              {/* Plans Grid */}
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">
                  Available Plans
                </Text>

                <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
                  {plans.map((plan) => {
                    const isCurrentPlan = plan.id === currentPlan && currentPlan !== "none" && subscription?.status !== "CANCELLED";

                    return (
                      <Card key={plan.id}>
                        <BlockStack gap="400">
                          <Box padding="400">
                            <BlockStack gap="500">
                              {/* Header */}
                              <BlockStack gap="200">
                                <InlineStack gap="200" blockAlign="center" align="space-between">
                                  <Text variant="headingLg" as="h3">
                                    {plan.name}
                                  </Text>
                                  {plan.popular && <Badge tone="success">Popular</Badge>}
                                  {plan.id === "free" && <Badge tone="info">Free Bypass</Badge>}
                                  {isCurrentPlan && <Badge tone="success">Active</Badge>}
                                </InlineStack>

                                {(() => {
                                  const descriptionLines = plan.description.split("\n");
                                  const targetAudience = descriptionLines[0];
                                  const mainDescription = descriptionLines.slice(1).join("\n");
                                  const [beforeWho, whoSection] = mainDescription.split("**Who is it for:**");

                                  return (
                                    <BlockStack gap="200">
                                      <div style={{ color: "#1B46CB", fontWeight: 600, fontSize: "14px", lineHeight: "1.4" }}>
                                        {targetAudience}
                                      </div>
                                      <Text variant="bodyMd" tone="subdued" as="p">
                                        {beforeWho?.trim()}
                                      </Text>
                                      {whoSection && (
                                        <BlockStack gap="050">
                                          <Text variant="bodySm" fontWeight="bold" tone="subdued" as="span">
                                            Who is it for:
                                          </Text>
                                          <Text variant="bodySm" tone="subdued" as="span">
                                            {whoSection.trim()}
                                          </Text>
                                        </BlockStack>
                                      )}
                                    </BlockStack>
                                  );
                                })()}
                              </BlockStack>

                              {/* Pricing */}
                              <BlockStack gap="100">
                                <Text variant="bodySm" tone="subdued" as="span">
                                  Starting at
                                </Text>
                                <InlineStack gap="100" blockAlign="baseline">
                                  <Text variant="heading2xl" as="p" fontWeight="bold">
                                    ${plan.price}
                                  </Text>
                                  <Text variant="bodyLg" tone="subdued" as="span">
                                    /month
                                  </Text>
                                </InlineStack>
                              </BlockStack>

                              {/* Features */}
                              <BlockStack gap="300">
                                <Text variant="headingMd" as="h4">
                                  Features included
                                </Text>
                                <BlockStack gap="150">
                                  <InlineStack gap="200" blockAlign="center">
                                    <Box minWidth="20px">
                                      <Icon source={CheckIcon} tone="success" />
                                    </Box>
                                    <Text variant="bodyMd" as="span">
                                      Full AI Store Audit & Sales Ranking
                                    </Text>
                                  </InlineStack>

                                  <InlineStack gap="200" blockAlign="center">
                                    <Box minWidth="20px">
                                      <Icon source={CheckIcon} tone="success" />
                                    </Box>
                                    <Text variant="bodyMd" as="span">
                                      Gemini 2.0 AI CRO & AEO Analyzer
                                    </Text>
                                  </InlineStack>

                                  <InlineStack gap="200" blockAlign="center">
                                    <Box minWidth="20px">
                                      <Icon source={CheckIcon} tone="success" />
                                    </Box>
                                    <Text variant="bodyMd" as="span">
                                      1-Click Apply & Reversible Undo
                                    </Text>
                                  </InlineStack>

                                  <InlineStack gap="200" blockAlign="center">
                                    <Box minWidth="20px">
                                      {plan.features.prioritySupport ? (
                                        <Icon source={CheckIcon} tone="success" />
                                      ) : (
                                        <Icon source={XSmallIcon} tone="subdued" />
                                      )}
                                    </Box>
                                    <Text variant="bodyMd" tone={plan.features.prioritySupport ? undefined : "subdued"} as="span">
                                      Priority Support
                                    </Text>
                                  </InlineStack>

                                  <InlineStack gap="200" blockAlign="center">
                                    <Box minWidth="20px">
                                      {plan.features.humanAudit ? (
                                        <Icon source={CheckIcon} tone="success" />
                                      ) : (
                                        <Icon source={XSmallIcon} tone="subdued" />
                                      )}
                                    </Box>
                                    <Text variant="bodyMd" tone={plan.features.humanAudit ? undefined : "subdued"} as="span">
                                      Expert Human Audit
                                    </Text>
                                  </InlineStack>
                                </BlockStack>
                              </BlockStack>

                              {/* Action Button */}
                              <BlockStack gap="200">
                                <Button
                                  fullWidth
                                  variant="primary"
                                  onClick={() => handleSelectPlan(plan.id)}
                                  disabled={isCurrentPlan || isSubmitting}
                                  size="large"
                                >
                                  {getButtonText(plan, isCurrentPlan)}
                                </Button>

                                {plan.price > 0 && !isCurrentPlan && (
                                  <Text variant="bodySm" alignment="center" tone="subdued" as="p">
                                    Billed monthly via Shopify
                                  </Text>
                                )}
                              </BlockStack>
                            </BlockStack>
                          </Box>
                        </BlockStack>
                      </Card>
                    );
                  })}
                </InlineGrid>
              </BlockStack>

              {/* FAQ Section */}
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">
                  Frequently Asked Questions
                </Text>

                <Card>
                  <BlockStack gap="400">
                    <BlockStack gap="100">
                      <Text variant="headingMd" as="h3">
                        What happens after I choose a plan?
                      </Text>
                      <Text variant="bodyMd" tone="subdued" as="p">
                        You&apos;ll be directed to your dashboard where you can immediately run an AI scan across your products, view revenue-ranked items, and start applying CRO & AEO optimizations.
                      </Text>
                    </BlockStack>

                    <Divider />

                    <BlockStack gap="100">
                      <Text variant="headingMd" as="h3">
                        Can I cancel or switch plans anytime?
                      </Text>
                      <Text variant="bodyMd" tone="subdued" as="p">
                        Yes, you can upgrade, downgrade, or cancel anytime from this page. If you cancel, your access continues until the end of your current 30-day billing cycle.
                      </Text>
                    </BlockStack>

                    <Divider />

                    <BlockStack gap="100">
                      <Text variant="headingMd" as="h3">
                        How does the Free Plan work?
                      </Text>
                      <Text variant="bodyMd" tone="subdued" as="p">
                        The Free Plan provides full testing and development access to scan your store and optimize products without entering credit card info.
                      </Text>
                    </BlockStack>
                  </BlockStack>
                </Card>
              </BlockStack>
            </BlockStack>
          </BlockStack>
        </Box>

        {/* Cancellation Confirmation Modal */}
        <Modal
          open={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          title="Cancel Subscription?"
          primaryAction={{
            content: "Yes, Cancel Subscription",
            destructive: true,
            onAction: handleConfirmCancel,
          }}
          secondaryActions={[
            {
              content: "Keep Subscription",
              onAction: () => setShowCancelModal(false),
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
      </Page>
    </Frame>
  );
}
