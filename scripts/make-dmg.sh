#!/bin/sh
# Baut eine einfache, funktionierende .dmg direkt mit hdiutil — ohne
# Tauris eingebautes create-dmg-Skript, das auf manchen macOS-Versionen
# mit "Not enough arguments" abbricht (bekannter Tauri-Bundler-Bug).
# Voraussetzung: `npm run tauri:build` wurde bereits erfolgreich
# ausgeführt und KieselWesen.app existiert.
#
# TAURI_TARGET (optional): dieselbe Rust-Zieltriple, mit der auch
# `tauri build --target ...` aufgerufen wurde (z.B. beim Cross-Compilen
# für Intel-Macs auf einem Apple-Silicon-Runner). Cargo legt Builds für
# ein explizites Target unter target/<triple>/release/ statt target/release/
# ab — dieses Skript muss also denselben Pfad kennen.
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="$REPO_ROOT/src-tauri/target/${TAURI_TARGET:+$TAURI_TARGET/}release"
APP_PATH="$TARGET_DIR/bundle/macos/KieselWesen.app"
DMG_DIR="$TARGET_DIR/bundle/dmg"
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
