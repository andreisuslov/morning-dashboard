#!/usr/bin/env node

/**
 * Morning Dashboard v2.2
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
 * - Interactive setup wizard
 * - Configurable via file or CLI flags
 */

const { execSync, spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const readline = require('readline');

// ─── Version ─────────────────────────────────────────────────────────────────

const VERSION = '2.2.0';

// ─── Paths ───────────────────────────────────────────────────────────────────

const CONFIG_DIR = path.join(os.homedir(), '.config/morning-dashboard');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const CREDENTIALS_PATH = path.join(CONFIG_DIR, 'credentials.json');

// ─── Default Configuration ───────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  google: {
    enabled: true,
    account: '', // Will be set during setup
  },
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
    apiToken: '', // Will be set during setup
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
    refreshInterval: 300,
    theme: 'auto',
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

// ─── Configuration Management ────────────────────────────────────────────────

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function loadConfig() {
  const configPaths = [
    CONFIG_PATH,
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

function saveConfig(config) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
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
    command: null, // setup, gui, or null for dashboard
    subcommand: null, // status, google, todoist, github
    help: false,
    version: false,
    compact: false,
    json: false,
    noColor: false,
    sections: [],
    configPath: null,
    port: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case 'setup':
        options.command = 'setup';
        if (args[i + 1] && !args[i + 1].startsWith('-')) {
          options.subcommand = args[++i];
        }
        break;
      case 'gui':
        options.command = 'gui';
        break;
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

Usage: 
  mdash                     Show dashboard in terminal
  mdash gui [--port <n>]    Launch web dashboard
  mdash setup [command]     Configure integrations

Dashboard Options:
  -h, --help          Show this help message
  -v, --version       Show version number
  -c, --compact       Compact output mode
  -j, --json          Output as JSON
  --no-color          Disable colors
  --config <path>     Use custom config file
  
Section filters:
  --tasks             Show only tasks
  --calendar          Show only calendar
  --email             Show only emails
  --weather           Show only weather
  --github            Show only GitHub notifications

Setup Commands:
  mdash setup              Interactive setup wizard
  mdash setup status       Show integration status
  mdash setup google       Configure Google (Gmail + Calendar)
  mdash setup todoist      Configure Todoist
  mdash setup github       Configure GitHub
  mdash setup weather      Configure weather location

GUI Options:
  mdash gui                Launch web dashboard
  mdash gui --port 8080    Use custom port (default: 3141)

Configuration:
  Config: ~/.config/morning-dashboard/config.json

Examples:
  mdash                    Full dashboard
  mdash setup              Run setup wizard
  mdash gui                Open web dashboard
  mdash --compact          Compact terminal view
  mdash --json             JSON output for scripting
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
      env: { ...process.env, ...options.env },
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

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function formatTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
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

function getDateRange(days) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return { from: start.toISOString(), to: end.toISOString() };
}

// ─── Setup & Integration Status ──────────────────────────────────────────────

function checkGogInstalled() {
  return exec('which gog 2>/dev/null') !== null;
}

function checkGhInstalled() {
  return exec('which gh 2>/dev/null') !== null;
}

function getGoogleAccounts() {
  if (!checkGogInstalled()) return [];
  const raw = exec('gog auth list --json 2>/dev/null');
  const data = parseJSON(raw);
  return data?.accounts || [];
}

function getGoogleAccountServices(email) {
  const accounts = getGoogleAccounts();
  const account = accounts.find(a => a.email === email);
  return account?.services || [];
}

function checkGoogleSetup(config) {
  if (!checkGogInstalled()) {
    return { installed: false, authenticated: false, account: null, services: [] };
  }
  
  const accounts = getGoogleAccounts();
  const configAccount = config.google?.account;
  
  // Find matching account or use first one
  let account = accounts.find(a => a.email === configAccount);
  if (!account && accounts.length > 0) {
    account = accounts[0];
  }
  
  const hasCalendar = account?.services?.includes('calendar');
  const hasGmail = account?.services?.includes('gmail');
  
  return {
    installed: true,
    authenticated: !!account,
    account: account?.email || null,
    services: account?.services || [],
    hasCalendar,
    hasGmail,
  };
}

function checkTodoistSetup(config) {
  // Check for API token in config or environment
  const token = config.todoist?.apiToken || process.env.TODOIST_API_TOKEN;
  if (!token) {
    return { configured: false, working: false };
  }
  
  // Test the API
  const raw = exec(`curl -s -H "Authorization: Bearer ${token}" "https://api.todoist.com/rest/v2/projects" 2>/dev/null`, { timeout: 5000 });
  const data = parseJSON(raw);
  
  return {
    configured: true,
    working: Array.isArray(data),
    hasToken: !!token,
  };
}

function checkGitHubSetup() {
  if (!checkGhInstalled()) {
    return { installed: false, authenticated: false, user: null };
  }
  
  const raw = exec('gh auth status 2>&1');
  const authenticated = raw?.includes('Logged in to');
  
  let user = null;
  if (authenticated) {
    const userRaw = exec('gh api user --jq .login 2>/dev/null');
    user = userRaw || null;
  }
  
  return { installed: true, authenticated, user };
}

function getIntegrationStatus(config) {
  return {
    google: checkGoogleSetup(config),
    todoist: checkTodoistSetup(config),
    github: checkGitHubSetup(),
    weather: {
      configured: true, // Always available via wttr.in
      location: config.weather?.location || 'auto-detect',
    },
  };
}

// ─── Setup Commands ──────────────────────────────────────────────────────────

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function runSetupStatus(config) {
  console.log(`\n${c.bold}☀️  Morning Dashboard - Integration Status${c.reset}\n`);
  console.log(`${c.dim}${'─'.repeat(50)}${c.reset}`);
  
  const status = getIntegrationStatus(config);
  
  // Google
  console.log(`\n${c.bold}Google (Gmail + Calendar)${c.reset}`);
  if (!status.google.installed) {
    console.log(`  ${c.red}✗${c.reset} gog CLI not installed`);
    console.log(`  ${c.dim}Install: brew install steipete/tap/gogcli${c.reset}`);
  } else if (!status.google.authenticated) {
    console.log(`  ${c.yellow}○${c.reset} Not authenticated`);
    console.log(`  ${c.dim}Run: mdash setup google${c.reset}`);
  } else {
    console.log(`  ${c.green}✓${c.reset} Account: ${status.google.account}`);
    console.log(`  ${c.green}✓${c.reset} Services: ${status.google.services.join(', ')}`);
  }
  
  // Todoist
  console.log(`\n${c.bold}Todoist${c.reset}`);
  if (!status.todoist.configured) {
    console.log(`  ${c.yellow}○${c.reset} API token not configured`);
    console.log(`  ${c.dim}Run: mdash setup todoist${c.reset}`);
  } else if (!status.todoist.working) {
    console.log(`  ${c.red}✗${c.reset} API token invalid or expired`);
    console.log(`  ${c.dim}Run: mdash setup todoist${c.reset}`);
  } else {
    console.log(`  ${c.green}✓${c.reset} Connected and working`);
  }
  
  // GitHub
  console.log(`\n${c.bold}GitHub${c.reset}`);
  if (!status.github.installed) {
    console.log(`  ${c.yellow}○${c.reset} gh CLI not installed (optional)`);
    console.log(`  ${c.dim}Install: brew install gh${c.reset}`);
  } else if (!status.github.authenticated) {
    console.log(`  ${c.yellow}○${c.reset} Not authenticated`);
    console.log(`  ${c.dim}Run: mdash setup github${c.reset}`);
  } else {
    console.log(`  ${c.green}✓${c.reset} Logged in as: ${status.github.user}`);
  }
  
  // Weather
  console.log(`\n${c.bold}Weather${c.reset}`);
  console.log(`  ${c.green}✓${c.reset} Available (no setup required)`);
  console.log(`  ${c.dim}Location: ${status.weather.location}${c.reset}`);
  
  console.log(`\n${c.dim}${'─'.repeat(50)}${c.reset}`);
  console.log(`\nConfig file: ${c.cyan}${CONFIG_PATH}${c.reset}\n`);
}

async function runSetupGoogle(config) {
  console.log(`\n${c.bold}☀️  Google Setup (Gmail + Calendar)${c.reset}\n`);
  
  // Check if gog is installed
  if (!checkGogInstalled()) {
    console.log(`${c.red}✗${c.reset} gog CLI is not installed.\n`);
    console.log(`Install it with:`);
    console.log(`  ${c.cyan}brew install steipete/tap/gogcli${c.reset}\n`);
    
    const install = await prompt('Install now? [y/N] ');
    if (install.toLowerCase() === 'y') {
      console.log(`\nInstalling gog...`);
      try {
        execSync('brew install steipete/tap/gogcli', { stdio: 'inherit' });
        console.log(`\n${c.green}✓${c.reset} gog installed successfully!\n`);
      } catch (e) {
        console.log(`\n${c.red}✗${c.reset} Installation failed. Please install manually.\n`);
        return;
      }
    } else {
      return;
    }
  }
  
  // Check existing accounts
  const accounts = getGoogleAccounts();
  
  if (accounts.length > 0) {
    console.log(`${c.green}✓${c.reset} Found existing Google account(s):\n`);
    accounts.forEach((acc, i) => {
      console.log(`  ${i + 1}. ${acc.email}`);
      console.log(`     Services: ${acc.services.join(', ')}`);
    });
    console.log();
    
    const useExisting = await prompt('Use an existing account? [Y/n] ');
    if (useExisting.toLowerCase() !== 'n') {
      let selectedAccount = accounts[0];
      if (accounts.length > 1) {
        const choice = await prompt(`Select account (1-${accounts.length}): `);
        const idx = parseInt(choice) - 1;
        if (idx >= 0 && idx < accounts.length) {
          selectedAccount = accounts[idx];
        }
      }
      
      // Check if it has required services
      const hasCalendar = selectedAccount.services.includes('calendar');
      const hasGmail = selectedAccount.services.includes('gmail');
      
      if (!hasCalendar || !hasGmail) {
        console.log(`\n${c.yellow}⚠${c.reset} Account is missing some services.`);
        console.log(`  Calendar: ${hasCalendar ? c.green + '✓' : c.red + '✗'}${c.reset}`);
        console.log(`  Gmail: ${hasGmail ? c.green + '✓' : c.red + '✗'}${c.reset}`);
        
        const reauth = await prompt('\nRe-authorize with all services? [Y/n] ');
        if (reauth.toLowerCase() !== 'n') {
          console.log(`\nOpening browser for authorization...`);
          try {
            execSync(`gog auth add ${selectedAccount.email} --services gmail,calendar --force`, { stdio: 'inherit' });
          } catch (e) {
            console.log(`\n${c.red}✗${c.reset} Authorization failed.\n`);
            return;
          }
        }
      }
      
      // Save to config
      config.google = config.google || {};
      config.google.account = selectedAccount.email;
      config.google.enabled = true;
      saveConfig(config);
      
      console.log(`\n${c.green}✓${c.reset} Google configured: ${selectedAccount.email}`);
      console.log(`  Config saved to: ${CONFIG_PATH}\n`);
      return;
    }
  }
  
  // Add new account
  console.log(`\n${c.bold}Add a new Google account${c.reset}\n`);
  console.log(`This will open your browser to authorize Morning Dashboard.`);
  console.log(`The app will request access to Gmail and Calendar.\n`);
  
  // Check for OAuth credentials
  const gogConfigPath = path.join(os.homedir(), 'Library/Application Support/gogcli/config.json');
  let hasCredentials = false;
  
  if (fs.existsSync(gogConfigPath)) {
    const gogConfig = parseJSON(fs.readFileSync(gogConfigPath, 'utf-8'));
    hasCredentials = !!gogConfig?.oauth?.client_id;
  }
  
  if (!hasCredentials) {
    console.log(`${c.yellow}⚠${c.reset} OAuth credentials not found.\n`);
    console.log(`You need to set up Google Cloud OAuth credentials first:`);
    console.log(`  1. Go to ${c.cyan}https://console.cloud.google.com/apis/credentials${c.reset}`);
    console.log(`  2. Create a new OAuth 2.0 Client ID (Desktop app)`);
    console.log(`  3. Download the JSON file`);
    console.log(`  4. Run: ${c.cyan}gog auth credentials /path/to/client_secret.json${c.reset}\n`);
    
    const credPath = await prompt('Path to client_secret.json (or press Enter to skip): ');
    if (credPath) {
      if (fs.existsSync(credPath)) {
        try {
          execSync(`gog auth credentials "${credPath}"`, { stdio: 'inherit' });
          console.log(`\n${c.green}✓${c.reset} Credentials stored.\n`);
        } catch (e) {
          console.log(`\n${c.red}✗${c.reset} Failed to store credentials.\n`);
          return;
        }
      } else {
        console.log(`\n${c.red}✗${c.reset} File not found: ${credPath}\n`);
        return;
      }
    } else {
      return;
    }
  }
  
  const email = await prompt('Google account email: ');
  if (!email || !email.includes('@')) {
    console.log(`\n${c.red}✗${c.reset} Invalid email.\n`);
    return;
  }
  
  console.log(`\nOpening browser for authorization...`);
  try {
    execSync(`gog auth add ${email} --services gmail,calendar`, { stdio: 'inherit' });
  } catch (e) {
    console.log(`\n${c.red}✗${c.reset} Authorization failed.\n`);
    return;
  }
  
  // Save to config
  config.google = config.google || {};
  config.google.account = email;
  config.google.enabled = true;
  saveConfig(config);
  
  console.log(`\n${c.green}✓${c.reset} Google configured: ${email}`);
  console.log(`  Config saved to: ${CONFIG_PATH}\n`);
}

async function runSetupTodoist(config) {
  console.log(`\n${c.bold}☀️  Todoist Setup${c.reset}\n`);
  
  // Check existing setup
  const status = checkTodoistSetup(config);
  if (status.working) {
    console.log(`${c.green}✓${c.reset} Todoist is already configured and working.\n`);
    const reconfigure = await prompt('Reconfigure? [y/N] ');
    if (reconfigure.toLowerCase() !== 'y') {
      return;
    }
  }
  
  console.log(`To get your Todoist API token:`);
  console.log(`  1. Go to ${c.cyan}https://todoist.com/app/settings/integrations/developer${c.reset}`);
  console.log(`  2. Copy your API token\n`);
  
  const openBrowser = await prompt('Open Todoist settings in browser? [Y/n] ');
  if (openBrowser.toLowerCase() !== 'n') {
    const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
    spawn(openCmd, ['https://todoist.com/app/settings/integrations/developer'], { detached: true, stdio: 'ignore' }).unref();
    console.log();
  }
  
  const token = await prompt('Paste your API token: ');
  if (!token) {
    console.log(`\n${c.red}✗${c.reset} No token provided.\n`);
    return;
  }
  
  // Verify token
  console.log(`\nVerifying token...`);
  const raw = exec(`curl -s -H "Authorization: Bearer ${token}" "https://api.todoist.com/rest/v2/projects" 2>/dev/null`, { timeout: 5000 });
  const data = parseJSON(raw);
  
  if (!Array.isArray(data)) {
    console.log(`${c.red}✗${c.reset} Invalid token or API error.\n`);
    return;
  }
  
  // Save to config
  config.todoist = config.todoist || {};
  config.todoist.apiToken = token;
  config.todoist.enabled = true;
  saveConfig(config);
  
  console.log(`${c.green}✓${c.reset} Todoist configured successfully!`);
  console.log(`  Found ${data.length} project(s)`);
  console.log(`  Config saved to: ${CONFIG_PATH}\n`);
}

async function runSetupGitHub(config) {
  console.log(`\n${c.bold}☀️  GitHub Setup${c.reset}\n`);
  
  // Check if gh is installed
  if (!checkGhInstalled()) {
    console.log(`${c.yellow}○${c.reset} GitHub CLI (gh) is not installed.\n`);
    console.log(`GitHub notifications are optional. Install with:`);
    console.log(`  ${c.cyan}brew install gh${c.reset}\n`);
    
    const install = await prompt('Install now? [y/N] ');
    if (install.toLowerCase() === 'y') {
      console.log(`\nInstalling gh...`);
      try {
        execSync('brew install gh', { stdio: 'inherit' });
        console.log(`\n${c.green}✓${c.reset} gh installed successfully!\n`);
      } catch (e) {
        console.log(`\n${c.red}✗${c.reset} Installation failed. Please install manually.\n`);
        return;
      }
    } else {
      return;
    }
  }
  
  // Check existing auth
  const status = checkGitHubSetup();
  if (status.authenticated) {
    console.log(`${c.green}✓${c.reset} Already logged in as: ${status.user}\n`);
    const reauth = await prompt('Re-authenticate? [y/N] ');
    if (reauth.toLowerCase() !== 'y') {
      return;
    }
  }
  
  console.log(`\nThis will open your browser to authenticate with GitHub.\n`);
  
  try {
    execSync('gh auth login', { stdio: 'inherit' });
    
    // Verify
    const newStatus = checkGitHubSetup();
    if (newStatus.authenticated) {
      console.log(`\n${c.green}✓${c.reset} GitHub configured: ${newStatus.user}\n`);
    }
  } catch (e) {
    console.log(`\n${c.red}✗${c.reset} Authentication failed.\n`);
  }
}

async function runSetupWeather(config) {
  console.log(`\n${c.bold}☀️  Weather Setup${c.reset}\n`);
  
  const currentLocation = config.weather?.location || '';
  console.log(`Current location: ${currentLocation || '(auto-detect by IP)'}\n`);
  
  console.log(`Enter a location (city name, ZIP code, or coordinates).`);
  console.log(`Leave empty to auto-detect by IP address.\n`);
  
  const location = await prompt('Location: ');
  
  // Test the location
  if (location) {
    console.log(`\nTesting location...`);
    const raw = exec(`curl -s "wttr.in/${encodeURIComponent(location)}?format=j1" 2>/dev/null`, { timeout: 5000 });
    const data = parseJSON(raw);
    
    if (data?.nearest_area?.[0]) {
      const area = data.nearest_area[0];
      const areaName = area.areaName?.[0]?.value || location;
      const region = area.region?.[0]?.value || '';
      const country = area.country?.[0]?.value || '';
      console.log(`${c.green}✓${c.reset} Found: ${areaName}${region ? ', ' + region : ''}${country ? ', ' + country : ''}`);
    } else {
      console.log(`${c.yellow}⚠${c.reset} Could not verify location, but saving anyway.`);
    }
  }
  
  // Save to config
  config.weather = config.weather || {};
  config.weather.location = location;
  saveConfig(config);
  
  console.log(`\n${c.green}✓${c.reset} Weather location saved.`);
  console.log(`  Config saved to: ${CONFIG_PATH}\n`);
  
  // Ask about units
  const currentUnits = config.weather?.units || 'imperial';
  console.log(`Current units: ${currentUnits}`);
  const changeUnits = await prompt('Change units? (imperial/metric) [Enter to skip]: ');
  
  if (changeUnits === 'metric' || changeUnits === 'imperial') {
    config.weather.units = changeUnits;
    saveConfig(config);
    console.log(`${c.green}✓${c.reset} Units set to ${changeUnits}\n`);
  }
}

async function runSetupWizard(config) {
  console.log(`\n${c.bold}☀️  Morning Dashboard Setup Wizard${c.reset}\n`);
  console.log(`This will help you configure your integrations.\n`);
  console.log(`${c.dim}${'─'.repeat(50)}${c.reset}\n`);
  
  // Show current status
  const status = getIntegrationStatus(config);
  
  // Google
  if (!status.google.authenticated) {
    const setupGoogle = await prompt('Set up Google (Gmail + Calendar)? [Y/n] ');
    if (setupGoogle.toLowerCase() !== 'n') {
      await runSetupGoogle(config);
      config = loadConfig(); // Reload
    }
  } else {
    console.log(`${c.green}✓${c.reset} Google already configured: ${status.google.account}\n`);
  }
  
  // Todoist
  if (!status.todoist.working) {
    const setupTodoist = await prompt('Set up Todoist? [Y/n] ');
    if (setupTodoist.toLowerCase() !== 'n') {
      await runSetupTodoist(config);
      config = loadConfig();
    }
  } else {
    console.log(`${c.green}✓${c.reset} Todoist already configured\n`);
  }
  
  // GitHub
  if (!status.github.authenticated) {
    const setupGitHub = await prompt('Set up GitHub notifications? (optional) [y/N] ');
    if (setupGitHub.toLowerCase() === 'y') {
      await runSetupGitHub(config);
      config = loadConfig();
    }
  } else {
    console.log(`${c.green}✓${c.reset} GitHub already configured: ${status.github.user}\n`);
  }
  
  // Weather
  if (!config.weather?.location) {
    const setupWeather = await prompt('Set weather location? (optional) [y/N] ');
    if (setupWeather.toLowerCase() === 'y') {
      await runSetupWeather(config);
    }
  }
  
  console.log(`\n${c.dim}${'─'.repeat(50)}${c.reset}`);
  console.log(`\n${c.green}✓${c.reset} Setup complete!\n`);
  console.log(`Run ${c.cyan}mdash${c.reset} to see your dashboard.`);
  console.log(`Run ${c.cyan}mdash gui${c.reset} to open the web interface.\n`);
}

// ─── Data Fetchers ───────────────────────────────────────────────────────────

function fetchEmails(config) {
  if (!config.gmail?.enabled) return [];
  
  const account = config.google?.account;
  const accountFlag = account ? `--account ${account}` : '';
  
  const raw = exec(`gog gmail search '${config.gmail.query}' --max ${config.gmail.maxEmails} ${accountFlag} --json 2>/dev/null`);
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
  if (!config.calendar?.enabled) return [];
  
  const account = config.google?.account;
  const accountFlag = account ? `--account ${account}` : '';
  
  const { from, to } = getDateRange(config.calendar.lookaheadDays);
  const raw = exec(`gog calendar events ${config.calendar.id} --from "${from}" --to "${to}" ${accountFlag} --json 2>/dev/null`);
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
  if (!config.todoist?.enabled) return { today: [], overdue: [], upcoming: [] };
  
  const token = config.todoist?.apiToken || process.env.TODOIST_API_TOKEN;
  if (!token) return { today: [], overdue: [], upcoming: [] };
  
  // Use direct API calls instead of CLI
  const headers = `-H "Authorization: Bearer ${token}"`;
  const baseUrl = 'https://api.todoist.com/rest/v2';
  
  // Fetch all active tasks
  const raw = exec(`curl -s ${headers} "${baseUrl}/tasks" 2>/dev/null`, { timeout: 10000 });
  const allTasks = parseJSON(raw) || [];
  
  const today = new Date().toISOString().split('T')[0];
  
  const mapTask = (t) => ({
    id: t.id,
    content: t.content,
    description: t.description,
    due: t.due?.string || t.due?.date,
    dueDate: t.due?.date,
    priority: t.priority || 1,
    projectId: t.project_id,
    labels: t.labels || [],
    isOverdue: t.due?.date && t.due.date < today,
  });
  
  const overdue = allTasks
    .filter(t => t.due?.date && t.due.date < today)
    .map(t => mapTask(t));
  
  const todayTasks = allTasks
    .filter(t => t.due?.date === today)
    .map(t => mapTask(t));
  
  const upcoming = config.todoist.showUpcoming 
    ? allTasks
        .filter(t => t.due?.date && t.due.date > today)
        .map(t => mapTask(t))
        .slice(0, 10)
    : [];
  
  return { overdue, today: todayTasks, upcoming };
}

function fetchWeather(config) {
  if (!config.weather?.enabled) return null;
  
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
  if (!config.github?.enabled) return [];
  
  const ghCheck = exec('which gh 2>/dev/null');
  if (!ghCheck) return [];
  
  const raw = exec(`gh api notifications --jq '.[] | {id: .id, reason: .reason, title: .subject.title, type: .subject.type, repo: .repository.full_name, unread: .unread}' 2>/dev/null`);
  if (!raw) return [];
  
  return raw.split('\n')
    .filter(line => line.trim())
    .map(line => parseJSON(line))
    .filter(n => n && n.unread)
    .slice(0, config.github.maxNotifications);
}

function fetchSystemHealth(config) {
  if (!config.system?.enabled) return null;
  
  const health = {};
  
  if (config.system.showBattery && process.platform === 'darwin') {
    const batteryRaw = exec('pmset -g batt 2>/dev/null');
    if (batteryRaw) {
      const match = batteryRaw.match(/(\d+)%/);
      const charging = batteryRaw.includes('charging') || batteryRaw.includes('AC Power');
      if (match) {
        health.battery = { percent: parseInt(match[1]), charging };
      }
    }
  }
  
  return Object.keys(health).length > 0 ? health : null;
}

function calculateFocusTime(events, config) {
  if (!config.calendar?.showFocusTime || events.length === 0) return [];
  
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
        focusBlocks.push({ start: new Date(currentTime), end: eventStart, duration });
      }
    }
    currentTime = new Date(Math.max(currentTime, new Date(event.end)));
  }
  
  if (currentTime < endOfDay) {
    const duration = (endOfDay - currentTime) / 60000;
    if (duration >= 30) {
      focusBlocks.push({ start: new Date(currentTime), end: endOfDay, duration });
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
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { text: "Until we can manage time, we can manage nothing else.", author: "Peter Drucker" },
];

function getDailyQuote() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return QUOTES[dayOfYear % QUOTES.length];
}

