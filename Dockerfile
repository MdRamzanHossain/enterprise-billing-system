# Production Dockerfile for Master Technology Billing System
FROM node:20-alpine

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Set working directory
WORKDIR /app

# Copy application files
COPY package.json ./
COPY server.js ./
COPY public ./public
COPY data ./data

# Ensure data directory has write permissions for the node user
RUN chown -R node:node /app

# Switch to non-root user for security
USER node

# Persistent data volume for invoices, products, users, companies
VOLUME ["/app/data"]

# Expose HTTP port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1

# Start the application
CMD ["node", "server.js"]
