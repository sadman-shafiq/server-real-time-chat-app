# Use the official Bun base image
FROM oven/bun:latest AS base

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install

# Copy the rest of the app source code
COPY . .

# Expose the port the app runs on
EXPOSE 8000

# Set environment variables (override with Docker Compose or runtime)
ENV PORT=8000
ENV HOST=0.0.0.0

# Command to run the app
CMD ["bun", "--log-level", "run", "--watch", "src/index.ts"]
