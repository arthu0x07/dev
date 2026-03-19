'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  PORTFOLIO SERVER  •  Production-grade  •  Low-cost / Zero-infra
//  Author: Arthur  |  Stack: Node.js + Express
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// Security
const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const cors = require('cors');

// Logging
const winston = require('winston');
const DailyRotate = require('winston-daily-rotate-file');
const morgan = require('morgan');

// Performance
const compression = require('compression');

// Intelligence
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const { v4: uuidv4 } = require('uuid');

// HTTP client
const axios = require('axios');

// ─────────────────────────────────────────────────────────────────────────────
//  ENV & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 3333;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'CHANGE_ME_IN_DOTENV';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : null; // null = wildcard (dev only)

const LOGS_DIR = path.join(__dirname, 'logs');
const VISITORS_LOG = path.join(LOGS_DIR, 'visitors.ndjson');   // One JSON per line
const MAX_VISITOR_ROWS = 50_000;

if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

// ─────────────────────────────────────────────────────────────────────────────
//  WINSTON — STRUCTURED LOGGING ENGINE
// ─────────────────────────────────────────────────────────────────────────────
const { combine, timestamp, json, colorize, printf, errors } = winston.format;

// Pretty format for console (dev)
const consoleFmt = printf(({ level, message, timestamp: ts, service, requestId, ...meta }) => {
  const rid = requestId ? ` [${requestId.slice(0, 8)}]` : '';
  const extra = Object.keys(meta).length
    ? '\n' + JSON.stringify(meta, null, 2).split('\n').map(l => '    ' + l).join('\n')
    : '';
  return `${ts} ${level.padEnd(7)}${rid}  ${message}${extra}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (IS_PROD ? 'info' : 'debug'),
  defaultMeta: { service: 'portfolio-server', env: NODE_ENV, host: os.hostname() },
  format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }), json()),
  transports: [
    // ── Console (colorized in dev, plain JSON in prod) ──
    new winston.transports.Console({
      format: IS_PROD
        ? combine(timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }), json())
        : combine(colorize({ all: true }), timestamp({ format: 'HH:mm:ss.SSS' }), consoleFmt),
    }),

    // ── Combined log with daily rotation ──
    new DailyRotate({
      filename: path.join(LOGS_DIR, 'server-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      maxSize: '50m',
      zippedArchive: true,
      format: combine(timestamp(), json()),
    }),

    // ── Error-only log ──
    new DailyRotate({
      filename: path.join(LOGS_DIR, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d',
      maxSize: '10m',
      zippedArchive: true,
      format: combine(timestamp(), json()),
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
//  VISITOR INTELLIGENCE ENGINE
// ─────────────────────────────────────────────────────────────────────────────
const SKIP_EXT = new Set([
  '.css', '.js', '.ico', '.png', '.jpg', '.jpeg', '.gif',
  '.svg', '.woff', '.woff2', '.ttf', '.eot', '.map',
  '.webp', '.avif', '.mp4', '.webm', '.json',
]);

function getClientIP(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || req.ip || '0.0.0.0';
}

/**
 * Classifies how suspicious a request looks (0 = clean, 10 = highly suspicious).
 * Cheap heuristics — no ML needed.
 */
function threatScore(req, uaResult) {
  let score = 0;
  const ua = (req.headers['user-agent'] || '').toLowerCase();

  // Missing or empty UA
  if (!ua) score += 5;

  // Common scanner/bot strings
  const scannerPatterns = [
    'sqlmap', 'nmap', 'nikto', 'masscan', 'zgrab',
    'curl/', 'wget/', 'python-requests', 'go-http-client',
    'dirbuster', 'hydra', 'acunetix', 'nessus', 'burp',
    'scrapy', 'httpx', 'nuclei', 'fuzzer',
  ];
  if (scannerPatterns.some(p => ua.includes(p))) score += 6;

  // Headless browsers
  if (ua.includes('headless') || ua.includes('phantomjs') || ua.includes('selenium')) score += 4;

  // Path traversal / injection in URL
  const fullUrl = req.originalUrl;
  if (/(\.\.[/\\]|%2e%2e|%252e)/.test(fullUrl)) score += 7;
  if (/(<script|javascript:|onerror=|onload=)/i.test(fullUrl)) score += 7;
  if (/(union.*select|select.*from|insert.*into|drop.*table)/i.test(fullUrl)) score += 8;

  // Missing common browser headers
  if (!req.headers['accept-language']) score += 1;
  if (!req.headers['accept']) score += 1;

  return Math.min(score, 10);
}

function detectBotType(ua) {
  const u = ua.toLowerCase();
  if (u.includes('googlebot')) return 'googlebot';
  if (u.includes('bingbot')) return 'bingbot';
  if (u.includes('twitterbot')) return 'twitterbot';
  if (u.includes('linkedinbot')) return 'linkedinbot';
  if (u.includes('facebookexternalhit')) return 'facebook-scraper';
  if (u.includes('semrushbot')) return 'semrush';
  if (u.includes('ahrefsbot')) return 'ahrefs';
  if (/bot|crawl|spider|slurp/i.test(u)) return 'generic-bot';
  return null;
}

function buildVisitorRecord(req) {
  const ip = getClientIP(req);
  const uaString = req.headers['user-agent'] || '';
  const ua = new UAParser(uaString).getResult();
  const geo = geoip.lookup(ip) || {};
  const botType = detectBotType(uaString);
  const threat = threatScore(req, ua);

  return {
    // ── Identity ────────────────────────────────────────────────────────────
    id: uuidv4(),
    requestId: req.id,
    session: req.headers['x-session-id'] || null,
    timestamp: new Date().toISOString(),
    ip,

    // ── Geo-Intelligence ─────────────────────────────────────────────────────
    geo: {
      country: geo.country || null,
      region: geo.region || null,
      city: geo.city || null,
      ll: geo.ll || null,  // [latitude, longitude]
      timezone: geo.timezone || null,
      eu: geo.eu || '0',   // EU member? (GDPR relevance)
    },

    // ── Browser / OS / Device ────────────────────────────────────────────────
    browser: {
      name: ua.browser.name || null,
      version: ua.browser.version || null,
      major: ua.browser.major || null,
    },
    os: {
      name: ua.os.name || null,
      version: ua.os.version || null,
    },
    engine: {
      name: ua.engine.name || null,
      version: ua.engine.version || null,
    },
    device: {
      type: ua.device.type || 'desktop',
      vendor: ua.device.vendor || null,
      model: ua.device.model || null,
    },

    // ── Client Hints (modern browsers send these) ─────────────────────────────
    clientHints: {
      browser: req.headers['sec-ch-ua'] || null,
      mobile: req.headers['sec-ch-ua-mobile'] || null,
      platform: req.headers['sec-ch-ua-platform'] || null,
    },

    // ── Request ──────────────────────────────────────────────────────────────
    request: {
      method: req.method,
      path: req.path,
      query: Object.keys(req.query).length ? req.query : null,
      referrer: req.headers['referer'] || req.headers['referrer'] || null,
      protocol: req.protocol,
      httpVer: req.httpVersion,
    },

    // ── Behavioral signals ───────────────────────────────────────────────────
    signals: {
      isBot: botType !== null,
      botType,
      threatScore: threat,
      threatLevel: threat === 0 ? 'clean' : threat <= 2 ? 'low' : threat <= 5 ? 'medium' : 'high',
      dnt: req.headers['dnt'] === '1',
      acceptLang: req.headers['accept-language'] || null,
      acceptEnc: req.headers['accept-encoding'] || null,
      fetchSite: req.headers['sec-fetch-site'] || null,
      fetchMode: req.headers['sec-fetch-mode'] || null,
      fetchDest: req.headers['sec-fetch-dest'] || null,
      connection: req.headers['connection'] || null,
    },

    raw_ua: uaString,
  };
}

function appendVisitorNDJSON(record) {
  try {
    const line = JSON.stringify(record) + '\n';
    fs.appendFileSync(VISITORS_LOG, line, 'utf-8');

    // Trim file if it exceeds MAX_VISITOR_ROWS (keep last N lines)
    const content = fs.readFileSync(VISITORS_LOG, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    if (lines.length > MAX_VISITOR_ROWS) {
      fs.writeFileSync(VISITORS_LOG, lines.slice(-MAX_VISITOR_ROWS).join('\n') + '\n');
    }
  } catch (e) {
    logger.error('Failed to write visitor log', { error: e.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXPRESS APP BOOTSTRAP
// ─────────────────────────────────────────────────────────────────────────────
const app = express();

// Trust first proxy in chain (Nginx, Cloudflare, etc.)
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ── Request ID ───────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// ── Security Headers ─────────────────────────────────────────────────────────
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
  fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
  imgSrc: ["'self'", 'data:', 'https:'],
  connectSrc: ["'self'", 'https://unpkg.com'],
  frameSrc: ["'none'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
};
if (IS_PROD) cspDirectives.upgradeInsecureRequests = [];

app.use(
  helmet({
    contentSecurityPolicy: { directives: cspDirectives },
    hsts: IS_PROD ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
    noSniff: true,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: false,
  })
);

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, cb) => {
      if (!ALLOWED_ORIGINS || !origin || ALLOWED_ORIGINS.includes(origin))
        return cb(null, true);
      logger.warn('CORS blocked', { origin });
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'x-admin-token', 'x-session-id'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  })
);

// ── Compression ───────────────────────────────────────────────────────────────
app.use(compression({ level: 6, threshold: 1024 }));

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req, getClientIP(req)),
  skip: (req) => req.path.startsWith('/api/chat/'),
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', { ip: getClientIP(req), path: req.path });
    res.status(429).json({
      status: 'error',
      code: 'RATE_LIMIT',
      message: 'Too many requests. Back off and try again in 15 minutes.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req, getClientIP(req)),
  handler: (req, res) => {
    logger.warn('Scan rate limit exceeded', { ip: getClientIP(req) });
    res.status(429).json({
      status: 'error',
      code: 'SCAN_RATE_LIMIT',
      message: 'Too many scan requests. Max 10/min per IP.',
    });
  },
});

app.use(globalLimiter);

// ── HTTP Access Log (Morgan → Winston) ───────────────────────────────────────
const morganFmt = IS_PROD
  ? ':remote-addr :method :url HTTP/:http-version :status :res[content-length] ":referrer" ":user-agent" :response-time ms'
  : ':method :url :status :response-time ms';

app.use(
  morgan(morganFmt, {
    stream: {
      write: (msg) => logger.http(msg.trim(), { type: 'access' }),
    },
    skip: (req) => {
      const ext = path.extname(req.path).toLowerCase();
      return SKIP_EXT.has(ext);
    },
  })
);

// ── Body Parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ── Visitor Intelligence Middleware ───────────────────────────────────────────
app.use((req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  if (SKIP_EXT.has(ext) || req.path.startsWith('/api/visitors')) return next();

  const record = buildVisitorRecord(req);

  // Structured log for every page hit
  logger.info('VISITOR', {
    requestId: record.requestId,
    ip: record.ip,
    country: record.geo.country,
    city: record.geo.city,
    ll: record.geo.ll,
    browser: `${record.browser.name} ${record.browser.major || ''}`.trim(),
    os: `${record.os.name} ${record.os.version || ''}`.trim(),
    device: record.device.type,
    path: record.request.path,
    referrer: record.request.referrer,
    isBot: record.signals.isBot,
    botType: record.signals.botType,
    threatScore: record.signals.threatScore,
    threatLevel: record.signals.threatLevel,
    lang: record.signals.acceptLang,
    dnt: record.signals.dnt,
    platform: record.clientHints.platform,
  });

  // Async NDJSON write — never blocks the response
  setImmediate(() => appendVisitorNDJSON(record));

  // Warn on medium+ threat
  if (record.signals.threatScore >= 3) {
    logger.warn('SUSPICIOUS REQUEST', {
      ip: record.ip,
      path: req.path,
      ua: record.raw_ua,
      threatScore: record.signals.threatScore,
      threatLevel: record.signals.threatLevel,
      requestId: req.id,
    });
  }

  next();
});

// ─────────────────────────────────────────────────────────────────────────────
//  HEALTH CHECK  (/health)  — must be BEFORE express.static
// ─────────────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  const uptime = process.uptime();
  res.json({
    status: 'ok',
    version: process.env.npm_package_version || '1.0.0',
    env: NODE_ENV,
    uptime: {
      seconds: Math.floor(uptime),
      human: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
    },
    memory: {
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
    },
    node: process.version,
    platform: process.platform,
    pid: process.pid,
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  SCAN API  (/api/cyber-scan)
// ─────────────────────────────────────────────────────────────────────────────
const VALID_TOOLS = new Set(['ip', 'subdomains', 'malicious', 'ioc', 'proxies', 'leak', 'ssl', 'dns']);
const TARGET_REGEX = /^[a-zA-Z0-9.\-_:/@]{1,253}$/;

const TOOL_CONFIG = {
  ip: { host: 'ip-enricher.p.rapidapi.com', url: (t) => `https://ip-enricher.p.rapidapi.com/enrich-ip?ip=${enc(t)}` },
  subdomains: { host: 'subdomain-scan.p.rapidapi.com', url: (t) => `https://subdomain-scan.p.rapidapi.com/scan/${enc(t)}` },
  malicious: { host: 'malicious-scanner.p.rapidapi.com', url: (t) => `https://malicious-scanner.p.rapidapi.com/scan?url=${enc(t)}` },
  ioc: { host: 'ioc-search.p.rapidapi.com', url: (t) => `https://ioc-search.p.rapidapi.com/search?query=${enc(t)}` },
  proxies: { host: 'proxy-list.p.rapidapi.com', url: () => `https://proxy-list.p.rapidapi.com/proxies` },
  leak: { host: 'leakinsight.p.rapidapi.com', url: (t) => `https://leakinsight.p.rapidapi.com/v1/search/${enc(t)}` },
  ssl: { host: 'ssl-certificate-checker.p.rapidapi.com', url: (t) => `https://ssl-certificate-checker.p.rapidapi.com/check/${enc(t)}` },
  dns: { host: 'dns-records.p.rapidapi.com', url: (t) => `https://dns-records.p.rapidapi.com/records/${enc(t)}` },
  cinema: { mockOnly: true }
};

function enc(v) { return encodeURIComponent(v); }

function validateScan(req, res, next) {
  const { tool, target } = req.query;

  if (!tool || !VALID_TOOLS.has(tool))
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_TOOL',
      message: `Unknown tool. Accepted: ${[...VALID_TOOLS].join(', ')}`,
    });

  if (tool !== 'proxies' && (!target || !TARGET_REGEX.test(target)))
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_TARGET',
      message: 'Invalid target. Allowed chars: alphanumeric, dot, hyphen, colon, slash, underscore. Max 253 chars.',
    });

  next();
}

