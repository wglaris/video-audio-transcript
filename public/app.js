const statusEl = document.querySelector("#status");
const messageEl = document.querySelector("#message");
const resultEl = document.querySelector("#result");
const urlInput = document.querySelector("#urlInput");
const loadUrlBtn = document.querySelector("#loadUrl");
const loadAudioBtn = document.querySelector("#loadAudio");
const transcribeUrlBtn = document.querySelector("#transcribeUrl");
const fileInput = document.querySelector("#fileInput");
const video = document.querySelector("#video");
const currentLineEl = document.querySelector("#currentLine");
const transcriptListEl = document.querySelector("#transcriptList");
const followCurrentBtn = document.querySelector("#followCurrent");
const showFullTranscriptBtn = document.querySelector("#showFullTranscript");
const fullTranscriptDialog = document.querySelector("#fullTranscriptDialog");
const fullTranscriptText = document.querySelector("#fullTranscriptText");
const copyFullTranscriptBtn = document.querySelector("#copyFullTranscript");
const startInput = document.querySelector("#startInput");
const endInput = document.querySelector("#endInput");
const startRange = document.querySelector("#startRange");
const endRange = document.querySelector("#endRange");
const markStart = document.querySelector("#markStart");
const markEnd = document.querySelector("#markEnd");
const filenameInput = document.querySelector("#filenameInput");
const transcribeBtn = document.querySelector("#transcribeBtn");
const exportBtn = document.querySelector("#exportBtn");
const formatSelect = document.querySelector("#formatSelect");
const typeButtons = document.querySelectorAll("[data-type]");

let currentId = null;
let exportType = "audio";
let transcript = [];
let activeCueIndex = -1;
let transcriptAutoFollow = true;
let isProgrammaticTranscriptScroll = false;

function setMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.classList.toggle("error", isError);
}

function setBusy(isBusy, label = "Processing") {
  loadUrlBtn.disabled = isBusy;
  loadAudioBtn.disabled = isBusy;
  transcribeUrlBtn.disabled = isBusy;
  transcribeBtn.disabled = isBusy || !currentId;
  exportBtn.disabled = isBusy || !currentId;
  fileInput.disabled = isBusy;
  if (isBusy) setMessage(`${label}...`);
}

function updateFilenamePlaceholder() {
  const ext = exportType === "video" ? "mp4" : formatSelect.value;
  filenameInput.placeholder = `Example: interview-highlight-1.${ext}`;
}

