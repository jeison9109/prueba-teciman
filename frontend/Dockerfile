# Imagen de desarrollo: Vite con recarga en caliente y proxy /api hacia el backend.
FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev"]
