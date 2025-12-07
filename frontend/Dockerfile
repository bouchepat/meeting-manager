# Frontend Dockerfile
FROM node:22-alpine AS development

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (with legacy peer deps for Angular Fire compatibility)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Expose port
EXPOSE 4200

# Start development server
CMD ["npm", "start", "--", "--host", "0.0.0.0", "--poll", "2000"]

# Build stage
FROM node:22-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Copy built files to nginx
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