function seconds(value) {
  if (typeof value === "string" && value.includes(":")) {
    const parts = value.split(":").map(part => Number(part.trim()));
    if (parts.some(part => !Number.isFinite(part) || part < 0)) return 0;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function formatTime(totalSeconds) {
  const total = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = value => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
}

function renderTranscript(cues = []) {
  transcript = cues;
  activeCueIndex = -1;
  transcriptAutoFollow = true;
  followCurrentBtn.hidden = true;
  showFullTranscriptBtn.disabled = !transcript.length;
  transcriptListEl.innerHTML = "";

  if (!transcript.length) {
    currentLineEl.textContent = "No transcript yet. Click Generate Transcript or Transcribe to start speech recognition.";
    transcriptListEl.innerHTML = '<div class="transcript-state">No transcript yet</div>';
    return;
  }

  currentLineEl.textContent = transcript[0].text;
  const escapeHtml = value => value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  transcriptListEl.innerHTML = transcript.map((cue, index) => `
    <button class="cue" type="button" data-index="${index}">
      <span class="cue-time">${formatTime(cue.start)}</span>
      <span>${escapeHtml(cue.text)}</span>
    </button>
  `).join("");
}

function setTranscriptStatus(title, detail = "") {
  transcript = [];
  activeCueIndex = -1;
  transcriptAutoFollow = true;
  followCurrentBtn.hidden = true;
  showFullTranscriptBtn.disabled = true;
  currentLineEl.textContent = title;
  transcriptListEl.innerHTML = `<div class="transcript-state">${detail || title}</div>`;
}

function getFullTranscriptText() {
  if (!transcript.length) return "";
  const shouldJoinWithoutSpace = (left, right) => {
    if (!left || !right) return true;
    return /[\u4e00-\u9fff，。！？、；：“”‘’）】》]/.test(left)
      || /^[\u4e00-\u9fff，。！？、；：“”‘’（【《]/.test(right);
  };

  return transcript
    .map(cue => cue.text.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .reduce((text, part) => {
      if (!text) return part;
      return `${text}${shouldJoinWithoutSpace(text.at(-1), part[0]) ? "" : " "}${part}`;
    }, "");
}

function scrollActiveCueIntoView() {
  const activeEl = transcriptListEl.querySelector(`[data-index="${activeCueIndex}"]`);
  if (!activeEl) return;
  isProgrammaticTranscriptScroll = true;
  activeEl.scrollIntoView({ block: "nearest" });
  window.setTimeout(() => {
    isProgrammaticTranscriptScroll = false;
  }, 120);
}

function updateActiveCue() {
  if (!transcript.length) return;
  const now = video.currentTime;
  const index = transcript.findIndex(cue => now >= cue.start && now < cue.end);
  if (index === -1 || index === activeCueIndex) return;

  activeCueIndex = index;
  const cue = transcript[index];
  currentLineEl.textContent = cue.text;
  transcriptListEl.querySelectorAll(".cue.active").forEach(el => el.classList.remove("active"));
  const activeEl = transcriptListEl.querySelector(`[data-index="${index}"]`);
  if (activeEl) {
    activeEl.classList.add("active");
    if (transcriptAutoFollow) scrollActiveCueIntoView();
  }
}

function syncLimits(duration) {
  const max = duration && Number.isFinite(duration) ? duration : 100;
  for (const el of [startRange, endRange]) {
    el.max = String(max);
    el.step = "0.1";
  }
  startInput.dataset.max = String(max);
  endInput.dataset.max = String(max);
  startInput.value = formatTime(0);
  startRange.value = "0";
  endInput.value = formatTime(max);
  endRange.value = max.toFixed(1);
}

function syncTextToRange(source, target) {
  const value = seconds(source.value);
  target.value = String(value);
}

function syncRangeToText(source, target) {
  target.value = formatTime(seconds(source.value));
  enforceOrder();
}

function enforceOrder() {
  const max = seconds(endInput.dataset.max || video.duration || 100);
  let start = Math.min(seconds(startInput.value), max);
  let end = Math.min(seconds(endInput.value), max);
  if (end <= start) end = Math.min(max, start + 1);
  startInput.value = formatTime(start);
  startRange.value = String(start);
  endInput.value = formatTime(end);
  endRange.value = String(end);
}

async function api(path, options = {}) {
  const res = await fetch(path, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ? `${data.error}\n${data.detail}` : data.error);
  return data;
}

async function refreshStatus() {
  const status = await api("/api/status");
  statusEl.innerHTML = [
    ["ffmpeg", status.ffmpeg],
    ["ffprobe", status.ffprobe],
    ["yt-dlp", status.ytDlp],
    ["whisper", status.whisper]
  ].map(([name, ok]) => `<span class="pill ${ok ? "ok" : "missing"}">${ok ? "Ready" : "Missing"} ${name}</span>`).join("");

  if (!status.ffmpeg || !status.ytDlp || !status.whisper) {
    setMessage("Paste a complete video URL from Bilibili, YouTube, Xiaohongshu, Douyin/TikTok, Weibo, Zhihu, or another supported site.\nDownloads require yt-dlp; exports require ffmpeg; transcription requires Whisper.\nOn macOS, run: brew install yt-dlp ffmpeg openai-whisper");
  }
}

function loadVideo(data) {
  currentId = data.id;
  video.src = data.videoUrl;
  video.load();
  exportBtn.disabled = false;
  resultEl.textContent = "";
  renderTranscript(data.transcript || []);
  if (data.duration) syncLimits(data.duration);
  setMessage("Media loaded. You can generate a transcript or select a time range and export directly.");
}

async function transcribeCurrent() {
  if (!currentId) return;
  setBusy(true, "Transcribing");
  try {
    setMessage("Whisper is transcribing the audio. The first run may download a model, and long videos can take several minutes.");
    setTranscriptStatus(
      "Whisper is transcribing the audio. Please wait.",
      "Generating transcript. Long videos may take several minutes; the result will appear here automatically."
    );
    const data = await api("/api/transcribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: currentId })
    });
    renderTranscript(data.transcript || []);
    setMessage("Transcript generated. Click any transcript line to jump to that time, or use Start and End to export a clip.");
  } catch (error) {
    setTranscriptStatus("Transcription failed.", error.message);
    setMessage(error.message, true);
  } finally {
    setBusy(false);
  }
}

async function loadFromUrl(mode) {
  const url = urlInput.value.trim();
  if (!/^https?:\/\/.+/i.test(url)) {
    setMessage("Paste the full video URL, not a video title. Supported examples include Bilibili, YouTube, Xiaohongshu, Douyin/TikTok, Weibo, and Zhihu share links.", true);
    return false;
  }

  const isAudioOnly = mode === "audio";
  setBusy(true, isAudioOnly ? "Downloading audio" : "Downloading video");
  try {
    currentId = null;
    setMessage(isAudioOnly
      ? "Downloading the audio stream only. This is usually faster; after loading, use the player timeline to choose a clip."
      : "Downloading a 720p preview video with concurrent fragments. Speed depends on the source site; long videos may take several minutes.");
    const data = await api("/api/download", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, mode })
    });
    loadVideo(data);
    return true;
  } catch (error) {
    setMessage(error.message, true);
    return false;
  } finally {
    setBusy(false);
  }
}

