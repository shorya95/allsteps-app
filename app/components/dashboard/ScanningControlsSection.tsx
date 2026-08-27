import { Card, BlockStack, Box, InlineStack, Text, Button, Badge, Spinner } from "@shopify/polaris";
import { RefreshIcon, MagicIcon } from "@shopify/polaris-icons";

export interface ScanningControlsSectionProps {
  isScanning: boolean;
  isRedirecting: boolean;
  lastScanTime: string | null;
  scanProgress: number;
  scanStep: string;
  scanComplete: boolean;
  handleScanStore: () => void;
  navigate: (path: string) => void;
  totalProducts?: number;
  totalUnitsSold?: number;
  totalRevenue?: number;
  currencyCode?: string;
}

export function ScanningControlsSection({
  isScanning,
  isRedirecting,
  lastScanTime,
  scanProgress,
  scanStep,
  scanComplete,
  handleScanStore,
  navigate,
  totalProducts = 0,
  totalUnitsSold = 0,
  totalRevenue = 0,
  currencyCode = "USD",
}: ScanningControlsSectionProps) {
  const formattedRevenue = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(totalRevenue);

  return (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="150">
              <InlineStack gap="200" blockAlign="center">
                <Text as="h2" variant="headingLg">
                  {isScanning ? "Scanning your store…" : "Scan your Store"}
                </Text>
                <Badge tone="success">Growth Plan</Badge>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                {lastScanTime ? `Last scan completed: ${lastScanTime}` : "Run an AI-powered scan across your store layout, speed, and product performance"}
              </Text>
            </BlockStack>

            <InlineStack gap="200">
              {!isScanning && (
                <Button
                  size="large"
                  variant={scanComplete ? "secondary" : "primary"}
                  icon={scanComplete ? RefreshIcon : undefined}
                  onClick={handleScanStore}
                >
                  {scanComplete ? "Rescan Store" : "Scan now"}
                </Button>
              )}
              {isScanning && (
                <Button size="large" variant="primary" loading>
                  Scanning...
                </Button>
              )}
              <Button
                size="large"
                variant={scanComplete ? "primary" : "secondary"}
                icon={MagicIcon}
                onClick={() => navigate("/app/products")}
              >
                Optimize Products
              </Button>
            </InlineStack>
          </InlineStack>

          {/* Progress bar during scan or redirect */}
          {(isScanning || isRedirecting) && (
            <Box paddingBlockStart="200">
              <BlockStack gap="200">
                <div
                  style={{
                    width: "100%",
                    height: "10px",
                    backgroundColor: "#e1e3e5",
                    borderRadius: "5px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(scanProgress, 100)}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #4A90E2 0%, #124AD3 100%)",
                      borderRadius: "5px",
                      transition: "width 0.4s ease-in-out",
                    }}
                  />
                </div>
                <InlineStack align="space-between">
                  <Text as="span" variant="bodySm" tone="subdued">
                    {scanStep || "Analyzing store touchpoints..."}
                  </Text>
                  <Text as="span" variant="bodySm" fontWeight="semibold">
                    {`${Math.round(scanProgress)}%`}
                  </Text>
                </InlineStack>
              </BlockStack>
            </Box>
          )}

          {/* Store Quick Stats */}
          <Box paddingBlockStart="200">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
              }}
            >
              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <BlockStack gap="050">
                  <Text variant="bodySm" tone="subdued" as="span">Store Products</Text>
                  <Text variant="headingMd" as="span">{totalProducts.toLocaleString()}</Text>
                </BlockStack>
              </Box>

              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <BlockStack gap="050">
                  <Text variant="bodySm" tone="subdued" as="span">Total Units Sold</Text>
                  <Text variant="headingMd" as="span">{totalUnitsSold.toLocaleString()}</Text>
                </BlockStack>
              </Box>

              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <BlockStack gap="050">
                  <Text variant="bodySm" tone="subdued" as="span">Tracked Revenue</Text>
                  <Text variant="headingMd" as="span">{formattedRevenue}</Text>
                </BlockStack>
              </Box>

              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <BlockStack gap="050">
                  <Text variant="bodySm" tone="subdued" as="span">CRO & AEO Status</Text>
                  <InlineStack gap="100" blockAlign="center">
                    <Badge tone="info">Ready to Optimize</Badge>
                  </InlineStack>
                </BlockStack>
              </Box>
            </div>
          </Box>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
