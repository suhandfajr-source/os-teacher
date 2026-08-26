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

export function resolveTrustedOrigins(
    nodeEnv: string | undefined = process.env.NODE_ENV,
    appUrl: string | undefined = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL
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
        return [appUrl.replace(/\/$/, "")];
    }
    return [];
}

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    trustedOrigins: resolveTrustedOrigins(),
    emailAndPassword: {
        enabled: true,
        autoSignIn: true
    },
});
