/**
 * Google Gemini AI integration for product CRO/AEO analysis.
 * Uses the Gemini REST API (no SDK needed).
 */

export interface AnalysisResult {
  scoreOverall: number;
  scoreCRO: number;
  scoreAEO: number;
  titleAnalysis: {
    score: number;
    issues: string[];
    suggestion: string;
  };
  descriptionAnalysis: {
    score: number;
    issues: string[];
    suggestion: string;
  };
  seoAnalysis: {
    score: number;
    titleSuggestion: string;
    descriptionSuggestion: string;
    issues: string[];
  };
  aeoAnalysis: {
    score: number;
    issues: string[];
    suggestions: string[];
  };
  tagsAnalysis: {
    score: number;
    missingKeywords: string[];
    suggestion: string;
  };
  quickWins: Array<{
    priority: "high" | "medium" | "low";
    field: string;
    action: string;
    impact: string;
  }>;
  recommendations: Array<{
    field: "title" | "descriptionHtml" | "seoTitle" | "seoDescription" | "tags";
    label: string;
    currentValue: string;
    suggestedValue: string;
    reason: string;
  }>;
}

interface ProductInput {
  title: string;
  descriptionHtml: string;
  seoTitle: string | null;
  seoDescription: string | null;
  tags: string[];
  vendor: string;
  productType: string;
  price: string;
  unitsSold: number;
  revenue: number;
  currencyCode: string;
}

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

function buildPrompt(product: ProductInput): string {
  return `You are an expert Shopify merchant consultant specialising in Conversion Rate Optimization (CRO) and AI Engine Optimization (AEO) for product pages.

Analyse the following Shopify product and return a detailed JSON report.

## PRODUCT DATA
Title: ${product.title}
Vendor: ${product.vendor}
Product Type: ${product.productType}
Price: ${product.currencyCode} ${product.price}
Units Sold: ${product.unitsSold}
Revenue: ${product.currencyCode} ${product.revenue.toFixed(2)}
Tags: ${product.tags.join(", ") || "(none)"}
SEO Title: ${product.seoTitle || "(not set)"}
SEO Description: ${product.seoDescription || "(not set)"}
Description HTML:
${product.descriptionHtml || "(empty)"}

## INSTRUCTIONS
Return ONLY a valid JSON object matching this exact structure (no markdown, no explanation):

{
  "scoreOverall": <0-100>,
  "scoreCRO": <0-100>,
  "scoreAEO": <0-100>,
  "titleAnalysis": {
    "score": <0-100>,
    "issues": ["..."],
    "suggestion": "Improved title text"
  },
  "descriptionAnalysis": {
    "score": <0-100>,
    "issues": ["..."],
    "suggestion": "Full improved HTML description"
  },
  "seoAnalysis": {
    "score": <0-100>,
    "titleSuggestion": "Improved SEO title (max 60 chars)",
    "descriptionSuggestion": "Improved meta description (max 160 chars)",
    "issues": ["..."]
  },
  "aeoAnalysis": {
    "score": <0-100>,
    "issues": ["..."],
    "suggestions": ["..."]
  },
  "tagsAnalysis": {
    "score": <0-100>,
    "missingKeywords": ["..."],
    "suggestion": "comma,separated,improved,tags"
  },
  "quickWins": [
    {
      "priority": "high|medium|low",
      "field": "title|descriptionHtml|seoTitle|seoDescription|tags",
      "action": "Short description of what to change",
      "impact": "Expected benefit"
    }
  ],
  "recommendations": [
    {
      "field": "title|descriptionHtml|seoTitle|seoDescription|tags",
      "label": "Human readable field name",
      "currentValue": "existing value",
      "suggestedValue": "improved value",
      "reason": "Why this change helps CRO or AEO"
    }
  ]
}

Focus on:
- CRO: persuasive copy, benefit-driven language, trust signals, clear CTAs in description
- AEO: structured facts, question-answer format, featured-snippet-ready content, schema hints
- SEO: keyword-rich titles under 60 chars, compelling meta descriptions under 160 chars
- Tags: relevant search keywords the merchant is missing`;
}

export async function analyseProduct(product: ProductInput): Promise<AnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in environment variables.");

  const body = {
    contents: [{ parts: [{ text: buildPrompt(product) }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
  };

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const json = await res.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  };

  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // Strip potential markdown code fences
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();

  try {
    return JSON.parse(cleaned) as AnalysisResult;
  } catch {
    throw new Error(`Failed to parse Gemini response as JSON: ${cleaned.slice(0, 300)}`);
  }
}
