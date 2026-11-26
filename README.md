# Video Audio Transcript Tool

A local-first web tool for turning online videos or local media files into reusable clips and transcripts. Paste a public video URL or upload a local file, load audio/video, generate a Whisper transcript, select a start and end time, and export MP3/M4A/WAV audio or MP4 video clips.

## Features

- Load media from supported public video URLs
- Download audio only for faster transcription and audio clipping
- Generate speech-to-text transcripts with Whisper
- Display a synced transcript while media plays
- Show a clean full transcript without timestamps for easy note-taking
- Export selected time ranges as MP3, M4A, WAV, or MP4
- Customize exported filenames before downloading
- Deploy with Docker on a cloud server

## Supported Sources

The current allowlist includes these common sources:

- Bilibili: `bilibili.com`, `b23.tv`
- YouTube: `youtube.com`, `youtu.be`
- Xiaohongshu: `xiaohongshu.com`, `xhslink.com`
- Douyin/TikTok: `douyin.com`, `iesdouyin.com`, `tiktok.com`
- Weibo: `weibo.com`, `m.weibo.cn`
- Zhihu: `zhihu.com`
- X/Twitter: `x.com`, `twitter.com`
- Instagram: `instagram.com`
- Facebook: `facebook.com`, `fb.watch`
- Vimeo: `vimeo.com`
- TED: `ted.com`

Download support depends on `yt-dlp` and the source site's current behavior. If a site requires login, CAPTCHA, region access, or blocks automated requests, the tool reports the error and does not attempt to bypass access controls.

## Local Development

### Requirements

- Node.js
- `yt-dlp`
- `ffmpeg`
- `openai-whisper`

On macOS, install dependencies with Homebrew:

```bash
brew install node yt-dlp ffmpeg openai-whisper
```

Start the app:

```bash
sh start.sh
```

Open:

```text
http://localhost:4173/video-audio-transcript
```

## macOS Background Service

Install the app as a background service that starts after login:

```bash
sh install-background-service.sh
```

The installer copies the app to:

```text
~/Library/Application Support/VideoAudioTranscriptTool
```

Stop and remove the background service:

```bash
sh uninstall-background-service.sh
```

## Docker

```bash
docker build -t video-audio-transcript-tool .
docker run --rm -p 4173:4173 video-audio-transcript-tool
```

See [DEPLOY.md](DEPLOY.md) for public deployment notes.

## Open Source And Privacy

This repository should contain tool code only. Do not commit:

- `work/`
- `outputs/`
- Downloaded videos, audio files, transcripts, or exported clips
- Cookies, login files, API keys, SSH private keys, or server passwords
- `.env` or any file containing credentials

`.gitignore` excludes common generated and sensitive files, but it is still a good idea to check before committing:

```bash
git status --short
```

See [GITHUB_PUBLISH.md](GITHUB_PUBLISH.md) for publishing steps.

## Disclaimer

This tool is intended for personal learning, research, note-taking, and processing content that you have the right to access and process. Follow the terms of service of each source platform, copyright rules, and applicable laws. Do not use this tool for unauthorized downloading, redistribution, commercial use, or bypassing access controls.

## License

MIT
