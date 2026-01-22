# Stage 1: Build the application
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies like typescript)
RUN npm ci

COPY . .

# Build the TypeScript application
RUN npm run build

# Stage 2: Run the application
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy the built application from the builder stage
COPY --from=builder /app/dist ./dist

ENTRYPOINT ["node", "dist/app.js"]
