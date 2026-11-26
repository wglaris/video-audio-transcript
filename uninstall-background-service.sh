#!/usr/bin/env sh
set -eu

LABEL="com.video-audio-transcript.tool"
LEGACY_LABEL="com.codex.bilibili-clipper"
PLIST_DEST="$HOME/Library/LaunchAgents/$LABEL.plist"
LEGACY_PLIST="$HOME/Library/LaunchAgents/$LEGACY_LABEL.plist"
APP_DIR="$HOME/Library/Application Support/VideoAudioTranscriptTool"

launchctl bootout "gui/$(id -u)" "$PLIST_DEST" >/dev/null 2>&1 || true
launchctl bootout "gui/$(id -u)" "$LEGACY_PLIST" >/dev/null 2>&1 || true
rm -f "$PLIST_DEST"
rm -f "$LEGACY_PLIST"

echo "Stopped and removed $LABEL"
echo "App files are still at: $APP_DIR"
