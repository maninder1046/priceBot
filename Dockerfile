# Multi-stage Dockerfile for Price Drop Telegram Bot
# Stage 1: Build native dependencies (better-sqlite3)
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Stage 2: Minimal runtime image
FROM node:20-alpine AS runner

WORKDIR /app

# Ensure standard runtime C++ libraries exist for native bindings
RUN apk add --no-cache libstdc++

# Copy built application and modules from builder
COPY --from=builder /app /app

# Create persistent storage mount directory
RUN mkdir -p /data

ENV NODE_ENV=production
ENV DB_PATH=/data/pricebot.db

# Run as background worker process (long-polling)
CMD ["node", "src/index.js"]
