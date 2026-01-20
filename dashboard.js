#!/usr/bin/env node

/**
 * Morning Dashboard
 * A lightweight productivity dashboard that aggregates:
 * - Gmail (unread/important emails)
 * - Google Calendar (today's events)
 * - Todoist (tasks due today + overdue)
 */

const { execSync } = require('child_process');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────────────────────

const CONFIG = {
  gmail: {
    maxEmails: 10,
    query: 'is:unread newer_than:3d',
  },
  calendar: {
    id: 'primary',
  },
  todoist: {
    cliPath: path.join(process.env.HOME, 'clawd/skills/todoist/scripts/todoist'),
  },
  display: {
    width: 80,
    maxTasksShown: 15,
    maxEmailsShown: 8,
    maxEventsShown: 10,
  },
};

// ─── ANSI Colors ─────────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
};

// ─── Utilities ───────────────────────────────────────────────────────────────

function exec(cmd, silent = true) {
  try {
    const result = execSync(cmd, {
      encoding: 'utf-8',
      stdio: silent ? ['pipe', 'pipe', 'pipe'] : 'inherit',
      timeout: 30000,
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
  return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

function padRight(str, len) {
  return (str || '').padEnd(len);
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
  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

// ─── Box Drawing ─────────────────────────────────────────────────────────────

function box(title, content, color = c.cyan) {
  const w = CONFIG.display.width;
  const titleText = ` ${title} `;
  const topPad = Math.floor((w - 4 - titleText.length) / 2);
  const topRemainder = w - 4 - titleText.length - topPad;

  let output = '';
  output += `${color}╭${'─'.repeat(topPad)}${c.bold}${titleText}${c.reset}${color}${'─'.repeat(topRemainder)}╮${c.reset}\n`;

  const lines = content.split('\n');
  for (const line of lines) {
    const visibleLen = line.replace(/\x1b\[[0-9;]*m/g, '').length;
    const padding = Math.max(0, w - 4 - visibleLen);
    output += `${color}│${c.reset} ${line}${' '.repeat(padding)} ${color}│${c.reset}\n`;
  }

  output += `${color}╰${'─'.repeat(w - 2)}╯${c.reset}`;
  return output;
}

function divider(char = '─') {
  return `${c.dim}${char.repeat(CONFIG.display.width)}${c.reset}`;
}

// ─── Data Fetchers ───────────────────────────────────────────────────────────

function fetchEmails() {
  const raw = exec(`gog gmail search '${CONFIG.gmail.query}' --max ${CONFIG.gmail.maxEmails} --json 2>/dev/null`);
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

function fetchCalendarEvents() {
  const { from, to } = getTodayRange();
  const raw = exec(`gog calendar events primary --from "${from}" --to "${to}" --json 2>/dev/null`);
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
    }))
    .sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return new Date(a.start) - new Date(b.start);
    });
}

function fetchTasks() {
  const todoistCli = CONFIG.todoist.cliPath;
  
  // Fetch today's tasks
  const todayRaw = exec(`"${todoistCli}" today 2>/dev/null`);
  const todayTasks = parseJSON(todayRaw) || [];
  
  // Fetch overdue tasks
  const overdueRaw = exec(`"${todoistCli}" overdue 2>/dev/null`);
  const overdueTasks = parseJSON(overdueRaw) || [];
  
  // Combine and deduplicate
  const seen = new Set();
  const allTasks = [];
  
  for (const t of [...overdueTasks, ...todayTasks]) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      allTasks.push({
        id: t.id,
        content: t.content,
        due: t.due?.string || t.due?.date,
        priority: t.priority || 1,
        projectId: t.project_id,
        isOverdue: overdueTasks.some(o => o.id === t.id),
      });
    }
  }
  
  // Sort by priority (higher first), then overdue first
  return allTasks.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return b.priority - a.priority;
  });
}

// ─── Renderers ───────────────────────────────────────────────────────────────

function renderHeader() {
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
  console.log();
  console.log(divider('═'));
}

