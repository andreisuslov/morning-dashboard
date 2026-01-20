# ☀️ Morning Dashboard

A lightweight morning productivity dashboard that aggregates your tasks, calendar, emails, weather, and more into a single beautiful view — available as both a **terminal CLI** and a **web GUI**.

```
  ☀️  Good morning!
  Monday, January 20, 2026 • 7:30 AM
  🌤️ 45°F (feels 42°F) • Partly cloudy

════════════════════════════════════════════════════════════════════════════════

  "The secret of getting ahead is getting started."
   — Mark Twain

╭─────────────────────── 📋 TASKS (5 today, 1 overdue) ─────────────────────────╮
│ ● [OVERDUE] Review Q4 report (yesterday)                                     │
│ ● Prepare presentation slides (today)                                        │
│ ○ Reply to client email (today)                                              │
│ ○ Schedule team standup (today)                                              │
│                                                                              │
│ ── Upcoming ──                                                               │
│   ○ Submit expense report (tomorrow)                                         │
│   ○ Dentist appointment (Jan 25)                                             │
╰──────────────────────────────────────────────────────────────────────────────╯

╭──────────────────────────── 📅 CALENDAR (4) ─────────────────────────────────╮
│ ALL DAY  Company Holiday                                                     │
│ 9:00 AM  Team standup ← in 1h 30m                                            │
│ 2:00 PM  Client call                                                         │
│          📍 Zoom Meeting                                                     │
│          🔗 https://zoom.us/j/123456                                         │
│                                                                              │
│ ── Focus Time ──                                                             │
│   ◆ 10:00 AM — 3h 45m available                                              │
│   ◆ 3:30 PM — 2h 30m available                                               │
╰──────────────────────────────────────────────────────────────────────────────╯

╭─────────────────────────── 📧 INBOX (3 unread) ──────────────────────────────╮
│ John Smith         Re: Project update                                        │
│ GitHub             [repo] New pull request #42                               │
│ Calendar           Invitation: Team sync                                     │
╰──────────────────────────────────────────────────────────────────────────────╯

╭──────────────────────────── 🐙 GITHUB (2) ───────────────────────────────────╮
│ 🔀 user/repo            Fix authentication bug                               │
│ 🐛 user/other-repo      Feature request: dark mode                           │
╰──────────────────────────────────────────────────────────────────────────────╯

════════════════════════════════════════════════════════════════════════════════

  Today: 1 overdue • 5 tasks • 4 events • 3 emails • 2 notifications
```

## ✨ Features

| Feature | Description |
|---------|-------------|
| **📋 Tasks** | Today's and overdue tasks from Todoist, color-coded by priority |
| **📅 Calendar** | Today's events from Google Calendar with meeting links |
| **📧 Email** | Unread emails from Gmail |
| **🌤️ Weather** | Current conditions and forecast (no API key needed) |
| **💬 Quotes** | Daily motivational quote to start your day |
| **🐙 GitHub** | Unread notifications (PRs, issues, releases) |
| **⏰ Focus Time** | Suggested focus blocks based on calendar gaps |
| **🔋 System** | Battery warnings when low |
| **🖥️ Web GUI** | Beautiful browser-based dashboard with `mdash gui` |
| **⚙️ Configurable** | JSON config file + CLI flags |
| **📦 Lightweight** | Pure Node.js, zero dependencies |

## 📋 Prerequisites

