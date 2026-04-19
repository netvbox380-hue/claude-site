import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir   = path.join(__dirname, '../../data');
const votesFile = path.join(dataDir, 'votes.json');
const votersFile = path.join(dataDir, 'voters.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(votesFile))  fs.writeFileSync(votesFile,  JSON.stringify({ likes: 47, dislikes: 3 }));
if (!fs.existsSync(votersFile)) fs.writeFileSync(votersFile, JSON.stringify({}));

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f,'utf-8')); } catch { return d; } };
const writeJson = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

export const handler = async (event) => {
  if (event.httpMethod === 'GET') {
    return { statusCode: 200, headers, body: JSON.stringify(readJson(votesFile, { likes: 47, dislikes: 3 })) };
  }

  if (event.httpMethod === 'POST') {
    const { action, visitorId } = JSON.parse(event.body || '{}');
    if (!['like','dislike','remove'].includes(action)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ação inválida.' }) };
    }
    const safeVid = typeof visitorId === 'string' && /^[a-z0-9_-]{1,64}$/i.test(visitorId) ? visitorId : null;
    const votes  = readJson(votesFile,  { likes: 47, dislikes: 3 });
    const voters = readJson(votersFile, {});
    const prev   = safeVid ? voters[safeVid] : null;
    if (prev === 'like')    votes.likes    = Math.max(0, votes.likes - 1);
    if (prev === 'dislike') votes.dislikes = Math.max(0, votes.dislikes - 1);
    if (action === 'like')    { votes.likes++;    if (safeVid) voters[safeVid] = 'like'; }
    if (action === 'dislike') { votes.dislikes++; if (safeVid) voters[safeVid] = 'dislike'; }
    if (action === 'remove')  { if (safeVid) delete voters[safeVid]; }
    writeJson(votesFile, votes); writeJson(votersFile, voters);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, votes, userVote: safeVid ? (voters[safeVid] || null) : null }) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método não permitido.' }) };
};
