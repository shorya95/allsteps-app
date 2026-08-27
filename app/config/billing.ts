export interface PlanFeatures {
  humanAudit: boolean;
  prioritySupport: boolean;
  seoConsultant: boolean;
  croConsultant: boolean;
  validator: boolean;
  shareFeature: boolean;
  enabledAnalyzers: string[];
}

export interface BillingPlan {
  id: string;
  name: string;
  price: number;
  interval: "EVERY_30_DAYS" | "ANNUAL";
  trialDays: number;
  features: PlanFeatures;
  description: string;
  popular?: boolean;
}

export const BILLING_PLANS: Record<string, BillingPlan> = {
  free: {
    id: "free",
    name: "Free (Bypass)",
    price: 0,
    interval: "EVERY_30_DAYS",
    trialDays: 0,
    features: {
      humanAudit: true,
      prioritySupport: false,
      seoConsultant: false,
      croConsultant: true,
      validator: true,
      shareFeature: true,
      enabledAnalyzers: ["*"],
    },
    description: "Free Bypass Plan for Testing\nFull access to AI store audits, sales-velocity product rankings, and 1-click CRO/AEO optimizations.\n\n**Who is it for:** Stores testing and evaluating AllSteps capabilities without entering billing info.",
  },
  basic: {
    id: "basic",
    name: "Pro",
    price: 499.00,
    interval: "EVERY_30_DAYS",
    trialDays: 0,
    popular: true,
    features: {
      humanAudit: true,
      prioritySupport: true,
      seoConsultant: true,
      croConsultant: true,
      validator: true,
      shareFeature: true,
      enabledAnalyzers: ["*"],
    },
    description: "Professional Solution for Growing Stores\nGet everything you need to optimize your Shopify store: 100+ AI-powered analyzers, expert human audit, priority support, and dedicated SEO & CRO consultants. Complete optimization solution for serious businesses.\n\n**Who is it for:** Growing stores with up to 1,000 products seeking complete optimization coverage.",
  },
  pro: {
    id: "pro",
    name: "Enterprise",
    price: 4999.00,
    interval: "EVERY_30_DAYS",
    trialDays: 0,
    features: {
      humanAudit: true,
      prioritySupport: true,
      seoConsultant: true,
      croConsultant: true,
      validator: true,
      shareFeature: true,
      enabledAnalyzers: ["*"],
    },
    description: "Enterprise Solution for High-Volume Stores\nEverything in Pro PLUS dedicated account manager, white-glove implementation, custom integrations, advanced analytics dashboard, and enterprise SLA. Ideal for stores doing $10M+ annually or requiring hands-on strategic guidance.\n\n**Who is it for:** Enterprise stores with 1,000+ products requiring dedicated strategic guidance.",
  },
};

export function getPlanById(planId: string): BillingPlan | null {
  return BILLING_PLANS[planId] || null;
}
