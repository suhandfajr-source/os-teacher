import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export function resolveTrustedOrigins(): string[] {
    const origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:3004",
        "http://localhost:3005",
        "https://*.vercel.app",
        "https://*.pages.dev"
    ];

    if (process.env.BETTER_AUTH_URL) {
        origins.push(process.env.BETTER_AUTH_URL.replace(/\/$/, ""));
    }
    if (process.env.NEXT_PUBLIC_APP_URL) {
        origins.push(process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ""));
    }
    if (process.env.VERCEL_URL) {
        origins.push(`https://${process.env.VERCEL_URL.replace(/\/$/, "")}`);
    }
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
        origins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/$/, "")}`);
    }

    return Array.from(new Set(origins));
}

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    trustedOrigins: resolveTrustedOrigins(),
    secret: process.env.BETTER_AUTH_SECRET || "os-teacher-secret-auth-key-2026",
    emailAndPassword: {
        enabled: true,
        autoSignIn: true
    },
});
