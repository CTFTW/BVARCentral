# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# ---------------------------------------------------------------------------
# dev: used by .devcontainer for local development (no build step)
# ---------------------------------------------------------------------------
FROM base AS dev
ENV NODE_ENV=development
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---------------------------------------------------------------------------
# deps: install production dependencies only
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# ---------------------------------------------------------------------------
# builder: build the Next.js app
# ---------------------------------------------------------------------------
FROM base AS builder
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npx prisma generate
RUN npm run build

# ---------------------------------------------------------------------------
# runner: minimal production image
# ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
# Copy the Prisma client generated in `builder` (against the real schema),
# not the one from `deps`, which never ran `prisma generate`.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
