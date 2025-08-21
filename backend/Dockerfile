FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN npm ci || npm i
COPY . .
RUN npm run prisma:generate && npm run build
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.js"]