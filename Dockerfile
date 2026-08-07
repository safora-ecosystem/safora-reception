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
# qiymat, sir emas.
# Default ATAYLAB bo'sh emas (`VITE_API_URL` kabi prod qiymati). Bo'sh default bilan build-arg
# tushib qolsa xato JIM bo'ladi: Vite `""` ni fold qilib widget kodini butunlay o'chiradi, login
# tokensiz ketadi va TURNSTILE_ENABLED=true backend har urinishni 403 qiladi — panelga hech kim
# kira olmaydi. Shu tuzoq prodni ikki marta yiqitgan (2026-07-17 CI'da arg yo'q edi; 2026-08-07
# migratsiyada admin image CI'dan tashqarida, argsiz qurilgan). Sitekey Cloudflare'da almashsa
# — shu qiymat va `.gitlab-ci.yml` dagi arg BIRGA yangilanadi.
ARG VITE_TURNSTILE_SITEKEY=0x4AAAAAAD18gPs6NsdXy9fa
ENV VITE_TURNSTILE_SITEKEY=$VITE_TURNSTILE_SITEKEY
# Firebase web push (FCM) — hammasi OCHIQ qiymatlar (apiKey web bundle'da baribir
# ko'rinadi; himoya Firebase qoidalari va domen cheklovlarida). Bo'sh qolsa panel
# push'siz, "Brauzer bildirishnomasi" faqat tab-ochiq rejimda ishlaydi.
ARG VITE_FIREBASE_API_KEY=
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_PROJECT_ID=
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_SENDER_ID=
ENV VITE_FIREBASE_SENDER_ID=$VITE_FIREBASE_SENDER_ID
ARG VITE_FIREBASE_APP_ID=
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_VAPID_KEY=
ENV VITE_FIREBASE_VAPID_KEY=$VITE_FIREBASE_VAPID_KEY
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
