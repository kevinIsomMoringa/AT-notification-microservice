FROM node:20-alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci

COPY src ./src

RUN npm run build

FROM node:20-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /usr/src/app/dist ./dist
COPY .env.example ./.env.example

EXPOSE 3000

CMD ["node", "dist/server.js"]
