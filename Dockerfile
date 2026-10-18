# Root-level Dockerfile (Coolify buildpack context = repo root)
FROM node:22-alpine AS deps
WORKDIR /build
COPY app/package.json app/package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /build
COPY --from=deps /build/node_modules ./node_modules
COPY app/ .
ENV NODE_OPTIONS=--max-old-space-size=3072
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /build/node_modules ./node_modules
COPY --from=build /build/.next ./.next
COPY --from=build /build/public ./public
COPY --from=build /build/package.json ./package.json
ENV DATABASE_URL=file:/data/agentos.db
RUN mkdir -p /data
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
