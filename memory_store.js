/**
 * In-memory store for running without MongoDB.
 * Use when MONGODB_URI is not set - ideal for UI development and redesign.
 * Data is lost on server restart.
 */
class MemoryStore {
  constructor() {
    this.problemStatements = [];
    this.registrations = [];
    this.teams = [];
    this.participants = [];
    this.winners = [];
    this.evaluationCriteria = null;
    this.problemStatementReleased = false;
  }

  async init() {
    // No-op - empty store, no seed data for fresh start
  }

  async close() {
    // No-op for in-memory
  }

  async getAllProblemStatements() {
    const idToCount = new Map();
    this.registrations.forEach(r => {
      idToCount.set(r.problemStatementId, (idToCount.get(r.problemStatementId) || 0) + 1);
    });
    return this.problemStatements.map(p => {
      const parsedMax = typeof p.maxSelections === 'number' ? p.maxSelections : parseInt(p.maxSelections || '0', 10) || 0;
      const maxSel = Math.max(1, parsedMax);
      const selected = idToCount.get(p.id) || 0;
      return {
        id: p.id,
        title: p.title,
        description: p.description,
        max_selections: maxSel,
        category: p.category || null,
        difficulty: p.difficulty || null,
        technologies: Array.isArray(p.technologies) ? p.technologies : [],
        selected_count: selected,
        is_available: selected < maxSel
      };
    });
  }

  async getProblemStatementById(id) {
    return this.problemStatements.find(p => p.id === id) || null;
  }

  async createProblemStatement(ps) {
    const exists = this.problemStatements.some(p => p.id === ps.id);
    if (exists) return { id: ps.id, changes: 0 };
    const parsedMax = typeof ps.maxSelections === 'number' ? ps.maxSelections : parseInt(ps.maxSelections || '0', 10) || 0;
    const maxSel = Math.max(1, parsedMax);
    this.problemStatements.push({
      id: ps.id,
      title: ps.title,
      description: ps.description,
      maxSelections: maxSel,
      category: ps.category || null,
      difficulty: ps.difficulty || null,
      technologies: Array.isArray(ps.technologies) ? ps.technologies : []
    });
    return { id: ps.id, changes: 1 };
  }

  async updateProblemStatement(id, updates) {
    const idx = this.problemStatements.findIndex(p => p.id === id);
    if (idx === -1) return { id, changes: 0 };
    const p = this.problemStatements[idx];
    if (updates.title !== undefined) p.title = updates.title;
    if (updates.description !== undefined) p.description = updates.description;
    if (updates.category !== undefined) p.category = updates.category;
    if (updates.difficulty !== undefined) p.difficulty = updates.difficulty;
    if (updates.technologies !== undefined) p.technologies = Array.isArray(updates.technologies) ? updates.technologies : [];
    if (updates.max_selections !== undefined || updates.maxSelections !== undefined) {
      const val = updates.max_selections ?? updates.maxSelections;
      p.maxSelections = Math.max(1, typeof val === 'number' ? val : parseInt(val || '0', 10) || 0);
    }
    return { id, changes: 1 };
  }

  async deleteProblemStatement(id) {
    const idx = this.problemStatements.findIndex(p => p.id === id);
    if (idx === -1) return { id, changes: 0 };
    this.problemStatements.splice(idx, 1);
    this.registrations = this.registrations.filter(r => r.problemStatementId !== id);
    return { id, changes: 1 };
  }

  async getEvaluationCriteria() {
    return this.evaluationCriteria;
  }

  async getAllRegistrations() {
    const idToPs = new Map(this.problemStatements.map(p => [p.id, p]));
    return this.registrations.map(r => ({
      team_number: r.teamNumber,
      team_name: r.teamName,
      team_leader: r.teamLeader,
      team_members: r.teamMembers || '',
      problem_title: (r.problemStatementId && idToPs.get(r.problemStatementId)?.title) || 'Pending',
      problem_category: idToPs.get(r.problemStatementId)?.category || null,
      problem_difficulty: idToPs.get(r.problemStatementId)?.difficulty || null,
      registration_date_time: r.registrationDateTime
    }));
  }

