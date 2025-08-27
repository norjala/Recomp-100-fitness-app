# Use Node.js 20 Alpine image for smaller size and security
# Cache bust: v2.1 - Fix vite build dependencies
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies needed for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    sqlite-dev

# Copy package files
COPY package*.json ./

# Install ALL dependencies including dev dependencies (vite, typescript, etc.)
# This is required for the build step to work
RUN npm ci --include=dev --legacy-peer-deps

# Verify vite is installed
RUN npx vite --version || echo "Vite not found in node_modules"

# Copy application source
COPY . .

# Build the application (requires dev dependencies)
RUN npm run build

# Now remove dev dependencies to reduce final image size
RUN npm prune --omit=dev

# Create necessary directories
RUN mkdir -p /app/data /app/uploads /app/logs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["npm", "run", "start:railway"]