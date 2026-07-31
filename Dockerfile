FROM node:20-alpine

WORKDIR /app

# Install dependencies required by some native modules
RUN apk add --no-cache git

COPY package*.json ./
RUN npm install

COPY . .

RUN npx tsc

EXPOSE 3005

CMD ["node", "dist/index.js"]
