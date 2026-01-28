const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const yaml = require('js-yaml');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';

const CONFIG_PATH = path.join(__dirname, 'config', 'services.yml');

function loadConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  return yaml.load(raw);
}

function buildServiceList(config) {
  const environments = config.environments || [];
  const services = [];
  environments.forEach((env) => {
    (env.services || []).forEach((svc) => {
      services.push({
        key: `${env.name}:${svc.id}`,
        environment: env.name,
        id: svc.id,
        label: svc.label || svc.id,
        default_minutes: svc.default_minutes
      });
    });
  });
  return services;
}

app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 365,
      sameSite: 'lax'
    }
  })
);

app.use('/public', express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    if (req.path.startsWith('/api')) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.redirect('/login');
  }
  return next();
}

let db;
let config;
let services;

function toMysqlDateTime(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}-` +
    `${pad(date.getUTCMonth() + 1)}-` +
    `${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:` +
    `${pad(date.getUTCMinutes())}:` +
    `${pad(date.getUTCSeconds())}`
  );
}

function mysqlDateTimeToIso(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value !== 'string') {
    return new Date(value).toISOString();
  }
  return `${value.replace(' ', 'T')}Z`;
}

function mysqlDateTimeToDate(value) {
  const iso = mysqlDateTimeToIso(value);
  return iso ? new Date(iso) : null;
}

async function dbGet(sql, params = []) {
  const [rows] = await db.query(sql, params);
  return rows[0] || null;
}

async function dbAll(sql, params = []) {
  const [rows] = await db.query(sql, params);
  return rows;
}

async function dbRun(sql, params = []) {
  await db.query(sql, params);
}

app.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/');
  }
  return res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }
  const user = await dbGet('SELECT id, email, nickname FROM users WHERE email = ?', [email]);
  if (!user) {
    return res.status(403).json({ error: 'Email not found' });
  }
  req.session.userId = user.id;
  req.session.email = user.email;
  req.session.nickname = user.nickname;
  return res.json({ ok: true, user });
});

app.post('/api/logout', requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({
    id: req.session.userId,
    email: req.session.email,
    nickname: req.session.nickname
  });
});

app.get('/api/services', requireAuth, async (req, res) => {
  const now = toMysqlDateTime(new Date());
  const reservations = await dbAll(
    `SELECT r.service_key, r.environment_name, r.service_name, r.user_id,
            r.claimed_at, r.expires_at, u.nickname
     FROM reservations r
     JOIN users u ON u.id = r.user_id
     WHERE r.released_at IS NULL AND r.expires_at > ?`,
    [now]
  );

  const reservationMap = new Map(
    reservations.map((row) => [row.service_key, row])
  );

  const result = services.map((svc) => {
    const active = reservationMap.get(svc.key);
    return {
      ...svc,
      active: Boolean(active),
      claimed_by: active ? active.nickname : null,
      claimed_by_id: active ? active.user_id : null,
      claimed_at: active ? mysqlDateTimeToIso(active.claimed_at) : null,
      expires_at: active ? mysqlDateTimeToIso(active.expires_at) : null
    };
  });

  res.json({
    expiry_warning_minutes: config.expiry_warning_minutes || 5,
    auto_refresh_minutes: config.auto_refresh_minutes || 2,
    services: result
  });
});

app.post('/api/claim', requireAuth, async (req, res) => {
  const serviceKey = String(req.body.service_key || '').trim();
  const service = services.find((svc) => svc.key === serviceKey);
  if (!service) {
    return res.status(404).json({ error: 'Service not found' });
  }

  const now = new Date();
  const nowIso = toMysqlDateTime(now);

  const existing = await dbGet(
    `SELECT id, user_id, expires_at
     FROM reservations
     WHERE service_key = ? AND released_at IS NULL AND expires_at > ?`,
    [serviceKey, nowIso]
  );

  if (existing) {
    return res.status(409).json({ error: 'Service already claimed' });
  }

  const expires = toMysqlDateTime(new Date(now.getTime() + service.default_minutes * 60000));

  await dbRun(
    `INSERT INTO reservations
     (service_key, environment_name, service_name, user_id, claimed_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)` ,
    [service.key, service.environment, service.label, req.session.userId, nowIso, expires]
  );

  return res.json({ ok: true, expires_at: expires });
});

app.post('/api/release', requireAuth, async (req, res) => {
  const serviceKey = String(req.body.service_key || '').trim();
  const nowIso = toMysqlDateTime(new Date());

  const reservation = await dbGet(
    `SELECT id, user_id FROM reservations
     WHERE service_key = ? AND released_at IS NULL AND expires_at > ?`,
    [serviceKey, nowIso]
  );

  if (!reservation) {
    return res.status(404).json({ error: 'Active reservation not found' });
  }

  if (reservation.user_id !== req.session.userId) {
    return res.status(403).json({ error: 'Only the owner can release' });
  }

  await dbRun(
    `UPDATE reservations SET released_at = ? WHERE id = ?`,
    [nowIso, reservation.id]
  );

  return res.json({ ok: true });
});

app.post('/api/extend', requireAuth, async (req, res) => {
  const serviceKey = String(req.body.service_key || '').trim();
  const service = services.find((svc) => svc.key === serviceKey);
  if (!service) {
    return res.status(404).json({ error: 'Service not found' });
  }

  const now = new Date();
  const nowIso = toMysqlDateTime(now);

  const reservation = await dbGet(
    `SELECT id, user_id, expires_at FROM reservations
     WHERE service_key = ? AND released_at IS NULL AND expires_at > ?`,
    [serviceKey, nowIso]
  );

  if (!reservation) {
    return res.status(404).json({ error: 'Active reservation not found' });
  }

  if (reservation.user_id !== req.session.userId) {
    return res.status(403).json({ error: 'Only the owner can extend' });
  }

  const base = mysqlDateTimeToDate(reservation.expires_at);
  const extended = toMysqlDateTime(new Date(base.getTime() + service.default_minutes * 60000));

  await dbRun(
    `UPDATE reservations SET expires_at = ? WHERE id = ?`,
    [extended, reservation.id]
  );

  return res.json({ ok: true, expires_at: extended });
});

app.get('/events', requireAuth, async (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.flushHeaders();

  let closed = false;
  req.on('close', () => {
    closed = true;
  });

  const warningMinutes = config.expiry_warning_minutes || 5;
  const pollIntervalMs = 15000;

  const interval = setInterval(async () => {
    if (closed) {
      clearInterval(interval);
      return;
    }

    const now = new Date();
    const warningIso = toMysqlDateTime(new Date(now.getTime() + warningMinutes * 60000));
    const nowIso = toMysqlDateTime(now);

    const expiring = await dbAll(
      `SELECT r.service_key, r.expires_at, r.environment_name, r.service_name
       FROM reservations r
       WHERE r.user_id = ?
         AND r.released_at IS NULL
         AND r.expires_at > ?
         AND r.expires_at <= ?`,
      [req.session.userId, nowIso, warningIso]
    );

    expiring.forEach((row) => {
      const expiresAt = mysqlDateTimeToDate(row.expires_at);
      const minutesLeft = Math.max(
        0,
        Math.ceil((expiresAt.getTime() - now.getTime()) / 60000)
      );
      res.write(`event: expiring\n`);
      res.write(
        `data: ${JSON.stringify({
          service_key: row.service_key,
          environment: row.environment_name,
          service_name: row.service_name,
          minutes_left: minutesLeft
        })}\n\n`
      );
    });
  }, pollIntervalMs);
});

async function start() {
  config = loadConfig();
  services = buildServiceList(config);
  db = await initDb();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
