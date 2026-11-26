FROM node:24-bookworm

ENV HOST=0.0.0.0
ENV PORT=4173
ENV PIP_BREAK_SYSTEM_PACKAGES=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip ca-certificates \
  && python3 -m pip install --no-cache-dir -U yt-dlp openai-whisper \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json server.mjs start.sh README.md ./
COPY public ./public

RUN mkdir -p work/media work/transcripts outputs \
  && chmod +x start.sh

EXPOSE 4173

CMD ["node", "server.mjs"]
