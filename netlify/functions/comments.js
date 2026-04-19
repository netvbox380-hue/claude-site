import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir      = path.join(__dirname, '../../data');
const commentsFile = path.join(dataDir, 'comments.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(commentsFile)) fs.writeFileSync(commentsFile, '[]');

const readJson  = (f, d) => { try { return JSON.parse(fs.readFileSync(f,'utf-8')); } catch { return d; } };
const writeJson = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const rand  = (a) => a[Math.floor(Math.random() * a.length)];
const names   = ['Assinante Feliz','Cliente Satisfeito','Telespectador','Fã de Séries','Maratonista','Cinéfilo','Espectador'];
const avatars = ['🎬','📺','🎥','🍿','⭐','🎭','📽️','🌟','🔥'];

const sanitize = (t) => String(t||'').replace(/[<>]/g,'').replace(/javascript:/gi,'').trim();

const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

export const handler = async (event) => {
  if (event.httpMethod === 'GET') {
    return { statusCode: 200, headers, body: JSON.stringify(readJson(commentsFile, [])) };
  }

  if (event.httpMethod === 'POST') {
    const { action, text, commentId, visitorId } = JSON.parse(event.body || '{}');
    const safeVid = typeof visitorId === 'string' && /^[a-z0-9_-]{1,64}$/i.test(visitorId) ? visitorId : 'anon';
    let comments = readJson(commentsFile, []);

    if (action === 'add') {
      const clean = sanitize(text);
      if (clean.length < 3)   return { statusCode: 400, headers, body: JSON.stringify({ error: 'Comentário muito curto.' }) };
      if (clean.length > 500) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Máximo 500 caracteres.' }) };
      const c = { id: genId(), text: clean, name: rand(names), avatar: rand(avatars), date: new Date().toISOString(), likes: 0, likedBy: [] };
      comments.unshift(c);
      comments = comments.slice(0, 100);
      writeJson(commentsFile, comments);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, comment: c, comments }) };
    }

    if (action === 'like') {
      if (!commentId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'commentId ausente.' }) };
      const idx = comments.findIndex(c => c.id === commentId);
      if (idx === -1) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Comentário não encontrado.' }) };
      const c = comments[idx];
      c.likedBy = Array.isArray(c.likedBy) ? c.likedBy : [];
      const li = c.likedBy.indexOf(safeVid);
      if (li === -1) { c.likedBy.push(safeVid); c.likes = (c.likes||0)+1; }
      else { c.likedBy.splice(li,1); c.likes = Math.max(0,(c.likes||0)-1); }
      comments[idx] = c; writeJson(commentsFile, comments);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, comment: c, comments }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ação inválida.' }) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método não permitido.' }) };
};
