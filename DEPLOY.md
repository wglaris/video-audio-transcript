# Public Deployment Guide

This tool can run as a Docker web service on a cloud server. In a public deployment, visitors use the same browser interface while the server handles media downloads, Whisper transcription, and audio/video clip exports for supported sources such as Bilibili, YouTube, Xiaohongshu, Douyin/TikTok, Weibo, and Zhihu.

## Important Notes

- A public service consumes server CPU, disk space, and bandwidth. Whisper transcription is especially resource intensive.
- The current app has no account system. Anyone who knows the URL can use it.
- Public deployments only allow common video domains on the server allowlist, which helps prevent the service from being used to request arbitrary URLs.
- If a target site requires login, CAPTCHA, region access, or blocks automated requests, the app reports the error and does not attempt to bypass restrictions.
- Only process content that you have the right to access and process, and follow the rules of each video or music platform.
- For early public testing, share the URL with a small group first to reduce abuse risk.

## Local Docker Test

```bash
docker build -t video-audio-transcript-tool .
docker run --rm -p 4173:4173 video-audio-transcript-tool
```

Open:

```text
http://localhost:4173/video-audio-transcript
```

## Cloud Server Deployment

1. Prepare a cloud server. Use at least 2 CPU cores and 4 GB of RAM for comfortable transcription; use a larger instance if you expect frequent long-video transcription.
2. Install Docker.
3. Upload the project directory to the server.
4. Build and run the container:

```bash
docker build -t video-audio-transcript-tool .
docker run -d \
  --name video-audio-transcript-tool \
  --restart unless-stopped \
  -p 4173:4173 \
  -v "$PWD/outputs:/app/outputs" \
  -v "$PWD/work:/app/work" \
  video-audio-transcript-tool
```

5. Open port `4173` in the server firewall or cloud security group, or reverse proxy the app to ports `80` and `443` with Nginx or Caddy.
6. If you own a domain, point DNS to the server IP and configure HTTPS.

## About `http://video-audio-transcript`

This bare host name will not work for all internet users automatically. Public users need a real domain, for example:

```text
https://video-audio-transcript.com
```

Or a default domain from a cloud platform, for example:

```text
https://video-audio-transcript.example-platform.app
```
