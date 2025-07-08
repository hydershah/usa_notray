# Use Node.js 18 LTS
FROM node:18-alpine

# Install system dependencies for sharp, puppeteer, and other native deps
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    python3 \
    make \
    g++

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create app directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci --silent

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Clean up dev dependencies to reduce image size
RUN npm ci --production --silent && npm cache clean --force

# Create non-root user for security (simplified approach)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S notary -u 1001 -G nodejs && \
    chown -R notary:nodejs /app

# Simple health check that just checks if port is responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Switch to non-root user
USER notary

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"] 