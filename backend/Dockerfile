# Backend Dockerfile
FROM node:22-alpine AS development

WORKDIR /app

# Install ffmpeg for audio conversion
RUN apk add --no-cache ffmpeg

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start development server
CMD ["npm", "run", "start:dev"]

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Install ffmpeg for audio conversion
RUN apk add --no-cache ffmpeg

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start production server
CMD ["node", "dist/main.js"]