app.get('/api/cyber-scan', scanLimiter, validateScan, async (req, res) => {
  const { tool, target } = req.query;
  const apiKey = process.env.RAPIDAPI_KEY;
  const ip = getClientIP(req);
  const cfg = TOOL_CONFIG[tool];

  logger.info('SCAN REQUEST', { requestId: req.id, tool, target, ip });

  if (!apiKey || cfg.mockOnly) {
    logger.warn(`${cfg.mockOnly ? 'CINEMA' : 'MOCK'} MODE`, { tool, target });
    return res.json({ status: 'success', mode: 'mock', data: getMockData(tool, target) });
  }

  try {
    const response = await axios.get(cfg.url(target), {
      headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': cfg.host },
      timeout: 12_000,
      maxRedirects: 3,
    });

    logger.info('SCAN SUCCESS', { requestId: req.id, tool, target, status: response.status });
    res.json({ status: 'success', data: response.data });
  } catch (err) {
    logger.error('SCAN FAILED', { requestId: req.id, tool, target, error: err.message });
    res.status(502).json({
      status: 'error',
      code: 'UPSTREAM_ERROR',
      message: 'External scan service unavailable. Returning cached data.',
      mock: getMockData(tool, target),
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN — VISITOR ANALYTICS  (/api/visitors)
// ─────────────────────────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (!token || token !== ADMIN_TOKEN) {
    logger.warn('UNAUTHORIZED ACCESS ATTEMPT', { ip: getClientIP(req), path: req.path });
    return res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Invalid or missing admin token.' });
  }
  next();
}

function readAllVisitors() {
  if (!fs.existsSync(VISITORS_LOG)) return [];
  return fs.readFileSync(VISITORS_LOG, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

function buildStats(visitors) {
  const counter = (arr, key) =>
    arr.reduce((acc, v) => {
      const k = (key(v) || 'Unknown');
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

  const topN = (obj, n = 10) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});

  const total = visitors.length;
  const bots = visitors.filter(v => v.signals?.isBot).length;
  const humans = total - bots;
  const threats = visitors.filter(v => (v.signals?.threatScore || 0) >= 3).length;
  const euVisitors = visitors.filter(v => v.geo?.eu === '1').length;

  return {
    overview: {
      total,
      humans,
      bots,
      threats,
      euVisitors,
      uniqueIPs: new Set(visitors.map(v => v.ip)).size,
      uniqueCountries: new Set(visitors.map(v => v.geo?.country).filter(Boolean)).size,
      firstSeen: visitors[0]?.timestamp || null,
      lastSeen: visitors[total - 1]?.timestamp || null,
    },
    top: {
      countries: topN(counter(visitors, v => v.geo?.country)),
      cities: topN(counter(visitors, v => v.geo?.city)),
      browsers: topN(counter(visitors, v => v.browser?.name)),
      os: topN(counter(visitors, v => v.os?.name)),
      devices: topN(counter(visitors, v => v.device?.type)),
      referrers: topN(counter(visitors, v => v.request?.referrer || 'direct')),
      pages: topN(counter(visitors, v => v.request?.path)),
      languages: topN(counter(visitors, v => (v.signals?.acceptLang || '').split(',')[0].split(';')[0].trim())),
      botTypes: topN(counter(visitors.filter(v => v.signals?.isBot), v => v.signals?.botType)),
      platforms: topN(counter(visitors, v => {
        const p = v.clientHints?.platform;
        return p ? p.replace(/"/g, '') : (v.os?.name || 'Unknown');
      })),
    },
    threatBreakdown: {
      clean: visitors.filter(v => v.signals?.threatLevel === 'clean').length,
      low: visitors.filter(v => v.signals?.threatLevel === 'low').length,
      medium: visitors.filter(v => v.signals?.threatLevel === 'medium').length,
      high: visitors.filter(v => v.signals?.threatLevel === 'high').length,
    },
  };
}

// GET /api/visitors — paginated list + aggregated stats
app.get('/api/visitors', requireAdmin, (req, res) => {
  const visitors = readAllVisitors();
  const stats = buildStats(visitors);

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(500, parseInt(req.query.limit) || 50);
  const total = visitors.length;
  const slice = visitors.slice().reverse().slice((page - 1) * limit, page * limit);

  logger.info('ADMIN: visitors fetched', { ip: getClientIP(req), total, page });

  res.json({
    meta: {
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
      requestId: req.id,
      generatedAt: new Date().toISOString(),
    },
    stats,
    visitors: slice,
  });
});

// DELETE /api/visitors — wipe all logs
app.delete('/api/visitors', requireAdmin, (req, res) => {
  const before = readAllVisitors().length;
  try {
    fs.writeFileSync(VISITORS_LOG, '');
    logger.warn('ADMIN: visitor logs cleared', { ip: getClientIP(req), entriesRemoved: before });
    res.json({ status: 'success', message: `${before} entries cleared.` });
  } catch (e) {
    logger.error('Failed to clear logs', { error: e.message });
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────
function getMockData(tool, target) {
  return {
    ip: { isp: 'Google LLC', city: 'Mountain View', country: 'US', proxy: false, threat_score: 0 },
    subdomains: [`api.${target}`, `dev.${target}`, `staging.${target}`, `mail.${target}`],
    malicious: { status: 'CLEAN', verdict: 'SAFE', engines: '0/68' },
    ioc: { match: false, last_seen: 'Active', threat: 'none' },
    proxies: ['192.168.1.1:8080', '45.33.22.11:3128'],
    leak: { leaked: true, sources: ['Adobe', 'LinkedIn'], total: 2, advice: 'Change your password immediately.' },
    ssl: { valid: true, expires: '2026-12-31', issuer: 'Let\'s Encrypt', protocol: 'TLS 1.3' },
    dns: { A: ['1.1.1.1'], MX: ['mail.example.com'], TXT: ['v=spf1 include:_spf.google.com ~all'] },
    cinema: { target: target || '' },
  }[tool] || {};
}

// ─────────────────────────────────────────────────────────────────────────────
//  STATIC FILES  — registered AFTER all API/route handlers
// ─────────────────────────────────────────────────────────────────────────────
app.use(
  express.static(path.join(__dirname, 'src'), {
    etag: true,
    lastModified: true,
    maxAge: IS_PROD ? '7d' : 0,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  })
);

// ─────────────────────────────────────────────────────────────────────────────
//  GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error('UNHANDLED ERROR', {
    requestId: req.id,
    message: err.message,
    stack: err.stack,
    path: req.path,
    ip: getClientIP(req),
  });
  res.status(err.status || 500).json({
    status: 'error',
    code: 'INTERNAL_ERROR',
    requestId: req.id,
    message: IS_PROD ? 'An unexpected error occurred.' : err.message,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  ANONYMOUS CHAT ENGINE (/api/chat)
// ─────────────────────────────────────────────────────────────────────────────
const rooms = new Map(); // Map<string, Array<{id, user, text, time}>>
const MAX_MSG = 50;

app.post('/api/chat/send', (req, res) => {
  const { room, message, user } = req.body;
  const ip = getClientIP(req);
  if (!room || !message) {
    logger.warn('CHAT SEND MISSING FIELDS', { room, message });
    return res.status(400).json({ status: 'error', message: 'Missing fields' });
  }

  if (!rooms.has(room)) rooms.set(room, []);
  const msgs = rooms.get(room);

  const username = user ? String(user).trim().substring(0, 20) : `user_${ip.split('.').slice(-1)}`;

  const entry = {
    id: Date.now() + Math.random(),
    user: username,
    text: String(message).substring(0, 500),
    time: new Date().toISOString(),
  };

  msgs.push(entry);
  if (msgs.length > MAX_MSG) msgs.shift();

  logger.info('CHAT MESSAGE', { room, user: entry.user, requestId: req.id });
  res.json({ status: 'success', entry });
});

app.get('/api/chat/messages', (req, res) => {
  const { room } = req.query;
  if (!room) return res.json({ status: 'success', messages: [] });
  res.json({ status: 'success', messages: rooms.get(room) || [] });
});

// 404 — catchall
app.use((req, res) => {
  logger.debug('404', { path: req.path, ip: getClientIP(req) });
  res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Resource not found.' });
});

// ─────────────────────────────────────────────────────────────────────────────
//  GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────────────────────────────────────
function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully…`);
  server.close(() => {
    logger.info('HTTP server closed. Goodbye.');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Shutdown timeout — forcing exit.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => logger.error('UNCAUGHT EXCEPTION', { error: err.message, stack: err.stack }));
process.on('unhandledRejection', (err) => logger.error('UNHANDLED REJECTION', { error: String(err) }));

// ─────────────────────────────────────────────────────────────────────────────
//  START
// ─────────────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info('SERVER STARTED', {
    port: PORT,
    env: NODE_ENV,
    pid: process.pid,
    node: process.version,
    static: path.join(__dirname, 'src'),
    visitorLog: VISITORS_LOG,
    endpoints: {
      health: `http://localhost:${PORT}/health`,
      visitors: `http://localhost:${PORT}/api/visitors  (header: x-admin-token)`,
      scan: `http://localhost:${PORT}/api/cyber-scan?tool=ip&target=8.8.8.8`,
    },
  });
});
