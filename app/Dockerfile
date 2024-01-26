FROM node:20.11.0-slim AS base

# ----

FROM base AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ----

FROM base AS runner

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

 # entrypointで.envを書き出せるように、予めapp userに権限を与えた空ファイルを用意しておく
RUN touch .env && chown nextjs .env

USER nextjs

# COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY docker-entrypoint.sh ./

CMD ["./docker-entrypoint.sh"]