function renderTasks(tasks) {
  if (!tasks.length) {
    console.log(box('📋 TASKS', `${c.dim}No tasks due today. Enjoy your day!${c.reset}`, c.green));
    return;
  }

  const lines = [];
  const shown = tasks.slice(0, CONFIG.display.maxTasksShown);
  
  for (const task of shown) {
    const priorityIcon = task.priority === 4 ? `${c.red}●${c.reset}` :
                         task.priority === 3 ? `${c.yellow}●${c.reset}` :
                         task.priority === 2 ? `${c.blue}●${c.reset}` :
                         `${c.dim}○${c.reset}`;
    
    const overdueTag = task.isOverdue ? `${c.red}[OVERDUE]${c.reset} ` : '';
    const dueStr = task.due ? `${c.dim}(${task.due})${c.reset}` : '';
    
    const contentWidth = CONFIG.display.width - 12;
    const content = truncate(task.content, contentWidth);
    
    lines.push(`${priorityIcon} ${overdueTag}${content} ${dueStr}`);
  }
  
  if (tasks.length > CONFIG.display.maxTasksShown) {
    lines.push(`${c.dim}  ... and ${tasks.length - CONFIG.display.maxTasksShown} more tasks${c.reset}`);
  }

  console.log(box(`📋 TASKS (${tasks.length})`, lines.join('\n'), c.yellow));
}

function renderCalendar(events) {
  if (!events.length) {
    console.log(box('📅 CALENDAR', `${c.dim}No events scheduled for today.${c.reset}`, c.blue));
    return;
  }

  const lines = [];
  const shown = events.slice(0, CONFIG.display.maxEventsShown);
  
  for (const event of shown) {
    let timeStr;
    if (event.allDay) {
      timeStr = `${c.magenta}ALL DAY${c.reset}`;
    } else {
      timeStr = `${c.cyan}${formatTime(event.start)}${c.reset}`;
    }
    
    const contentWidth = CONFIG.display.width - 18;
    const summary = truncate(event.summary, contentWidth);
    
    lines.push(`${padRight(timeStr.replace(/\x1b\[[0-9;]*m/g, '').length < 10 ? timeStr : timeStr, 12)} ${summary}`);
    
    if (event.location) {
      lines.push(`${c.dim}            📍 ${truncate(event.location, contentWidth - 3)}${c.reset}`);
    }
  }
  
  if (events.length > CONFIG.display.maxEventsShown) {
    lines.push(`${c.dim}  ... and ${events.length - CONFIG.display.maxEventsShown} more events${c.reset}`);
  }

  console.log(box(`📅 CALENDAR (${events.length})`, lines.join('\n'), c.blue));
}

function renderEmails(emails) {
  if (!emails.length) {
    console.log(box('📧 INBOX', `${c.dim}No unread emails. Inbox zero! 🎉${c.reset}`, c.magenta));
    return;
  }

  const lines = [];
  const shown = emails.slice(0, CONFIG.display.maxEmailsShown);
  
  for (const email of shown) {
    const fromWidth = 20;
    const subjectWidth = CONFIG.display.width - fromWidth - 8;
    
    const from = truncate(email.from, fromWidth);
    const subject = truncate(email.subject, subjectWidth);
    
    lines.push(`${c.cyan}${padRight(from, fromWidth)}${c.reset} ${subject}`);
  }
  
  if (emails.length > CONFIG.display.maxEmailsShown) {
    lines.push(`${c.dim}  ... and ${emails.length - CONFIG.display.maxEmailsShown} more emails${c.reset}`);
  }

  console.log(box(`📧 INBOX (${emails.length} unread)`, lines.join('\n'), c.magenta));
}

function renderFooter(stats) {
  console.log(divider('═'));
  console.log();
  
  const summary = [];
  if (stats.tasks > 0) summary.push(`${c.yellow}${stats.tasks} tasks${c.reset}`);
  if (stats.events > 0) summary.push(`${c.blue}${stats.events} events${c.reset}`);
  if (stats.emails > 0) summary.push(`${c.magenta}${stats.emails} emails${c.reset}`);
  
  if (summary.length) {
    console.log(`${c.dim}  Today:${c.reset} ${summary.join(' • ')}`);
  } else {
    console.log(`${c.green}  ✨ All clear! Have a great day.${c.reset}`);
  }
  console.log();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  
  if (isDryRun) {
    console.log(`${c.dim}[Dry run mode - using sample data]${c.reset}`);
  }

  // Clear screen for clean display
  console.clear();
  
  renderHeader();
  console.log();

  // Fetch all data in parallel (sort of - we use sync calls but could be made async)
  process.stdout.write(`${c.dim}Loading...${c.reset}`);
  
  const tasks = fetchTasks();
  const events = fetchCalendarEvents();
  const emails = fetchEmails();
  
  // Clear the loading message
  process.stdout.write('\r' + ' '.repeat(20) + '\r');

  // Render sections
  renderTasks(tasks);
  console.log();
  renderCalendar(events);
  console.log();
  renderEmails(emails);
  console.log();
  
  renderFooter({
    tasks: tasks.length,
    events: events.length,
    emails: emails.length,
  });
}

main().catch(console.error);
