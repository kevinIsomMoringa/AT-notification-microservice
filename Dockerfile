FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
COPY tsconfig.json ./
COPY .eslintrc.json ./

RUN npm ci --only=production

COPY src ./src
COPY .env.example ./.env.example

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/server.js"]
