#!/usr/bin/env node
/**
 * Local gog proxy server
 * Runs natively on macOS with Keychain access to provide Google data
 * Docker dashboard fetches from this proxy
 */

const http = require('http');
const { execSync } = require('child_process');

const PORT = 3142;

function exec(cmd, timeout = 15000) {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return null;
  }
}

function getEmails() {
  const configPath = require('path').join(require('os').homedir(), '.config/morning-dashboard/config.json');
  let config = { gmail: { query: 'is:unread newer_than:3d', maxEmails: 10 }, google: { account: '' } };
  try {
    config = { ...config, ...JSON.parse(require('fs').readFileSync(configPath, 'utf-8')) };
  } catch {}

  const accountFlag = config.google?.account ? `--account ${config.google.account}` : '';
  const raw = exec(`gog gmail search '${config.gmail.query}' --max ${config.gmail.maxEmails} ${accountFlag} --json 2>/dev/null`);
  if (!raw) return [];
  
  try {
    const data = JSON.parse(raw);
    // gog returns {threads: [...]} or {messages: [...]} or direct array
    const messages = data?.threads || data?.messages || (Array.isArray(data) ? data : []);
    return messages.map(m => ({
      id: m.id,
      threadId: m.threadId || m.id,
      from: m.from?.replace(/<.*>/, '').trim() || 'Unknown',
      subject: m.subject || '(no subject)',
      snippet: m.snippet || '',
      date: m.date,
      labelIds: m.labels || m.labelIds || [],
      isUnread: (m.labels || m.labelIds || []).includes('UNREAD')
    }));
  } catch {
    return [];
  }
}

function getCalendar() {
  const configPath = require('path').join(require('os').homedir(), '.config/morning-dashboard/config.json');
  let config = { calendar: { id: 'primary', lookaheadDays: 7 }, google: { account: '' } };
  try {
    config = { ...config, ...JSON.parse(require('fs').readFileSync(configPath, 'utf-8')) };
  } catch {}

  const accountFlag = config.google?.account ? `--account ${config.google.account}` : '';
  const from = new Date();
  from.setDate(from.getDate() - 3); // Include past 3 days
  const to = new Date();
  to.setDate(to.getDate() + (config.calendar.lookaheadDays || 7));
  
  const raw = exec(`gog calendar events ${config.calendar.id || 'primary'} --from "${from.toISOString()}" --to "${to.toISOString()}" ${accountFlag} --json 2>/dev/null`);
  if (!raw) return [];
  
  try {
    const data = JSON.parse(raw);
    // gog returns {events: [...]} or direct array
    return data?.events || (Array.isArray(data) ? data : []);
  } catch {
    return [];
  }
}

function getGoogleStatus() {
  const raw = exec('gog auth list --json 2>/dev/null');
  if (!raw) return { installed: false, authenticated: false, account: null, services: [] };
  
  try {
    const data = JSON.parse(raw);
    if (data.accounts && data.accounts.length > 0) {
      const acc = data.accounts[0];
      return {
        installed: true,
        authenticated: true,
        account: acc.email,
        services: acc.services || []
      };
    }
  } catch {}
  
  return { installed: true, authenticated: false, account: null, services: [] };
}

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.url === '/health') {
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  
  if (req.url === '/google') {
    const data = {
      email: getEmails(),
      calendar: getCalendar(),
      status: getGoogleStatus()
    };
    res.end(JSON.stringify(data));
    return;
  }
  
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🔗 gog-proxy running on http://localhost:${PORT}`);
  console.log(`   /health - Health check`);
  console.log(`   /google - Email + Calendar data`);
});
