import { BlockStack, Box } from "@shopify/polaris";

export interface WebsiteScreenshot {
  screenshot?: string;
  mobileScreenshot?: string;
}

export interface ComplexDevicePreviewProps {
  websiteScreenshot?: WebsiteScreenshot | null;
  screenshotLoading?: boolean;
  isScanning?: boolean;
}

export function ComplexDevicePreview({
  websiteScreenshot,
  screenshotLoading = false,
  isScanning = false,
}: ComplexDevicePreviewProps) {
  return (
    <BlockStack gap="600">
      {/* Device preview section with blue gradient */}
      <div
        style={{
          padding: "32px",
          background: "linear-gradient(135deg, #87CEEB 0%, #4A90E2 40%, #124AD3 100%)",
          borderRadius: "12px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Modern hexagonal grid pattern */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: `
              linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(0deg, rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(60deg, rgba(255,255,255,0.08) 1px, transparent 1px),
              linear-gradient(-60deg, rgba(255,255,255,0.08) 1px, transparent 1px)
            `,
            backgroundSize: "100px 100px, 100px 100px, 100px 57.74px, 100px 57.74px",
            backgroundPosition: "0 0, 0 0, 0 0, 50px 28.87px",
            pointerEvents: "none",
            filter: "contrast(1.1) brightness(1.02)",
            opacity: 0.9,
          }}
        />

        {/* Top fade gradient */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "140px",
            background: "linear-gradient(180deg, rgba(18, 74, 211, 0.4) 0%, rgba(18, 74, 211, 0.15) 50%, transparent 100%)",
            pointerEvents: "none",
            zIndex: 3,
          }}
        />

        {/* Logo in top left */}
        <div
          style={{
            position: "absolute",
            top: "24px",
            left: "24px",
            zIndex: 4,
          }}
        >
          <img
            src="/logo.svg"
            alt="AllSteps Logo"
            style={{
              width: "110px",
              height: "auto",
              filter: "brightness(0) invert(1)",
              opacity: 0.95,
            }}
          />
        </div>

        {/* Dual Device Frames */}
        <div
          style={{
            display: "flex",
            gap: "24px",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingTop: "60px",
            paddingBottom: "10px",
            position: "relative",
            zIndex: 2,
            maxWidth: "100%",
            overflow: "hidden",
          }}
        >
          {/* Desktop Frame */}
          <div style={{ flex: "0 0 auto", maxWidth: "440px", width: "100%" }}>
            <div
              style={{
                background: "#f8f9fa",
                borderRadius: "8px",
                padding: "0px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                position: "relative",
              }}
            >
              {/* Laptop Screen Frame */}
              <div
                style={{
                  background: "#1a1a1a",
                  borderRadius: "8px 8px 0 0",
                  padding: "8px 8px 4px 8px",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)",
                }}
              >
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "4px",
                    aspectRatio: "16/10",
                    overflow: "hidden",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {screenshotLoading && isScanning ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "8px",
                        color: "#666",
                      }}
                    >
                      <div
                        style={{
                          width: "18px",
                          height: "18px",
                          border: "2px solid #f3f4f6",
                          borderTop: "2px solid #3b82f6",
                          borderRadius: "50%",
                          animation: "spin 1s linear infinite",
                        }}
                      />
                      <div style={{ color: "#6b7280", fontSize: "11px" }}>Loading store preview…</div>
                    </div>
                  ) : websiteScreenshot?.screenshot ? (
                    <img
                      src={websiteScreenshot.screenshot}
                      alt="Desktop preview"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition: "top left",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        color: "#8c9196",
                        fontSize: "12px",
                        textAlign: "center",
                        padding: "20px",
                      }}
                    >
                      <div style={{ marginBottom: "6px", fontSize: "20px" }}>🖥️</div>
                      <div>Store Desktop Preview</div>
                    </div>
                  )}
                </div>
              </div>
              {/* Laptop Base */}
              <div
                style={{
                  background: "#222",
                  height: "8px",
                  borderRadius: "0 0 8px 8px",
                  position: "relative",
                  borderTop: "1px solid #333",
                }}
              />
            </div>
          </div>

          {/* Mobile Frame */}
          <div style={{ flex: "0 0 auto", width: "120px" }}>
            <div
              style={{
                background: "#1a1a1a",
                borderRadius: "16px",
                padding: "5px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                position: "relative",
              }}
            >
              {/* Mobile Screen */}
              <div
                style={{
                  background: "#ffffff",
                  height: "200px",
                  borderRadius: "12px",
                  overflow: "hidden",
                  position: "relative",
                  border: "1px solid #e0e0e0",
                }}
              >
                {screenshotLoading && isScanning ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      gap: "6px",
                      color: "#666",
                    }}
                  >
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        border: "1.5px solid #f3f4f6",
                        borderTop: "1.5px solid #3b82f6",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                  </div>
                ) : websiteScreenshot?.mobileScreenshot || websiteScreenshot?.screenshot ? (
                  <img
                    src={websiteScreenshot.mobileScreenshot || websiteScreenshot.screenshot}
                    alt="Mobile preview"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: "top center",
                      display: "block",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      color: "#8c9196",
                      fontSize: "9px",
                      textAlign: "center",
                      padding: "8px",
                    }}
                  >
                    <div style={{ marginBottom: "2px", fontSize: "14px" }}>📱</div>
                    <div>Mobile Preview</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </BlockStack>
  );
}
