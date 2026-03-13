// Monolithic Node.js app serving API and frontend
const path = require('path');
const fs = require('fs');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(raw => {
    const line = raw.trim();
    if (line && !line.startsWith('#')) {
      const eq = line.indexOf('=');
      if (eq > 0) {
        const key = line.slice(0, eq).trim();
        const val = line.slice(eq + 1).trim();
        if (key) process.env[key] = val;
      }
    }
  });
}
const express = require('express');
const MongoStore = require('./mongo_store');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Release API - must be first so nothing intercepts
app.get('/api/problem-statement-released', async (req, res) => {
  try {
    const released = await db.getProblemStatementReleased();
    res.setHeader('Content-Type', 'application/json');
    res.json({ released });
  } catch (err) {
    console.error('Error fetching release status:', err);
    res.status(500).json({ released: false });
  }
});
app.post('/api/admin/problem-statement-release', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    if (!db || typeof db.getProblemStatementReleased !== 'function') {
      return res.status(500).json({ error: 'Database not ready', released: false });
    }
    const current = await db.getProblemStatementReleased();
    const released = !current;
    await db.setProblemStatementReleased(released);
    broadcastUpdate('release', { released });
    res.json({ released });
  } catch (err) {
    console.error('Error toggling release:', err);
    res.status(500).json({ error: String(err.message), released: false });
  }
});

// Configure trusted proxy safely (avoid permissive setting)
const TRUST_PROXY = process.env.VERCEL ? 1 : false;
app.set('trust proxy', TRUST_PROXY);

// Admin Login (cookie-based)
const ADMIN_USER = process.env.ADMIN_USER || '';
const ADMIN_PASS = process.env.ADMIN_PASS || '';
function isAuthenticated(req){
  const cookie = req.headers['cookie'] || '';
  return cookie.split(';').some(c => c.trim().startsWith('admin_auth=1'));
}
function requireAdmin(req, res, next) {
  if (isAuthenticated(req)) return next();
  return res.redirect('/admin-login');
}

function formatProblems(statements) {
  return statements.map((ps) => {
    const technologies = Array.isArray(ps.technologies) ? ps.technologies : (ps.technologies ? ps.technologies : []);
    const selectedCount = Number.isFinite(ps.selected_count) ? ps.selected_count : (parseInt(ps.selected_count || '0', 10) || 0);
    const maxSelections = Math.max(1, (Number.isFinite(ps.max_selections) ? ps.max_selections : (parseInt(ps.max_selections || '0', 10) || 0)));
    const isAvailable = selectedCount < maxSelections;
    return {
      id: ps.id,
      title: ps.title,
      description: ps.description,
      category: ps.category || null,
      difficulty: ps.difficulty || null,
      technologies,
      selectedCount,
      maxSelections,
      isAvailable
    };
  });
}

// Initialize database - use in-memory when NO_DATABASE=1 or MONGODB_URI unset; otherwise MongoDB
const USE_MEMORY_STORE = process.env.NO_DATABASE === '1' || !process.env.MONGODB_URI;
const MONGODB_URI = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'hackathon';
const prefix = process.env.MONGODB_COLLECTION_PREFIX || '';
const MemoryStore = require('./memory_store');
let db = null;
if (USE_MEMORY_STORE) {
  db = new MemoryStore();
  console.log('Running without database (in-memory store). Data will not persist. Set MONGODB_URI for production.');
} else {
  db = new MongoStore(MONGODB_URI, dbName, prefix);
}

async function initializeDatabase() {
  if (!db) return;
  try {
    await db.init();
  } catch (error) {
    console.error('Error during database initialization:', error);
    throw error;
  }
}

// Ensure database is initialized before handling any requests on Vercel
let dbReadyPromise = null;
if (process.env.VERCEL) {
  dbReadyPromise = db ? (async () => { try { await initializeDatabase(); } catch (e) { console.error('DB init failed:', e); } })() : null;
  app.use(async (req, res, next) => {
    if (!db) {
      return res.status(503).send('<!DOCTYPE html><html><body style="font-family:Arial;padding:40px;text-align:center"><h2>Configuration Required</h2><p>MONGODB_URI is not set. Add it in Vercel Project Settings → Environment Variables.</p></body></html>');
    }
    try { if (dbReadyPromise) await dbReadyPromise; } catch (_) {}
    next();
  });
}

