import { createServer } from "node:http";
import { accessSync, constants, createReadStream, promises as fs } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const ROOT = resolve(".");
const PUBLIC_DIR = join(ROOT, "public");
const WORK_DIR = join(ROOT, "work");
const MEDIA_DIR = join(WORK_DIR, "media");
const TRANSCRIPT_DIR = join(WORK_DIR, "transcripts");
const EXPORT_DIR = join(ROOT, "outputs");
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 1024 * 1024 * 1024);
const ALLOWED_VIDEO_HOSTS = [
  "bilibili.com",
  "b23.tv",
  "youtube.com",
  "youtu.be",
  "xiaohongshu.com",
  "xhslink.com",
  "douyin.com",
  "iesdouyin.com",
  "tiktok.com",
  "weibo.com",
  "m.weibo.cn",
  "zhihu.com",
  "x.com",
  "twitter.com",
  "instagram.com",
  "facebook.com",
  "fb.watch",
  "vimeo.com",
  "ted.com"
];

const jobs = new Map();

await fs.mkdir(MEDIA_DIR, { recursive: true });
await fs.mkdir(TRANSCRIPT_DIR, { recursive: true });
await fs.mkdir(EXPORT_DIR, { recursive: true });

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(text);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function readBuffer(req, maxBytes = MAX_UPLOAD_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("The file is too large. Please use a shorter video or audio file.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function isAllowedVideoUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    return parsed.protocol === "https:" && ALLOWED_VIDEO_HOSTS.some(allowedHost => (
      host === allowedHost || host.endsWith(`.${allowedHost}`)
    ));
  } catch {
    return false;
  }
}

function commandExists(command) {
  const paths = (process.env.PATH || "").split(":");
  return paths.some(path => {
    try {
      accessSync(join(path, command), constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: ROOT, ...options });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", chunk => {
      stdout += chunk.toString();
      options.onStdout?.(chunk.toString());
    });
    child.stderr?.on("data", chunk => {
      stderr += chunk.toString();
      options.onStderr?.(chunk.toString());
    });
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) resolveRun({ stdout, stderr });
      else {
        const error = new Error(stderr.trim() || `${command} exited with ${code}`);
        error.stdout = stdout;
        error.stderr = stderr;
        error.code = code;
        reject(error);
      }
    });
  });
}

function escapeFilename(name) {
  return name
    .replace(/[\/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "video";
}

function contentType(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".m4a") return "audio/mp4";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".vtt") return "text/vtt; charset=utf-8";
  return "application/octet-stream";
}

function parseVttTime(value) {
  const parts = value.trim().split(":");
  const secondsPart = parts.pop() || "0";
  const seconds = Number(secondsPart.replace(",", "."));
  const minutes = Number(parts.pop() || 0);
  const hours = Number(parts.pop() || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function cleanCaptionText(text) {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/\{\\.*?\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function parseTranscript(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  const blocks = text.replace(/\r/g, "").split(/\n\n+/);
  const cues = [];

  for (const block of blocks) {
    const lines = block.split("\n").filter(Boolean);
    const timeIndex = lines.findIndex(line => line.includes("-->"));
    if (timeIndex === -1) continue;

    const [startRaw, rest] = lines[timeIndex].split("-->");
    const endRaw = rest?.trim().split(/\s+/)[0];
    const start = parseVttTime(startRaw);
    const end = parseVttTime(endRaw || "0");
    const cueText = cleanCaptionText(lines.slice(timeIndex + 1).join(" "));
    if (Number.isFinite(start) && Number.isFinite(end) && end > start && cueText) {
      cues.push({ start, end, text: cueText });
    }
  }

  return cues;
}

async function findTranscript(id) {
  const files = await fs.readdir(MEDIA_DIR);
  const transcriptFile = files
    .filter(name => name.startsWith(`${id}.`) && name.endsWith(".vtt"))
    .sort((a, b) => {
      const score = name => Number(name.includes("zh")) * 2 + Number(name.includes("Hans"));
      return score(b) - score(a);
    })[0];

  if (!transcriptFile) return [];
  return parseTranscript(join(MEDIA_DIR, transcriptFile)).catch(() => []);
}

async function findWhisperTranscript(mediaPath) {
  const baseName = basename(mediaPath, extname(mediaPath));
  const files = await fs.readdir(TRANSCRIPT_DIR);
  const transcriptFile = files.find(name => name === `${baseName}.vtt`)
    || files.find(name => name.startsWith(baseName) && name.endsWith(".vtt"));
  return transcriptFile ? join(TRANSCRIPT_DIR, transcriptFile) : null;
}

async function transcribeJob(job) {
  if (!commandExists("whisper")) {
    throw new Error("Whisper is not installed. Install it first with: brew install openai-whisper. The first transcription may download a model and take a while.");
  }
  if (!job?.path) throw new Error("No audio or video file was found. Load a URL or upload a file first.");

  await run("whisper", [
    job.path,
    "--language", "Chinese",
    "--task", "transcribe",
    "--model", "base",
    "--output_format", "vtt",
    "--output_dir", TRANSCRIPT_DIR
  ]);

  const transcriptPath = await findWhisperTranscript(job.path);
  if (!transcriptPath) throw new Error("Whisper finished, but no generated VTT transcript was found.");
  const transcript = await parseTranscript(transcriptPath);
  job.transcript = transcript;
  job.transcriptSource = "whisper";
  return transcript;
}

async function serveFile(req, res, baseDir, urlPath) {
  const filePath = resolve(baseDir, `.${decodeURIComponent(urlPath)}`);
  if (!filePath.startsWith(baseDir)) return sendText(res, 403, "Forbidden");
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat || !stat.isFile()) return sendText(res, 404, "Not found");

  const range = req.headers.range;
  const headers = {
    "content-type": contentType(filePath),
    "accept-ranges": "bytes"
  };

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : stat.size - 1;
      res.writeHead(206, {
        ...headers,
        "content-range": `bytes ${start}-${end}/${stat.size}`,
        "content-length": end - start + 1
      });
      createReadStream(filePath, { start, end }).pipe(res);
      return;
    }
  }

  res.writeHead(200, { ...headers, "content-length": stat.size });
  createReadStream(filePath).pipe(res);
}

async function getDuration(filePath) {
  if (!commandExists("ffprobe")) return null;
  try {
    const { stdout } = await run("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath
    ]);
    const duration = Number(stdout.trim());
    return Number.isFinite(duration) ? duration : null;
  } catch {
    return null;
  }
}

