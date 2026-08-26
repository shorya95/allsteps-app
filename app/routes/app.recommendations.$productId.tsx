/**
 * Step 3 — Display AI recommendations with scores and before/after suggestions.
 */
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Badge,
  Button,
  Box,
  InlineStack,
  ProgressBar,
  Divider,
  List,
  Banner,
  Thumbnail,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { fetchProduct } from "../lib/shopify.products";
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
  if (!analysis || analysis.status !== "done") {
    return json({ product, analysis: null, result: null });
  }

  const result = JSON.parse(analysis.rawAnalysis) as AnalysisResult;
  return json({ product, analysis, result });
};

// ── Helpers ────────────────────────────────────────────────────────────────

type ProgressTone = "success" | "critical";

function scoreTone(score: number): ProgressTone {
  return score >= 50 ? "success" : "critical";
}

type BadgeTone = "success" | "attention" | "critical";

function badgeTone(score: number): BadgeTone {
  if (score >= 70) return "success";
  if (score >= 40) return "attention";
  return "critical";
}

type PriorityTone = "critical" | "attention" | "info";

function priorityTone(p: string): PriorityTone {
  if (p === "high") return "critical";
  if (p === "medium") return "attention";
  return "info";
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <BlockStack gap="100">
      <InlineStack align="space-between">
        <Text as="span" variant="bodySm">{label}</Text>
        <Text as="span" variant="bodySm" fontWeight="semibold">{`${score}/100`}</Text>
      </InlineStack>
      <ProgressBar progress={score} tone={scoreTone(score)} size="small" />
    </BlockStack>
  );
}

