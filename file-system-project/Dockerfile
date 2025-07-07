# FROM nginx:1.21-alpine

# # Copy our custom test HTML file to the Nginx web root directory
# COPY index.html /usr/share/nginx/html/index.html

# # Expose port 80 (the default Nginx port) inside the container
# EXPOSE 80

# Stage 1: Install dependencies
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --production

# Stage 2: Build the final image
FROM node:18-alpine AS final
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules

# Copy all other necessary files
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# The command to run the application
CMD ["node", "server.js"]
