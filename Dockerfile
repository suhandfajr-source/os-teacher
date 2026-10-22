# syntax=docker/dockerfile:1

# ---- Build stage: modern glibc (bookworm = glibc 2.36) so Next.js SWC native works ----
FROM node:22-bookworm AS builder
WORKDIR /app
ENV NODE_OPTIONS=--max-old-space-size=2048

# Build-time placeholders only. Route modules are evaluated during `next build`
# (page-data collection) and fail-fast checks (betterAuth, PIN_PEPPER module-scope
# resolve) require these to be present. REAL secrets are injected at runtime
# via --env-file and override these values.
ARG BETTER_AUTH_SECRET=build-time-placeholder-not-a-real-secret-32ch
ARG PIN_PEPPER=build-time-placeholder-pepper-32chars-minimum-ok
ARG STUDENT_SESSION_SECRET=build-time-placeholder-session-32chars-minimum
ENV BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET} \
    PIN_PEPPER=${PIN_PEPPER} \
    STUDENT_SESSION_SECRET=${STUDENT_SESSION_SECRET}

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---- Run stage: standalone Next.js output ----
FROM node:22-bookworm AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=2001 \
    HOSTNAME=0.0.0.0

# Non-root user
RUN groupadd -r klassa && useradd -r -g klassa klassa

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER klassa
EXPOSE 2001
CMD ["node", "server.js"]