  async getRegistrationsByProblemStatement(problemStatementId) {
    const problem = this.problemStatements.find(p => p.id === problemStatementId);
    return this.registrations
      .filter(r => r.problemStatementId === problemStatementId)
      .map(r => ({
        team_number: r.teamNumber,
        team_name: r.teamName,
        team_leader: r.teamLeader,
        problem_title: problem?.title || '',
        registration_date_time: r.registrationDateTime
      }));
  }

  async getRegistrationByTeamNumber(teamNumber) {
    const target = String(teamNumber).trim();
    const reg = this.registrations.find(r => r.teamNumber === target);
    if (!reg) return null;
    const problem = reg.problemStatementId ? this.problemStatements.find(p => p.id === reg.problemStatementId) : null;
    return {
      team_number: reg.teamNumber,
      team_name: reg.teamName,
      team_leader: reg.teamLeader,
      team_members: reg.teamMembers || '',
      problem_statement_id: reg.problemStatementId || null,
      problem_title: problem?.title || null,
      registration_date_time: reg.registrationDateTime
    };
  }

  async isTeamNumberTaken(teamNumber) {
    const target = String(teamNumber).trim();
    return this.registrations.some(r => r.teamNumber === target);
  }

  async createTeamOnly(teamNumber, teamName, teamLeader, teamMembers) {
    const target = String(teamNumber).trim();
    if (this.registrations.some(r => r.teamNumber === target)) return null;
    const record = {
      teamNumber: target,
      teamName: teamName || '',
      teamLeader: teamLeader || '',
      teamMembers: teamMembers || '',
      problemStatementId: null,
      registrationDateTime: new Date().toISOString()
    };
    this.registrations.push(record);
    return { id: record.teamNumber, changes: 1 };
  }

  async updateRegistrationProblem(teamNumber, problemStatementId) {
    const target = String(teamNumber).trim();
    const reg = this.registrations.find(r => r.teamNumber === target);
    if (!reg) return null;
    if (reg.problemStatementId) return null; // Team already selected - cannot change
    const problem = this.problemStatements.find(p => p.id === problemStatementId);
    if (!problem) return null;
    const maxSel = Math.max(1, typeof problem.maxSelections === 'number' ? problem.maxSelections : parseInt(problem.maxSelections || '0', 10) || 0);
    const count = this.registrations.filter(r => r.problemStatementId === problem.id).length;
    if (count >= maxSel) return null;
    reg.problemStatementId = problemStatementId;
    return { id: target, changes: 1 };
  }

  async createRegistrationAtomic(registration) {
    const target = String(registration.teamNumber).trim();
    if (this.registrations.some(r => r.teamNumber === target)) return null;

    const problem = this.problemStatements.find(p => p.id === registration.problemStatementId);
    if (!problem) return null;

    const maxSel = Math.max(1, typeof problem.maxSelections === 'number' ? problem.maxSelections : parseInt(problem.maxSelections || '0', 10) || 0);
    const count = this.registrations.filter(r => r.problemStatementId === problem.id).length;
    if (count >= maxSel) return null;

    const record = {
      teamNumber: target,
      teamName: registration.teamName,
      teamLeader: registration.teamLeader,
      teamMembers: registration.teamMembers || '',
      problemStatementId: registration.problemStatementId,
      registrationDateTime: new Date().toISOString()
    };
    this.registrations.push(record);
    return { id: record.teamNumber, changes: 1 };
  }

  async deleteRegistration(teamNumber) {
    const target = String(teamNumber).trim();
    const idx = this.registrations.findIndex(r => r.teamNumber === target);
    if (idx === -1) return { changes: 0 };
    this.registrations.splice(idx, 1);
    return { changes: 1 };
  }

