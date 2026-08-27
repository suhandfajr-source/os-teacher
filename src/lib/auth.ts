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

export function getBaseURL(): string {
    if (process.env.BETTER_AUTH_URL) {
        return process.env.BETTER_AUTH_URL.replace(/\/$/, "");
    }
    if (process.env.NEXT_PUBLIC_APP_URL) {
        return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    }
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
        return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/$/, "")}`;
    }
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
    }
    return "http://localhost:3000";
}

export function getAuthSecret(nodeEnv: string | undefined = process.env.NODE_ENV): string {
    const secret = process.env.BETTER_AUTH_SECRET;
    if (nodeEnv === "production") {
        if (!secret || secret.trim() === "") {
            throw new Error("Missing required BETTER_AUTH_SECRET configuration in production environment.");
        }
        return secret;
    }
    return secret || "dev-only-local-secret-do-not-use-in-production";
}

export function resolveTrustedOrigins(
    nodeEnv: string | undefined = process.env.NODE_ENV,
    appUrl: string | undefined = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined)
): string[] {
    if (nodeEnv !== "production") {
        return [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002",
            "http://localhost:3003",
            "http://localhost:3004",
            "http://localhost:3005"
        ];
    }
    if (appUrl && !appUrl.includes("localhost") && !appUrl.includes("127.0.0.1")) {
        const cleaned = appUrl.replace(/\/$/, "");
        return [cleaned];
    }
    return [];
}

export const auth = betterAuth({
    baseURL: getBaseURL(),
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    trustedOrigins: resolveTrustedOrigins(),
    secret: getAuthSecret(),
    emailAndPassword: {
        enabled: true,
        autoSignIn: true
    },
});
