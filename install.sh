#!/usr/bin/env bash
#
# Morning Dashboard - Installation Script
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARD_PATH="$SCRIPT_DIR/dashboard.js"

echo "☀️  Installing Morning Dashboard..."
echo

# Make dashboard executable
chmod +x "$DASHBOARD_PATH"
echo "✓ Made dashboard.js executable"

# Add mdash alias to shell config
add_alias() {
  local rc_file="$1"
  local alias_line="alias mdash=\"$DASHBOARD_PATH\""
  
  if [ -f "$rc_file" ]; then
    if grep -q "alias mdash=" "$rc_file" 2>/dev/null; then
      echo "✓ mdash alias already exists in $(basename "$rc_file")"
    else
      echo "" >> "$rc_file"
      echo "# Morning Dashboard" >> "$rc_file"
      echo "$alias_line" >> "$rc_file"
      echo "✓ Added mdash alias to $(basename "$rc_file")"
    fi
    return 0
  fi
  return 1
}

# Try zsh first, then bash
if add_alias "$HOME/.zshrc"; then
  :
elif add_alias "$HOME/.bashrc"; then
  :
elif add_alias "$HOME/.bash_profile"; then
  :
else
  echo "⚠ Could not find shell config file. Add this manually:"
  echo "  alias mdash=\"$DASHBOARD_PATH\""
fi

# Optional: Install launchd plist for scheduled runs
echo
read -p "Install launchd agent for 7:30 AM daily runs? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  PLIST_SRC="$SCRIPT_DIR/com.andreisuslov.morning-dashboard.plist"
  PLIST_DST="$HOME/Library/LaunchAgents/com.andreisuslov.morning-dashboard.plist"
  
  # Update paths in plist to match current installation
  sed "s|/Users/ansuslov/projects/morning-dashboard|$SCRIPT_DIR|g" "$PLIST_SRC" > "$PLIST_DST"
  
  # Unload if already loaded, then load
  launchctl unload "$PLIST_DST" 2>/dev/null || true
  launchctl load "$PLIST_DST"
  
  echo "✓ Installed launchd agent (runs daily at 7:30 AM)"
fi

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Installation complete!"
echo
echo "Usage:"
echo "  mdash          Run the dashboard now"
echo
echo "To apply the alias in your current shell:"
echo "  source ~/.zshrc   # or ~/.bashrc"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
