FROM node:20

WORKDIR /app

ENV PATH=/app/node_modules/.bin:$PATH

RUN npm install -g tsx

COPY package.json package-lock.json ./

RUN npm ci

COPY . ./

RUN npx prisma generate

EXPOSE 3020

CMD ["npm", "start"]
