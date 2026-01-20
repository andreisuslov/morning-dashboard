#!/usr/bin/env node

/**
 * Morning Dashboard v2.1
 * A comprehensive morning productivity dashboard
 * 
 * Features:
 * - Gmail unread emails
 * - Google Calendar events
 * - Todoist tasks (today + overdue + upcoming)
 * - Weather forecast
 * - Motivational quotes
 * - GitHub notifications
 * - Focus time suggestions
 * - System health (battery)
 * - Web GUI mode
 * - Configurable via file or CLI flags
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

// ─── Version ─────────────────────────────────────────────────────────────────

const VERSION = '2.1.0';

// ─── Default Configuration ───────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  gmail: {
    enabled: true,
    maxEmails: 10,
    query: 'is:unread newer_than:3d',
  },
  calendar: {
    enabled: true,
    id: 'primary',
    showFocusTime: true,
    lookaheadDays: 1,
  },
  todoist: {
    enabled: true,
    cliPath: path.join(os.homedir(), 'clawd/skills/todoist/scripts/todoist'),
    showUpcoming: true,
    upcomingDays: 7,
  },
  weather: {
    enabled: true,
    location: '',
    units: 'imperial',
  },
  quote: {
    enabled: true,
  },
  github: {
    enabled: true,
    maxNotifications: 5,
  },
  system: {
    enabled: true,
    showBattery: true,
  },
  gui: {
    port: 3141,
    autoRefresh: true,
    refreshInterval: 300, // seconds
    theme: 'auto', // 'light', 'dark', 'auto'
  },
  display: {
    width: 80,
    maxTasksShown: 12,
    maxEmailsShown: 6,
    maxEventsShown: 8,
    compact: false,
    color: true,
    showGreeting: true,
    showSummary: true,
  },
};

// ─── Load Configuration ──────────────────────────────────────────────────────

function loadConfig() {
  const configPaths = [
    path.join(os.homedir(), '.config/morning-dashboard/config.json'),
    path.join(os.homedir(), '.morning-dashboard.json'),
    path.join(__dirname, 'config.json'),
  ];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return deepMerge(DEFAULT_CONFIG, userConfig);
      } catch (e) {
        console.error(`Warning: Could not parse config at ${configPath}`);
      }
    }
  }

  return DEFAULT_CONFIG;
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// ─── CLI Arguments ───────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    help: false,
    version: false,
    compact: false,
    json: false,
    noColor: false,
    sections: [],
    configPath: null,
    gui: false,
    port: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-v':
      case '--version':
        options.version = true;
        break;
      case '-c':
      case '--compact':
        options.compact = true;
        break;
      case '-j':
      case '--json':
        options.json = true;
        break;
      case '--no-color':
        options.noColor = true;
        break;
      case '-s':
      case '--section':
        if (args[i + 1]) {
          options.sections.push(args[++i]);
        }
        break;
      case '--config':
        if (args[i + 1]) {
          options.configPath = args[++i];
        }
        break;
      case '--tasks':
        options.sections.push('tasks');
        break;
      case '--calendar':
        options.sections.push('calendar');
        break;
      case '--email':
        options.sections.push('email');
        break;
      case '--weather':
        options.sections.push('weather');
        break;
      case '--github':
        options.sections.push('github');
        break;
      case 'gui':
      case '--gui':
        options.gui = true;
        break;
      case '-p':
      case '--port':
        if (args[i + 1]) {
          options.port = parseInt(args[++i], 10);
        }
        break;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
☀️  Morning Dashboard v${VERSION}

Usage: mdash [options]
       mdash gui [--port <port>]

Options:
  -h, --help          Show this help message
  -v, --version       Show version number
  -c, --compact       Compact output mode
  -j, --json          Output as JSON
  --no-color          Disable colors
  --config <path>     Use custom config file
  
Section filters (show only specific sections):
  --tasks             Show only tasks
  --calendar          Show only calendar
  --email             Show only emails
  --weather           Show only weather
  --github            Show only GitHub notifications
  -s, --section <name>  Show specific section (repeatable)

GUI mode:
  gui                 Launch web dashboard in browser
  --port, -p <port>   Server port (default: 3141)

Configuration:
  Config file locations (in order of priority):
    ~/.config/morning-dashboard/config.json
    ~/.morning-dashboard.json
    ./config.json

Examples:
  mdash                    Full dashboard
  mdash --compact          Compact view
  mdash --tasks --calendar Tasks and calendar only
  mdash --json             JSON output for scripting
  mdash gui                Open web dashboard
  mdash gui --port 8080    Open on custom port
`);
}

// ─── ANSI Colors ─────────────────────────────────────────────────────────────

let useColor = true;

const colors = {
  reset: () => useColor ? '\x1b[0m' : '',
  bold: () => useColor ? '\x1b[1m' : '',
  dim: () => useColor ? '\x1b[2m' : '',
  italic: () => useColor ? '\x1b[3m' : '',
  red: () => useColor ? '\x1b[31m' : '',
  green: () => useColor ? '\x1b[32m' : '',
  yellow: () => useColor ? '\x1b[33m' : '',
  blue: () => useColor ? '\x1b[34m' : '',
  magenta: () => useColor ? '\x1b[35m' : '',
  cyan: () => useColor ? '\x1b[36m' : '',
  white: () => useColor ? '\x1b[37m' : '',
  gray: () => useColor ? '\x1b[90m' : '',
  bgBlue: () => useColor ? '\x1b[44m' : '',
  bgGreen: () => useColor ? '\x1b[42m' : '',
  bgYellow: () => useColor ? '\x1b[43m' : '',
  bgRed: () => useColor ? '\x1b[41m' : '',
};

const c = new Proxy(colors, {
  get: (target, prop) => target[prop] ? target[prop]() : '',
});

// ─── Utilities ───────────────────────────────────────────────────────────────

function exec(cmd, options = {}) {
  try {
    const result = execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: options.timeout || 15000,
      ...options,
    });
    return result.trim();
  } catch (e) {
    return null;
  }
}

function parseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function truncate(str, len) {
  if (!str) return '';
  str = String(str);
  return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

function padRight(str, len) {
  return (str || '').toString().padEnd(len);
}

function padLeft(str, len) {
  return (str || '').toString().padStart(len);
}

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function formatTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatRelativeTime(date) {
  const now = new Date();
  const diff = date - now;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  
  if (mins < 0) return 'now';
  if (mins < 60) return `in ${mins}m`;
  if (hours < 24) return `in ${hours}h ${mins % 60}m`;
  return `in ${Math.floor(hours / 24)}d`;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

function getDateRange(days) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return { from: start.toISOString(), to: end.toISOString() };
}

// ─── Box Drawing ─────────────────────────────────────────────────────────────

function box(title, content, color = c.cyan, config) {
  const w = config.display.width;
  const titleText = ` ${title} `;
  const topPad = Math.floor((w - 4 - stripAnsi(titleText).length) / 2);
  const topRemainder = w - 4 - stripAnsi(titleText).length - topPad;

  let output = '';
  output += `${color}╭${'─'.repeat(topPad)}${c.bold}${titleText}${c.reset}${color}${'─'.repeat(topRemainder)}╮${c.reset}\n`;

  const lines = content.split('\n');
  for (const line of lines) {
    const visibleLen = stripAnsi(line).length;
    const padding = Math.max(0, w - 4 - visibleLen);
    output += `${color}│${c.reset} ${line}${' '.repeat(padding)} ${color}│${c.reset}\n`;
  }

  output += `${color}╰${'─'.repeat(w - 2)}╯${c.reset}`;
  return output;
}

function divider(config, char = '─') {
  return `${c.dim}${char.repeat(config.display.width)}${c.reset}`;
}

// ─── Motivational Quotes ─────────────────────────────────────────────────────

const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It's not about having time, it's about making time.", author: "Unknown" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { text: "Small daily improvements are the key to staggering long-term results.", author: "Unknown" },
  { text: "Productivity is never an accident. It is always the result of commitment to excellence.", author: "Paul J. Meyer" },
  { text: "Either you run the day or the day runs you.", author: "Jim Rohn" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "Amateurs sit and wait for inspiration, the rest of us just get up and go to work.", author: "Stephen King" },
  { text: "Your future is created by what you do today, not tomorrow.", author: "Robert Kiyosaki" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "If you want to make an easy job seem mighty hard, just keep putting off doing it.", author: "Olin Miller" },
  { text: "Eat a live frog first thing in the morning and nothing worse will happen to you the rest of the day.", author: "Mark Twain" },
  { text: "Until we can manage time, we can manage nothing else.", author: "Peter Drucker" },
  { text: "Time is what we want most, but what we use worst.", author: "William Penn" },
  { text: "You can do anything, but not everything.", author: "David Allen" },
  { text: "Simplicity boils down to two steps: Identify the essential. Eliminate the rest.", author: "Leo Babauta" },
  { text: "What gets measured gets managed.", author: "Peter Drucker" },
  { text: "Plans are nothing; planning is everything.", author: "Dwight D. Eisenhower" },
  { text: "The key is not to prioritize what's on your schedule, but to schedule your priorities.", author: "Stephen Covey" },
  { text: "Efficiency is doing things right. Effectiveness is doing the right things.", author: "Peter Drucker" },
  { text: "There is nothing so useless as doing efficiently that which should not be done at all.", author: "Peter Drucker" },
  { text: "Working on the right thing is probably more important than working hard.", author: "Caterina Fake" },
  { text: "It is not enough to be busy; so are the ants. The question is: What are we busy about?", author: "Henry David Thoreau" },
  { text: "Time is more valuable than money. You can get more money, but you cannot get more time.", author: "Jim Rohn" },
];

function getDailyQuote() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return QUOTES[dayOfYear % QUOTES.length];
}

// ─── Data Fetchers ───────────────────────────────────────────────────────────

function fetchEmails(config) {
  if (!config.gmail.enabled) return [];
  
  const raw = exec(`gog gmail search '${config.gmail.query}' --max ${config.gmail.maxEmails} --json 2>/dev/null`);
  const emails = parseJSON(raw);
  if (!emails || !Array.isArray(emails)) return [];
  
  return emails.map(e => ({
    id: e.id,
    from: e.from?.split('<')[0]?.trim() || e.from || 'Unknown',
    subject: e.subject || '(no subject)',
    date: e.date,
    snippet: e.snippet,
  }));
}

function fetchCalendarEvents(config) {
  if (!config.calendar.enabled) return [];
  
  const { from, to } = getDateRange(config.calendar.lookaheadDays);
  const raw = exec(`gog calendar events ${config.calendar.id} --from "${from}" --to "${to}" --json 2>/dev/null`);
  const events = parseJSON(raw);
  if (!events || !Array.isArray(events)) return [];

  return events
    .map(e => ({
      id: e.id,
      summary: e.summary || '(no title)',
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      location: e.location,
      allDay: !e.start?.dateTime,
      meetLink: e.hangoutLink || e.conferenceData?.entryPoints?.[0]?.uri,
    }))
    .sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return new Date(a.start) - new Date(b.start);
    });
}

function fetchTasks(config) {
  if (!config.todoist.enabled) return { today: [], overdue: [], upcoming: [] };
  
  const cli = config.todoist.cliPath;
  
  const todayRaw = exec(`"${cli}" today 2>/dev/null`);
  const todayTasks = parseJSON(todayRaw) || [];
  
  const overdueRaw = exec(`"${cli}" overdue 2>/dev/null`);
  const overdueTasks = parseJSON(overdueRaw) || [];
  
  let upcomingTasks = [];
  if (config.todoist.showUpcoming) {
    const upcomingRaw = exec(`"${cli}" upcoming 2>/dev/null`);
    upcomingTasks = parseJSON(upcomingRaw) || [];
  }
  
  const mapTask = (t, isOverdue = false) => ({
    id: t.id,
    content: t.content,
    description: t.description,
    due: t.due?.string || t.due?.date,
    dueDate: t.due?.date,
    priority: t.priority || 1,
    projectId: t.project_id,
    labels: t.labels || [],
    isOverdue,
  });

  const seen = new Set();
  const dedup = (tasks, isOverdue = false) => {
    const result = [];
    for (const t of tasks) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        result.push(mapTask(t, isOverdue));
      }
    }
    return result;
  };

  return {
    overdue: dedup(overdueTasks, true),
    today: dedup(todayTasks),
    upcoming: dedup(upcomingTasks.filter(t => {
      if (!t.due?.date) return true;
      const today = new Date().toISOString().split('T')[0];
      return t.due.date > today;
    })),
  };
}

function fetchWeather(config) {
  if (!config.weather.enabled) return null;
  
  const location = config.weather.location || '';
  
  const raw = exec(`curl -s "wttr.in/${encodeURIComponent(location)}?format=j1" 2>/dev/null`, { timeout: 5000 });
  const data = parseJSON(raw);
  
  if (!data || !data.current_condition?.[0]) return null;
  
  const current = data.current_condition[0];
  const today = data.weather?.[0];
  
  const tempKey = config.weather.units === 'metric' ? 'temp_C' : 'temp_F';
  const feelsKey = config.weather.units === 'metric' ? 'FeelsLikeC' : 'FeelsLikeF';
  const minKey = config.weather.units === 'metric' ? 'mintempC' : 'mintempF';
  const maxKey = config.weather.units === 'metric' ? 'maxtempC' : 'maxtempF';
  const unit = config.weather.units === 'metric' ? '°C' : '°F';
  
  return {
    location: data.nearest_area?.[0]?.areaName?.[0]?.value || location || 'Unknown',
    condition: current.weatherDesc?.[0]?.value || 'Unknown',
    temp: current[tempKey],
    feelsLike: current[feelsKey],
    humidity: current.humidity,
    windSpeed: config.weather.units === 'metric' ? current.windspeedKmph : current.windspeedMiles,
    windUnit: config.weather.units === 'metric' ? 'km/h' : 'mph',
    high: today?.[maxKey],
    low: today?.[minKey],
    unit,
    sunrise: today?.astronomy?.[0]?.sunrise,
    sunset: today?.astronomy?.[0]?.sunset,
    uvIndex: current.uvIndex,
    chanceOfRain: today?.hourly?.[Math.floor(new Date().getHours() / 3)]?.chanceofrain || '0',
  };
}

function fetchGitHubNotifications(config) {
  if (!config.github.enabled) return [];
  
  const ghCheck = exec('which gh 2>/dev/null');
  if (!ghCheck) return [];
  
  const raw = exec(`gh api notifications --jq '.[] | {id: .id, reason: .reason, title: .subject.title, type: .subject.type, repo: .repository.full_name, unread: .unread}' 2>/dev/null`);
  if (!raw) return [];
  
  const notifications = raw.split('\n')
    .filter(line => line.trim())
    .map(line => parseJSON(line))
    .filter(n => n && n.unread)
    .slice(0, config.github.maxNotifications);
  
  return notifications;
}

function fetchSystemHealth(config) {
  if (!config.system.enabled) return null;
  
  const health = {};
  
  if (config.system.showBattery && process.platform === 'darwin') {
    const batteryRaw = exec('pmset -g batt 2>/dev/null');
    if (batteryRaw) {
      const match = batteryRaw.match(/(\d+)%/);
      const charging = batteryRaw.includes('charging') || batteryRaw.includes('AC Power');
      if (match) {
        health.battery = {
          percent: parseInt(match[1]),
          charging,
        };
      }
    }
  }
  
  return Object.keys(health).length > 0 ? health : null;
}

function calculateFocusTime(events, config) {
  if (!config.calendar.showFocusTime || events.length === 0) return [];
  
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(18, 0, 0, 0);
  
  if (now >= endOfDay) return [];
  
  const todayEvents = events
    .filter(e => !e.allDay && new Date(e.start) >= now && new Date(e.start) < endOfDay)
    .sort((a, b) => new Date(a.start) - new Date(b.start));
  
  const focusBlocks = [];
  let currentTime = new Date(Math.max(now, new Date().setHours(9, 0, 0, 0)));
  
  for (const event of todayEvents) {
    const eventStart = new Date(event.start);
    if (eventStart > currentTime) {
      const duration = (eventStart - currentTime) / 60000;
      if (duration >= 30) {
        focusBlocks.push({
          start: new Date(currentTime),
          end: eventStart,
          duration,
        });
      }
    }
    currentTime = new Date(Math.max(currentTime, new Date(event.end)));
  }
  
  if (currentTime < endOfDay) {
    const duration = (endOfDay - currentTime) / 60000;
    if (duration >= 30) {
      focusBlocks.push({
        start: new Date(currentTime),
        end: endOfDay,
        duration,
      });
    }
  }
  
  return focusBlocks.slice(0, 3);
}

function fetchAllData(config) {
  const emails = fetchEmails(config);
  const events = fetchCalendarEvents(config);
  const taskData = fetchTasks(config);
  const weather = fetchWeather(config);
  const github = fetchGitHubNotifications(config);
  const systemHealth = fetchSystemHealth(config);
  const focusBlocks = calculateFocusTime(events, config);
  const quote = getDailyQuote();
  
  return {
    timestamp: new Date().toISOString(),
    greeting: getGreeting(),
    quote,
    tasks: taskData,
    calendar: { events, focusBlocks },
    email: emails,
    weather,
    github,
    system: systemHealth,
  };
}

// ─── Terminal Renderers ──────────────────────────────────────────────────────

function renderHeader(config, weather, systemHealth) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  console.log();
  console.log(`${c.bold}${c.cyan}  ☀️  ${getGreeting()}!${c.reset}`);
  console.log(`${c.dim}  ${dateStr} • ${timeStr}${c.reset}`);
  
  if (weather) {
    const weatherIcon = getWeatherIcon(weather.condition);
    console.log(`${c.dim}  ${weatherIcon} ${weather.temp}${weather.unit} (feels ${weather.feelsLike}${weather.unit}) • ${weather.condition}${c.reset}`);
  }
  
  if (systemHealth?.battery && systemHealth.battery.percent <= 20 && !systemHealth.battery.charging) {
    console.log(`${c.yellow}  ⚠️  Battery low: ${systemHealth.battery.percent}%${c.reset}`);
  }
  
  console.log();
  console.log(divider(config, '═'));
}

function getWeatherIcon(condition) {
  const cond = (condition || '').toLowerCase();
  if (cond.includes('sun') || cond.includes('clear')) return '☀️';
  if (cond.includes('cloud') && cond.includes('part')) return '⛅';
  if (cond.includes('cloud') || cond.includes('overcast')) return '☁️';
  if (cond.includes('rain') || cond.includes('drizzle')) return '🌧️';
  if (cond.includes('thunder') || cond.includes('storm')) return '⛈️';
  if (cond.includes('snow')) return '🌨️';
  if (cond.includes('fog') || cond.includes('mist')) return '🌫️';
  if (cond.includes('wind')) return '💨';
  return '🌡️';
}

function renderQuote(config) {
  if (!config.quote.enabled) return;
  
  const quote = getDailyQuote();
  const maxWidth = config.display.width - 8;
  
  const words = quote.text.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxWidth) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  
  console.log();
  console.log(`${c.dim}${c.italic}  "${lines.join('\n   ')}"${c.reset}`);
  console.log(`${c.dim}   — ${quote.author}${c.reset}`);
}

function renderTasks(taskData, config) {
  const { overdue, today, upcoming } = taskData;
  const allTasks = [...overdue, ...today];
  
  if (allTasks.length === 0 && upcoming.length === 0) {
    console.log(box('📋 TASKS', `${c.dim}No tasks due today. Enjoy your day!${c.reset}`, c.green, config));
    return;
  }

  const lines = [];
  const maxShown = config.display.maxTasksShown;
  
  const sorted = allTasks.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return b.priority - a.priority;
  });
  
  const shown = sorted.slice(0, maxShown);
  
  for (const task of shown) {
    const priorityIcon = task.priority === 4 ? `${c.red}●${c.reset}` :
                         task.priority === 3 ? `${c.yellow}●${c.reset}` :
                         task.priority === 2 ? `${c.blue}●${c.reset}` :
                         `${c.dim}○${c.reset}`;
    
    const overdueTag = task.isOverdue ? `${c.red}[OVERDUE]${c.reset} ` : '';
    const dueStr = task.due ? `${c.dim}(${task.due})${c.reset}` : '';
    
    const contentWidth = config.display.width - 16;
    const content = truncate(task.content, contentWidth);
    
    lines.push(`${priorityIcon} ${overdueTag}${content} ${dueStr}`);
  }
  
  if (allTasks.length > maxShown) {
    lines.push(`${c.dim}  ... and ${allTasks.length - maxShown} more tasks${c.reset}`);
  }
  
  if (config.todoist.showUpcoming && upcoming.length > 0) {
    lines.push('');
    lines.push(`${c.dim}── Upcoming ──${c.reset}`);
    for (const task of upcoming.slice(0, 3)) {
      const content = truncate(task.content, config.display.width - 20);
      lines.push(`${c.dim}  ○ ${content} (${task.due || task.dueDate})${c.reset}`);
    }
    if (upcoming.length > 3) {
      lines.push(`${c.dim}    ... and ${upcoming.length - 3} more upcoming${c.reset}`);
    }
  }

  const title = `📋 TASKS (${allTasks.length} today${overdue.length > 0 ? `, ${c.red}${overdue.length} overdue${c.reset}` : ''})`;
  console.log(box(title, lines.join('\n'), c.yellow, config));
}

function renderCalendar(events, focusBlocks, config) {
  if (events.length === 0) {
    console.log(box('📅 CALENDAR', `${c.dim}No events scheduled for today.${c.reset}`, c.blue, config));
    return;
  }

  const lines = [];
  const shown = events.slice(0, config.display.maxEventsShown);
  const now = new Date();
  
  const nextEvent = events.find(e => !e.allDay && new Date(e.start) > now);
  
  for (const event of shown) {
    let timeStr;
    const isNext = nextEvent && event.id === nextEvent.id;
    const isPast = !event.allDay && new Date(event.end) < now;
    
    if (event.allDay) {
      timeStr = `${c.magenta}ALL DAY${c.reset} `;
    } else {
      const time = formatTime(event.start);
      const relative = isNext ? ` ${c.green}← ${formatRelativeTime(new Date(event.start))}${c.reset}` : '';
      timeStr = `${isPast ? c.dim : c.cyan}${padRight(time, 8)}${c.reset}${relative}`;
    }
    
    const contentWidth = config.display.width - 24;
    const summary = truncate(event.summary, contentWidth);
    const dimStyle = isPast ? c.dim : '';
    
    lines.push(`${dimStyle}${timeStr} ${summary}${c.reset}`);
    
    if (event.location && !config.display.compact) {
      lines.push(`${c.dim}         📍 ${truncate(event.location, contentWidth - 3)}${c.reset}`);
    }
    
    if (event.meetLink && !config.display.compact) {
      lines.push(`${c.dim}         🔗 ${truncate(event.meetLink, contentWidth - 3)}${c.reset}`);
    }
  }
  
  if (events.length > config.display.maxEventsShown) {
    lines.push(`${c.dim}  ... and ${events.length - config.display.maxEventsShown} more events${c.reset}`);
  }
  
  if (focusBlocks.length > 0 && !config.display.compact) {
    lines.push('');
    lines.push(`${c.green}── Focus Time ──${c.reset}`);
    for (const block of focusBlocks) {
      const startTime = formatTime(block.start.toISOString());
      const duration = block.duration >= 60 
        ? `${Math.floor(block.duration / 60)}h ${block.duration % 60}m`
        : `${block.duration}m`;
      lines.push(`${c.green}  ◆ ${startTime} — ${duration} available${c.reset}`);
    }
  }

  console.log(box(`📅 CALENDAR (${events.length})`, lines.join('\n'), c.blue, config));
}

function renderEmails(emails, config) {
  if (emails.length === 0) {
    console.log(box('📧 INBOX', `${c.dim}No unread emails. Inbox zero! 🎉${c.reset}`, c.magenta, config));
    return;
  }

  const lines = [];
  const shown = emails.slice(0, config.display.maxEmailsShown);
  
  for (const email of shown) {
    const fromWidth = 18;
    const subjectWidth = config.display.width - fromWidth - 8;
    
    const from = truncate(email.from, fromWidth);
    const subject = truncate(email.subject, subjectWidth);
    
    lines.push(`${c.cyan}${padRight(from, fromWidth)}${c.reset} ${subject}`);
  }
  
  if (emails.length > config.display.maxEmailsShown) {
    lines.push(`${c.dim}  ... and ${emails.length - config.display.maxEmailsShown} more emails${c.reset}`);
  }

  console.log(box(`📧 INBOX (${emails.length} unread)`, lines.join('\n'), c.magenta, config));
}

function renderGitHub(notifications, config) {
  if (notifications.length === 0) return;

  const lines = [];
  
  const typeIcons = {
    PullRequest: '🔀',
    Issue: '🐛',
    Release: '🏷️',
    Discussion: '💬',
    default: '📌',
  };
  
  for (const n of notifications) {
    const icon = typeIcons[n.type] || typeIcons.default;
    const repo = truncate(n.repo, 20);
    const title = truncate(n.title, config.display.width - 30);
    lines.push(`${icon} ${c.dim}${repo}${c.reset} ${title}`);
  }

  console.log(box(`🐙 GITHUB (${notifications.length})`, lines.join('\n'), c.gray, config));
}

function renderFooter(stats, config) {
  console.log(divider(config, '═'));
  console.log();
  
  const summary = [];
  if (stats.overdueTasks > 0) summary.push(`${c.red}${stats.overdueTasks} overdue${c.reset}`);
  if (stats.todayTasks > 0) summary.push(`${c.yellow}${stats.todayTasks} tasks${c.reset}`);
  if (stats.events > 0) summary.push(`${c.blue}${stats.events} events${c.reset}`);
  if (stats.emails > 0) summary.push(`${c.magenta}${stats.emails} emails${c.reset}`);
  if (stats.github > 0) summary.push(`${c.gray}${stats.github} notifications${c.reset}`);
  
  if (summary.length) {
    console.log(`${c.dim}  Today:${c.reset} ${summary.join(' • ')}`);
  } else {
    console.log(`${c.green}  ✨ All clear! Have a great day.${c.reset}`);
  }
  console.log();
}

// ─── Web GUI ─────────────────────────────────────────────────────────────────

function generateHTML(data, config) {
  const weatherIcon = data.weather ? getWeatherIconEmoji(data.weather.condition) : '🌡️';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Morning Dashboard</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>☀️</text></svg>">
  <style>
    :root {
      --bg: #0d1117;
      --bg-card: #161b22;
      --bg-hover: #21262d;
      --border: #30363d;
      --text: #e6edf3;
      --text-muted: #8b949e;
      --text-dim: #6e7681;
      --accent: #58a6ff;
      --green: #3fb950;
      --yellow: #d29922;
      --red: #f85149;
      --purple: #a371f7;
      --pink: #db61a2;
      --orange: #f0883e;
    }
    
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f6f8fa;
        --bg-card: #ffffff;
        --bg-hover: #f3f4f6;
        --border: #d0d7de;
        --text: #1f2328;
        --text-muted: #656d76;
        --text-dim: #8c959f;
        --accent: #0969da;
        --green: #1a7f37;
        --yellow: #9a6700;
        --red: #cf222e;
        --purple: #8250df;
        --pink: #bf3989;
        --orange: #bc4c00;
      }
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      min-height: 100vh;
      padding: 2rem;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    /* Header */
    .header {
      text-align: center;
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
    }
    
    .greeting {
      font-size: 2rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    
    .greeting .sun {
      display: inline-block;
      animation: pulse 2s ease-in-out infinite;
    }
    
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
    
    .date-time {
      color: var(--text-muted);
      font-size: 1.1rem;
      margin-bottom: 0.5rem;
    }
    
    .weather-line {
      color: var(--text-muted);
      font-size: 1rem;
    }
    
    .weather-line .temp {
      color: var(--text);
      font-weight: 500;
    }
    
    /* Quote */
    .quote {
      text-align: center;
      margin-bottom: 2rem;
      padding: 1rem 2rem;
      font-style: italic;
      color: var(--text-muted);
    }
    
    .quote-text {
      font-size: 1.1rem;
      margin-bottom: 0.5rem;
    }
    
    .quote-author {
      font-size: 0.9rem;
      color: var(--text-dim);
    }
    
    /* Grid */
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    
    /* Cards */
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }
    
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--border);
      background: var(--bg-hover);
    }
    
    .card-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 600;
      font-size: 0.95rem;
    }
    
    .card-count {
      background: var(--accent);
      color: white;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.15rem 0.5rem;
      border-radius: 10px;
    }
    
    .card-count.warning {
      background: var(--red);
    }
    
    .card-body {
      padding: 0;
      max-height: 400px;
      overflow-y: auto;
    }
    
    .card-body::-webkit-scrollbar {
      width: 6px;
    }
    
    .card-body::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 3px;
    }
    
    .empty-state {
      padding: 2rem;
      text-align: center;
      color: var(--text-muted);
    }
    
    .empty-state .emoji {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    
    /* Items */
    .item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.875rem 1.25rem;
      border-bottom: 1px solid var(--border);
      transition: background 0.15s;
    }
    
    .item:last-child {
      border-bottom: none;
    }
    
    .item:hover {
      background: var(--bg-hover);
    }
    
    .item-icon {
      flex-shrink: 0;
      width: 20px;
      text-align: center;
    }
    
    .item-content {
      flex: 1;
      min-width: 0;
    }
    
    .item-title {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .item-meta {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: 0.125rem;
    }
    
    .item-badge {
      flex-shrink: 0;
      font-size: 0.75rem;
      padding: 0.125rem 0.5rem;
      border-radius: 6px;
      font-weight: 500;
    }
    
    /* Task specific */
    .priority-4 { color: var(--red); }
    .priority-3 { color: var(--yellow); }
    .priority-2 { color: var(--accent); }
    .priority-1 { color: var(--text-dim); }
    
    .overdue-badge {
      background: rgba(248, 81, 73, 0.15);
      color: var(--red);
    }
    
    /* Event specific */
    .event-time {
      font-size: 0.85rem;
      color: var(--accent);
      font-weight: 500;
      min-width: 70px;
    }
    
    .event-time.all-day {
      color: var(--purple);
    }
    
    .event-time.past {
      color: var(--text-dim);
    }
    
    .event-location {
      font-size: 0.8rem;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 0.25rem;
      margin-top: 0.25rem;
    }
    
    .next-badge {
      background: rgba(63, 185, 80, 0.15);
      color: var(--green);
    }
    
    /* Focus time */
    .focus-section {
      padding: 1rem 1.25rem;
      border-top: 1px solid var(--border);
      background: rgba(63, 185, 80, 0.05);
    }
    
    .focus-title {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--green);
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .focus-block {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      color: var(--text-muted);
      padding: 0.25rem 0;
    }
    
    .focus-block .time {
      color: var(--green);
      font-weight: 500;
    }
    
    /* Email specific */
    .email-from {
      font-weight: 500;
      color: var(--accent);
    }
    
    /* GitHub specific */
    .gh-repo {
      color: var(--text-muted);
      font-size: 0.85rem;
    }
    
    /* Weather card */
    .weather-card {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      padding: 1.25rem;
    }
    
    .weather-main {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    
    .weather-icon {
      font-size: 3rem;
    }
    
    .weather-temp {
      font-size: 2.5rem;
      font-weight: 600;
    }
    
    .weather-condition {
      color: var(--text-muted);
    }
    
    .weather-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
      font-size: 0.9rem;
    }
    
    .weather-detail {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-muted);
    }
    
    .weather-detail .label {
      color: var(--text-dim);
    }
    
    /* Footer */
    .footer {
      text-align: center;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      color: var(--text-muted);
    }
    
    .summary {
      display: flex;
      justify-content: center;
      gap: 1.5rem;
      flex-wrap: wrap;
      margin-bottom: 1rem;
    }
    
    .summary-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .summary-count {
      font-weight: 600;
      font-size: 1.25rem;
    }
    
    .summary-label {
      font-size: 0.9rem;
    }
    
    .summary-item.overdue .summary-count { color: var(--red); }
    .summary-item.tasks .summary-count { color: var(--yellow); }
    .summary-item.events .summary-count { color: var(--accent); }
    .summary-item.emails .summary-count { color: var(--purple); }
    .summary-item.github .summary-count { color: var(--text-muted); }
    
    .refresh-info {
      font-size: 0.85rem;
      color: var(--text-dim);
    }
    
    .refresh-btn {
      background: var(--bg-hover);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      margin-left: 0.5rem;
      transition: background 0.15s;
    }
    
    .refresh-btn:hover {
      background: var(--border);
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      body {
        padding: 1rem;
      }
      
      .grid {
        grid-template-columns: 1fr;
      }
      
      .greeting {
        font-size: 1.5rem;
      }
      
      .weather-card {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1 class="greeting"><span class="sun">☀️</span> ${data.greeting}!</h1>
      <div class="date-time">${formatDateLong(new Date())} • ${formatTimeLong(new Date())}</div>
      ${data.weather ? `
        <div class="weather-line">
          ${weatherIcon} <span class="temp">${data.weather.temp}${data.weather.unit}</span> 
          (feels like ${data.weather.feelsLike}${data.weather.unit}) • ${data.weather.condition}
        </div>
      ` : ''}
    </header>
    
    ${config.quote.enabled ? `
      <div class="quote">
        <div class="quote-text">"${data.quote.text}"</div>
        <div class="quote-author">— ${data.quote.author}</div>
      </div>
    ` : ''}
    
    <div class="grid">
      <!-- Tasks -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📋 Tasks</div>
          ${data.tasks.overdue.length > 0 ? `<span class="card-count warning">${data.tasks.overdue.length} overdue</span>` : ''}
          ${data.tasks.today.length > 0 ? `<span class="card-count">${data.tasks.today.length} today</span>` : ''}
        </div>
        <div class="card-body">
          ${[...data.tasks.overdue, ...data.tasks.today].length === 0 ? `
            <div class="empty-state">
              <div class="emoji">✨</div>
              <div>No tasks due today. Enjoy!</div>
            </div>
          ` : [...data.tasks.overdue, ...data.tasks.today].map(task => `
            <div class="item">
              <div class="item-icon priority-${task.priority}">${task.priority >= 3 ? '●' : '○'}</div>
              <div class="item-content">
                <div class="item-title">${escapeHtml(task.content)}</div>
                ${task.due ? `<div class="item-meta">${escapeHtml(task.due)}</div>` : ''}
              </div>
              ${task.isOverdue ? '<span class="item-badge overdue-badge">Overdue</span>' : ''}
            </div>
          `).join('')}
          ${data.tasks.upcoming.length > 0 ? `
            <div class="focus-section" style="background: rgba(88, 166, 255, 0.05);">
              <div class="focus-title" style="color: var(--accent);">Upcoming</div>
              ${data.tasks.upcoming.slice(0, 3).map(task => `
                <div class="focus-block">
                  <span>○</span>
                  <span>${escapeHtml(task.content)}</span>
                  <span style="color: var(--text-dim);">(${escapeHtml(task.due || task.dueDate || '')})</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
      
      <!-- Calendar -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📅 Calendar</div>
          ${data.calendar.events.length > 0 ? `<span class="card-count">${data.calendar.events.length}</span>` : ''}
        </div>
        <div class="card-body">
          ${data.calendar.events.length === 0 ? `
            <div class="empty-state">
              <div class="emoji">📭</div>
              <div>No events scheduled</div>
            </div>
          ` : data.calendar.events.map((event, i) => {
            const now = new Date();
            const isPast = !event.allDay && new Date(event.end) < now;
            const isNext = !isPast && !event.allDay && data.calendar.events.slice(0, i).every(e => e.allDay || new Date(e.end) < now);
            return `
              <div class="item">
                <div class="event-time ${event.allDay ? 'all-day' : ''} ${isPast ? 'past' : ''}">
                  ${event.allDay ? 'All day' : formatTimeLong(new Date(event.start))}
                </div>
                <div class="item-content">
                  <div class="item-title" ${isPast ? 'style="color: var(--text-dim);"' : ''}>${escapeHtml(event.summary)}</div>
                  ${event.location ? `<div class="event-location">📍 ${escapeHtml(event.location)}</div>` : ''}
                  ${event.meetLink ? `<div class="event-location"><a href="${escapeHtml(event.meetLink)}" target="_blank" style="color: var(--accent);">🔗 Join meeting</a></div>` : ''}
                </div>
                ${isNext ? '<span class="item-badge next-badge">Next</span>' : ''}
              </div>
            `;
          }).join('')}
          ${data.calendar.focusBlocks.length > 0 ? `
            <div class="focus-section">
              <div class="focus-title">◆ Focus Time</div>
              ${data.calendar.focusBlocks.map(block => `
                <div class="focus-block">
                  <span class="time">${formatTimeLong(new Date(block.start))}</span>
                  <span>—</span>
                  <span>${formatDuration(block.duration)} available</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
      
      <!-- Email -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📧 Inbox</div>
          ${data.email.length > 0 ? `<span class="card-count">${data.email.length} unread</span>` : ''}
        </div>
        <div class="card-body">
          ${data.email.length === 0 ? `
            <div class="empty-state">
              <div class="emoji">🎉</div>
              <div>Inbox zero!</div>
            </div>
          ` : data.email.map(email => `
            <div class="item">
              <div class="item-icon">✉️</div>
              <div class="item-content">
                <div class="item-title">${escapeHtml(email.subject)}</div>
                <div class="item-meta email-from">${escapeHtml(email.from)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- GitHub -->
      ${data.github.length > 0 ? `
        <div class="card">
          <div class="card-header">
            <div class="card-title">🐙 GitHub</div>
            <span class="card-count">${data.github.length}</span>
          </div>
          <div class="card-body">
            ${data.github.map(n => `
              <div class="item">
                <div class="item-icon">${n.type === 'PullRequest' ? '🔀' : n.type === 'Issue' ? '🐛' : n.type === 'Release' ? '🏷️' : '📌'}</div>
                <div class="item-content">
                  <div class="item-title">${escapeHtml(n.title)}</div>
                  <div class="item-meta gh-repo">${escapeHtml(n.repo)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <!-- Weather Details -->
      ${data.weather ? `
        <div class="card">
          <div class="card-header">
            <div class="card-title">🌤️ Weather</div>
          </div>
          <div class="weather-card">
            <div class="weather-main">
              <div class="weather-icon">${weatherIcon}</div>
              <div>
                <div class="weather-temp">${data.weather.temp}${data.weather.unit}</div>
                <div class="weather-condition">${data.weather.condition}</div>
              </div>
            </div>
            <div class="weather-details">
              <div class="weather-detail"><span class="label">Feels like</span> ${data.weather.feelsLike}${data.weather.unit}</div>
              <div class="weather-detail"><span class="label">High/Low</span> ${data.weather.high}° / ${data.weather.low}°</div>
              <div class="weather-detail"><span class="label">Humidity</span> ${data.weather.humidity}%</div>
              <div class="weather-detail"><span class="label">Wind</span> ${data.weather.windSpeed} ${data.weather.windUnit}</div>
              ${data.weather.chanceOfRain && parseInt(data.weather.chanceOfRain) > 0 ? `<div class="weather-detail"><span class="label">Rain</span> ${data.weather.chanceOfRain}%</div>` : ''}
              ${data.weather.sunrise ? `<div class="weather-detail"><span class="label">Sun</span> ↑${data.weather.sunrise} ↓${data.weather.sunset}</div>` : ''}
            </div>
          </div>
        </div>
      ` : ''}
    </div>
    
    <footer class="footer">
      <div class="summary">
        ${data.tasks.overdue.length > 0 ? `<div class="summary-item overdue"><span class="summary-count">${data.tasks.overdue.length}</span><span class="summary-label">overdue</span></div>` : ''}
        ${data.tasks.today.length > 0 ? `<div class="summary-item tasks"><span class="summary-count">${data.tasks.today.length}</span><span class="summary-label">tasks</span></div>` : ''}
        ${data.calendar.events.length > 0 ? `<div class="summary-item events"><span class="summary-count">${data.calendar.events.length}</span><span class="summary-label">events</span></div>` : ''}
        ${data.email.length > 0 ? `<div class="summary-item emails"><span class="summary-count">${data.email.length}</span><span class="summary-label">emails</span></div>` : ''}
        ${data.github.length > 0 ? `<div class="summary-item github"><span class="summary-count">${data.github.length}</span><span class="summary-label">notifications</span></div>` : ''}
      </div>
      <div class="refresh-info">
        Last updated: ${formatTimeLong(new Date())}
        <button class="refresh-btn" onclick="location.reload()">↻ Refresh</button>
      </div>
      ${config.gui.autoRefresh ? `
        <script>
          setTimeout(() => location.reload(), ${config.gui.refreshInterval * 1000});
        </script>
      ` : ''}
    </footer>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDateLong(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTimeLong(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDuration(minutes) {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${minutes}m`;
}

function getWeatherIconEmoji(condition) {
  const cond = (condition || '').toLowerCase();
  if (cond.includes('sun') || cond.includes('clear')) return '☀️';
  if (cond.includes('cloud') && cond.includes('part')) return '⛅';
  if (cond.includes('cloud') || cond.includes('overcast')) return '☁️';
  if (cond.includes('rain') || cond.includes('drizzle')) return '🌧️';
  if (cond.includes('thunder') || cond.includes('storm')) return '⛈️';
  if (cond.includes('snow')) return '🌨️';
  if (cond.includes('fog') || cond.includes('mist')) return '🌫️';
  if (cond.includes('wind')) return '💨';
  return '🌡️';
}

function startGUIServer(config, port) {
  const server = http.createServer((req, res) => {
    if (req.url === '/api/data') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      const data = fetchAllData(config);
      res.end(JSON.stringify(data));
    } else {
      res.setHeader('Content-Type', 'text/html');
      const data = fetchAllData(config);
      res.end(generateHTML(data, config));
    }
  });
  
  server.listen(port, '127.0.0.1', () => {
    const url = `http://localhost:${port}`;
    console.log(`\n☀️  Morning Dashboard GUI`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Server running at: ${url}`);
    console.log(`API endpoint: ${url}/api/data`);
    console.log(`\nPress Ctrl+C to stop\n`);
    
    // Open browser
    const openCmd = process.platform === 'darwin' ? 'open' :
                    process.platform === 'win32' ? 'start' : 'xdg-open';
    try {
      spawn(openCmd, [url], { detached: true, stdio: 'ignore' }).unref();
    } catch (e) {
      console.log(`Open ${url} in your browser`);
    }
  });
  
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`\nError: Port ${port} is already in use.`);
      console.log(`Try: mdash gui --port ${port + 1}\n`);
      process.exit(1);
    }
    throw e;
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  
  if (args.version) {
    console.log(`morning-dashboard v${VERSION}`);
    process.exit(0);
  }
  
  if (args.help) {
    showHelp();
    process.exit(0);
  }
  
  let config = loadConfig();
  
  if (args.configPath && fs.existsSync(args.configPath)) {
    const customConfig = parseJSON(fs.readFileSync(args.configPath, 'utf-8'));
    if (customConfig) {
      config = deepMerge(config, customConfig);
    }
  }
  
  // GUI mode
  if (args.gui) {
    const port = args.port || config.gui.port;
    startGUIServer(config, port);
    return;
  }
  
  // Terminal mode
  if (args.compact) config.display.compact = true;
  if (args.noColor) config.display.color = false;
  
  useColor = config.display.color && !args.json;
  
  const showAll = args.sections.length === 0;
  const shouldShow = (section) => showAll || args.sections.includes(section);

  const data = fetchAllData(config);

  // JSON output
  if (args.json) {
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
  }

  // Terminal output
  if (!args.compact && showAll) {
    console.clear();
  }
  
  if (config.display.showGreeting && showAll) {
    renderHeader(config, data.weather, data.system);
  }
  
  if (config.quote.enabled && showAll && !config.display.compact) {
    renderQuote(config);
  }
  
  console.log();

  if (shouldShow('tasks')) {
    renderTasks(data.tasks, config);
    console.log();
  }
  
  if (shouldShow('calendar')) {
    renderCalendar(data.calendar.events, data.calendar.focusBlocks, config);
    console.log();
  }
  
  if (shouldShow('email')) {
    renderEmails(data.email, config);
    console.log();
  }
  
  if (shouldShow('github') && data.github.length > 0) {
    renderGitHub(data.github, config);
    console.log();
  }
  
  if (config.display.showSummary && showAll) {
    renderFooter({
      overdueTasks: data.tasks.overdue.length,
      todayTasks: data.tasks.today.length,
      events: data.calendar.events.length,
      emails: data.email.length,
      github: data.github.length,
    }, config);
  }
}

main().catch(console.error);
