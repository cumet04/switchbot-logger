FROM node:20.16.0-slim AS base

# ----

FROM base AS builder

WORKDIR /app
ARG SENTRY_AUTH_TOKEN

# sentryのrelease APIを実行するために必要
RUN apt-get update && apt-get install -y ca-certificates

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN env SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN npm run build

# ----

FROM base AS runner

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

USER nextjs

# COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

CMD ["node", "server.js"]
