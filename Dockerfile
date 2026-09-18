FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production \
    DB_PATH=/data/scores.db \
    PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
