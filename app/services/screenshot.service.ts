/**
 * Screenshot Service using Google PageSpeed Insights API
 */
export interface ScreenshotResult {
  success: boolean;
  url?: string;
  screenshot?: string;
  mobileScreenshot?: string;
  format?: string;
  width?: number;
  height?: number;
  source?: string;
  strategy?: string;
  message?: string;
  error?: string;
}

export class ScreenshotService {
  private static async captureScreenshot(websiteUrl: string, strategy: "desktop" | "mobile" = "desktop"): Promise<any> {
    const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY || "AIzaSyDBPYbPNMXwTqicmmsne1YSqFDVBtYoUho";
    const pageSpeedUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(websiteUrl)}&key=${apiKey}&category=performance&strategy=${strategy}`;

    const response = await fetch(pageSpeedUrl);
    if (!response.ok) {
      throw new Error(`PageSpeed API returned ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  }

  private static extractScreenshotFromData(data: any, strategy: "desktop" | "mobile"): ScreenshotResult {
    if (!data || data.error) {
      return {
        success: false,
        message: data?.error?.message || "No data available",
        strategy,
      };
    }

    const fullScreenshot = data?.lighthouseResult?.fullPageScreenshot?.screenshot;
    if (fullScreenshot && fullScreenshot.data) {
      return {
        success: true,
        url: fullScreenshot.data,
        screenshot: fullScreenshot.data,
        format: "base64",
        width: fullScreenshot.width,
        height: fullScreenshot.height,
        source: "lighthouse-full-page",
        strategy,
      };
    }

    const finalScreenshot = data?.lighthouseResult?.audits?.["final-screenshot"]?.details?.data;
    if (finalScreenshot) {
      return {
        success: true,
        url: finalScreenshot,
        screenshot: finalScreenshot,
        format: "base64",
        source: "pagespeed-final-screenshot",
        strategy,
      };
    }

    return {
      success: false,
      message: "No screenshot data found in PageSpeed response",
      strategy,
    };
  }

  static async getWebsiteScreenshot(shopOrigin: string): Promise<ScreenshotResult> {
    try {
      let websiteUrl: string;
      if (shopOrigin.includes("://")) {
        websiteUrl = shopOrigin;
      } else if (shopOrigin.includes(".")) {
        websiteUrl = `https://${shopOrigin}`;
      } else {
        websiteUrl = `https://${shopOrigin}.myshopify.com`;
      }

      const data = await this.captureScreenshot(websiteUrl, "desktop");
      if (data.error) {
        throw new Error(`PageSpeed API error: ${data.error.message}`);
      }

      const screenshotResult = this.extractScreenshotFromData(data, "desktop");
      if (screenshotResult.success) {
        return {
          ...screenshotResult,
          mobileScreenshot: screenshotResult.screenshot,
        };
      }

      return {
        success: false,
        message: "No screenshot found in response",
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown screenshot error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