loadUrlBtn.addEventListener("click", () => loadFromUrl("video"));
loadAudioBtn.addEventListener("click", () => loadFromUrl("audio"));
transcribeUrlBtn.addEventListener("click", async () => {
  const loaded = await loadFromUrl("audio");
  if (loaded) await transcribeCurrent();
});
transcribeBtn.addEventListener("click", transcribeCurrent);

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  setBusy(true, "Uploading file");
  try {
    const data = await api("/api/upload", {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "x-filename": encodeURIComponent(file.name)
      },
      body: await file.arrayBuffer()
    });
    loadVideo(data);
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    setBusy(false);
  }
});

video.addEventListener("loadedmetadata", () => {
  if (video.duration && Number.isFinite(video.duration)) syncLimits(video.duration);
});

video.addEventListener("timeupdate", updateActiveCue);

transcriptListEl.addEventListener("click", event => {
  const cueEl = event.target.closest(".cue");
  if (!cueEl) return;
  const cue = transcript[Number(cueEl.dataset.index)];
  if (!cue) return;
  transcriptAutoFollow = true;
  followCurrentBtn.hidden = true;
  video.currentTime = cue.start;
  video.play().catch(() => {});
});

transcriptListEl.addEventListener("scroll", () => {
  if (isProgrammaticTranscriptScroll || !transcript.length) return;
  transcriptAutoFollow = false;
  followCurrentBtn.hidden = false;
});

followCurrentBtn.addEventListener("click", () => {
  transcriptAutoFollow = true;
  followCurrentBtn.hidden = true;
  if (activeCueIndex === -1) updateActiveCue();
  scrollActiveCueIntoView();
});

showFullTranscriptBtn.addEventListener("click", () => {
  fullTranscriptText.value = getFullTranscriptText();
  if (typeof fullTranscriptDialog.showModal === "function") {
    fullTranscriptDialog.showModal();
  } else {
    fullTranscriptDialog.setAttribute("open", "");
  }
  fullTranscriptText.focus();
  fullTranscriptText.select();
});

copyFullTranscriptBtn.addEventListener("click", async () => {
  fullTranscriptText.select();
  try {
    await navigator.clipboard.writeText(fullTranscriptText.value);
    copyFullTranscriptBtn.textContent = "Copied";
    window.setTimeout(() => {
      copyFullTranscriptBtn.textContent = "Copy All";
    }, 1200);
  } catch {
    document.execCommand("copy");
  }
});

markStart.addEventListener("click", () => {
  startInput.value = formatTime(video.currentTime);
  syncTextToRange(startInput, startRange);
  enforceOrder();
});

markEnd.addEventListener("click", () => {
  endInput.value = formatTime(video.currentTime);
  syncTextToRange(endInput, endRange);
  enforceOrder();
});

startInput.addEventListener("input", () => syncTextToRange(startInput, startRange));
endInput.addEventListener("input", () => syncTextToRange(endInput, endRange));
startRange.addEventListener("input", () => syncRangeToText(startRange, startInput));
endRange.addEventListener("input", () => syncRangeToText(endRange, endInput));

for (const input of [startInput, endInput]) {
  input.addEventListener("blur", enforceOrder);
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") input.blur();
  });
}

for (const button of typeButtons) {
  button.addEventListener("click", () => {
    exportType = button.dataset.type;
    typeButtons.forEach(btn => btn.classList.toggle("active", btn === button));
    formatSelect.disabled = exportType === "video";
    updateFilenamePlaceholder();
  });
}

formatSelect.addEventListener("change", updateFilenamePlaceholder);

exportBtn.addEventListener("click", async () => {
  if (!currentId) return;
  enforceOrder();
  setBusy(true, "Exporting clip");
  try {
    const data = await api("/api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: currentId,
        start: seconds(startInput.value),
        end: seconds(endInput.value),
        type: exportType,
        format: formatSelect.value,
        filename: filenameInput.value.trim()
      })
    });
    resultEl.innerHTML = `
      Exported: <a href="${data.downloadUrl}" download>${data.file}</a>
      <button id="revealExport" type="button" data-file="${data.file}">Show in Finder</button>
    `;
    setMessage("Export complete. Click the filename below to download it, then move it to your phone with AirDrop, Files, cloud storage, or a cable.");
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    setBusy(false);
  }
});

resultEl.addEventListener("click", async event => {
  const button = event.target.closest("#revealExport");
  if (!button) return;
  try {
    await api("/api/reveal-export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file: button.dataset.file })
    });
  } catch (error) {
    setMessage(error.message, true);
  }
});

transcribeBtn.disabled = true;
exportBtn.disabled = true;
renderTranscript([]);
updateFilenamePlaceholder();
refreshStatus().catch(error => setMessage(error.message, true));
