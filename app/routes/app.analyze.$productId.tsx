/**
 * Step 2 — Trigger AI analysis for a product, then redirect to recommendations.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect, json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Button,
  Thumbnail,
  Badge,
  Box,
  InlineStack,
  Banner,
  ProgressBar,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { fetchProduct } from "../lib/shopify.products";
import { analyseProduct } from "../lib/ai.analysis";
import prisma from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const productGid = `gid://shopify/Product/${params.productId}`;

  const product = await fetchProduct(admin, productGid);
  if (!product) throw new Response("Product not found", { status: 404 });

  const existing = await prisma.productAnalysis.findUnique({
    where: { shop_productId: { shop: session.shop, productId: productGid } },
  });

  return json({ product, existing });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const productGid = `gid://shopify/Product/${params.productId}`;

  const product = await fetchProduct(admin, productGid);
  if (!product) throw new Response("Product not found", { status: 404 });

  // Upsert pending record so UI can show "in progress" state
  await prisma.productAnalysis.upsert({
    where: { shop_productId: { shop: session.shop, productId: productGid } },
    create: {
      shop: session.shop,
      productId: productGid,
      productTitle: product.title,
      status: "pending",
      rawAnalysis: "{}",
    },
    update: { status: "pending", rawAnalysis: "{}" },
  });

  try {
    const result = await analyseProduct({
      title: product.title,
      descriptionHtml: product.descriptionHtml,
      seoTitle: product.seo.title,
      seoDescription: product.seo.description,
      tags: product.tags,
      vendor: product.vendor,
      productType: product.productType,
      price: product.variants[0]?.price ?? "0",
      unitsSold: product.unitsSold,
      revenue: product.revenue,
      currencyCode: product.currencyCode,
    });

    await prisma.productAnalysis.update({
      where: { shop_productId: { shop: session.shop, productId: productGid } },
      data: {
        status: "done",
        scoreOverall: result.scoreOverall,
        scoreCRO: result.scoreCRO,
        scoreAEO: result.scoreAEO,
        rawAnalysis: JSON.stringify(result),
        analysedAt: new Date(),
      },
    });
  } catch (err) {
    await prisma.productAnalysis.update({
      where: { shop_productId: { shop: session.shop, productId: productGid } },
      data: { status: "error", rawAnalysis: JSON.stringify({ error: String(err) }) },
    });
    return json({ error: String(err) }, { status: 500 });
  }

  return redirect(`/app/recommendations/${params.productId}`);
};

export default function AnalyzePage() {
  const { product, existing } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isAnalysing = navigation.state === "submitting";

  const numericId = product.id.replace("gid://shopify/Product/", "");

  return (
    <Page
      backAction={{ content: "Products", url: "/app" }}
      title="Analyse Product"
    >
      <TitleBar title={`Analyse — ${product.title}`} />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="400" blockAlign="center">
                <Thumbnail
                  source={
                    product.featuredImage?.url ??
                    "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png"
                  }
                  alt={product.title}
                  size="large"
                />
                <BlockStack gap="200">
                  <Text variant="headingLg" as="h2">{product.title}</Text>
                  <InlineStack gap="200">
                    <Badge tone={product.status === "ACTIVE" ? "success" : "info"}>
                      {product.status}
                    </Badge>
                    {product.vendor ? <Text as="span" tone="subdued" variant="bodySm">{product.vendor}</Text> : null}
                  </InlineStack>
                  {existing?.status === "done" && (
                    <Text as="p" variant="bodySm" tone="subdued">
                      Last analysed: {new Date(existing.analysedAt ?? "").toLocaleString()}
                    </Text>
                  )}
                </BlockStack>
              </InlineStack>

              {isAnalysing ? (
                <BlockStack gap="300">
                  <Banner title="Analysing your product…" tone="info">
                    <p>Gemini AI is reviewing the title, description, SEO, and tags. This usually takes 10–20 seconds.</p>
                  </Banner>
                  <ProgressBar progress={undefined} size="small" />
                </BlockStack>
              ) : existing?.status === "error" ? (
                <Banner title="Previous analysis failed" tone="critical">
                  <p>There was an error during the last analysis. Click below to try again.</p>
                </Banner>
              ) : existing?.status === "done" ? (
                <Banner title="Analysis ready!" tone="success">
                  <p>This product has already been analysed. You can re-analyse or view the existing report.</p>
                </Banner>
              ) : null}

              {/* What we analyse */}
              <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h3">What Gemini will analyse</Text>
                  <Text as="p" variant="bodyMd">
                    🏷️ <strong>Title</strong> — keyword clarity, length, benefit framing<br />
                    📝 <strong>Description</strong> — persuasion, completeness, trust signals<br />
                    🔍 <strong>SEO</strong> — meta title (max 60 chars), meta description (max 160 chars)<br />
                    🤖 <strong>AEO</strong> — AI-engine optimized content structure, featured snippet readiness<br />
                    🏷️ <strong>Tags</strong> — missing keywords and discoverability gaps
                  </Text>
                </BlockStack>
              </Box>

              <InlineStack gap="300">
                <Button
                  variant="primary"
                  loading={isAnalysing}
                  onClick={() => submit({}, { method: "POST" })}
                >
                  {existing?.status === "done" ? "Re-analyse with Gemini" : "Analyse with Gemini AI"}
                </Button>
                {existing?.status === "done" && (
                  <Button url={`/app/recommendations/${numericId}`}>
                    View Existing Report
                  </Button>
                )}
                <Button variant="plain" url="/app/products">
                  Cancel
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
