/**
 * Step 4 — Implement AI-recommended changes with before/after diff review + undo.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useNavigate } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Button,
  Box,
  InlineStack,
  Badge,
  Banner,
  Divider,
  Thumbnail,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { fetchProduct } from "../lib/shopify.products";
import { applyProductField } from "../lib/shopify.products";
import type { AnalysisResult } from "../lib/ai.analysis";
import prisma from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const productGid = `gid://shopify/Product/${params.productId}`;

  const [product, analysis] = await Promise.all([
    fetchProduct(admin, productGid),
    prisma.productAnalysis.findUnique({
      where: { shop_productId: { shop: session.shop, productId: productGid } },
    }),
  ]);

  if (!product) throw new Response("Product not found", { status: 404 });

  const result = analysis?.status === "done"
    ? (JSON.parse(analysis.rawAnalysis) as AnalysisResult)
    : null;

  // Load existing change history (applied/undone)
  const history = await prisma.changeHistory.findMany({
    where: { shop: session.shop, productId: productGid },
    orderBy: { appliedAt: "desc" },
  });

  return json({ product, result, history });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const productGid = `gid://shopify/Product/${params.productId}`;
  const formData = await request.formData();

  const intent = formData.get("intent") as string;
  const field = formData.get("field") as string;
  const newValue = formData.get("newValue") as string;
  const oldValue = formData.get("oldValue") as string;

  if (intent === "apply") {
    const applyResult = await applyProductField(admin, productGid, field, newValue);
    if (!applyResult.success) {
      return json({ ok: false, error: applyResult.error }, { status: 400 });
    }
    // Record history for undo
    await prisma.changeHistory.create({
      data: {
        shop: session.shop,
        productId: productGid,
        field,
        beforeValue: oldValue,
        afterValue: newValue,
      },
    });
    return json({ ok: true });
  }

  if (intent === "undo") {
    const historyId = formData.get("historyId") as string;
    const entry = await prisma.changeHistory.findUnique({ where: { id: historyId } });
    if (!entry || entry.undoneAt) return json({ ok: false, error: "Nothing to undo" }, { status: 400 });

    const undoResult = await applyProductField(admin, productGid, entry.field, entry.beforeValue);
    if (!undoResult.success) {
      return json({ ok: false, error: undoResult.error }, { status: 400 });
    }
    await prisma.changeHistory.update({
      where: { id: historyId },
      data: { undoneAt: new Date() },
    });
    return json({ ok: true });
  }

  return json({ ok: false, error: "Unknown intent" }, { status: 400 });
};

// ── Field label helper ─────────────────────────────────────────────────────
function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    title: "Product Title",
    descriptionHtml: "Description",
    seoTitle: "SEO Meta Title",
    seoDescription: "SEO Meta Description",
    tags: "Tags",
  };
  return labels[field] ?? field;
}

// ── Diff card for one recommendation ─────────────────────────────────────
function RecommendationCard({
  rec,
  applied,
  historyId,
}: {
  rec: AnalysisResult["recommendations"][number];
  applied: boolean;
  historyId?: string;
}) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const isLoading = fetcher.state !== "idle";
  const succeeded = fetcher.data?.ok === true;
  const isApplied = applied || succeeded;

  const displayHtml = rec.field === "descriptionHtml";

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingMd" as="h3">{rec.label || fieldLabel(rec.field)}</Text>
          {isApplied ? (
            <Badge tone="success">Applied ✓</Badge>
          ) : (
            <Badge tone="info">Pending</Badge>
          )}
        </InlineStack>

        <Text tone="subdued" variant="bodySm" as="p">{rec.reason}</Text>

        <InlineStack gap="400" align="start" wrap>
          {/* Before */}
          <div style={{ flex: 1, minWidth: "200px", background: "var(--p-color-bg-surface-critical)", borderRadius: "var(--p-border-radius-200)", padding: "var(--p-space-300)" }}>
            <BlockStack gap="100">
              <Text variant="bodySm" tone="critical" fontWeight="semibold" as="span">Before</Text>
              {displayHtml ? (
                <div
                  style={{ fontSize: "13px", opacity: 0.8, lineHeight: "1.5" }}
                  dangerouslySetInnerHTML={{ __html: rec.currentValue || "(empty)" }} // eslint-disable-line react/no-danger
                />
              ) : (
                <Text variant="bodySm" as="p">{rec.currentValue || "(empty)"}</Text>
              )}
            </BlockStack>
          </div>

          {/* After */}
          <div style={{ flex: 1, minWidth: "200px", background: "var(--p-color-bg-surface-success)", borderRadius: "var(--p-border-radius-200)", padding: "var(--p-space-300)" }}>
            <BlockStack gap="100">
              <Text variant="bodySm" tone="success" fontWeight="semibold" as="span">After</Text>
              {displayHtml ? (
                <div
                  style={{ fontSize: "13px", lineHeight: "1.5" }}
                  dangerouslySetInnerHTML={{ __html: rec.suggestedValue }} // eslint-disable-line react/no-danger
                />
              ) : (
                <Text variant="bodySm" as="p">{rec.suggestedValue}</Text>
              )}
            </BlockStack>
          </div>
        </InlineStack>

        {fetcher.data?.ok === false && (
          <Banner tone="critical" title="Failed to apply">
            <p>{fetcher.data.error}</p>
          </Banner>
        )}

        <InlineStack gap="200">
          {!isApplied && (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="apply" />
              <input type="hidden" name="field" value={rec.field} />
              <input type="hidden" name="newValue" value={rec.suggestedValue} />
              <input type="hidden" name="oldValue" value={rec.currentValue} />
              <Button variant="primary" submit loading={isLoading} size="slim">
                Apply Change
              </Button>
            </fetcher.Form>
          )}
          {isApplied && historyId && (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="undo" />
              <input type="hidden" name="historyId" value={historyId} />
              <Button variant="plain" submit loading={isLoading} size="slim" tone="critical">
                Undo
              </Button>
            </fetcher.Form>
          )}
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

