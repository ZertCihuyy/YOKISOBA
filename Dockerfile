FROM node:20-slim AS base

# Install ffmpeg and other dependencies
RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
