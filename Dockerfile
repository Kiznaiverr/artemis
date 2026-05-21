FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip ca-certificates ffmpeg \
  && rm -rf /var/lib/apt/lists/*

RUN python3 -m pip install --break-system-packages --no-cache-dir yt-dlp

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY index.ts ./
COPY src ./src

RUN npm run build

CMD ["node", "dist/index.js"]