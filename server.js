/**
 * NaTV de Sua Casa — Servidor Node.js
 * Versão segura: headers de segurança, rate limiting, sanitização de input.
 */
import express   from 'express';
import fs        from 'fs';
import path      from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app       = express();
const PORT      = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');
const dataDir   = path.join(__dirname, 'data');
const votesFile = path.join(dataDir, 'votes.json');
const commentsFile = path.join(dataDir, 'comments.json');
const votersFile   = path.join(dataDir, 'voters.json');

/* ── Inicializa diretórios e arquivos ─────────────────────── */
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(votesFile))    fs.writeFileSync(votesFile,    JSON.stringify({ likes: 47, dislikes: 3 }, null, 2));
if (!fs.existsSync(commentsFile)) fs.writeFileSync(commentsFile, JSON.stringify([], null, 2));
if (!fs.existsSync(votersFile))   fs.writeFileSync(votersFile,   JSON.stringify({}, null, 2));

/* ── Helpers JSON ─────────────────────────────────────────── */
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch (_) { return fallback; }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/* ── Sanitização de texto (previne XSS armazenado) ────────── */
function sanitizeText(raw) {
  return String(raw || '')
    .replace(/[<>]/g, '')          // remove tags HTML
    .replace(/javascript:/gi, '')  // remove JS URIs
    .replace(/on\w+=/gi, '')       // remove event handlers inline
    .trim();
}

/* ── Rate limiting simples em memória ─────────────────────── */
const rateLimitMap = new Map(); // ip -> { count, resetAt }
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX    = 30;        // 30 requisições por minuto por IP

function rateLimit(req, res, next) {
  const ip  = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return next();
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Muitas requisições. Tente novamente em 1 minuto.' });
  }
  next();
}

/* Limpa o mapa de rate limit periodicamente */
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 5 * 60 * 1000);

/* ── Dados aleatórios para comentários anônimos ───────────── */
const anonymousNames = [
  'Assinante Feliz', 'Cliente Satisfeito', 'Telespectador', 'Fã de Séries',
  'Maratonista', 'Cinéfilo', 'Usuário Anônimo', 'Espectador', 'Visitante'
];
const avatars = ['🎬','📺','🎥','🍿','⭐','🎭','📽️','🌟','🔥','💎','🏆'];
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ── Middleware: Headers de segurança ─────────────────────── */
app.use((req, res, next) => {
  // Evita clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // Evita sniffing de MIME type
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Desabilita cache em APIs
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  // Content Security Policy básica
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
    "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "frame-src https://widgets.futbolenlatv.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));
  next();
});

/* ── Middleware: JSON parsing (limite seguro) ─────────────── */
app.use(express.json({ limit: '100kb' }));

/* ── Health check ─────────────────────────────────────────── */
app.get('/api/health', (req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'production' });
});

/* ── GET /api/votes ───────────────────────────────────────── */
app.get('/api/votes', rateLimit, (req, res) => {
  res.json(readJson(votesFile, { likes: 47, dislikes: 3 }));
});

/* ── POST /api/votes ──────────────────────────────────────── */
app.post('/api/votes', rateLimit, (req, res) => {
  const { action, visitorId } = req.body || {};

  if (!action || !['like', 'dislike', 'remove'].includes(action)) {
    return res.status(400).json({ error: 'Ação inválida.' });
  }

  // Valida visitorId (apenas alfanuméricos + _ -)
  const safeVid = typeof visitorId === 'string' && /^[a-z0-9_\-]{1,64}$/i.test(visitorId)
    ? visitorId : null;

  const votes  = readJson(votesFile,  { likes: 47, dislikes: 3 });
  const voters = readJson(votersFile, {});
  const prev   = safeVid ? voters[safeVid] : null;

  // Remove voto anterior
  if (prev === 'like')    votes.likes    = Math.max(0, votes.likes - 1);
  if (prev === 'dislike') votes.dislikes = Math.max(0, votes.dislikes - 1);

  // Aplica novo voto
  if (action === 'like')    { votes.likes++;    if (safeVid) voters[safeVid] = 'like';    }
  if (action === 'dislike') { votes.dislikes++; if (safeVid) voters[safeVid] = 'dislike'; }
  if (action === 'remove')  { if (safeVid) delete voters[safeVid]; }

  writeJson(votesFile,  votes);
  writeJson(votersFile, voters);

  res.json({
    success:   true,
    votes,
    userVote:  safeVid ? (voters[safeVid] || null) : null
  });
});

/* ── GET /api/comments ────────────────────────────────────── */
app.get('/api/comments', rateLimit, (req, res) => {
  res.json(readJson(commentsFile, []));
});

/* ── POST /api/comments ───────────────────────────────────── */
app.post('/api/comments', rateLimit, (req, res) => {
  const { action, text, commentId, visitorId } = req.body || {};

  const safeVid = typeof visitorId === 'string' && /^[a-z0-9_\-]{1,64}$/i.test(visitorId)
    ? visitorId : 'anon';

  let comments = readJson(commentsFile, []);

  /* Adicionar comentário */
  if (action === 'add') {
    const clean = sanitizeText(text);
    if (clean.length < 3)   return res.status(400).json({ error: 'Comentário muito curto (mínimo 3 caracteres).' });
    if (clean.length > 500) return res.status(400).json({ error: 'Comentário muito longo (máximo 500 caracteres).' });

    const newComment = {
      id:       generateId(),
      text:     clean,
      name:     rand(anonymousNames),
      avatar:   rand(avatars),
      date:     new Date().toISOString(),
      likes:    0,
      likedBy:  []
    };

    comments.unshift(newComment);
    comments = comments.slice(0, 100); // máximo 100 comentários
    writeJson(commentsFile, comments);
    return res.json({ success: true, comment: newComment, comments });
  }

  /* Curtir comentário */
  if (action === 'like') {
    if (!commentId || typeof commentId !== 'string') {
      return res.status(400).json({ error: 'commentId inválido.' });
    }

    const idx = comments.findIndex((c) => c.id === commentId);
    if (idx === -1) return res.status(404).json({ error: 'Comentário não encontrado.' });

    const c = comments[idx];
    c.likedBy = Array.isArray(c.likedBy) ? c.likedBy : [];

    const likeIdx = c.likedBy.indexOf(safeVid);
    if (likeIdx === -1) {
      c.likedBy.push(safeVid);
      c.likes = (c.likes || 0) + 1;
    } else {
      c.likedBy.splice(likeIdx, 1);
      c.likes = Math.max(0, (c.likes || 0) - 1);
    }

    comments[idx] = c;
    writeJson(commentsFile, comments);
    return res.json({ success: true, comment: c, comments });
  }

  return res.status(400).json({ error: 'Ação inválida.' });
});

/* ── Arquivos estáticos (public/) ─────────────────────────── */
app.use(express.static(publicDir, {
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    // Cache longo para assets imutáveis
    if (filePath.match(/\.(svg|png|ico|webp|woff2?)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
    // Cache curto para HTML
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

/* ── Fallback → index.html (SPA-like) ────────────────────── */
app.get('*', (req, res) => {
  const requested = req.path === '/' ? '/index.html' : req.path;
  const filePath  = path.join(publicDir, requested);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return res.sendFile(filePath);
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

/* ── Start ────────────────────────────────────────────────── */
app.listen(PORT);
