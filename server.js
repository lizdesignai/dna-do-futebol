const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;
const NEON_CONN =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_I2gYxnq9zVOX@ep-aged-dust-b4ycyy76-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';
const NEON_SQL_URL = 'https://ep-aged-dust-b4ycyy76-pooler.c-6.us-east-2.aws.neon.tech/sql';

// ============================================================================
// CREDENCIAIS ADMINISTRATIVAS E SESSÃO CRIPTOGRAFADA (PAINEL DE LEADS)
// ============================================================================
const ADMIN_USER = process.env.ADMIN_USER || 'paulovitor';
const ADMIN_PASS = process.env.ADMIN_PASS || 'DnaFutebol@2026';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dna-futebol-secret-key-2026-pv-lizdesign';

function createAdminToken(username) {
  const exp = Date.now() + 1000 * 60 * 60 * 12; // expira em 12 horas
  const payload = Buffer.from(JSON.stringify({ u: username, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyAdminToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');

  if (sig !== expectedSig) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || Date.now() > data.exp) return false;
    return data.u === ADMIN_USER;
  } catch (e) {
    return false;
  }
}

function extractAuthToken(req) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = req.headers['cookie'] || '';
  const match = cookieHeader.match(/(?:^|;\s*)dna_admin_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Executa uma query SQL parametrizada diretamente no Neon PostgreSQL via HTTP API
 */
async function queryNeon(query, params = []) {
  const res = await fetch(NEON_SQL_URL, {
    method: 'POST',
    headers: {
      'Neon-Connection-String': NEON_CONN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, params }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Neon SQL Error (${res.status}): ${errText}`);
  }
  return res.json();
}

/**
 * Inicializa a tabela de Leads e Ranking do Minigame no Neon DB
 */
async function initDatabase() {
  try {
    await queryNeon(`
      CREATE TABLE IF NOT EXISTS dna_game_leads (
        id SERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        phone VARCHAR(40) NOT NULL UNIQUE,
        best_score INTEGER DEFAULT 0,
        goals INTEGER DEFAULT 0,
        favorite_mode VARCHAR(60) DEFAULT '1v1 Duelo',
        plays_count INTEGER DEFAULT 1,
        contacted BOOLEAN DEFAULT FALSE,
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('[NeonDB] Tabela dna_game_leads pronta e verificada.');
  } catch (err) {
    console.error('[NeonDB] Erro ao inicializar tabela:', err.message);
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, status, data, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  if (req.method === 'OPTIONS') {
    return sendJSON(res, 200, { ok: true });
  }

  // ==========================================================================
  // ROTAS DE API — AUTENTICAÇÃO ADMIN, MINIGAME & LEADS (NEON DB)
  // ==========================================================================
  try {
    // 0. POST /api/admin/login -> Autenticação obrigatória para o Painel de Leads
    if (pathname === '/api/admin/login' && req.method === 'POST') {
      const body = await parseBody(req);
      const user = String(body.username || '').trim();
      const pass = String(body.password || '');

      if (user === ADMIN_USER && pass === ADMIN_PASS) {
        const token = createAdminToken(user);
        return sendJSON(
          res,
          200,
          { ok: true, token },
          {
            'Set-Cookie': `dna_admin_token=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=43200; SameSite=Strict`,
          }
        );
      }
      return sendJSON(res, 401, {
        ok: false,
        error: 'Credenciais inválidas. Acesso negado.',
      });
    }

    // 0.1 POST /api/admin/logout -> Encerra sessão administrativa
    if (pathname === '/api/admin/logout' && req.method === 'POST') {
      return sendJSON(
        res,
        200,
        { ok: true },
        {
          'Set-Cookie': 'dna_admin_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict',
        }
      );
    }

    // 1. GET /api/leaderboard -> Público (Apenas Nome, Pontos, Gols e Modo, SEM TELEFONE)
    if (pathname === '/api/leaderboard' && req.method === 'GET') {
      const result = await queryNeon(`
        SELECT id, name, best_score, goals, favorite_mode, plays_count, updated_at
        FROM dna_game_leads
        ORDER BY best_score DESC, goals DESC, updated_at ASC
        LIMIT 15
      `);
      return sendJSON(res, 200, { ok: true, leaderboard: result.rows || [] });
    }

    // 2. POST /api/lead -> Público (Cadastra ou atualiza Jogador no Minigame)
    if (pathname === '/api/lead' && req.method === 'POST') {
      const body = await parseBody(req);
      const name = String(body.name || '').trim();
      const rawPhone = String(body.phone || '').replace(/\D/g, '');
      const mode = String(body.mode || '1v1 Duelo').trim();

      if (!name || rawPhone.length < 10) {
        return sendJSON(res, 400, {
          ok: false,
          error: 'Informe seu nome e um WhatsApp válido com DDD.',
        });
      }

      const upsert = await queryNeon(
        `
        INSERT INTO dna_game_leads (name, phone, favorite_mode, plays_count, updated_at)
        VALUES ($1, $2, $3, 1, NOW())
        ON CONFLICT (phone) DO UPDATE
        SET name = EXCLUDED.name,
            favorite_mode = EXCLUDED.favorite_mode,
            plays_count = dna_game_leads.plays_count + 1,
            updated_at = NOW()
        RETURNING id, name, best_score, goals, favorite_mode, plays_count
        `,
        [name, rawPhone, mode]
      );

      return sendJSON(res, 200, { ok: true, player: upsert.rows[0] });
    }

    // 3. POST /api/score -> Público (Salva pontuação da partida)
    if (pathname === '/api/score' && req.method === 'POST') {
      const body = await parseBody(req);
      const rawPhone = String(body.phone || '').replace(/\D/g, '');
      const score = parseInt(body.score, 10) || 0;
      const goals = parseInt(body.goals, 10) || 0;
      const mode = String(body.mode || '1v1 Duelo').trim();

      if (!rawPhone) {
        return sendJSON(res, 400, { ok: false, error: 'Telefone ausente.' });
      }

      const updateRes = await queryNeon(
        `
        UPDATE dna_game_leads
        SET best_score = GREATEST(best_score, $1),
            goals = GREATEST(goals, $2),
            favorite_mode = $3,
            updated_at = NOW()
        WHERE phone = $4
        RETURNING id, name, best_score, goals, favorite_mode, plays_count
        `,
        [score, goals, mode, rawPhone]
      );

      return sendJSON(res, 200, {
        ok: true,
        player: updateRes.rows ? updateRes.rows[0] : null,
      });
    }

    // ========================================================================
    // ROTAS PROTEGIDAS (/api/leads) — EXIGEM AUTENTICAÇÃO VÁLIDA
    // ========================================================================
    if (pathname === '/api/leads') {
      const token = extractAuthToken(req);
      if (!verifyAdminToken(token)) {
        return sendJSON(res, 401, {
          ok: false,
          error: 'Não autorizado. Faça login para acessar os leads.',
        });
      }

      if (req.method === 'GET') {
        const result = await queryNeon(`
          SELECT id, name, phone, best_score, goals, favorite_mode, plays_count, contacted, notes, created_at, updated_at
          FROM dna_game_leads
          ORDER BY created_at DESC
        `);
        return sendJSON(res, 200, { ok: true, leads: result.rows || [] });
      }

      if (req.method === 'PATCH') {
        const body = await parseBody(req);
        const id = parseInt(body.id, 10);
        const contacted = Boolean(body.contacted);
        const notes = body.notes !== undefined ? String(body.notes) : null;

        if (!id) {
          return sendJSON(res, 400, { ok: false, error: 'ID inválido.' });
        }

        if (notes !== null) {
          await queryNeon(
            `UPDATE dna_game_leads SET contacted = $1, notes = $2, updated_at = NOW() WHERE id = $3`,
            [contacted, notes, id]
          );
        } else {
          await queryNeon(
            `UPDATE dna_game_leads SET contacted = $1, updated_at = NOW() WHERE id = $2`,
            [contacted, id]
          );
        }
        return sendJSON(res, 200, { ok: true });
      }

      if (req.method === 'DELETE') {
        const body = await parseBody(req);
        const id = parseInt(body.id, 10);
        if (!id) return sendJSON(res, 400, { ok: false, error: 'ID inválido.' });
        await queryNeon(`DELETE FROM dna_game_leads WHERE id = $1`, [id]);
        return sendJSON(res, 200, { ok: true });
      }
    }
  } catch (apiErr) {
    console.error('[API Error]', apiErr);
    return sendJSON(res, 500, { ok: false, error: apiErr.message });
  }

  // ==========================================================================
  // BLOQUEIO DE ARQUIVOS SENSÍVEIS E SERVIDOR ESTÁTICO
  // ==========================================================================
  let safePath = pathname === '/' ? '/index.html' : pathname;
  if (safePath === '/favicon.ico') safePath = '/img/favicon.svg';

  // Impede acesso público ao código do servidor ou pastas ocultas (.git, .env)
  if (
    safePath === '/server.js' ||
    safePath.startsWith('/.') ||
    safePath.endsWith('.env')
  ) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 - Acesso Restrito');
  }

  const filePath = path.join(__dirname, safePath);
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 - Arquivo não encontrado');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

initDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`Servidor DNA do Futebol + NeonDB rodando em http://localhost:${PORT}`);
  });
});
