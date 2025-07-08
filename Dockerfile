# Use a lightweight Node.js base image
FROM node:20-alpine

# Set working directory in the container
WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.js ./

# Optional: set npm retry settings for more reliable installs
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy the rest of the application
COPY . .

# Build the frontend and backend
RUN npm run build

# Set environment variables
ENV NODE_ENV=production

# Expose the backend port (your server runs on 3000)
EXPOSE 3000

# Start the production server
CMD ["node", "dist/index.js"]