- **Node.js** 18+ 
- **[gog](https://gogcli.sh)** — Google Workspace CLI (for Gmail & Calendar)
- **[todoist](https://github.com/your/todoist-cli)** — Todoist CLI (for tasks)
- **[gh](https://cli.github.com)** — GitHub CLI (optional, for notifications)
- **curl** — For weather data (usually pre-installed)

### Quick Setup

```bash
# Install gog (Google Workspace CLI)
brew install steipete/tap/gogcli
gog auth add your@gmail.com --services gmail,calendar

# Set Todoist API token
export TODOIST_API_TOKEN="your_token_here"

# Install GitHub CLI (optional)
brew install gh
gh auth login
```

## 🚀 Installation

```bash
# Clone the repo
git clone https://github.com/andreisuslov/morning-dashboard.git
cd morning-dashboard

# Run the install script
./install.sh
```

The install script will:
- Make the dashboard executable
- Add `mdash` alias to your shell (~/.zshrc or ~/.bashrc)
- Optionally install launchd agent for scheduled runs

### Manual Installation

```bash
chmod +x dashboard.js

# Add to your shell config
echo 'alias mdash="~/path/to/morning-dashboard/dashboard.js"' >> ~/.zshrc
source ~/.zshrc
```

## 📖 Usage

### Terminal Mode

```bash
# Run the full dashboard
mdash

# Compact mode (less detail)
mdash --compact
mdash -c

# Show only specific sections
mdash --tasks
mdash --calendar
mdash --email
mdash --weather
mdash --github
mdash --tasks --calendar  # Multiple sections

# JSON output (for scripting)
mdash --json
mdash --json | jq '.tasks.overdue'

# Disable colors (for piping)
mdash --no-color

# Use custom config
mdash --config /path/to/config.json

# Help & version
mdash --help
mdash --version
```

### Web GUI Mode

```bash
# Launch web dashboard (opens browser automatically)
mdash gui

# Use custom port
mdash gui --port 8080
mdash gui -p 8080
```

The web GUI features:
- 🌓 **Auto dark/light mode** based on system preference
- 🔄 **Auto-refresh** every 5 minutes (configurable)
- 📱 **Responsive design** works on mobile
- 🔗 **Clickable meeting links** in calendar events
- 🎨 **Beautiful cards** with smooth animations

**API Endpoint:** `http://localhost:3141/api/data` returns JSON for custom integrations.

## ⚙️ Configuration

Create a config file at one of these locations (in order of priority):

1. `~/.config/morning-dashboard/config.json`
2. `~/.morning-dashboard.json`
3. `./config.json` (in the dashboard directory)

### Example Configuration

```json
{
  "gmail": {
    "enabled": true,
    "maxEmails": 10,
    "query": "is:unread newer_than:3d"
  },
  "calendar": {
    "enabled": true,
    "id": "primary",
    "showFocusTime": true,
    "lookaheadDays": 1
  },
  "todoist": {
    "enabled": true,
    "showUpcoming": true,
    "upcomingDays": 7
  },
  "weather": {
    "enabled": true,
    "location": "New York",
    "units": "imperial"
  },
  "quote": {
    "enabled": true
  },
  "github": {
    "enabled": true,
    "maxNotifications": 5
  },
  "system": {
    "enabled": true,
    "showBattery": true
  },
  "display": {
    "width": 80,
    "maxTasksShown": 12,
    "maxEmailsShown": 6,
    "maxEventsShown": 8,
    "compact": false,
    "color": true,
    "showGreeting": true,
    "showSummary": true
  }
}
```

### Configuration Options

#### Gmail (`gmail`)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable Gmail section |
| `maxEmails` | number | `10` | Maximum emails to fetch |
| `query` | string | `"is:unread newer_than:3d"` | Gmail search query |

**Common Gmail Queries:**
- `is:unread` — All unread
- `is:unread is:important` — Unread & important
- `is:unread newer_than:1d` — Unread from last 24h
- `is:unread -category:promotions` — Unread, no promos

#### Calendar (`calendar`)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable Calendar section |
| `id` | string | `"primary"` | Calendar ID (use `primary` or specific ID) |
| `showFocusTime` | boolean | `true` | Show suggested focus time blocks |
| `lookaheadDays` | number | `1` | Days to look ahead (1 = today only) |

#### Todoist (`todoist`)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable Tasks section |
| `cliPath` | string | `~/clawd/.../todoist` | Path to Todoist CLI |
| `showUpcoming` | boolean | `true` | Show upcoming tasks section |
| `upcomingDays` | number | `7` | Days to look ahead for upcoming |

#### Weather (`weather`)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable weather |
| `location` | string | `""` | Location (empty = auto-detect by IP) |
| `units` | string | `"imperial"` | `"imperial"` (°F) or `"metric"` (°C) |

**Location Examples:**
- `"New York"` — City name
- `"NYC"` — City code
- `"10001"` — ZIP code
- `"40.7,-74.0"` — Coordinates
- `""` — Auto-detect by IP

#### GitHub (`github`)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable GitHub notifications |
| `maxNotifications` | number | `5` | Max notifications to show |

#### Quote (`quote`)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Show daily motivational quote |

#### System (`system`)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable system health checks |
| `showBattery` | boolean | `true` | Show battery warning if low |

#### GUI (`gui`)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | number | `3141` | Web server port |
| `autoRefresh` | boolean | `true` | Auto-refresh the page |
| `refreshInterval` | number | `300` | Refresh interval in seconds |
| `theme` | string | `"auto"` | `"auto"`, `"light"`, or `"dark"` |

#### Display (`display`)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `width` | number | `80` | Dashboard width in characters |
| `maxTasksShown` | number | `12` | Max tasks to display |
| `maxEmailsShown` | number | `6` | Max emails to display |
| `maxEventsShown` | number | `8` | Max calendar events to display |
| `compact` | boolean | `false` | Compact mode (less detail) |
| `color` | boolean | `true` | Enable ANSI colors |
| `showGreeting` | boolean | `true` | Show greeting header |
| `showSummary` | boolean | `true` | Show summary footer |

## ⏰ Scheduled Runs

### macOS (launchd)

The install script can set up automatic runs at 7:30 AM:

```bash
./install.sh  # Select 'y' when prompted for launchd

# Manual setup:
cp com.andreisuslov.morning-dashboard.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.andreisuslov.morning-dashboard.plist

# Check status
launchctl list | grep morning-dashboard

# Uninstall
launchctl unload ~/Library/LaunchAgents/com.andreisuslov.morning-dashboard.plist
rm ~/Library/LaunchAgents/com.andreisuslov.morning-dashboard.plist
```

### Linux (cron)

```bash
# Edit crontab
crontab -e

# Add line (runs at 7:30 AM, outputs to terminal)
30 7 * * * /path/to/morning-dashboard/dashboard.js

# Or save to file
30 7 * * * /path/to/morning-dashboard/dashboard.js > /tmp/morning-dashboard.txt 2>&1
```

### Clawdbot Integration

```javascript
// Add to Clawdbot cron jobs
{
  "name": "morning-dashboard",
  "schedule": { "kind": "cron", "expr": "30 7 * * *" },
  "runOnWake": true,
  "payload": {
    "kind": "agentTurn",
    "message": "Run ~/projects/morning-dashboard/dashboard.js and summarize my day",
    "deliver": true
  }
}
```

## 🎨 Customization

### Disable Sections

Set any section's `enabled` to `false`:

```json
{
  "github": { "enabled": false },
  "quote": { "enabled": false }
}
```

### Wide Terminal

```json
{
  "display": {
    "width": 120,
    "maxTasksShown": 20,
    "maxEmailsShown": 10
  }
}
```

### Minimal Mode

```json
{
  "quote": { "enabled": false },
  "github": { "enabled": false },
  "system": { "enabled": false },
  "calendar": { "showFocusTime": false },
  "todoist": { "showUpcoming": false },
  "display": {
    "compact": true,
    "showGreeting": false
  }
}
```

### Work vs Personal

Create multiple configs:

```bash
# Work dashboard
mdash --config ~/.config/morning-dashboard/work.json

# Personal dashboard  
mdash --config ~/.config/morning-dashboard/personal.json
```

## 📊 JSON Output

Use `--json` for scripting and integrations:

```bash
# Full JSON output
mdash --json

# Extract specific data with jq
mdash --json | jq '.tasks.overdue'
mdash --json | jq '.calendar.events[] | .summary'
mdash --json | jq '.weather.temp'

# Count items
mdash --json | jq '.tasks.today | length'
```

### JSON Schema

```json
{
  "timestamp": "2026-01-20T12:30:00.000Z",
  "tasks": {
    "overdue": [{ "id": "123", "content": "...", "priority": 4, ... }],
    "today": [...],
    "upcoming": [...]
  },
  "calendar": {
    "events": [{ "id": "...", "summary": "...", "start": "...", ... }],
    "focusBlocks": [{ "start": "...", "end": "...", "duration": 120 }]
  },
  "email": [{ "id": "...", "from": "...", "subject": "...", ... }],
  "weather": {
    "location": "New York",
    "condition": "Partly cloudy",
    "temp": "45",
    "unit": "°F",
    ...
  },
  "github": [{ "id": "...", "type": "PullRequest", "title": "...", ... }],
  "system": {
    "battery": { "percent": 85, "charging": false }
  }
}
```

## 🔧 Troubleshooting

### "No tasks" but I have tasks

1. Check Todoist CLI is working: `~/clawd/skills/todoist/scripts/todoist today`
2. Ensure `TODOIST_API_TOKEN` is set
3. Check the CLI path in config matches your installation

### "No emails" but I have unread mail

1. Check gog is authenticated: `gog auth list`
2. Test manually: `gog gmail search "is:unread" --max 5`
3. Try a broader query in config

### Weather not showing

1. Weather uses wttr.in (may be blocked by some networks)
2. Test: `curl "wttr.in/?format=j1"`
3. Set explicit location if auto-detect fails

### Colors look wrong

1. Ensure terminal supports ANSI colors
2. Try `mdash --no-color` to disable
3. Set `"color": false` in config

### GitHub notifications not showing

1. Ensure gh CLI is installed: `which gh`
2. Check authentication: `gh auth status`
3. Test: `gh api notifications`

## 📁 Files

```
morning-dashboard/
├── dashboard.js              # Main script
├── install.sh                # Installation script
├── config.example.json       # Example configuration
├── com.andreisuslov.morning-dashboard.plist  # macOS launchd
├── package.json
├── README.md
└── LICENSE
```

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT © Andrei Suslov

---

**Start your day right! ☀️**