// ─── Terminal Renderers ──────────────────────────────────────────────────────

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

function renderHeader(config, weather, systemHealth) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  console.log();
  console.log(`${c.bold}${c.cyan}  ☀️  ${getGreeting()}!${c.reset}`);
  console.log(`${c.dim}  ${dateStr} • ${timeStr}${c.reset}`);
  
  if (weather) {
    const icon = getWeatherIcon(weather.condition);
    console.log(`${c.dim}  ${icon} ${weather.temp}${weather.unit} (feels ${weather.feelsLike}${weather.unit}) • ${weather.condition}${c.reset}`);
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
  return '🌡️';
}

function renderQuote(config) {
  if (!config.quote?.enabled) return;
  const quote = getDailyQuote();
  console.log();
  console.log(`${c.dim}${c.italic}  "${quote.text}"${c.reset}`);
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
  const sorted = allTasks.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return b.priority - a.priority;
  });
  
  for (const task of sorted.slice(0, config.display.maxTasksShown)) {
    const icon = task.priority === 4 ? `${c.red}●${c.reset}` :
                 task.priority === 3 ? `${c.yellow}●${c.reset}` :
                 task.priority === 2 ? `${c.blue}●${c.reset}` : `${c.dim}○${c.reset}`;
    const overdueTag = task.isOverdue ? `${c.red}[OVERDUE]${c.reset} ` : '';
    const dueStr = task.due ? `${c.dim}(${task.due})${c.reset}` : '';
    lines.push(`${icon} ${overdueTag}${truncate(task.content, config.display.width - 16)} ${dueStr}`);
  }
  
  if (allTasks.length > config.display.maxTasksShown) {
    lines.push(`${c.dim}  ... and ${allTasks.length - config.display.maxTasksShown} more tasks${c.reset}`);
  }
  
  if (config.todoist?.showUpcoming && upcoming.length > 0) {
    lines.push('');
    lines.push(`${c.dim}── Upcoming ──${c.reset}`);
    for (const task of upcoming.slice(0, 3)) {
      lines.push(`${c.dim}  ○ ${truncate(task.content, config.display.width - 20)} (${task.due || task.dueDate})${c.reset}`);
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
  const now = new Date();
  const nextEvent = events.find(e => !e.allDay && new Date(e.start) > now);
  
  for (const event of events.slice(0, config.display.maxEventsShown)) {
    const isNext = nextEvent && event.id === nextEvent.id;
    const isPast = !event.allDay && new Date(event.end) < now;
    
    let timeStr;
    if (event.allDay) {
      timeStr = `${c.magenta}ALL DAY${c.reset} `;
    } else {
      const time = formatTime(event.start);
      const relative = isNext ? ` ${c.green}← ${formatRelativeTime(new Date(event.start))}${c.reset}` : '';
      timeStr = `${isPast ? c.dim : c.cyan}${padRight(time, 8)}${c.reset}${relative}`;
    }
    
    lines.push(`${isPast ? c.dim : ''}${timeStr} ${truncate(event.summary, config.display.width - 24)}${c.reset}`);
    
    if (event.location && !config.display.compact) {
      lines.push(`${c.dim}         📍 ${truncate(event.location, config.display.width - 15)}${c.reset}`);
    }
  }
  
  if (events.length > config.display.maxEventsShown) {
    lines.push(`${c.dim}  ... and ${events.length - config.display.maxEventsShown} more events${c.reset}`);
  }
  
  if (focusBlocks.length > 0 && !config.display.compact) {
    lines.push('');
    lines.push(`${c.green}── Focus Time ──${c.reset}`);
    for (const block of focusBlocks) {
      const dur = block.duration >= 60 
        ? `${Math.floor(block.duration / 60)}h ${block.duration % 60}m`
        : `${block.duration}m`;
      lines.push(`${c.green}  ◆ ${formatTime(block.start.toISOString())} — ${dur} available${c.reset}`);
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
  for (const email of emails.slice(0, config.display.maxEmailsShown)) {
    const from = truncate(email.from, 18);
    const subject = truncate(email.subject, config.display.width - 26);
    lines.push(`${c.cyan}${padRight(from, 18)}${c.reset} ${subject}`);
  }
  
  if (emails.length > config.display.maxEmailsShown) {
    lines.push(`${c.dim}  ... and ${emails.length - config.display.maxEmailsShown} more emails${c.reset}`);
  }

  console.log(box(`📧 INBOX (${emails.length} unread)`, lines.join('\n'), c.magenta, config));
}

function renderGitHub(notifications, config) {
  if (notifications.length === 0) return;

  const lines = [];
  const icons = { PullRequest: '🔀', Issue: '🐛', Release: '🏷️', Discussion: '💬' };
  
  for (const n of notifications) {
    const icon = icons[n.type] || '📌';
    lines.push(`${icon} ${c.dim}${truncate(n.repo, 20)}${c.reset} ${truncate(n.title, config.display.width - 30)}`);
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

function generateHTML(data, config, status) {
  const weatherIcon = data.weather ? getWeatherIconEmoji(data.weather.condition) : '🌡️';
  const showSetup = status && (!status.google.authenticated || !status.todoist.working);
  
  // Calculate totals
  const totalTasks = data.tasks.overdue.length + data.tasks.today.length;
  const totalEvents = data.calendar.events.length;
  const totalEmails = data.email.length;
  const totalGithub = data.github.length;
  const hasAnything = totalTasks > 0 || totalEvents > 0 || totalEmails > 0 || totalGithub > 0;
  
  // Time of day for background
  const hour = new Date().getHours();
  let timeOfDay = 'morning';
  if (hour >= 5 && hour < 12) timeOfDay = 'morning';
  else if (hour >= 12 && hour < 17) timeOfDay = 'noon';
  else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
  else timeOfDay = 'night';
  
  // SVG Icons (Linear-style)
  const icons = {
    tasks: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    calendar: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M2 6h12M5 1.5v3M11 1.5v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    mail: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3" width="13" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M2 4l6 4 6-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    github: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>',
    sun: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5"/></svg>',
    pr: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10 9v2.5a1 1 0 01-1 1H5a1 1 0 01-1-1v-7a1 1 0 011-1h4a1 1 0 011 1V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M7 1.5v4M5 3.5l2-2 2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    issue: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5"/><circle cx="7" cy="7" r="1" fill="currentColor"/></svg>',
  };

  return `<!DOCTYPE html>
<html lang="en" class="${timeOfDay}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Morning Dashboard</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>☀️</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    /* Time-based color themes */
    :root {
      /* Morning: 5am - 12pm - Warm peachy tones */
      --morning-bg: rgba(253,242,235,1);
      --morning-secondary: rgba(254,231,212,1);
      --morning-accent: rgba(220,158,114,1);
      
      /* Noon: 12pm - 5pm - Warm orange */
      --noon-bg: rgba(252,222,201,1);
      --noon-secondary: rgba(254,231,212,1);
      --noon-accent: rgba(243,83,102,1);
      
      /* Evening: 5pm - 9pm - Deep orange/salmon */
      --evening-bg: rgba(220,158,114,1);
      --evening-secondary: rgba(252,222,201,1);
      --evening-accent: rgba(97,68,48,1);
      
      /* Night: 9pm - 5am - Dark brown */
      --night-bg: rgba(97,68,48,1);
      --night-secondary: rgba(72,50,35,1);
      --night-accent: rgba(220,158,114,1);
      
      /* Shared colors */
      --lightblue: rgba(140,202,202,1);
      --midblue: rgba(8,91,144,1);
      --darkblue: rgba(16,24,84,1);
      --red: rgba(243,83,102,1);
      --success: rgba(140,202,202,1);
      --warning: rgba(243,83,102,1);
      
      --radius: 12px;
      --radius-lg: 16px;
    }
    
    /* Morning theme */
    html.morning {
      --background: var(--morning-bg);
      --background-secondary: rgba(255,255,255,0.7);
      --background-tertiary: rgba(255,255,255,0.5);
      --border: rgba(0,0,0,0.08);
      --border-hover: rgba(0,0,0,0.12);
      --foreground: rgba(97,68,48,1);
      --foreground-muted: rgba(150,120,100,1);
      --foreground-subtle: rgba(180,150,130,1);
      --accent: var(--midblue);
      --card-shadow: 0 4px 24px rgba(97,68,48,0.1);
    }
    
    /* Noon theme */
    html.noon {
      --background: var(--noon-bg);
      --background-secondary: rgba(255,255,255,0.75);
      --background-tertiary: rgba(255,255,255,0.5);
      --border: rgba(0,0,0,0.08);
      --border-hover: rgba(0,0,0,0.12);
      --foreground: rgba(97,68,48,1);
      --foreground-muted: rgba(140,100,80,1);
      --foreground-subtle: rgba(170,130,110,1);
      --accent: var(--red);
      --card-shadow: 0 4px 24px rgba(97,68,48,0.12);
    }
    
    /* Evening theme */
    html.evening {
      --background: var(--evening-bg);
      --background-secondary: rgba(255,255,255,0.6);
      --background-tertiary: rgba(255,255,255,0.4);
      --border: rgba(0,0,0,0.1);
      --border-hover: rgba(0,0,0,0.15);
      --foreground: rgba(50,35,25,1);
      --foreground-muted: rgba(80,60,45,1);
      --foreground-subtle: rgba(120,90,70,1);
      --accent: var(--darkblue);
      --card-shadow: 0 4px 24px rgba(50,35,25,0.15);
    }
    
    /* Night theme */
    html.night {
      --background: var(--night-bg);
      --background-secondary: rgba(0,0,0,0.3);
      --background-tertiary: rgba(0,0,0,0.2);
      --border: rgba(255,255,255,0.1);
      --border-hover: rgba(255,255,255,0.15);
      --foreground: rgba(254,231,212,1);
      --foreground-muted: rgba(200,180,160,1);
      --foreground-subtle: rgba(160,140,120,1);
      --accent: var(--lightblue);
      --card-shadow: 0 4px 24px rgba(0,0,0,0.3);
    }
    
    html {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    body {
      background: var(--background);
      color: var(--foreground);
      line-height: 1.5;
      min-height: 100vh;
    }
    
    .app {
      max-width: 1400px;
      margin: 0 auto;
      padding: 32px 24px;
    }
    
    /* Header */
    .header {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding-bottom: 32px;
      margin-bottom: 32px;
      border-bottom: 1px solid var(--border);
    }
    
    .header-greeting {
      font-size: 32px;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: var(--foreground);
    }
    
    .header-greeting span {
      display: inline-block;
    }
    
    .header-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      color: var(--foreground-muted);
    }
    
    .header-separator {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--foreground-subtle);
    }
    
    .header-weather {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .header-weather-temp {
      font-weight: 500;
      color: var(--foreground);
    }
    
    /* Setup Banner */
    .banner {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
      margin-bottom: 32px;
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.2);
      border-radius: var(--radius-lg);
    }
    
    .banner-icon {
      font-size: 20px;
    }
    
    .banner-content {
      flex: 1;
    }
    
    .banner-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--warning);
      margin-bottom: 2px;
    }
    
    .banner-text {
      font-size: 13px;
      color: var(--foreground-muted);
    }
    
    .banner-text code {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 12px;
      padding: 2px 6px;
      background: var(--background-tertiary);
      border-radius: 4px;
    }
    
    .banner-action {
      display: inline-flex;
      align-items: center;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 500;
      color: #000;
      background: var(--warning);
      border: none;
      border-radius: var(--radius);
      cursor: pointer;
      text-decoration: none;
      transition: opacity 150ms;
    }
    
    .banner-action:hover {
      opacity: 0.9;
    }
    
    /* Grid */
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }
    
    /* Card */
    .card {
      background: var(--background-secondary);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
      transition: border-color 150ms, box-shadow 150ms;
    }
    
    .card:hover {
      border-color: var(--border-hover);
    }
    
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
    }
    
    .card-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      font-weight: 600;
      color: var(--foreground);
    }
    
    .card-title-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: var(--radius);
      background: var(--background-tertiary);
      color: var(--foreground-muted);
    }
    
    .card-badges {
      display: flex;
      gap: 8px;
    }
    
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 500;
      border-radius: 9999px;
      background: var(--background-tertiary);
      color: var(--foreground-muted);
    }
    
    .badge-accent {
      background: rgba(99, 102, 241, 0.15);
      color: var(--accent);
    }
    
    .badge-destructive {
      background: rgba(239, 68, 68, 0.15);
      color: var(--destructive);
    }
    
    .card-body {
      max-height: 380px;
      overflow-y: auto;
    }
    
    .card-body::-webkit-scrollbar {
      width: 6px;
    }
    
    .card-body::-webkit-scrollbar-track {
      background: transparent;
    }
    
    .card-body::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 3px;
    }
    
    /* Empty State */
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;
    }
    
    .empty-icon {
      font-size: 32px;
      margin-bottom: 12px;
      opacity: 0.6;
    }
    
    .empty-text {
      font-size: 14px;
      color: var(--foreground-subtle);
    }
    
    /* List Item */
    .list-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 20px;
      border-bottom: 1px solid var(--border);
      transition: background 100ms;
    }
    
    .list-item:last-child {
      border-bottom: none;
    }
    
    .list-item:hover {
      background: var(--background-tertiary);
    }
    
    .list-item-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      margin-top: 2px;
      flex-shrink: 0;
    }
    
    .list-item-indicator svg {
      width: 14px;
      height: 14px;
    }
    
    .list-item-content {
      flex: 1;
      min-width: 0;
    }
    
    .list-item-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--foreground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .list-item-title.dimmed {
      color: var(--foreground-subtle);
    }
    
    .list-item-meta {
      font-size: 13px;
      color: var(--foreground-subtle);
      margin-top: 2px;
    }
    
    .list-item-meta a {
      color: var(--accent);
      text-decoration: none;
    }
    
    .list-item-meta a:hover {
      text-decoration: underline;
    }
    
    .list-item-badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 8px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      border-radius: 4px;
      flex-shrink: 0;
    }
    
    .list-item-badge-destructive {
      background: rgba(239, 68, 68, 0.12);
      color: var(--destructive);
    }
    
    .list-item-badge-success {
      background: rgba(34, 197, 94, 0.12);
      color: var(--success);
    }
    
    /* Priority */
    .priority-4 { color: var(--destructive); }
    .priority-3 { color: var(--warning); }
    .priority-2 { color: var(--accent); }
    .priority-1 { color: var(--foreground-subtle); }
    
    /* Event */
    .event-time {
      font-size: 13px;
      font-weight: 500;
      color: var(--accent);
      min-width: 72px;
      flex-shrink: 0;
    }
    
    .event-time.all-day {
      color: var(--foreground-muted);
    }
    
    .event-time.past {
      color: var(--foreground-subtle);
    }
    
    /* Focus Section */
    .focus-section {
      padding: 16px 20px;
      background: rgba(34, 197, 94, 0.04);
      border-top: 1px solid var(--border);
    }
    
    .focus-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--success);
      margin-bottom: 12px;
    }
    
    .focus-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--foreground-muted);
      padding: 6px 0;
    }
    
    .focus-item-time {
      font-weight: 500;
      color: var(--success);
    }
    
    /* Weather */
    .weather-content {
      padding: 20px;
    }
    
    .weather-main {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }
    
    .weather-icon {
      font-size: 40px;
    }
    
    .weather-temp {
      font-size: 32px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    
    .weather-condition {
      font-size: 14px;
      color: var(--foreground-muted);
    }
    
    .weather-details {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 12px;
    }
    
    .weather-detail {
      display: flex;
      gap: 6px;
      padding: 6px 10px;
      background: var(--background-tertiary);
      border-radius: var(--radius);
    }
    
    .weather-detail-label {
      color: var(--foreground-subtle);
    }
    
    .weather-detail-value {
      font-weight: 500;
      color: var(--foreground);
    }
    
    /* Footer */
    .footer {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding-top: 32px;
      border-top: 1px solid var(--border);
    }
    
    .summary {
      display: flex;
      gap: 24px;
    }
    
    .summary-item {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }
    
    .summary-count {
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    
    .summary-count.destructive { color: var(--destructive); }
    .summary-count.warning { color: var(--warning); }
    .summary-count.accent { color: var(--accent); }
    .summary-count.muted { color: var(--foreground-muted); }
    
    .summary-label {
      font-size: 14px;
      color: var(--foreground-subtle);
    }
    
    .all-clear {
      font-size: 16px;
      color: var(--success);
    }
    
    .footer-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13px;
      color: var(--foreground-subtle);
    }
    
    .refresh-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      font-size: 13px;
      font-weight: 500;
      color: var(--foreground);
      background: var(--background-tertiary);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      cursor: pointer;
      transition: background 100ms, border-color 100ms;
    }
    
    .refresh-btn:hover {
      background: var(--background-secondary);
      border-color: var(--border-hover);
    }
    
    /* Responsive */
    @media (max-width: 840px) {
      .app { padding: 20px 16px; }
      .grid { grid-template-columns: 1fr; }
      .header-greeting { font-size: 24px; }
      .weather-content { grid-template-columns: 1fr; }
      .summary { gap: 16px; }
    }
  </style>
</head>
<body>
  <div class="app">
    ${showSetup ? `
    <div class="banner">
      <div class="banner-icon">⚙️</div>
      <div class="banner-content">
        <div class="banner-title">Setup Incomplete</div>
        <div class="banner-text">Run <code>mdash setup</code> to configure integrations</div>
      </div>
      <a href="/setup" class="banner-action">View Status</a>
    </div>
    ` : ''}
    
    <header class="header">
      <h1 class="header-greeting"><span>☀️</span> ${data.greeting}</h1>
      <div class="header-meta">
        <span>${formatDateLong(new Date())}</span>
        <span class="header-separator"></span>
        <span>${formatTimeLong(new Date())}</span>
        ${data.weather ? `
        <span class="header-separator"></span>
        <span class="header-weather">
          <span>${weatherIcon}</span>
          <span class="header-weather-temp">${data.weather.temp}${data.weather.unit}</span>
          <span>${data.weather.condition}</span>
        </span>
        ` : ''}
      </div>
    </header>
    
    <div class="grid">
      <!-- Tasks -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <div class="card-title-icon">${icons.tasks}</div>
            <span>Tasks</span>
          </div>
          <div class="card-badges">
            ${data.tasks.overdue.length > 0 ? `<span class="badge badge-destructive">${data.tasks.overdue.length} overdue</span>` : ''}
            ${data.tasks.today.length > 0 ? `<span class="badge badge-accent">${data.tasks.today.length} today</span>` : ''}
          </div>
        </div>
        <div class="card-body">
          ${totalTasks === 0 ? `
          <div class="empty">
            <div class="empty-icon">✓</div>
            <div class="empty-text">No tasks due today</div>
          </div>
          ` : [...data.tasks.overdue, ...data.tasks.today].map(t => `
          <div class="list-item">
            <div class="list-item-indicator priority-${t.priority}">${icons.check}</div>
            <div class="list-item-content">
              <div class="list-item-title">${escapeHtml(t.content)}</div>
              ${t.due ? `<div class="list-item-meta">${escapeHtml(t.due)}</div>` : ''}
            </div>
            ${t.isOverdue ? '<span class="list-item-badge list-item-badge-destructive">Overdue</span>' : ''}
          </div>
          `).join('')}
        </div>
      </div>
      
      <!-- Calendar -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <div class="card-title-icon">${icons.calendar}</div>
            <span>Calendar</span>
          </div>
          ${totalEvents > 0 ? `<span class="badge">${totalEvents} events</span>` : ''}
        </div>
        <div class="card-body">
          ${totalEvents === 0 ? `
          <div class="empty">
            <div class="empty-icon">📅</div>
            <div class="empty-text">No events scheduled</div>
          </div>
          ` : data.calendar.events.map((e, i) => {
            const now = new Date();
            const isPast = !e.allDay && new Date(e.end) < now;
            const isNext = !isPast && !e.allDay && data.calendar.events.slice(0, i).every(ev => ev.allDay || new Date(ev.end) < now);
            return `
            <div class="list-item">
              <div class="event-time ${e.allDay ? 'all-day' : ''} ${isPast ? 'past' : ''}">${e.allDay ? 'All day' : formatTimeLong(new Date(e.start))}</div>
              <div class="list-item-content">
                <div class="list-item-title ${isPast ? 'dimmed' : ''}">${escapeHtml(e.summary)}</div>
                ${e.location ? `<div class="list-item-meta">📍 ${escapeHtml(e.location)}</div>` : ''}
                ${e.meetLink ? `<div class="list-item-meta"><a href="${escapeHtml(e.meetLink)}" target="_blank">Join meeting →</a></div>` : ''}
              </div>
              ${isNext ? '<span class="list-item-badge list-item-badge-success">Next</span>' : ''}
            </div>
            `;
          }).join('')}
          ${data.calendar.focusBlocks.length > 0 ? `
          <div class="focus-section">
            <div class="focus-header">
              <span>◆</span>
              <span>Focus Time Available</span>
            </div>
            ${data.calendar.focusBlocks.map(b => `
            <div class="focus-item">
              <span class="focus-item-time">${formatTimeLong(new Date(b.start))}</span>
              <span>—</span>
              <span>${formatDuration(b.duration)} available</span>
            </div>
            `).join('')}
          </div>
          ` : ''}
        </div>
      </div>
      
      <!-- Email -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <div class="card-title-icon">${icons.mail}</div>
            <span>Inbox</span>
          </div>
          ${totalEmails > 0 ? `<span class="badge">${totalEmails} unread</span>` : ''}
        </div>
        <div class="card-body">
          ${totalEmails === 0 ? `
          <div class="empty">
            <div class="empty-icon">📭</div>
            <div class="empty-text">Inbox zero!</div>
          </div>
          ` : data.email.map(e => `
          <div class="list-item">
            <div class="list-item-indicator">${icons.mail}</div>
            <div class="list-item-content">
              <div class="list-item-title">${escapeHtml(e.subject)}</div>
              <div class="list-item-meta">${escapeHtml(e.from)}</div>
            </div>
          </div>
          `).join('')}
        </div>
      </div>
      
      <!-- GitHub -->
      ${totalGithub > 0 ? `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <div class="card-title-icon">${icons.github}</div>
            <span>GitHub</span>
          </div>
          <span class="badge">${totalGithub}</span>
        </div>
        <div class="card-body">
          ${data.github.map(n => `
          <div class="list-item">
            <div class="list-item-indicator">${n.type === 'PullRequest' ? icons.pr : icons.issue}</div>
            <div class="list-item-content">
              <div class="list-item-title">${escapeHtml(n.title)}</div>
              <div class="list-item-meta">${escapeHtml(n.repo)}</div>
            </div>
          </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
      
      <!-- Weather -->
      ${data.weather ? `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <div class="card-title-icon">${icons.sun}</div>
            <span>Weather</span>
          </div>
          <span class="badge">${data.weather.location}</span>
        </div>
        <div class="weather-content">
          <div class="weather-main">
            <div class="weather-icon">${weatherIcon}</div>
            <div>
              <div class="weather-temp">${data.weather.temp}${data.weather.unit}</div>
              <div class="weather-condition">${data.weather.condition}</div>
            </div>
          </div>
          <div class="weather-details">
            <div class="weather-detail">
              <span class="weather-detail-label">Feels</span>
              <span class="weather-detail-value">${data.weather.feelsLike}°</span>
            </div>
            <div class="weather-detail">
              <span class="weather-detail-label">H/L</span>
              <span class="weather-detail-value">${data.weather.high}°/${data.weather.low}°</span>
            </div>
            <div class="weather-detail">
              <span class="weather-detail-label">Humidity</span>
              <span class="weather-detail-value">${data.weather.humidity}%</span>
            </div>
            <div class="weather-detail">
              <span class="weather-detail-label">Wind</span>
              <span class="weather-detail-value">${data.weather.windSpeed}</span>
            </div>
          </div>
        </div>
      </div>
      ` : ''}
    
    <footer class="footer">
      ${hasAnything ? `
      <div class="summary">
        ${data.tasks.overdue.length > 0 ? `<div class="summary-item"><span class="summary-count destructive">${data.tasks.overdue.length}</span><span class="summary-label">overdue</span></div>` : ''}
        ${data.tasks.today.length > 0 ? `<div class="summary-item"><span class="summary-count warning">${data.tasks.today.length}</span><span class="summary-label">tasks</span></div>` : ''}
        ${totalEvents > 0 ? `<div class="summary-item"><span class="summary-count accent">${totalEvents}</span><span class="summary-label">events</span></div>` : ''}
        ${totalEmails > 0 ? `<div class="summary-item"><span class="summary-count muted">${totalEmails}</span><span class="summary-label">emails</span></div>` : ''}
        ${totalGithub > 0 ? `<div class="summary-item"><span class="summary-count muted">${totalGithub}</span><span class="summary-label">notifications</span></div>` : ''}
      </div>
      ` : `<div class="all-clear">✨ All clear! Have a great day.</div>`}
      <div class="footer-meta">
        <span>Updated ${formatTimeLong(new Date())}</span>
        <button class="refresh-btn" onclick="location.reload()">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 7a5.5 5.5 0 1 0 1.1-3.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M1 1v3h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Refresh
        </button>
      </div>
    </footer>
  </div>
  
  ${config.gui?.autoRefresh ? `<script>setTimeout(() => location.reload(), ${(config.gui.refreshInterval || 300) * 1000});</script>` : ''}
</body>
</html>`;
}

function generateSetupHTML(status, config) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Setup - Morning Dashboard</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚙️</text></svg>">
  <style>
    :root { --bg: #0d1117; --bg-card: #161b22; --bg-hover: #21262d; --border: #30363d; --text: #e6edf3; --text-muted: #8b949e; --accent: #58a6ff; --green: #3fb950; --yellow: #d29922; --red: #f85149; }
    @media (prefers-color-scheme: light) { :root { --bg: #f6f8fa; --bg-card: #ffffff; --bg-hover: #f3f4f6; --border: #d0d7de; --text: #1f2328; --text-muted: #656d76; --accent: #0969da; --green: #1a7f37; --yellow: #9a6700; --red: #cf222e; } }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; padding: 2rem; }
    .container { max-width: 700px; margin: 0 auto; }
    h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
    .subtitle { color: var(--text-muted); margin-bottom: 2rem; }
    .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; }
    .card-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
    .card-title { font-weight: 600; font-size: 1.1rem; }
    .status { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; padding: 0.25rem 0.75rem; border-radius: 20px; }
    .status.ok { background: rgba(63, 185, 80, 0.15); color: var(--green); }
    .status.warn { background: rgba(210, 153, 34, 0.15); color: var(--yellow); }
    .status.err { background: rgba(248, 81, 73, 0.15); color: var(--red); }
    .detail { font-size: 0.9rem; color: var(--text-muted); margin-top: 0.5rem; }
    code { background: var(--bg-hover); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.85rem; }
    .back-link { display: inline-block; margin-top: 2rem; color: var(--accent); text-decoration: none; }
    .back-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚙️ Setup Status</h1>
    <p class="subtitle">Run <code>mdash setup</code> in terminal to configure</p>
    
    <div class="card">
      <div class="card-header">
        <span class="card-title">Google (Gmail + Calendar)</span>
        <span class="status ${status.google.authenticated ? 'ok' : status.google.installed ? 'warn' : 'err'}">
          ${status.google.authenticated ? '✓ Connected' : status.google.installed ? '○ Not authenticated' : '✗ Not installed'}
        </span>
      </div>
      ${status.google.authenticated ? `<div class="detail">Account: ${status.google.account}<br>Services: ${status.google.services.join(', ')}</div>` : 
        status.google.installed ? `<div class="detail">Run: <code>mdash setup google</code></div>` : 
        `<div class="detail">Install: <code>brew install steipete/tap/gogcli</code></div>`}
    </div>
    
    <div class="card">
      <div class="card-header">
        <span class="card-title">Todoist</span>
        <span class="status ${status.todoist.working ? 'ok' : status.todoist.configured ? 'err' : 'warn'}">
          ${status.todoist.working ? '✓ Connected' : status.todoist.configured ? '✗ Token invalid' : '○ Not configured'}
        </span>
      </div>
      <div class="detail">${status.todoist.working ? 'API token verified' : 'Run: <code>mdash setup todoist</code>'}</div>
    </div>
    
    <div class="card">
      <div class="card-header">
        <span class="card-title">GitHub</span>
        <span class="status ${status.github.authenticated ? 'ok' : status.github.installed ? 'warn' : 'warn'}">
          ${status.github.authenticated ? '✓ Connected' : status.github.installed ? '○ Not authenticated' : '○ Not installed (optional)'}
        </span>
      </div>
      <div class="detail">${status.github.authenticated ? `Logged in as: ${status.github.user}` : status.github.installed ? 'Run: <code>mdash setup github</code>' : 'Install: <code>brew install gh</code>'}</div>
    </div>
    
    <div class="card">
      <div class="card-header">
        <span class="card-title">Weather</span>
        <span class="status ok">✓ Available</span>
      </div>
      <div class="detail">Location: ${status.weather.location || 'Auto-detect by IP'}</div>
    </div>
    
    <a href="/" class="back-link">← Back to Dashboard</a>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDateLong(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTimeLong(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDuration(minutes) {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60), m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${minutes}m`;
}

function getWeatherIconEmoji(condition) {
  const cond = (condition || '').toLowerCase();
  if (cond.includes('sun') || cond.includes('clear')) return '☀️';
  if (cond.includes('cloud') && cond.includes('part')) return '⛅';
  if (cond.includes('cloud') || cond.includes('overcast')) return '☁️';
  if (cond.includes('rain')) return '🌧️';
  if (cond.includes('snow')) return '🌨️';
  return '🌡️';
}

function startGUIServer(config, port) {
  const server = http.createServer((req, res) => {
    const status = getIntegrationStatus(config);
    
    if (req.url === '/api/data') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      const data = fetchAllData(config);
      res.end(JSON.stringify({ ...data, status }));
    } else if (req.url === '/api/status') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(status));
    } else if (req.url === '/setup') {
      res.setHeader('Content-Type', 'text/html');
      res.end(generateSetupHTML(status, config));
    } else {
      res.setHeader('Content-Type', 'text/html');
      const data = fetchAllData(config);
      res.end(generateHTML(data, config, status));
    }
  });
  
  server.listen(port, '127.0.0.1', () => {
    const url = `http://localhost:${port}`;
    console.log(`\n☀️  Morning Dashboard GUI`);
    console.log(`${'─'.repeat(40)}`);
    console.log(`Dashboard:  ${url}`);
    console.log(`Setup:      ${url}/setup`);
    console.log(`API:        ${url}/api/data`);
    console.log(`\nPress Ctrl+C to stop\n`);
    
    const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    try { spawn(openCmd, [url], { detached: true, stdio: 'ignore' }).unref(); } catch (e) {}
  });
  
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`\nError: Port ${port} in use. Try: mdash gui --port ${port + 1}\n`);
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
    if (customConfig) config = deepMerge(config, customConfig);
  }
  
  // Setup command
  if (args.command === 'setup') {
    switch (args.subcommand) {
      case 'status':
        await runSetupStatus(config);
        break;
      case 'google':
        await runSetupGoogle(config);
        break;
      case 'todoist':
        await runSetupTodoist(config);
        break;
      case 'github':
        await runSetupGitHub(config);
        break;
      case 'weather':
        await runSetupWeather(config);
        break;
      default:
        await runSetupWizard(config);
    }
    process.exit(0);
  }
  
  // GUI command
  if (args.command === 'gui') {
    const port = args.port || config.gui?.port || 3141;
    startGUIServer(config, port);
    return;
  }
  
  // Terminal dashboard
  if (args.compact) config.display.compact = true;
  if (args.noColor) config.display.color = false;
  useColor = config.display.color && !args.json;
  
  const showAll = args.sections.length === 0;
  const shouldShow = (section) => showAll || args.sections.includes(section);
  
  const data = fetchAllData(config);
  
  if (args.json) {
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
  }
  
  if (!args.compact && showAll) console.clear();
  if (config.display.showGreeting && showAll) renderHeader(config, data.weather, data.system);
  if (config.quote?.enabled && showAll && !config.display.compact) renderQuote(config);
  console.log();
  
  if (shouldShow('tasks')) { renderTasks(data.tasks, config); console.log(); }
  if (shouldShow('calendar')) { renderCalendar(data.calendar.events, data.calendar.focusBlocks, config); console.log(); }
  if (shouldShow('email')) { renderEmails(data.email, config); console.log(); }
  if (shouldShow('github') && data.github.length > 0) { renderGitHub(data.github, config); console.log(); }
  
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