  async importFromJSON(jsonData) {
    if (!jsonData?.problemStatements) return;
    const existingIds = new Set(this.problemStatements.map(p => p.id));
    jsonData.problemStatements.forEach(psItem => {
      if (existingIds.has(psItem.id)) return;
      const maxSel = Math.max(1, parseInt(psItem.maxSelections || '2', 10) || 2);
      this.problemStatements.push({
        id: psItem.id,
        title: psItem.title,
        description: psItem.description,
        maxSelections: maxSel,
        category: psItem.category || null,
        difficulty: psItem.difficulty || null,
        technologies: Array.isArray(psItem.technologies) ? psItem.technologies : []
      });
      existingIds.add(psItem.id);
    });
  }

  async resetAll() {
    this.problemStatements = [];
    this.registrations = [];
    this.teams = [];
    this.participants = [];
    this.winners = [];
    return true;
  }

  async getAllWinners() {
    return [...this.winners].sort((a, b) => (a.position || 0) - (b.position || 0)).map(w => ({
      id: w.id,
      position: w.position,
      teamName: w.teamName || '',
      teamLeader: w.teamLeader || '',
      problemStatement: w.problemStatement || '',
      teamMembers: w.teamMembers || '',
      teamPhoto: w.teamPhoto || null
    }));
  }

  async addWinner(winner) {
    const teamName = (winner.teamName || '').trim().toLowerCase();
    if (!teamName) return null;
    const isDuplicate = this.winners.some(w => String(w.teamName || '').toLowerCase() === teamName);
    if (isDuplicate) return null;
    const id = 'w' + Date.now();
    this.winners.push({
      id,
      position: Number(winner.position) || 1,
      teamName: (winner.teamName || '').trim(),
      teamLeader: winner.teamLeader || '',
      problemStatement: winner.problemStatement || '',
      teamMembers: winner.teamMembers || '',
      teamPhoto: winner.teamPhoto || null
    });
    return { id, changes: 1 };
  }

  async updateWinnerPhoto(id, teamPhotoBase64) {
    const w = this.winners.find(x => x.id === id);
    if (!w) return { changes: 0 };
    w.teamPhoto = teamPhotoBase64 || null;
    return { changes: 1 };
  }

  async deleteWinner(id) {
    const idx = this.winners.findIndex(w => w.id === id);
    if (idx === -1) return { changes: 0 };
    this.winners.splice(idx, 1);
    return { changes: 1 };
  }

  async getTeamByNumber(teamNumber) {
    return this.teams.find(t => t.teamNumber === String(teamNumber).trim()) || null;
  }

  async searchTeams(q) {
    const lower = q.toLowerCase();
    return this.teams.filter(t => {
      const leader = (t.teamLeader || '').toLowerCase();
      const name = (t.teamName || '').toLowerCase();
      const members = (t.teamMembers || '').toLowerCase();
      const num = (t.teamNumber || '').toLowerCase();
      return leader.includes(lower) || name.includes(lower) || num.includes(lower) || members.includes(lower);
    });
  }

  async getAllParticipants() {
    return [...this.participants];
  }

  async searchParticipants(q) {
    const lower = q.toLowerCase();
    return this.participants.filter(p => {
      const name = (p.name || '').toLowerCase();
      const regNo = (p.regNo || '').toLowerCase();
      const email = (p.email || '').toLowerCase();
      return name.includes(lower) || regNo.includes(lower) || email.includes(lower);
    });
  }

  async getParticipantsByTeam(teamNumber) {
    return [];
  }

