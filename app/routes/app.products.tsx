/**
 * Step 1 — Products sorted by units sold + revenue (Product CRO & AEO Optimizer)
 */
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Text,
  Badge,
  Button,
  Thumbnail,
  BlockStack,
  InlineStack,
  Box,
  Banner,
  EmptyState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { fetchProductsWithSales, type ProductWithSales } from "../lib/shopify.products";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const products = await fetchProductsWithSales(admin);

  // Load cached analysis statuses for badge display
  const analyses = await prisma.productAnalysis.findMany({
    where: { shop },
    select: { productId: true, status: true, scoreOverall: true },
  });
  const analysisMap = Object.fromEntries(
    analyses.map((a) => [a.productId, { status: a.status, score: a.scoreOverall }]),
  );

  return json({ products, analysisMap });
};

function scoreBadge(score: number) {
  const label = `${score}/100`;
  if (score >= 80) return <Badge tone="success">{label}</Badge>;
  if (score >= 50) return <Badge tone="attention">{label}</Badge>;
  return <Badge tone="critical">{label}</Badge>;
}

function formatCurrency(amount: number, code: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(amount);
}

export default function ProductsPage() {
  const { products, analysisMap } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  if (products.length === 0) {
    return (
      <Page
        backAction={{ content: "Dashboard", url: "/app" }}
        title="Products — CRO & AEO Optimizer"
      >
        <TitleBar title="Products — CRO & AEO Optimizer" />
        <EmptyState
          heading="No products found"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>Add products to your store to start optimizing them.</p>
        </EmptyState>
      </Page>
    );
  }

  const rows = products.map((p: ProductWithSales) => {
    const analysis = analysisMap[p.id];
    const numericId = p.id.replace("gid://shopify/Product/", "");

    return [
      // Thumbnail + title
      <InlineStack gap="300" blockAlign="center" key={p.id}>
        <Thumbnail
          source={p.featuredImage?.url ?? "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png"}
          alt={p.featuredImage?.altText ?? p.title}
          size="small"
        />
        <BlockStack gap="050">
          <Text variant="bodyMd" fontWeight="semibold" as="span">{p.title}</Text>
          <Text variant="bodySm" tone="subdued" as="span">{p.vendor || p.productType || p.handle}</Text>
        </BlockStack>
      </InlineStack>,

      // Status
      <Badge
        key="status"
        tone={p.status === "ACTIVE" ? "success" : p.status === "DRAFT" ? "info" : "attention"}
      >
        {p.status}
      </Badge>,

      // Units sold
      <Text key="units" variant="bodyMd" as="span" fontWeight="semibold">
        {p.unitsSold.toLocaleString()}
      </Text>,

      // Revenue
      <Text key="revenue" variant="bodyMd" as="span">
        {p.unitsSold > 0 ? formatCurrency(p.revenue, p.currencyCode) : "—"}
      </Text>,

      // AI Score
      analysis?.status === "done"
        ? scoreBadge(analysis.score)
        : analysis?.status === "pending"
          ? <Badge key="score" tone="info">Analysing…</Badge>
          : <Text key="score" tone="subdued" variant="bodySm" as="span">Not analysed</Text>,

      // Action
      <Button
        key="action"
        variant={analysis?.status === "done" ? "secondary" : "primary"}
        size="slim"
        onClick={() => navigate(`/app/analyze/${numericId}`)}
      >
        {analysis?.status === "done" ? "View Report" : "Analyse"}
      </Button>,
    ];
  });

  const totalProducts = products.length;
  const analysedCount = Object.values(analysisMap).filter((a) => a.status === "done").length;
  const totalRevenue = products.reduce((s: number, p: ProductWithSales) => s + p.revenue, 0);
  const currency = products[0]?.currencyCode ?? "USD";

  return (
    <Page
      backAction={{ content: "Dashboard", url: "/app" }}
      title="AllSteps Super — CRO & AEO Optimizer"
    >
      <TitleBar title="AllSteps Super — CRO & AEO Optimizer" />
      <BlockStack gap="500">
        {/* Summary banner */}
        <Layout>
          <Layout.Section>
            <Banner title="Your product performance at a glance" tone="info">
              <p>
                <strong>{totalProducts}</strong> products found ·{" "}
                <strong>{analysedCount}</strong> analysed ·{" "}
                Total revenue: <strong>{formatCurrency(totalRevenue, currency)}</strong>
              </p>
            </Banner>
          </Layout.Section>
        </Layout>

        {/* Product table */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Box paddingBlockStart="200" paddingInlineStart="200">
                  <Text variant="headingMd" as="h2">
                    Products — sorted by units sold
                  </Text>
                  <Text variant="bodySm" tone="subdued" as="p">
                    Click Analyse on any product to get AI-powered CRO & AEO recommendations.
                  </Text>
                </Box>
                <DataTable
                  columnContentTypes={["text", "text", "numeric", "numeric", "text", "text"]}
                  headings={["Product", "Status", "Units Sold", "Revenue", "AI Score", "Action"]}
                  rows={rows}
                  hoverable
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
