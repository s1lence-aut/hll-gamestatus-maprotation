FROM node:18-alpine
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install
COPY . .
COPY .env ./
CMD ["node", "main.mjs"]
