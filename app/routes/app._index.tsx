/**
 * AllSteps Dashboard — Hero Device Preview + Scan Controls + Store KPIs
 */
import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  BlockStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { fetchProductsWithSales } from "../lib/shopify.products";
import { ComplexDevicePreview, type WebsiteScreenshot } from "../components/dashboard/ComplexDevicePreview";
import { ScanningControlsSection } from "../components/dashboard/ScanningControlsSection";
import { ScreenshotService } from "../services/screenshot.service";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  // 1. Fetch products with sales
  const products = await fetchProductsWithSales(admin);

  // 2. Fetch cached analyses count
  const analyses = await prisma.productAnalysis.findMany({
    where: { shop },
    select: { status: true },
  });
  const analysedCount = analyses.filter((a) => a.status === "done").length;

  // 3. Fetch active subscription status (by default null / no plan)
  const subscription = await prisma.subscription.findUnique({
    where: { shop },
  });
  const canPerformScan = !!subscription && subscription.status === "ACTIVE";
  const planId = subscription?.planId || null;
  const planName = subscription?.planName || null;

  // 4. Aggregate quick KPI totals
  const totalProducts = products.length;
  const totalUnitsSold = products.reduce((s, p) => s + p.unitsSold, 0);
  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
  const currencyCode = products[0]?.currencyCode || "USD";

  // 5. Try fetching initial screenshot in background or return shop domain
  let initialScreenshot: WebsiteScreenshot | null = null;
  try {
    const shotResult = await ScreenshotService.getWebsiteScreenshot(shop);
    if (shotResult.success && shotResult.screenshot) {
      initialScreenshot = {
        screenshot: shotResult.screenshot,
        mobileScreenshot: shotResult.mobileScreenshot,
      };
    }
  } catch {
    // Graceful fallback
  }

  return json({
    shop,
    canPerformScan,
    planId,
    planName,
    totalProducts,
    totalUnitsSold,
    totalRevenue,
    currencyCode,
    analysedCount,
    initialScreenshot,
  });
};

const SCAN_STEPS = [
  "Connecting to Shopify Admin API...",
  "Fetching store catalog & sales velocity...",
  "Analyzing homepage layout & conversion touchpoints...",
  "Checking product descriptions, keywords & metadata...",
  "Running Core Web Vitals & mobile speed scan...",
  "Scanning AEO search & featured snippet signals...",
  "Calculating store CRO opportunities...",
  "Finalizing optimization roadmap!",
];

export default function Dashboard() {
  const {
    shop,
    canPerformScan,
    planId,
    planName,
    totalProducts,
    totalUnitsSold,
    totalRevenue,
    currencyCode,
    analysedCount,
    initialScreenshot,
  } = useLoaderData<typeof loader>();

  const navigate = useNavigate();

  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStep, setScanStep] = useState("");
  const [websiteScreenshot, setWebsiteScreenshot] = useState<WebsiteScreenshot | null>(initialScreenshot);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleScanStore = () => {
    if (!canPerformScan) {
      navigate("/app/plans");
      return;
    }

    setIsScanning(true);
    setScanComplete(false);
    setScanProgress(8);
    setScanStep(SCAN_STEPS[0]);
    setScreenshotLoading(true);

    let stepIndex = 0;
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        const next = prev + 12;
        if (next >= 100) {
          clearInterval(interval);
          setScanProgress(100);
          setScanStep("✅ Scan complete! Generated optimization roadmap.");
          setIsScanning(false);
          setScanComplete(true);
          setScreenshotLoading(false);
          setLastScanTime(new Date().toLocaleTimeString());
          return 100;
        }

        const stepIdx = Math.min(
          Math.floor((next / 100) * SCAN_STEPS.length),
          SCAN_STEPS.length - 1,
        );
        setScanStep(SCAN_STEPS[stepIdx]);
        return next;
      });
    }, 450);
  };

  return (
    <Page>
      <TitleBar title="AllSteps — CRO & AEO Suite" />
      <BlockStack gap="600">
        {/* Device Preview Hero */}
        <ComplexDevicePreview
          websiteScreenshot={websiteScreenshot}
          screenshotLoading={screenshotLoading}
          isScanning={isScanning}
        />

        {/* Scan Controls Section */}
        <ScanningControlsSection
          isScanning={isScanning}
          isRedirecting={isRedirecting}
          lastScanTime={lastScanTime}
          scanProgress={scanProgress}
          scanStep={scanStep}
          scanComplete={scanComplete}
          canPerformScan={canPerformScan}
          planId={planId}
          planName={planName}
          handleScanStore={handleScanStore}
          navigate={navigate}
          totalProducts={totalProducts}
          totalUnitsSold={totalUnitsSold}
          totalRevenue={totalRevenue}
          currencyCode={currencyCode}
        />
      </BlockStack>
    </Page>
  );
}