  async replaceParticipantsFromCSV(csvContent) {
    const lines = csvContent.trim().split(/\r?\n/).filter(Boolean);
    // Skip title rows (e.g. "DIGICON 4.0 FINAL PARTCIPANTS LIST") until we find header with NAME, REG NO
    let headerIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const h = (lines[i] || '').trim().toLowerCase();
      if (h.includes('name') && h.includes('reg no')) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx < 0) {
      throw new Error('CSV must include a header row with: NAME, REG NO (and optionally COLLEGE, CITY, EMAIL, PHN NO, DEPT/DEP, GENDER, YEAR)');
    }
    const header = lines[headerIdx];
    const rows = lines.slice(headerIdx + 1);
    const cols = header.split(',').map(c => c.trim().toLowerCase());
    const idx = (keys) => {
      const k = Array.isArray(keys) ? keys : [keys];
      for (const key of k) {
        const v = key.replace(/\s/g, '');
        const i = cols.findIndex(c => c.replace(/\s/g, '') === v || c.includes(v));
        if (i >= 0) return i;
      }
      return -1;
    };
    const formatRegNo = (val) => {
      const s = String(val || '').trim();
      if (/^\d+\.?\d*[eE][+-]?\d+$/.test(s)) {
        const n = parseFloat(s);
        return Number.isFinite(n) ? String(Math.round(n)) : s;
      }
      return s;
    };
    const docs = [];
    rows.forEach(line => {
      const parts = line.split(',').map(p => p.trim());
      const name = (idx(['name']) >= 0 ? parts[idx(['name'])] : parts[0]) || '';
      const rawRegNo = idx(['regno', 'reg no']) >= 0 ? parts[idx(['regno', 'reg no'])] : parts[1] || '';
      const regNo = formatRegNo(rawRegNo);
      if (!name || !regNo) return;
      const extra = parts.length > 9 ? parts.slice(9).join(',').trim() : '';
      docs.push({
        name,
        regNo,
        college: (idx(['college']) >= 0 ? parts[idx(['college'])] : parts[2]) || '',
        city: (idx(['city']) >= 0 ? parts[idx(['city'])] : parts[3]) || '',
        email: (idx(['email']) >= 0 ? parts[idx(['email'])] : parts[4]) || '',
        phnNo: (idx(['phnno', 'phn no']) >= 0 ? parts[idx(['phnno', 'phn no'])] : parts[5]) || '',
        dept: (idx(['dept', 'dep']) >= 0 ? parts[idx(['dept', 'dep'])] : parts[6]) || '',
        gender: (idx(['gender']) >= 0 ? parts[idx(['gender'])] : parts[7]) || '',
        year: (idx(['year']) >= 0 ? parts[idx(['year'])] : parts[8]) || '',
        extra: extra || ''
      });
    });
    this.participants = docs;
    return docs.length;
  }

  async getAllTeams() {
    return [...this.teams];
  }

  async deleteAllTeams() {
    const count = this.teams.length;
    this.teams = [];
    return count;
  }

  async replaceTeamsFromCSV(csvContent) {
    const lines = csvContent.trim().split(/\r?\n/).filter(Boolean);
    const [header, ...rows] = lines;
    const h = (header || '').trim().toLowerCase();
    const hasMembers = h.includes('teammembers');
    const expected = hasMembers ? 'teamNumber,teamName,teamLeader,teamMembers' : 'teamNumber,teamName,teamLeader';
    if (!header || !h.startsWith('teamnumber,teamname,teamleader')) {
      throw new Error(`CSV header must start with: teamNumber,teamName,teamLeader (optional: ,teamMembers)`);
    }
    const docs = [];
    rows.forEach(line => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 3) return;
      const teamNumber = String(parts[0]).trim();
      const teamName = parts[1] !== undefined ? String(parts[1]).trim() : '';
      const teamLeader = parts[2] !== undefined ? String(parts[2]).trim() : '';
      const teamMembers = (hasMembers && parts.length > 3) ? parts.slice(3).join(',').trim() : '';
      if (!teamNumber) return;
      docs.push({ teamNumber, teamName, teamLeader, teamMembers });
    });
    this.teams = docs;
    return docs.length;
  }

  async getProblemStatementReleased() {
    return Boolean(this.problemStatementReleased);
  }

  async setProblemStatementReleased(released) {
    this.problemStatementReleased = released;
    return released;
  }
}

module.exports = MemoryStore;
