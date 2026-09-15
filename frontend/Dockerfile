# Two stages: build the bundle, then serve it from nginx with /api proxied to
# the backend so the browser only ever makes same-origin requests.
FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
