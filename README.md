# ☀️ Morning Dashboard

A lightweight terminal-based productivity dashboard that aggregates your tasks, calendar, and emails into a single view.

![Dashboard Preview](preview.png)

## Features

- **📋 Tasks** — Today's and overdue tasks from Todoist, sorted by priority
- **📅 Calendar** — Today's events from Google Calendar
- **📧 Inbox** — Recent unread emails from Gmail
- **🎨 Beautiful** — Clean ASCII box-drawing with color-coded sections
- **⚡ Fast** — Lightweight Node.js script, no heavy dependencies
- **🔄 Scheduled** — Runs automatically every morning (with launchd)

## Prerequisites

- **Node.js** 18+
- **gog** — Google Workspace CLI ([install](https://gogcli.sh))
- **todoist** — Todoist CLI (see setup below)

### Setting up gog

```bash
# Install via Homebrew
brew install steipete/tap/gogcli

# Authenticate
gog auth credentials /path/to/client_secret.json
gog auth add your@gmail.com --services gmail,calendar
```

### Setting up Todoist

The dashboard uses the Todoist CLI from `~/clawd/skills/todoist/scripts/todoist`.

```bash
# Set your API token
export TODOIST_API_TOKEN="your_token_here"

# Or add to your shell profile (~/.zshrc or ~/.bashrc)
echo 'export TODOIST_API_TOKEN="your_token"' >> ~/.zshrc
```

## Installation

```bash
# Clone the repo
git clone https://github.com/andreisuslov/morning-dashboard.git
cd morning-dashboard

# Run the install script
./install.sh
```

This will:
- Make the dashboard executable
- Add `mdash` alias to your shell config (~/.zshrc or ~/.bashrc)
- Optionally install the launchd agent for scheduled 7:30 AM runs

### Manual Installation

```bash
chmod +x dashboard.js
echo 'alias mdash="~/path/to/morning-dashboard/dashboard.js"' >> ~/.zshrc
source ~/.zshrc
```

## Usage

```bash
mdash       # Run the dashboard
```

## Scheduling (macOS)

The dashboard can run every morning at 7:30 AM. If your Mac is asleep or off, it will run when you wake/boot it.

### Install the Launch Agent

```bash
# Copy the launchd plist
cp com.andreisuslov.morning-dashboard.plist ~/Library/LaunchAgents/

# Load it
launchctl load ~/Library/LaunchAgents/com.andreisuslov.morning-dashboard.plist

# Check status
launchctl list | grep morning-dashboard
```

### Uninstall

```bash
launchctl unload ~/Library/LaunchAgents/com.andreisuslov.morning-dashboard.plist
rm ~/Library/LaunchAgents/com.andreisuslov.morning-dashboard.plist
```

## Configuration

Edit `dashboard.js` to customize:

```javascript
const CONFIG = {
  gmail: {
    maxEmails: 10,
    query: 'is:unread newer_than:3d',  // Gmail search query
  },
  calendar: {
    id: 'primary',  // or a specific calendar ID
  },
  todoist: {
    cliPath: '~/clawd/skills/todoist/scripts/todoist',
  },
  display: {
    width: 80,
    maxTasksShown: 15,
    maxEmailsShown: 8,
    maxEventsShown: 10,
  },
};
```

## Output

The dashboard displays a clean, color-coded view in your terminal:

```
  ☀️  Good morning!
  Monday, January 19, 2026 • 7:30 AM

════════════════════════════════════════════════════════════════════════════════

╭───────────────────────── 📋 TASKS (5) ─────────────────────────╮
│ ● [OVERDUE] Review Q4 report (yesterday)                       │
│ ● Prepare presentation slides (today)                          │
│ ○ Reply to client email (today)                                │
│ ○ Schedule team standup (today)                                │
│ ○ Update project documentation (today)                         │
╰────────────────────────────────────────────────────────────────╯

╭───────────────────────── 📅 CALENDAR (3) ──────────────────────╮
│ ALL DAY    Company Holiday                                     │
│ 9:00 AM    Team standup                                        │
│ 2:00 PM    Client call                                         │
│            📍 Zoom Meeting                                     │
╰────────────────────────────────────────────────────────────────╯

╭───────────────────────── 📧 INBOX (4 unread) ──────────────────╮
│ John Smith           Re: Project update                        │
│ GitHub               [repo] New pull request                   │
│ Calendar             Invitation: Team sync                     │
│ Todoist              Weekly productivity report                │
╰────────────────────────────────────────────────────────────────╯

════════════════════════════════════════════════════════════════════════════════

  Today: 5 tasks • 3 events • 4 emails
```

## Integrating with Clawdbot

Add a cron job to show the dashboard via Clawdbot:

```javascript
{
  "id": "morning-dashboard",
  "schedule": "30 7 * * *",
  "runOnWake": true,
  "prompt": "Run the morning dashboard and show me the results"
}
```

## License

MIT © Andrei Suslov
