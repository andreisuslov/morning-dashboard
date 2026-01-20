#!/usr/bin/env bash
#
# Morning Dashboard - Installation Script
# https://github.com/andreisuslov/morning-dashboard
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARD_PATH="$SCRIPT_DIR/dashboard.js"
CONFIG_DIR="$HOME/.config/morning-dashboard"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo
echo -e "${CYAN}${BOLD}☀️  Morning Dashboard Installer${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js is required but not installed${NC}"
  echo "  Install from: https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${YELLOW}⚠ Node.js 18+ recommended (you have $(node -v))${NC}"
fi

# Make dashboard executable
chmod +x "$DASHBOARD_PATH"
echo -e "${GREEN}✓${NC} Made dashboard.js executable"

# Add mdash alias to shell config
add_alias() {
  local rc_file="$1"
  local alias_line="alias mdash=\"$DASHBOARD_PATH\""
  
  if [ -f "$rc_file" ]; then
    if grep -q "alias mdash=" "$rc_file" 2>/dev/null; then
      echo -e "${GREEN}✓${NC} mdash alias already exists in $(basename "$rc_file")"
    else
      echo "" >> "$rc_file"
      echo "# Morning Dashboard" >> "$rc_file"
      echo "$alias_line" >> "$rc_file"
      echo -e "${GREEN}✓${NC} Added mdash alias to $(basename "$rc_file")"
    fi
    return 0
  fi
  return 1
}

# Try zsh first, then bash
if add_alias "$HOME/.zshrc"; then
  SHELL_RC="~/.zshrc"
elif add_alias "$HOME/.bashrc"; then
  SHELL_RC="~/.bashrc"
elif add_alias "$HOME/.bash_profile"; then
  SHELL_RC="~/.bash_profile"
else
  echo -e "${YELLOW}⚠${NC} Could not find shell config file. Add this manually:"
  echo "  alias mdash=\"$DASHBOARD_PATH\""
  SHELL_RC=""
fi

# Create config directory and copy example config
echo
if [ ! -d "$CONFIG_DIR" ]; then
  mkdir -p "$CONFIG_DIR"
  echo -e "${GREEN}✓${NC} Created config directory: $CONFIG_DIR"
fi

if [ ! -f "$CONFIG_DIR/config.json" ]; then
  cp "$SCRIPT_DIR/config.example.json" "$CONFIG_DIR/config.json"
  echo -e "${GREEN}✓${NC} Created config file: $CONFIG_DIR/config.json"
else
  echo -e "${GREEN}✓${NC} Config file already exists: $CONFIG_DIR/config.json"
fi

# Check dependencies
echo
echo -e "${BOLD}Checking dependencies...${NC}"

check_dep() {
  local name="$1"
  local cmd="$2"
  local install_hint="$3"
  
  if command -v "$cmd" &> /dev/null; then
    echo -e "${GREEN}✓${NC} $name"
    return 0
  else
    echo -e "${YELLOW}○${NC} $name (optional) - $install_hint"
    return 1
  fi
}

check_dep "gog (Gmail/Calendar)" "gog" "brew install steipete/tap/gogcli"
check_dep "gh (GitHub CLI)" "gh" "brew install gh"
check_dep "curl (Weather)" "curl" "usually pre-installed"

# Check Todoist
if [ -f "$HOME/clawd/skills/todoist/scripts/todoist" ]; then
  echo -e "${GREEN}✓${NC} Todoist CLI"
else
  echo -e "${YELLOW}○${NC} Todoist CLI (optional) - check TODOIST_API_TOKEN"
fi

# Optional: Install launchd plist for scheduled runs (macOS only)
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo
  echo -e "${BOLD}Scheduled runs (optional)${NC}"
  read -p "Install launchd agent for 7:30 AM daily runs? [y/N] " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    PLIST_SRC="$SCRIPT_DIR/com.andreisuslov.morning-dashboard.plist"
    PLIST_DST="$HOME/Library/LaunchAgents/com.andreisuslov.morning-dashboard.plist"
    
    # Detect node path
    NODE_PATH=$(which node)
    
    # Update paths in plist to match current installation
    sed -e "s|/Users/ansuslov/projects/morning-dashboard|$SCRIPT_DIR|g" \
        -e "s|/opt/homebrew/bin/node|$NODE_PATH|g" \
        -e "s|/Users/ansuslov|$HOME|g" \
        "$PLIST_SRC" > "$PLIST_DST"
    
    # Unload if already loaded, then load
    launchctl unload "$PLIST_DST" 2>/dev/null || true
    launchctl load "$PLIST_DST"
    
    echo -e "${GREEN}✓${NC} Installed launchd agent (runs daily at 7:30 AM)"
    echo -e "  ${CYAN}Logs: /tmp/morning-dashboard.log${NC}"
  fi
fi

# Summary
echo
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}✨ Installation complete!${NC}"
echo
echo -e "${BOLD}Quick start:${NC}"
echo -e "  ${CYAN}mdash${NC}              Run the full dashboard"
echo -e "  ${CYAN}mdash --compact${NC}    Compact mode"
echo -e "  ${CYAN}mdash --help${NC}       Show all options"
echo
echo -e "${BOLD}Configuration:${NC}"
echo -e "  ${CYAN}$CONFIG_DIR/config.json${NC}"
echo
if [ -n "$SHELL_RC" ]; then
  echo -e "${BOLD}To use mdash now:${NC}"
  echo -e "  ${CYAN}source $SHELL_RC${NC}"
  echo
fi
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