async function handleDownload(req, res) {
  if (!commandExists("yt-dlp")) {
    return sendJson(res, 400, {
      error: "yt-dlp is not installed. Install it first with: brew install yt-dlp, or pipx install yt-dlp."
    });
  }
  const { url, mode } = await readJson(req);
  if (!url || !isAllowedVideoUrl(url)) {
    return sendJson(res, 400, { error: "Enter a valid video URL. Supported sources include Bilibili, YouTube, Xiaohongshu, Douyin/TikTok, Weibo, Zhihu, X/Twitter, Instagram, Facebook, Vimeo, TED, and other common links on the allowlist." });
  }

  const id = randomUUID();
  const outTemplate = join(MEDIA_DIR, `${id}.%(ext)s`);
  const log = [];
  jobs.set(id, { id, status: "downloading", log, source: "url" });

  try {
    const formatArgs = mode === "audio"
      ? ["-f", "ba/bestaudio/best", "-x", "--audio-format", "m4a"]
      : ["-f", "bv*[height<=720]+ba/b[height<=720]/best", "--merge-output-format", "mp4"];

    await run("yt-dlp", [
      "--no-playlist",
      "--concurrent-fragments", "8",
      "--write-subs",
      "--write-auto-subs",
      "--sub-langs", "zh-Hans,zh-CN,zh,en.*",
      "--sub-format", "vtt",
      ...formatArgs,
      "-o", outTemplate,
      url
    ], {
      onStderr: text => log.push(text),
      onStdout: text => log.push(text)
    });
    const files = await fs.readdir(MEDIA_DIR);
    const mediaExts = new Set([".mp4", ".m4a", ".mp3", ".webm", ".mkv"]);
    const file = files.find(name => name.startsWith(`${id}.`) && mediaExts.has(extname(name).toLowerCase()));
    if (!file) throw new Error("Download completed, but no media file was found.");
    const path = join(MEDIA_DIR, file);
    const duration = await getDuration(path);
    const transcript = await findTranscript(id);
    const job = { id, status: "ready", file, path, duration, source: "url", log, transcript };
    jobs.set(id, job);
    sendJson(res, 200, { id, videoUrl: `/media/${file}`, duration, transcript });
  } catch (error) {
    jobs.set(id, { id, status: "error", error: error.message, log });
    sendJson(res, 500, { error: error.message, detail: log.slice(-6).join("") });
  }
}

async function handleUpload(req, res) {
  const id = randomUUID();
  const rawName = decodeURIComponent(req.headers["x-filename"] || "upload.mp4");
  const ext = extname(rawName) || ".mp4";
  const file = `${id}${ext}`;
  const path = join(MEDIA_DIR, file);
  const buffer = await readBuffer(req);
  if (!buffer.length) return sendJson(res, 400, { error: "No media file was received." });
  await fs.writeFile(path, buffer);
  const duration = await getDuration(path);
  jobs.set(id, { id, status: "ready", file, path, duration, source: "upload", log: [], transcript: [] });
  sendJson(res, 200, { id, videoUrl: `/media/${file}`, duration, transcript: [] });
}

