/**
 * Shopify GraphQL helpers — product queries + sales aggregation + mutations
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductWithSales {
  id: string;
  title: string;
  handle: string;
  status: string;
  featuredImage: { url: string; altText: string | null } | null;
  descriptionHtml: string;
  seo: { title: string | null; description: string | null };
  tags: string[];
  vendor: string;
  productType: string;
  unitsSold: number;
  revenue: number;
  currencyCode: string;
  variants: Array<{
    id: string;
    title: string;
    price: string;
    inventoryQuantity: number;
  }>;
}

export interface ApplyFieldResult {
  success: boolean;
  error?: string;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

const PRODUCTS_QUERY = `#graphql
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: TITLE) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          handle
          status
          featuredImage { url altText }
          descriptionHtml
          seo { title description }
          tags
          vendor
          productType
          variants(first: 5) {
            edges {
              node {
                id
                title
                price
                inventoryQuantity
              }
            }
          }
        }
      }
    }
  }
`;

// Fetch order line items aggregated by product to get units sold + revenue
const ORDERS_QUERY = `#graphql
  query GetOrderLineItems($first: Int!, $after: String) {
    orders(first: $first, after: $after, query: "financial_status:paid") {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          currencyCode
          lineItems(first: 50) {
            edges {
              node {
                quantity
                originalTotalSet {
                  shopMoney { amount }
                }
                product { id }
              }
            }
          }
        }
      }
    }
  }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AdminGraphQL = (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;

/**
 * Aggregate units sold + revenue per product from paid orders.
 * Returns a Map keyed by Shopify product GID.
 */
async function aggregateSales(
  admin: { graphql: AdminGraphQL },
): Promise<Map<string, { units: number; revenue: number; currency: string }>> {
  const salesMap = new Map<string, { units: number; revenue: number; currency: string }>();

  let after: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const res = await admin.graphql(ORDERS_QUERY, {
      variables: { first: 50, ...(after ? { after } : {}) },
    });
    const json = await res.json() as {
      data: {
        orders: {
          pageInfo: { hasNextPage: boolean; endCursor: string };
          edges: Array<{
            node: {
              currencyCode: string;
              lineItems: {
                edges: Array<{
                  node: {
                    quantity: number;
                    originalTotalSet: { shopMoney: { amount: string } };
                    product: { id: string } | null;
                  };
                }>;
              };
            };
          }>;
        };
      };
    };

    const orders = json.data?.orders;
    if (!orders) break;

    for (const { node: order } of orders.edges) {
      for (const { node: item } of order.lineItems.edges) {
        if (!item.product) continue;
        const pid = item.product.id;
        const prev = salesMap.get(pid) ?? { units: 0, revenue: 0, currency: order.currencyCode };
        salesMap.set(pid, {
          units: prev.units + item.quantity,
          revenue: prev.revenue + parseFloat(item.originalTotalSet.shopMoney.amount),
          currency: order.currencyCode,
        });
      }
    }

    hasNextPage = orders.pageInfo.hasNextPage;
    after = orders.pageInfo.endCursor;
  }

  return salesMap;
}

/**
 * Fetch all products and enrich them with sales data, sorted by units sold desc.
 */
export async function fetchProductsWithSales(
  admin: { graphql: AdminGraphQL },
): Promise<ProductWithSales[]> {
  const salesMap = await aggregateSales(admin);

  const products: ProductWithSales[] = [];
  let after: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const res = await admin.graphql(PRODUCTS_QUERY, {
      variables: { first: 50, ...(after ? { after } : {}) },
    });
    const json = await res.json() as {
      data: {
        products: {
          pageInfo: { hasNextPage: boolean; endCursor: string };
          edges: Array<{ node: {
            id: string; title: string; handle: string; status: string;
            featuredImage: { url: string; altText: string | null } | null;
            descriptionHtml: string;
            seo: { title: string | null; description: string | null };
            tags: string[];
            vendor: string;
            productType: string;
            variants: { edges: Array<{ node: { id: string; title: string; price: string; inventoryQuantity: number } }> };
          } }>;
        };
      };
    };

    const page = json.data?.products;
    if (!page) break;

    for (const { node } of page.edges) {
      const sales = salesMap.get(node.id);
      products.push({
        id: node.id,
        title: node.title,
        handle: node.handle,
        status: node.status,
        featuredImage: node.featuredImage,
        descriptionHtml: node.descriptionHtml,
        seo: node.seo,
        tags: node.tags,
        vendor: node.vendor,
        productType: node.productType,
        unitsSold: sales?.units ?? 0,
        revenue: sales?.revenue ?? 0,
        currencyCode: sales?.currency ?? "USD",
        variants: node.variants.edges.map((e) => e.node),
      });
    }

    hasNextPage = page.pageInfo.hasNextPage;
    after = page.pageInfo.endCursor;
  }

  // Sort by units sold descending
  products.sort((a, b) => b.unitsSold - a.unitsSold);
  return products;
}

/**
 * Fetch a single product by GID.
 */
export async function fetchProduct(
  admin: { graphql: AdminGraphQL },
  productId: string,
): Promise<ProductWithSales | null> {
  const res = await admin.graphql(
    `#graphql
      query GetProduct($id: ID!) {
        product(id: $id) {
          id title handle status
          featuredImage { url altText }
          descriptionHtml
          seo { title description }
          tags vendor productType
          variants(first: 10) {
            edges { node { id title price inventoryQuantity } }
          }
        }
      }
    `,
    { variables: { id: productId } },
  );
  const json = await res.json() as { data: { product: {
    id: string; title: string; handle: string; status: string;
    featuredImage: { url: string; altText: string | null } | null;
    descriptionHtml: string;
    seo: { title: string | null; description: string | null };
    tags: string[];
    vendor: string;
    productType: string;
    variants: { edges: Array<{ node: { id: string; title: string; price: string; inventoryQuantity: number } }> };
  } | null } };

  const node = json.data?.product;
  if (!node) return null;

  return {
    ...node,
    unitsSold: 0,
    revenue: 0,
    currencyCode: "USD",
    variants: node.variants.edges.map((e) => e.node),
  };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function applyProductField(
  admin: { graphql: AdminGraphQL },
  productId: string,
  field: string,
  value: string,
): Promise<ApplyFieldResult> {
  try {
    const input: Record<string, unknown> = { id: productId };

    if (field === "title") input.title = value;
    else if (field === "descriptionHtml") input.descriptionHtml = value;
    else if (field === "tags") input.tags = value.split(",").map((t) => t.trim());
    else if (field === "seoTitle") input.seo = { title: value };
    else if (field === "seoDescription") input.seo = { description: value };
    else return { success: false, error: `Unknown field: ${field}` };

    const res = await admin.graphql(
      `#graphql
        mutation UpdateProduct($input: ProductInput!) {
          productUpdate(product: $input) {
            product { id }
            userErrors { field message }
          }
        }
      `,
      { variables: { input } },
    );
    const json = await res.json() as {
      data: { productUpdate: { product: { id: string } | null; userErrors: Array<{ field: string[]; message: string }> } };
    };

    const errors = json.data?.productUpdate?.userErrors;
    if (errors && errors.length > 0) {
      return { success: false, error: errors.map((e) => e.message).join(", ") };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
