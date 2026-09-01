FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/

RUN npm install --workspace @cursor-burner/shared --workspace @cursor-burner/api

COPY packages/shared ./packages/shared
COPY packages/api ./packages/api
COPY tsconfig.base.json ./

RUN npm run build -w @cursor-burner/shared && npm run build -w @cursor-burner/api

WORKDIR /app/packages/api
EXPOSE 3001
CMD ["node", "dist/server.js"]