async function handleTranscribe(req, res) {
  const { id } = await readJson(req);
  const job = jobs.get(id);
  if (!job?.path) return sendJson(res, 404, { error: "No loaded audio or video was found. Load a URL or upload a file first." });

  try {
    const transcript = await transcribeJob(job);
    sendJson(res, 200, { id, transcript, source: "whisper" });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleExport(req, res) {
  if (!commandExists("ffmpeg")) {
    return sendJson(res, 400, {
      error: "ffmpeg is not installed. Install it first with: brew install ffmpeg."
    });
  }
  const { id, start, end, type, format, filename } = await readJson(req);
  const job = jobs.get(id);
  if (!job?.path) return sendJson(res, 404, { error: "No loaded media was found. Download or upload the file again." });

  const startTime = Number(start);
  const endTime = Number(end);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    return sendJson(res, 400, { error: "Choose a valid start and end time." });
  }

  const safeFormat = type === "video" ? "mp4" : (["mp3", "m4a", "wav"].includes(format) ? format : "mp3");
  const requestedBase = typeof filename === "string" ? escapeFilename(filename.replace(/\.[^.]+$/, "")) : "";
  const base = requestedBase || `${escapeFilename(basename(job.file, extname(job.file)))}_${Math.round(startTime)}-${Math.round(endTime)}`;
  const outFile = `${base}.${safeFormat}`;
  const outPath = join(EXPORT_DIR, outFile);
  const args = ["-y", "-ss", String(startTime), "-to", String(endTime), "-i", job.path];

  if (type === "video") {
    args.push("-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", outPath);
  } else if (safeFormat === "mp3") {
    args.push("-vn", "-c:a", "libmp3lame", "-b:a", "192k", outPath);
  } else if (safeFormat === "m4a") {
    args.push("-vn", "-c:a", "aac", "-b:a", "192k", outPath);
  } else {
    args.push("-vn", "-c:a", "pcm_s16le", outPath);
  }

  try {
    await run("ffmpeg", args);
    sendJson(res, 200, { file: outFile, downloadUrl: `/exports/${encodeURIComponent(outFile)}` });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleRevealExport(req, res) {
  if (process.platform !== "darwin") {
    return sendJson(res, 400, { error: "This feature is only available in the local Mac version. On a public web deployment, click the export link to download the file." });
  }

  const { file } = await readJson(req);
  if (!file || typeof file !== "string") {
    return sendJson(res, 400, { error: "Missing export filename." });
  }

  const filePath = resolve(EXPORT_DIR, file);
  if (!filePath.startsWith(EXPORT_DIR)) {
    return sendJson(res, 403, { error: "Cannot open files outside the export directory." });
  }

  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat?.isFile()) return sendJson(res, 404, { error: "Export file not found." });

  try {
    await run("open", ["-R", filePath]);
    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/api/status") {
      return sendJson(res, 200, {
        ffmpeg: commandExists("ffmpeg"),
        ffprobe: commandExists("ffprobe"),
        ytDlp: commandExists("yt-dlp"),
        whisper: commandExists("whisper")
      });
    }
    if (req.method === "POST" && url.pathname === "/api/download") return handleDownload(req, res);
    if (req.method === "POST" && url.pathname === "/api/upload") return handleUpload(req, res);
    if (req.method === "POST" && url.pathname === "/api/transcribe") return handleTranscribe(req, res);
    if (req.method === "POST" && url.pathname === "/api/export") return handleExport(req, res);
    if (req.method === "POST" && url.pathname === "/api/reveal-export") return handleRevealExport(req, res);
    if (req.method === "GET" && url.pathname.startsWith("/media/")) return serveFile(req, res, MEDIA_DIR, url.pathname.replace("/media", ""));
    if (req.method === "GET" && url.pathname.startsWith("/exports/")) return serveFile(req, res, EXPORT_DIR, url.pathname.replace("/exports", ""));

    const appPaths = new Set([
      "/",
      "/bilibili-audio-transcript",
      "/video-audio-transcript",
      "/bilibili-audio-tool",
      "/bilibili-audio-transcript-tool",
      "/video-audio-transcript-tool"
    ]);
    const staticPath = appPaths.has(url.pathname) ? "/index.html" : url.pathname;
    return serveFile(req, res, PUBLIC_DIR, staticPath);
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message });
  }
}).listen(PORT, HOST, () => {
  console.log(`Video Audio Transcript Tool running at http://${HOST}:${PORT}`);
});