// Add rate limiting (enabled in production only)
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
  trustProxy: true
});
if (process.env.NODE_ENV === 'production') {
  app.use('/api/', limiter);
}

// SSE for live updates
const connectedClients = new Set();
function broadcastUpdate(type, data) {
  const message = `data: ${JSON.stringify({ type, data, timestamp: new Date().toISOString() })}\n\n`;
  connectedClients.forEach((client) => { try { client.write(message); } catch (_) { connectedClients.delete(client); } });
}

// API
app.get('/api/problem-statements', async (req, res) => {
  try {
    res.set({ 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
    const released = await db.getProblemStatementReleased();
    if (!released) {
      return res.json([]);
    }
    const statements = await db.getAllProblemStatements();
    const formatted = formatProblems(statements).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    res.json(formatted);
  } catch (error) {
    console.error('Error fetching problem statements:', error);
    res.status(500).json({ error: 'Failed to fetch problem statements' });
  }
});


app.get('/api/teams', async (req, res) => {
  try {
    res.set({ 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
    const teams = await db.getAllTeams();
    res.json(teams);
  } catch (_) { res.status(500).json({ error: 'Failed to load teams' }); }
});

app.get('/api/teams/search', async (req, res) => {
  res.set({ 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    if (!q || q.length < 2) return res.json([]);
    const teams = await db.searchTeams(q);
    res.json(teams);
  } catch (_) { res.json([]); }
});

app.get('/api/participants/search', async (req, res) => {
  res.set({ 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) return res.json([]);
    const participants = await db.searchParticipants(q);
    res.json(participants.map(p => ({
      participantName: p.name,
      teamNumber: p.regNo,
      teamName: p.college || '',
      teamLeader: p.name || '',
      teamMembers: p.name || '',
      name: p.name,
      regNo: p.regNo,
      college: p.college,
      city: p.city,
      email: p.email,
      phnNo: p.phnNo,
      dept: p.dept,
      gender: p.gender,
      year: p.year
    })));
  } catch (_) { res.json([]); }
});

app.get('/api/teams/:teamNumber', async (req, res) => {
  res.set({ 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
  try {
    const team = await db.getTeamByNumber(req.params.teamNumber);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json(team);
  } catch (_) { res.status(500).json({ error: 'Team lookup failed' }); }
});

app.get('/api/events', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Cache-Control' });
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Real-time updates enabled' })}\n\n`);
  connectedClients.add(res);
  const heartbeat = setInterval(() => { try { res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`); } catch (_) { clearInterval(heartbeat); connectedClients.delete(res); } }, 30000);
  req.on('close', () => { clearInterval(heartbeat); connectedClients.delete(res); });
});

// Store team only (when user confirms on home page, before problem selection)
app.post('/api/register/team', async (req, res) => {
  try {
    const { teamNumber, teamName, teamLeader, teamMembers } = req.body;
    if (!teamNumber || !teamName || !teamLeader) {
      return res.status(400).json({ error: 'Missing required fields: teamNumber, teamName, teamLeader' });
    }
    const isTaken = await db.isTeamNumberTaken(teamNumber);
    if (isTaken) return res.status(409).json({ error: 'Team number already registered.' });
    const result = typeof db.createTeamOnly === 'function'
      ? await db.createTeamOnly(teamNumber, teamName, teamLeader, teamMembers || '')
      : null;
    if (!result) return res.status(409).json({ error: 'Team number already registered.' });
    console.log('[Registration] Team saved (pending problem):', { teamNumber, teamName, teamLeader });
    try {
      const updatedRegistrations = await db.getAllRegistrations();
      broadcastUpdate('registration', { registrations: updatedRegistrations });
    } catch (_) {}
    res.json({ success: true, message: 'Team registered. Please select a problem statement.', teamNumber });
  } catch (error) {
    console.error('Error saving team:', error);
    res.status(500).json({ error: 'Failed to save team', details: error.message });
  }
});

// Get single registration by team number
app.get('/api/registration/:teamNumber', async (req, res) => {
  try {
    const teamNumber = String(req.params.teamNumber || '').trim();
    if (!teamNumber) return res.status(400).json({ error: 'Missing teamNumber' });
    const reg = typeof db.getRegistrationByTeamNumber === 'function'
      ? await db.getRegistrationByTeamNumber(teamNumber)
      : null;
    if (!reg) return res.status(404).json({ error: 'Registration not found' });
    res.json(reg);
  } catch (error) {
    console.error('Error fetching registration:', error);
    res.status(500).json({ error: 'Failed to fetch registration' });
  }
});

// Update existing team registration with problem statement (when user selects problem on problem page)
app.patch('/api/registration/:teamNumber', async (req, res) => {
  try {
    const teamNumber = String(req.params.teamNumber || '').trim();
    const { problemStatementId } = req.body || {};
    if (!teamNumber || !problemStatementId) {
      return res.status(400).json({ error: 'Missing teamNumber or problemStatementId' });
    }
    const existing = typeof db.getRegistrationByTeamNumber === 'function'
      ? await db.getRegistrationByTeamNumber(teamNumber)
      : null;
    if (existing && existing.problem_statement_id) {
      return res.status(409).json({ error: 'Your team has already selected a problem. You cannot change your selection.' });
    }
    const ps = await db.getProblemStatementById(problemStatementId);
    if (!ps) return res.status(404).json({ error: 'Problem statement not found.' });
    const result = typeof db.updateRegistrationProblem === 'function'
      ? await db.updateRegistrationProblem(teamNumber, problemStatementId)
      : null;
    if (!result) {
      const allProblems = formatProblems(await db.getAllProblemStatements());
      const targetProblem = allProblems.find(p => p.id === problemStatementId);
      if (targetProblem && !targetProblem.isAvailable) {
        return res.status(409).json({ error: 'Problem statement is full. Please select another.' });
      }
      return res.status(409).json({ error: 'Registration update failed. Team may not exist or problem is full.' });
    }
    console.log('[Registration] Problem updated:', { teamNumber, problemStatementId });
    try {
      const updatedRegistrations = await db.getAllRegistrations();
      const updatedProblems = formatProblems(await db.getAllProblemStatements());
      broadcastUpdate('registration', { registrations: updatedRegistrations, problems: updatedProblems });
    } catch (_) {}
    const reg = (await db.getAllRegistrations()).find(r => r.team_number === teamNumber);
    res.json({ success: true, message: 'Registration complete!', registration: reg });
  } catch (error) {
    console.error('Error updating registration:', error);
    res.status(500).json({ error: 'Failed to update registration', details: error.message });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { teamNumber, teamName, teamLeader, problemStatementId, teamMembers } = req.body;
    if (!teamNumber || !teamName || !teamLeader || !problemStatementId) {
      return res.status(400).json({ error: 'Missing required fields: teamNumber, teamName, teamLeader, problemStatementId' });
    }
    
    // Check if team number is already taken
    const isTaken = await db.isTeamNumberTaken(teamNumber);
    if (isTaken) return res.status(409).json({ error: 'Team number already registered.' });
    
    // Check if problem statement exists
    const ps = await db.getProblemStatementById(problemStatementId);
    if (!ps) return res.status(404).json({ error: 'Problem statement not found.' });
    
    // Get current state of all problem statements for better error messages
    const allProblems = formatProblems(await db.getAllProblemStatements());
    const targetProblem = allProblems.find(p => p.id === problemStatementId);
    
    // Attempt atomic registration
    const registration = await db.createRegistrationAtomic({ teamNumber, teamName, teamLeader, problemStatementId, teamMembers: teamMembers || '' });
    
    if (!registration) {
      // Registration failed - provide simple feedback
      if (targetProblem && !targetProblem.isAvailable) {
        // Problem statement is full
        return res.status(409).json({
          error: 'Registration failed - Problem statement is full',
          details: {
            selectedProblem: {
              id: targetProblem.id,
              title: targetProblem.title,
              status: `${targetProblem.selectedCount}/${targetProblem.maxSelections} slots filled`
            },
            message: 'This problem statement is full. Please try another problem statement.'
          }
        });
      } else {
        // Other registration failure (shouldn't happen with current logic, but safety net)
        return res.status(409).json({ 
          error: 'Registration failed', 
          details: 'Unable to complete registration. Please try again.' 
        });
      }
    }
    
    // Registration successful - log for debugging
    console.log('[Registration] Saved:', { teamNumber, teamName, teamLeader, problemStatementId });
    try {
      const updatedRegistrations = await db.getAllRegistrations();
      const updatedProblems = formatProblems(await db.getAllProblemStatements());
      broadcastUpdate('registration', { registrations: updatedRegistrations, problems: updatedProblems, newRegistration: { ...registration, problemStatement: ps } });
    } catch (_) {}
    
    res.json({ 
      success: true,
      message: 'Registration successful!', 
      registration: { ...registration, problemStatement: ps },
      problemStatement: {
        id: targetProblem.id,
        title: targetProblem.title,
        category: targetProblem.category,
        difficulty: targetProblem.difficulty,
        newStatus: `${targetProblem.selectedCount + 1}/${targetProblem.maxSelections} slots filled`
      }
    });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

app.delete('/api/registration/:teamNumber', async (req, res) => {
  try {
    const result = await db.deleteRegistration(req.params.teamNumber);
    if (result.changes === 0) return res.status(404).json({ error: 'Registration not found' });
    try {
      const updatedRegistrations = await db.getAllRegistrations();
      const updatedProblems = formatProblems(await db.getAllProblemStatements());
      broadcastUpdate('deletion', { registrations: updatedRegistrations, problems: updatedProblems, deletedTeamNumber: String(req.params.teamNumber).trim() });
    } catch (_) {}
    res.json({ message: 'Registration deleted successfully' });
  } catch (error) {
    console.error('Error deleting registration:', error);
    res.status(500).json({ error: 'Failed to delete registration' });
  }
});

// Add a single problem statement
app.post('/api/problem-statements', async (req, res) => {
  try {
    const { id, title, description, category, difficulty, technologies, maxSelections } = req.body;
    if (!id || !title || !description) {
      return res.status(400).json({ error: 'Missing required fields: id, title, description' });
    }
    const result = await db.createProblemStatement({
      id: String(id).trim(),
      title: String(title).trim(),
      description: String(description).trim(),
      category: category || null,
      difficulty: difficulty || null,
      technologies: Array.isArray(technologies) ? technologies : (technologies ? String(technologies).split(',').map(t => t.trim()).filter(Boolean) : []),
      maxSelections: Math.max(1, parseInt(maxSelections || '2', 10) || 2)
    });
    if (result.changes === 0) {
      return res.status(409).json({ error: `Problem statement with id "${id}" already exists.` });
    }
    const problems = formatProblems(await db.getAllProblemStatements());
    broadcastUpdate('problems', { problems });
    res.json({ ok: true, id: result.id });
  } catch (error) {
    console.error('Error adding problem statement:', error);
    res.status(500).json({ error: 'Failed to add problem statement' });
  }
});

// Bulk import problem statements from parsed CSV/JSON array
app.post('/api/problem-statements/bulk', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required and must not be empty' });
    }
    let added = 0, skipped = 0;
    for (const ps of items) {
      if (!ps.id || !ps.title || !ps.description) { skipped++; continue; }
      const result = await db.createProblemStatement({
        id: String(ps.id).trim(),
        title: String(ps.title).trim(),
        description: String(ps.description).trim(),
        category: ps.category || null,
        difficulty: ps.difficulty || null,
        technologies: Array.isArray(ps.technologies) ? ps.technologies : (ps.technologies ? String(ps.technologies).split(',').map(t => t.trim()).filter(Boolean) : []),
        maxSelections: Math.max(1, parseInt(ps.maxSelections || '2', 10) || 2)
      });
      if (result.changes > 0) added++; else skipped++;
    }
    const problems = formatProblems(await db.getAllProblemStatements());
    broadcastUpdate('problems', { problems });
    res.json({ ok: true, added, skipped });
  } catch (error) {
    console.error('Error bulk importing problem statements:', error);
    res.status(500).json({ error: 'Failed to import problem statements' });
  }
});

// Delete a problem statement
app.delete('/api/problem-statements/:id', async (req, res) => {
  try {
    const result = await db.deleteProblemStatement(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Problem statement not found' });
    const problems = formatProblems(await db.getAllProblemStatements());
    broadcastUpdate('problems', { problems });
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting problem statement:', error);
    res.status(500).json({ error: 'Failed to delete problem statement' });
  }
});

// Admin: reset all data (re-seed defaults)
app.post('/api/reset', async (req, res) => {
  try {
    await db.resetAll();
    const registrations = await db.getAllRegistrations();
    const problems = formatProblems(await db.getAllProblemStatements());
    broadcastUpdate('reset', { registrations, problems });
    res.json({ ok: true });
  } catch (error) {
    console.error('Error during reset:', error);
    res.status(500).json({ error: 'Failed to reset data' });
  }
});

app.get('/api/registrations', async (req, res) => {
  try {
    res.set({ 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
    const registrations = await db.getAllRegistrations();
    res.json(registrations);
  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

app.get('/api/admin/storage-mode', (req, res) => {
  res.json({ mode: process.env.MONGODB_URI ? 'mongodb' : 'memory' });
});

app.get('/api/evaluation-criteria', async (req, res) => {
  try {
    res.set({ 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
    let criteria = null;
    try {
      if (typeof db.getEvaluationCriteria === 'function') {
        criteria = await db.getEvaluationCriteria();
      }
    } catch (_) {}

    if (!criteria) {
      return res.status(404).json({ error: 'Evaluation criteria not found' });
    }
    res.json(criteria);
  } catch (error) {
    console.error('Error fetching evaluation criteria:', error);
    res.status(500).json({ error: 'Failed to fetch evaluation criteria' });
  }
});

// Export endpoints (HTML-to-print)
app.get('/api/export/registrations/pdf', async (req, res) => {
  try {
    const registrations = await db.getAllRegistrations();
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Registrations</title><style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background:#c10016;color:#fff}</style></head><body><h1>Registrations</h1>${registrations.length?`<table><thead><tr><th>Team #</th><th>Team Name</th><th>Team Leader</th><th>Team Members</th><th>Problem Statement</th></tr></thead><tbody>${registrations.map(r=>`<tr><td>${r.team_number}</td><td>${r.team_name||''}</td><td>${r.team_leader||''}</td><td>${(r.team_members||'').replace(/</g,'&lt;')}</td><td>${r.problem_title||''}</td></tr>`).join('')}</tbody></table>`:`<p>No registrations.</p>`}</body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'inline; filename="registrations-report.html"');
    res.send(html);
  } catch (error) {
    console.error('Error exporting registrations PDF:', error);
    res.status(500).json({ error: 'Failed to export registrations PDF' });
  }
});

// Export Problem Selections (grouped by problem statement)
app.get('/api/export/problem-selections/pdf', async (req, res) => {
  try {
    const registrations = await db.getAllRegistrations();
    const confirmed = (registrations || []).filter(r => r.problem_title && r.problem_title !== 'Pending');
    if (confirmed.length === 0) {
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Problem Selections Report</title><style>body{font-family:Arial;padding:24px;max-width:900px;margin:0 auto}h1{color:#c10016;border-bottom:2px solid #c10016;padding-bottom:8px}.empty{color:#666;font-size:1.1rem}</style></head><body><h1>Problem Statements Selection Report</h1><p class="empty">No problem selections yet. Teams will appear here after they select and confirm a problem.</p><p style="margin-top:20px;color:#888;font-size:0.9rem;">Generated: ${new Date().toLocaleString('en-IN')}</p></body></html>`;
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', 'inline; filename="problem-selections-report.html"');
      return res.send(html);
    }
    const byProblem = {};
    confirmed.forEach(r => {
      const key = r.problem_title || 'Unknown';
      if (!byProblem[key]) byProblem[key] = [];
      byProblem[key].push(r);
    });
    const problemOrder = Object.keys(byProblem).sort();
    let sections = '';
    problemOrder.forEach((probTitle, idx) => {
      const teams = byProblem[probTitle];
      const rows = teams.map((r, i) => `<tr><td>${i + 1}</td><td>${r.team_number || '—'}</td><td>${r.team_name || '—'}</td><td>${r.team_leader || '—'}</td><td>${(r.team_members || '').replace(/</g, '&lt;').replace(/\|/g, ', ')}</td></tr>`).join('');
      sections += `<div class="problem-section"><h2>${idx + 1}. ${probTitle}</h2><p class="team-count">${teams.length} team(s) selected</p><table><thead><tr><th>#</th><th>Team #</th><th>Team Name</th><th>Team Leader</th><th>Team Members</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    });
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Problem Selections Report</title><style>body{font-family:Arial,sans-serif;padding:24px;max-width:900px;margin:0 auto}h1{color:#c10016;border-bottom:2px solid #c10016;padding-bottom:8px;margin-bottom:24px}.problem-section{margin-bottom:32px;page-break-inside:avoid}.problem-section h2{color:#333;font-size:1.1rem;margin-bottom:4px}.team-count{color:#666;font-size:0.9rem;margin-bottom:12px}table{width:100%;border-collapse:collapse;font-size:0.9rem}th,td{border:1px solid #ddd;padding:8px 10px;text-align:left}th{background:#c10016;color:#fff;font-weight:600}tbody tr:nth-child(even){background:#f9f9f9}.meta{color:#888;font-size:0.85rem;margin-top:24px;padding-top:16px;border-top:1px solid #eee}</style></head><body><h1>Problem Statements Selection Report</h1><p style="color:#666;margin-bottom:24px;">DIGICON 4.0 — Teams grouped by their selected problem statement.</p>${sections}<p class="meta">Generated: ${new Date().toLocaleString('en-IN')} &nbsp;| &nbsp;Total: ${confirmed.length} team(s)</p></body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'inline; filename="problem-selections-report.html"');
    res.send(html);
  } catch (error) {
    console.error('Error exporting problem selections PDF:', error);
    res.status(500).json({ error: 'Failed to export problem selections PDF' });
  }
});

app.get('/api/export/problem-statements/pdf', async (req, res) => {
  try {
    const problems = (await db.getAllProblemStatements()).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    const html = `<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>Problem Statements</title><style>body{font-family:Arial;padding:20px}.card{border:1px solid #ddd;margin-bottom:10px;padding:10px;border-radius:4px}.status{font-weight:bold}.ok{color:#28a745}.full{color:#dc3545}</style></head><body><h1>Problem Statements</h1>${problems.map(p=>{const teams=`${(p.selected_count??p.selectedCount)}/${(p.max_selections??p.maxSelections)}`;const isOk=(p.is_available??p.isAvailable);const statusHtml=`<span class=\"status ${isOk?'ok':'full'}\">${isOk?'Available':'Full'}</span>`;return `<div class=\"card\"><h3>${p.title}</h3><div>ID: ${p.id} | Category: ${p.category||'N/A'} | Teams: ${teams} | Status: ${statusHtml}</div><div style=\"margin-top:6px;\">${p.description}</div></div>`;}).join('')}</body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'inline; filename="problem-statements-report.html"');
    res.send(html);
  } catch (error) {
    console.error('Error exporting problem statements PDF:', error);
    res.status(500).json({ error: 'Failed to export problem statements PDF' });
  }
});

app.get('/api/export/all/pdf', async (req, res) => {
  try {
    const problems = (await db.getAllProblemStatements()).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    const registrations = await db.getAllRegistrations();
    const html = `<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>Complete Report</title><style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background:#c10016;color:#fff}.card{border:1px solid #ddd;margin-bottom:10px;padding:10px;border-radius:4px}.status{font-weight:bold}.ok{color:#28a745}.full{color:#dc3545}</style></head><body><h1>Complete Report</h1><h2>Problem Statements</h2>${problems.map(p=>{const teams=`${(p.selected_count??p.selectedCount)}/${(p.max_selections??p.maxSelections)}`;const isOk=(p.is_available??p.isAvailable);const statusHtml=`<span class=\"status ${isOk?'ok':'full'}\">${isOk?'Available':'Full'}</span>`;return `<div class=\"card\"><strong>${p.title}</strong><div style=\"font-size:12px;color:#555;\">ID: ${p.id} | Category: ${p.category||'N/A'} | Teams: ${teams} | Status: ${statusHtml}</div><div style=\"margin-top:6px;\">${p.description}</div></div>`;}).join('')}<h2>Registrations</h2>${registrations.length?`<table><thead><tr><th>Team #</th><th>Team Name</th><th>Team Leader</th><th>Team Members</th><th>Problem Statement</th></tr></thead><tbody>${registrations.map(r=>`<tr><td>${r.team_number}</td><td>${r.team_name||''}</td><td>${r.team_leader||''}</td><td>${(r.team_members||'').replace(/</g,'&lt;')}</td><td>${r.problem_title||''}</td></tr>`).join('')}</tbody></table>`:`<p>No registrations.</p>`}</body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'inline; filename="hackathon-complete-report.html"');
    res.send(html);
  } catch (error) {
    console.error('Error exporting complete PDF:', error);
    res.status(500).json({ error: 'Failed to export complete PDF' });
  }
});

// Admin: delete all teams
app.delete('/api/admin/teams', async (req, res) => {
  try {
    const deleted = await db.deleteAllTeams();
    res.json({ ok: true, deletedCount: deleted });
  } catch (error) {
    console.error('Error deleting teams:', error);
    res.status(500).json({ error: 'Failed to delete teams' });
  }
});

// Admin: get all registrations (teams) from database
app.get('/api/admin/registrations', async (req, res) => {
  res.set({ 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
  try {
    const registrations = await db.getAllRegistrations();
    res.json(registrations);
  } catch (err) {
    console.error('Error fetching registrations:', err);
    res.status(500).json([]);
  }
});

// Admin: get all participants
app.get('/api/admin/participants', async (req, res) => {
  res.set({ 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
  try {
    const participants = typeof db.getAllParticipants === 'function' ? await db.getAllParticipants() : [];
    res.json(participants);
  } catch (err) {
    console.error('Error fetching participants:', err);
    res.status(500).json([]);
  }
});

// Admin: upload participants CSV
app.post('/api/admin/participants/upload', async (req, res) => {
  try {
    const { csv } = req.body;
    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "csv" field in request body' });
    }
    const count = await db.replaceParticipantsFromCSV(csv.trim() + '\n');
    res.json({ ok: true, participantsCount: count });
  } catch (error) {
    console.error('Error uploading participants CSV:', error);
    res.status(500).json({ error: error.message || 'Failed to save participants CSV' });
  }
});

// Admin: upload teams CSV (stores in MongoDB - works on Vercel serverless)
app.post('/api/admin/teams/upload', async (req, res) => {
  try {
    const { csv } = req.body;
    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "csv" field in request body' });
    }
    const lines = csv.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 1) {
      return res.status(400).json({ error: 'CSV must have at least a header row' });
    }
    const header = (lines[0] || '').trim().toLowerCase();
    if (!header.startsWith('teamnumber,teamname,teamleader')) {
      return res.status(400).json({ error: 'CSV header must start with: teamNumber,teamName,teamLeader (optional: ,teamMembers)' });
    }
    const count = await db.replaceTeamsFromCSV(csv.trim() + '\n');
    res.json({ ok: true, teamsCount: count });
  } catch (error) {
    console.error('Error uploading teams CSV:', error);
    res.status(500).json({ error: error.message || 'Failed to save teams CSV' });
  }
});

// Static files (after API routes so /api/* is handled first)
app.use(express.static(path.join(__dirname, 'public')));

// Winners API (public) - only returns winners when released
app.get('/api/winners', async (req, res) => {
  try {
    res.set({ 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' });
    const released = typeof db.getWinnersReleased === 'function' ? await db.getWinnersReleased() : false;
    const winners = released && typeof db.getAllWinners === 'function' ? await db.getAllWinners() : [];
    res.json({ released, winners });
  } catch (err) {
    console.error('Error fetching winners:', err);
    res.status(500).json({ released: false, winners: [] });
  }
});

// Admin: get winners list and release status (always returns full list)
app.get('/api/admin/winners', async (req, res) => {
  try {
    const released = typeof db.getWinnersReleased === 'function' ? await db.getWinnersReleased() : false;
    const winners = typeof db.getAllWinners === 'function' ? await db.getAllWinners() : [];
    res.json({ released, winners });
  } catch (err) {
    console.error('Error fetching admin winners:', err);
    res.status(500).json({ released: false, winners: [] });
  }
});

// Admin: toggle winners release (show/hide on public page)
app.post('/api/admin/winners/release', async (req, res) => {
  try {
    if (typeof db.getWinnersReleased !== 'function' || typeof db.setWinnersReleased !== 'function') {
      return res.status(501).json({ error: 'Release not supported' });
    }
    const current = await db.getWinnersReleased();
    const next = !current;
    await db.setWinnersReleased(next);
    const winners = await db.getAllWinners();
    broadcastUpdate('winners', { released: next, winners });
    res.json({ ok: true, released: next, winners });
  } catch (error) {
    console.error('Error toggling winners release:', error);
    res.status(500).json({ error: error.message || 'Failed to toggle release' });
  }
});

// Admin: add winner
app.post('/api/admin/winners', async (req, res) => {
  try {
    const { position, teamName, teamLeader, problemStatement, teamMembers, teamPhoto } = req.body || {};
    if (!teamName || !teamLeader) {
      return res.status(400).json({ error: 'Team name and team leader are required' });
    }
    const result = await db.addWinner({ position: position || 1, teamName, teamLeader, problemStatement: problemStatement || '', teamMembers: teamMembers || '', teamPhoto: teamPhoto || null });
    if (!result) {
      return res.status(409).json({ error: 'This team has already been added as a winner. No duplicate winners allowed.' });
    }
    const winners = await db.getAllWinners();
    const released = typeof db.getWinnersReleased === 'function' ? await db.getWinnersReleased() : false;
    broadcastUpdate('winners', { released, winners });
    res.json({ ok: true, id: result.id, winners });
  } catch (error) {
    console.error('Error adding winner:', error);
    res.status(500).json({ error: error.message || 'Failed to add winner' });
  }
});

// Admin: update winner photo
app.patch('/api/admin/winners/:id', async (req, res) => {
  try {
    const { teamPhoto } = req.body || {};
    if (typeof db.updateWinnerPhoto !== 'function') {
      return res.status(501).json({ error: 'Photo update not supported' });
    }
    const result = await db.updateWinnerPhoto(req.params.id, teamPhoto || null);
    if (result.changes === 0) return res.status(404).json({ error: 'Winner not found' });
    const winners = await db.getAllWinners();
    const released = typeof db.getWinnersReleased === 'function' ? await db.getWinnersReleased() : false;
    broadcastUpdate('winners', { released, winners });
    res.json({ ok: true, winners });
  } catch (error) {
    console.error('Error updating winner photo:', error);
    res.status(500).json({ error: error.message || 'Failed to update photo' });
  }
});

// Admin: delete winner
app.delete('/api/admin/winners/:id', async (req, res) => {
  try {
    const result = await db.deleteWinner(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Winner not found' });
    const winners = await db.getAllWinners();
    const released = typeof db.getWinnersReleased === 'function' ? await db.getWinnersReleased() : false;
    broadcastUpdate('winners', { released, winners });
    res.json({ ok: true, winners });
  } catch (error) {
    console.error('Error deleting winner:', error);
    res.status(500).json({ error: error.message || 'Failed to delete winner' });
  }
});

// Frontend routes
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'home.html')); });
app.get('/problem', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'problem.html')); });
app.get('/winners', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'winners.html')); });
app.get('/admin', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'admin.html')); });
app.get('/admin-login', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'admin-login.html')); });
app.post('/api/admin/login', express.urlencoded({ extended: false }), (req, res) => {
  const user = (req.body.username || '').trim();
  const pass = (req.body.password || '').trim();
  if (ADMIN_USER && ADMIN_PASS && user === ADMIN_USER && pass === ADMIN_PASS) {
    res.setHeader('Set-Cookie', 'admin_auth=1; Path=/; HttpOnly; SameSite=Lax');
    return res.redirect('/admin');
  }
  return res.status(401).send('<!DOCTYPE html><html><body style="font-family:Arial;padding:20px"><h3 style="color:#c10016">Access denied</h3><p>Admin credentials are not set or invalid. Please configure ADMIN_USER and ADMIN_PASS in environment variables.</p><a href="/admin-login">Back to login</a></body></html>');
});
app.post('/api/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'admin_auth=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax');
  return res.redirect('/admin-login');
});

process.on('SIGINT', async () => { await db.close(); process.exit(0); });

async function startServer() {
  await initializeDatabase();
  // Optional: auto-reset on cold start to ensure clean slate
  if (process.env.AUTO_RESET === '1') {
    try {
      await db.resetAll();
      const registrations = await db.getAllRegistrations();
      const problems = formatProblems(await db.getAllProblemStatements());
      broadcastUpdate('reset', { registrations, problems });
    } catch (e) {
      console.error('Auto reset failed:', e);
    }
  }
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch(console.error);
} else {
  // On Vercel, export the app for the serverless function runtime
  module.exports = app;
}


