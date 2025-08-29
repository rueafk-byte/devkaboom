# Use Node.js 18 LTS as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    sqlite \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package-enhanced.json package.json
COPY package-lock.json* ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Create necessary directories
RUN mkdir -p logs data backend

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S kaboom -u 1001 -G nodejs

# Set ownership
RUN chown -R kaboom:nodejs /app

# Switch to non-root user
USER kaboom

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application
CMD ["npm", "start"]
