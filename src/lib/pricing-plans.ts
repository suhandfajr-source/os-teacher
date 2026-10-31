export interface PricingPlan {
  id: "bulanan" | "semester" | "tahunan";
  name: string;
  price: number; // IDR Integer
  durationDays: number;
  description: string;
}

export const PRICING_PLANS: Record<string, PricingPlan> = {
  bulanan: {
    id: "bulanan",
    name: "Paket Bulanan",
    price: 1000,
    durationDays: 30,
    description: "Akses 1 Bulan Penuh Fitur KLASSA (Uji Coba)",
  },
  semester: {
    id: "semester",
    name: "Paket Semester",
    price: 199000,
    durationDays: 180,
    description: "Akses 1 Semester (6 Bulan) Penuh Fitur KLASSA",
  },
  tahunan: {
    id: "tahunan",
    name: "Paket Tahunan",
    price: 349000,
    durationDays: 365,
    description: "Akses 1 Tahun Ajaran Penuh Fitur KLASSA",
  },
};

export type PlanId = keyof typeof PRICING_PLANS;

export function getPricingPlan(planId: string): PricingPlan | null {
  return PRICING_PLANS[planId] || null;
}
