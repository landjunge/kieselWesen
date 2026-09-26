#!/bin/sh
# Baut eine einfache, funktionierende .dmg direkt mit hdiutil — ohne
# Tauris eingebautes create-dmg-Skript, das auf manchen macOS-Versionen
# mit "Not enough arguments" abbricht (bekannter Tauri-Bundler-Bug).
# Voraussetzung: `npm run tauri:build` wurde bereits erfolgreich
# ausgeführt und KieselWesen.app existiert.
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_PATH="$REPO_ROOT/src-tauri/target/release/bundle/macos/KieselWesen.app"
DMG_DIR="$REPO_ROOT/src-tauri/target/release/bundle/dmg"
DMG_PATH="$DMG_DIR/KieselWesen.dmg"
STAGING_DIR="$(mktemp -d)"

if [ ! -d "$APP_PATH" ]; then
  echo "KieselWesen.app nicht gefunden unter $APP_PATH"
  echo "Zuerst 'npm run tauri:build' ausführen."
  exit 1
fi

mkdir -p "$DMG_DIR"
rm -f "$DMG_PATH"

cp -R "$APP_PATH" "$STAGING_DIR/"
ln -s /Applications "$STAGING_DIR/Programme (Applications)"

hdiutil create -volname "KieselWesen" -srcfolder "$STAGING_DIR" -ov -format UDZO "$DMG_PATH"

rm -rf "$STAGING_DIR"

echo "Fertig: $DMG_PATH"
