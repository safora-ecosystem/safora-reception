# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Vite compiles the API base into the bundle at BUILD time (not runtime).
ARG VITE_API_URL=https://api.safora.uz
ENV VITE_API_URL=$VITE_API_URL
# Turnstile sitekey — build vaqtida bundle'ga kiradi (VITE_ o'zgaruvchilari shunday). Ochiq
# qiymat, sir emas; bo'sh bo'lsa widget render qilinmaydi.
ARG VITE_TURNSTILE_SITEKEY=
ENV VITE_TURNSTILE_SITEKEY=$VITE_TURNSTILE_SITEKEY
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
