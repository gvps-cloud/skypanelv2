# Use Node.js 20 LTS for stability
FROM node:20-alpine AS base

# Install necessary system packages
RUN apk add --no-cache \
    git \
    openssh-client \
    curl \
    bash \
    python3 \
    make \
    g++ \
    docker-cli \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy source code
COPY --chown=nodejs:nodejs . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install runtime packages
RUN apk add --no-cache \
    git \
    openssh-client \
    curl \
    bash \
    docker-cli \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Create required directories with proper permissions
RUN mkdir -p /app/logs && \
    chown -R nodejs:nodejs /app

# Copy built application from base stage
COPY --from=base --chown=nodejs:nodejs /app/dist ./dist
COPY --from=base --chown=nodejs:nodejs /app/api ./api
COPY --from=base --chown=nodejs:nodejs /app/public ./public
COPY --from=base --chown=nodejs:nodejs /app/scripts ./scripts
COPY --from=base --chown=nodejs:nodejs /app/migrations ./migrations
COPY --from=base --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=base --chown=nodejs:nodejs /app/package.json ./
COPY --from=base --chown=nodejs:nodejs /app/ecosystem.config.cjs ./

# Switch to non-root user
USER nodejs

# Expose the application port
EXPOSE 3001

# Set environment variables for production
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

# Start the application
CMD ["npm", "start"]
