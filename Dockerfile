FROM node:20-bookworm-slim AS build

WORKDIR /app/apps/backend

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY apps/backend/package*.json ./
RUN npm ci

COPY apps/backend ./
RUN npm run build \
  && npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app/apps/backend

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/apps/backend ./

EXPOSE 3000
CMD ["npm", "run", "start"]