export default function RecommendationsPage() {
  const { product, result } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const numericId = product.id.replace("gid://shopify/Product/", "");

  if (!result) {
    return (
      <Page
        backAction={{ content: "Products", url: "/app" }}
        title="Recommendations"
      >
        <Banner title="No analysis found" tone="warning">
          <p>This product hasn&apos;t been analysed yet.</p>
          <Button onClick={() => navigate(`/app/analyze/${numericId}`)}>Analyse now</Button>
        </Banner>
      </Page>
    );
  }

  return (
    <Page
      backAction={{ content: "Products", url: "/app" }}
      title={`Recommendations — ${product.title}`}
      primaryAction={{
        content: "Implement Changes",
        onAction: () => navigate(`/app/implement/${numericId}`),
      }}
      secondaryActions={[
        {
          content: "Re-analyse",
          onAction: () => navigate(`/app/analyze/${numericId}`),
        },
      ]}
    >
      <TitleBar title={`Recommendations — ${product.title}`} />
      <BlockStack gap="600">

        {/* ── Score Card ──────────────────────────────────────────────────── */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <InlineStack gap="300" blockAlign="center">
                  <Thumbnail
                    source={product.featuredImage?.url ?? ""}
                    alt={product.title}
                    size="medium"
                  />
                  <BlockStack gap="100">
                    <Text variant="headingMd" as="h2">{product.title}</Text>
                    <Badge tone={badgeTone(result.scoreOverall)}>
                      {`Score: ${result.scoreOverall}/100`}
                    </Badge>
                  </BlockStack>
                </InlineStack>
                <Divider />
                <BlockStack gap="300">
                  <ScoreBar label="Overall" score={result.scoreOverall} />
                  <ScoreBar label="CRO (Conversion)" score={result.scoreCRO} />
                  <ScoreBar label="AEO (AI Engine)" score={result.scoreAEO} />
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* ── Quick Wins ─────────────────────────────────────────────────── */}
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">⚡ Quick Wins</Text>
                <Text tone="subdued" variant="bodySm" as="p">
                  Prioritised actions ranked by expected impact.
                </Text>
                <BlockStack gap="200">
                  {result.quickWins.map((w, i) => (
                    <Box
                      key={i}
                      padding="300"
                      background="bg-surface-secondary"
                      borderRadius="200"
                    >
                      <InlineStack gap="200" blockAlign="start">
                        <Badge tone={priorityTone(w.priority)}>
                          {w.priority.toUpperCase()}
                        </Badge>
                        <BlockStack gap="050">
                          <Text variant="bodySm" fontWeight="semibold" as="span">{w.action}</Text>
                          <Text variant="bodySm" tone="subdued" as="span">{w.impact}</Text>
                        </BlockStack>
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* ── Title Analysis ─────────────────────────────────────────────── */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h2">🏷️ Title</Text>
                  <Badge tone={badgeTone(result.titleAnalysis.score)}>
                    {`${result.titleAnalysis.score}/100`}
                  </Badge>
                </InlineStack>
                {result.titleAnalysis.issues.length > 0 && (
                  <List type="bullet">
                    {result.titleAnalysis.issues.map((issue, i) => (
                      <List.Item key={i}>{issue}</List.Item>
                    ))}
                  </List>
                )}
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="100">
                    <Text variant="bodySm" tone="subdued" as="span">Suggested title:</Text>
                    <Text variant="bodyMd" fontWeight="semibold" as="p">
                      {result.titleAnalysis.suggestion}
                    </Text>
                  </BlockStack>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* ── SEO ─────────────────────────────────────────────────────────── */}
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h2">🔍 SEO</Text>
                  <Badge tone={badgeTone(result.seoAnalysis.score)}>
                    {`${result.seoAnalysis.score}/100`}
                  </Badge>
                </InlineStack>
                {result.seoAnalysis.issues.length > 0 && (
                  <List type="bullet">
                    {result.seoAnalysis.issues.map((issue, i) => (
                      <List.Item key={i}>{issue}</List.Item>
                    ))}
                  </List>
                )}
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="200">
                    <BlockStack gap="050">
                      <Text variant="bodySm" tone="subdued" as="span">Meta Title:</Text>
                      <Text variant="bodySm" fontWeight="semibold" as="p">
                        {result.seoAnalysis.titleSuggestion}
                      </Text>
                    </BlockStack>
                    <BlockStack gap="050">
                      <Text variant="bodySm" tone="subdued" as="span">Meta Description:</Text>
                      <Text variant="bodySm" as="p">
                        {result.seoAnalysis.descriptionSuggestion}
                      </Text>
                    </BlockStack>
                  </BlockStack>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* ── Description ─────────────────────────────────────────────────── */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h2">📝 Description</Text>
                  <Badge tone={badgeTone(result.descriptionAnalysis.score)}>
                    {`${result.descriptionAnalysis.score}/100`}
                  </Badge>
                </InlineStack>
                {result.descriptionAnalysis.issues.length > 0 && (
                  <List type="bullet">
                    {result.descriptionAnalysis.issues.map((issue, i) => (
                      <List.Item key={i}>{issue}</List.Item>
                    ))}
                  </List>
                )}
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="100">
                    <Text variant="bodySm" tone="subdued" as="span">Suggested description:</Text>
                    <div
                      style={{ fontSize: "14px", lineHeight: "1.6" }}
                      dangerouslySetInnerHTML={{ __html: result.descriptionAnalysis.suggestion }} // eslint-disable-line react/no-danger
                    />
                  </BlockStack>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* ── AEO + Tags ──────────────────────────────────────────────────── */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <Text variant="headingMd" as="h2">🤖 AEO</Text>
                    <Badge tone={badgeTone(result.aeoAnalysis.score)}>
                      {`${result.aeoAnalysis.score}/100`}
                    </Badge>
                  </InlineStack>
                  {result.aeoAnalysis.suggestions.length > 0 && (
                    <List type="bullet">
                      {result.aeoAnalysis.suggestions.map((s, i) => (
                        <List.Item key={i}>{s}</List.Item>
                      ))}
                    </List>
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <Text variant="headingMd" as="h2">🏷️ Tags</Text>
                    <Badge tone={badgeTone(result.tagsAnalysis.score)}>
                      {`${result.tagsAnalysis.score}/100`}
                    </Badge>
                  </InlineStack>
                  {result.tagsAnalysis.missingKeywords.length > 0 && (
                    <BlockStack gap="100">
                      <Text variant="bodySm" tone="subdued" as="span">Missing keywords:</Text>
                      <InlineStack gap="100" wrap>
                        {result.tagsAnalysis.missingKeywords.map((kw, i) => (
                          <Badge key={i}>{kw}</Badge>
                        ))}
                      </InlineStack>
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>

        {/* ── CTA ─────────────────────────────────────────────────────────── */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">Ready to apply these changes?</Text>
                <Text tone="subdued" as="p" variant="bodyMd">
                  Step 4 lets you review every change side-by-side (before vs. after) and apply them with one click. All changes are reversible.
                </Text>
                <InlineStack gap="300">
                  <Button variant="primary" onClick={() => navigate(`/app/implement/${numericId}`)}>
                    Go to Step 4 — Implement Changes
                  </Button>
                  <Button variant="plain" url="/app">
                    Back to products
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

      </BlockStack>
    </Page>
  );
}
