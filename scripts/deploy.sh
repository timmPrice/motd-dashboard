#!/bin/sh
# Copy the built plugin into a vault. Copies (not symlinks) so Obsidian Sync
# carries it to other devices.
set -e
VAULT="${VAULT:-$HOME/obs-notes}"
DEST="$VAULT/.obsidian/plugins/motd"
mkdir -p "$DEST"
cp main.js manifest.json styles.css "$DEST/"
echo "deployed to $DEST"