export default function ImplementPage() {
  const { product, result, history } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const numericId = product.id.replace("gid://shopify/Product/", "");

  const appliedFields = new Set(
    history
      .filter((h) => !h.undoneAt)
      .map((h) => h.field),
  );

  if (!result) {
    return (
      <Page
        backAction={{ content: "Products", url: "/app" }}
        title="Implement Changes"
      >
        <Banner title="No analysis found" tone="warning">
          <p>Please run an AI analysis first.</p>
          <Button onClick={() => navigate(`/app/analyze/${numericId}`)}>Analyse now</Button>
        </Banner>
      </Page>
    );
  }

  const appliedCount = result.recommendations.filter((r) => appliedFields.has(r.field)).length;
  const totalCount = result.recommendations.length;

  return (
    <Page
      backAction={{ content: "Recommendations", url: `/app/recommendations/${numericId}` }}
      title={`Implement Changes — ${product.title}`}
    >
      <TitleBar title={`Implement — ${product.title}`} />
      <BlockStack gap="500">

        {/* Header */}
        <Layout>
          <Layout.Section>
            <Card>
              <InlineStack gap="400" blockAlign="center">
                <Thumbnail
                  source={product.featuredImage?.url ?? ""}
                  alt={product.title}
                  size="medium"
                />
                <BlockStack gap="150">
                  <Text variant="headingLg" as="h2">{product.title}</Text>
                  <Text tone="subdued" variant="bodySm" as="p">
                    {appliedCount} of {totalCount} changes applied · All changes are reversible via the Undo button.
                  </Text>
                </BlockStack>
              </InlineStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Divider />

        {/* Recommendation cards */}
        {result.recommendations.map((rec, i) => {
          const historyEntry = history.find(
            (h) => h.field === rec.field && !h.undoneAt,
          );
          return (
            <RecommendationCard
              key={i}
              rec={rec}
              applied={appliedFields.has(rec.field)}
              historyId={historyEntry?.id}
            />
          );
        })}

        {/* Done CTA */}
        <Card>
          <InlineStack gap="300">
            <Button variant="primary" url="/app/products">
              Done — Back to all products
            </Button>
            <Button url={`/app/analyze/${numericId}`} variant="plain">
              Re-analyse
            </Button>
          </InlineStack>
        </Card>

      </BlockStack>
    </Page>
  );
}
