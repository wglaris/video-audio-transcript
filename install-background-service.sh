#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
LABEL="com.video-audio-transcript.tool"
LEGACY_LABEL="com.codex.bilibili-clipper"
APP_DIR="$HOME/Library/Application Support/VideoAudioTranscriptTool"
LEGACY_PLIST="$HOME/Library/LaunchAgents/$LEGACY_LABEL.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/$LABEL.plist"

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$APP_DIR/public" "$APP_DIR/work/logs" "$APP_DIR/outputs"
cp "$SCRIPT_DIR/package.json" "$APP_DIR/package.json"
cp "$SCRIPT_DIR/server.mjs" "$APP_DIR/server.mjs"
cp "$SCRIPT_DIR/start.sh" "$APP_DIR/start.sh"
cp "$SCRIPT_DIR/README.md" "$APP_DIR/README.md"
cp -R "$SCRIPT_DIR/public/." "$APP_DIR/public/"
chmod +x "$APP_DIR/start.sh"

cat > "$PLIST_DEST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>$APP_DIR/start.sh</string>
  </array>

  <key>WorkingDirectory</key>
  <string>$APP_DIR</string>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>$APP_DIR/work/logs/app.out.log</string>

  <key>StandardErrorPath</key>
  <string>$APP_DIR/work/logs/app.err.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)" "$LEGACY_PLIST" >/dev/null 2>&1 || true
launchctl bootout "gui/$(id -u)" "$PLIST_DEST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_DEST"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

echo "Installed and started $LABEL"
echo "App files: $APP_DIR"
echo "Open http://localhost:4173"
