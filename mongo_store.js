const { MongoClient } = require('mongodb');

class MongoStore {
  constructor(uri, dbName, collectionPrefix = '') {
    this.uri = uri;
    this.dbName = dbName;
    this.collectionPrefix = collectionPrefix || '';
    this.client = new MongoClient(this.uri, { serverSelectionTimeoutMS: 15000 });
    this.db = null;
    this.collections = null;
  }

  async init() {
    if (this.db) return;
    await this.client.connect();
    this.db = this.client.db(this.dbName);
    const ps = this.db.collection(`${this.collectionPrefix}problem_statements`);
    const regs = this.db.collection(`${this.collectionPrefix}registrations`);
    const teams = this.db.collection(`${this.collectionPrefix}teams`);
    const participants = this.db.collection(`${this.collectionPrefix}participants`);
    const winners = this.db.collection(`${this.collectionPrefix}winners`);
    this.collections = { ps, regs, teams, participants, winners };
    // indexes
    await ps.createIndex({ id: 1 }, { unique: true });
    await regs.createIndex({ teamNumber: 1 }, { unique: true });
    await regs.createIndex({ problemStatementId: 1 });
    await teams.createIndex({ teamNumber: 1 }, { unique: true });
    await participants.createIndex({ name: 1 });
    await participants.createIndex({ regNo: 1 });
    await winners.createIndex({ position: 1 });
    // seed defaults if empty
    const count = await ps.estimatedDocumentCount();
    if (count === 0) {
      const defaults = [
        { id: 'ps001', title: 'Secure Authentication System', description: 'Design and implement a multi-factor authentication system with biometric verification, OTP, and secure session management for a banking application.', maxSelections: 2, category: 'Cybersecurity', difficulty: 'Advanced', technologies: ['Node.js', 'React', 'JWT'] },
        { id: 'ps002', title: 'AI-Powered Code Review Assistant', description: 'Develop an intelligent code review tool that uses machine learning to detect bugs, security vulnerabilities, and suggest improvements in real-time.', maxSelections: 2, category: 'Artificial Intelligence', difficulty: 'Advanced', technologies: ['Python', 'TensorFlow'] },
        { id: 'ps003', title: 'Blockchain Supply Chain Tracker', description: 'Create a transparent supply chain management system using blockchain technology to track products from manufacturer to consumer.', maxSelections: 2, category: 'Blockchain', difficulty: 'Intermediate', technologies: ['Ethereum', 'Solidity'] }
      ];
      await ps.insertMany(defaults);
    }
  }

  async close() {
    try { await this.client.close(); } catch (_) {}
  }

  async getAllProblemStatements() {
    if (!this.collections) await this.init();
    const { ps, regs } = this.collections;
    const [problems, registrations] = await Promise.all([
      ps.find({}).toArray(),
      regs.find({}).toArray()
    ]);
    const idToCount = new Map();
    registrations.forEach(r => {
      idToCount.set(r.problemStatementId, (idToCount.get(r.problemStatementId) || 0) + 1);
    });
    return problems.map(p => {
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
    if (!this.collections) await this.init();
    const { ps } = this.collections;
    return await ps.findOne({ id })
  }

  async createProblemStatement(problemStatement) {
    if (!this.collections) await this.init();
    const { ps } = this.collections;
    const parsedMax = typeof problemStatement.maxSelections === 'number' ? problemStatement.maxSelections : parseInt(problemStatement.maxSelections || '0', 10) || 0;
    const maxSel = Math.max(1, parsedMax);
    try {
      await ps.insertOne({
        id: problemStatement.id,
        title: problemStatement.title,
        description: problemStatement.description,
        maxSelections: maxSel,
        category: problemStatement.category || null,
        difficulty: problemStatement.difficulty || null,
        technologies: Array.isArray(problemStatement.technologies) ? problemStatement.technologies : []
      });
      return { id: problemStatement.id, changes: 1 };
    } catch (e) {
      return { id: problemStatement.id, changes: 0 };
    }
  }

  async updateProblemStatement(id, updates) {
    if (!this.collections) await this.init();
    const { ps } = this.collections;
    const doc = {};
    if (updates.title !== undefined) doc.title = updates.title;
    if (updates.description !== undefined) doc.description = updates.description;
    if (updates.category !== undefined) doc.category = updates.category;
    if (updates.difficulty !== undefined) doc.difficulty = updates.difficulty;
    if (updates.technologies !== undefined) doc.technologies = Array.isArray(updates.technologies) ? updates.technologies : [];
    if (updates.max_selections !== undefined || updates.maxSelections !== undefined) {
      const val = updates.max_selections ?? updates.maxSelections;
      const parsed = typeof val === 'number' ? val : parseInt(val || '0', 10) || 0;
      doc.maxSelections = Math.max(1, parsed);
    }
    const res = await ps.updateOne({ id }, { $set: doc });
    return { id, changes: res.modifiedCount };
  }

  async deleteProblemStatement(id) {
    if (!this.collections) await this.init();
    const { ps, regs } = this.collections;
    const res = await ps.deleteOne({ id });
    await regs.deleteMany({ problemStatementId: id });
    return { id, changes: res.deletedCount };
  }

  async getEvaluationCriteria() {
    // For MongoDB, we'll store evaluation criteria in a separate collection
    if (!this.collections) await this.init();
    const criteriaCollection = this.db.collection(`${this.collectionPrefix}evaluation_criteria`);
    const criteria = await criteriaCollection.findOne({});
    return criteria || null;
  }

  async getAllRegistrations() {
    if (!this.collections) await this.init();
    const { regs, ps } = this.collections;
    const [registrations, problems] = await Promise.all([
      regs.find({}).toArray(),
      ps.find({}).toArray()
    ]);
    const idToPs = new Map(problems.map(p => [p.id, p]));
    return registrations.map(r => ({
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
    if (!this.collections) await this.init();
    const { regs, ps } = this.collections;
    const problem = await ps.findOne({ id: problemStatementId });
    const list = await regs.find({ problemStatementId }).toArray();
    return list.map(r => ({
      team_number: r.teamNumber,
      team_name: r.teamName,
      team_leader: r.teamLeader,
      problem_title: problem?.title || '',
      registration_date_time: r.registrationDateTime
    }));
  }

  async getRegistrationByTeamNumber(teamNumber) {
    if (!this.collections) await this.init();
    const { regs, ps } = this.collections;
    const target = String(teamNumber).trim();
    const reg = await regs.findOne({ teamNumber: target });
    if (!reg) return null;
    const problem = reg.problemStatementId ? await ps.findOne({ id: reg.problemStatementId }) : null;
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
    if (!this.collections) await this.init();
    const { regs } = this.collections;
    const target = String(teamNumber).trim();
    const found = await regs.findOne({ teamNumber: target });
    return Boolean(found);
  }

  async createTeamOnly(teamNumber, teamName, teamLeader, teamMembers) {
    if (!this.collections) await this.init();
    const { regs } = this.collections;
    const target = String(teamNumber).trim();
    const exists = await regs.findOne({ teamNumber: target });
    if (exists) return null;
    try {
      await regs.insertOne({
        teamNumber: target,
        teamName: teamName || '',
        teamLeader: teamLeader || '',
        teamMembers: teamMembers || '',
        problemStatementId: null,
        registrationDateTime: new Date().toISOString()
      });
      return { id: target, changes: 1 };
    } catch (e) {
      if (e.code === 11000) return null;
      throw e;
    }
  }

  async updateRegistrationProblem(teamNumber, problemStatementId) {
    if (!this.collections) await this.init();
    const { regs, ps } = this.collections;
    const target = String(teamNumber).trim();
    const reg = await regs.findOne({ teamNumber: target });
    if (!reg) return null;
    if (reg.problemStatementId) return null; // Team already selected - cannot change
    const problem = await ps.findOne({ id: problemStatementId });
    if (!problem) return null;
    const maxSel = Math.max(1, (typeof problem.maxSelections === 'number' ? problem.maxSelections : parseInt(problem.maxSelections || '0', 10) || 0));
    const actualCount = await regs.countDocuments({ problemStatementId: problem.id });
    if (actualCount >= maxSel) return null;
    const session = this.client.startSession();
    try {
      let result = null;
      await session.withTransaction(async () => {
        const capacity = await ps.updateOne(
          { id: problem.id, $expr: { $lt: [ { $ifNull: ['$selectedCount', 0] }, { $literal: maxSel } ] } },
          { $inc: { selectedCount: 1 } },
          { session }
        );
        if (!capacity || capacity.modifiedCount === 0) {
          result = null;
          return;
        }
        const upd = await regs.updateOne({ teamNumber: target }, { $set: { problemStatementId } }, { session });
        if (upd.modifiedCount > 0) result = { id: target, changes: 1 };
        else {
          try { await ps.updateOne({ id: problem.id }, { $inc: { selectedCount: -1 } }, { session }); } catch (_) {}
        }
      }, { readConcern: { level: 'majority' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
      return result;
    } catch (e) {
      throw e;
    } finally {
      await session.endSession();
    }
  }

  async createRegistrationAtomic(registration) {
    if (!this.collections) await this.init();
    const { regs, ps } = this.collections;
    const target = String(registration.teamNumber).trim();
    
    // Start a MongoDB session for transaction
    const session = this.client.startSession();
    
    try {
      let result = null;
      
      await session.withTransaction(async () => {
        // Check if team number is already taken (within transaction)
        const exists = await regs.findOne({ teamNumber: target }, { session });
        if (exists) {
          result = null;
          return;
        }
        // Sync selectedCount with actual registrations to avoid drift
        const problem = await ps.findOne({ id: registration.problemStatementId }, { session });
        if (!problem) { result = null; return; }
        const maxSel = Math.max(1, (typeof problem.maxSelections === 'number' ? problem.maxSelections : parseInt(problem.maxSelections || '0', 10) || 0));
        const actualCount = await regs.countDocuments({ problemStatementId: problem.id }, { session });
        const currentSelected = Number.isFinite(problem.selectedCount) ? problem.selectedCount : 0;
        if (currentSelected !== actualCount) {
          await ps.updateOne({ id: problem.id }, { $set: { selectedCount: actualCount } }, { session });
        }
        // Atomically reserve a slot by incrementing selectedCount only when below maxSelections
        const capacity = await ps.updateOne(
          {
            id: problem.id,
            $expr: {
              $lt: [ { $ifNull: ["$selectedCount", 0] }, { $literal: maxSel } ]
            }
          },
          { $inc: { selectedCount: 1 } },
          { session }
        );

        if (!capacity || capacity.modifiedCount === 0) {
          // No capacity available
          result = null;
          return;
        }

        // Create registration after capacity is reserved
        const record = {
          teamNumber: target,
          teamName: registration.teamName,
          teamLeader: registration.teamLeader,
          teamMembers: registration.teamMembers || '',
          problemStatementId: registration.problemStatementId,
          registrationDateTime: new Date().toISOString()
        };
        
        try {
          await regs.insertOne(record, { session });
          result = { id: record.teamNumber, changes: 1 };
        } catch (e) {
          // Rollback capacity reservation on failure
          try { await ps.updateOne({ id: registration.problemStatementId }, { $inc: { selectedCount: -1 } }, { session }); } catch (_) {}
          throw e;
        }
      }, {
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary'
      });
      
      return result;
      
    } catch (error) {
      // Handle duplicate key error specifically
      if (error.code === 11000) {
        // Duplicate key error - team number already exists
        return null;
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async deleteRegistration(teamNumber) {
    if (!this.collections) await this.init();
    const { regs, ps } = this.collections;
    const target = String(teamNumber).trim();
    const reg = await regs.findOne({ teamNumber: target });
    const res = await regs.deleteOne({ teamNumber: target });
    if (res.deletedCount > 0 && reg && reg.problemStatementId) {
      try { await ps.updateOne({ id: reg.problemStatementId }, { $inc: { selectedCount: -1 } }); } catch (_) {}
    }
    return { changes: res.deletedCount };
  }

  async importFromJSON(jsonData) {
    if (!jsonData || !Array.isArray(jsonData.problemStatements)) return;
    if (!this.collections) await this.init();
    const { ps } = this.collections;
    const existing = await ps.find({}).project({ id: 1 }).toArray();
    const existingIds = new Set(existing.map(x => x.id));
    const toInsert = [];
    jsonData.problemStatements.forEach(psItem => {
      if (existingIds.has(psItem.id)) return;
      const parsedMax = typeof psItem.maxSelections === 'number' ? psItem.maxSelections : parseInt(psItem.maxSelections || '0', 10) || 0;
      const maxSel = Math.max(1, parsedMax);
      toInsert.push({
        id: psItem.id,
        title: psItem.title,
        description: psItem.description,
        maxSelections: maxSel,
        category: psItem.category || null,
        difficulty: psItem.difficulty || null,
        technologies: Array.isArray(psItem.technologies) ? psItem.technologies : []
      });
    });
    if (toInsert.length) await ps.insertMany(toInsert);
  }

  async resetAll() {
    if (!this.collections) await this.init();
    const { ps, regs, teams, participants } = this.collections;
    await regs.deleteMany({});
    await ps.deleteMany({});
    await teams.deleteMany({});
    if (participants) await participants.deleteMany({});
    await this.init();
    return true;
  }

  async getTeamByNumber(teamNumber) {
    if (!this.collections) await this.init();
    const { teams } = this.collections;
    return await teams.findOne({ teamNumber: String(teamNumber).trim() });
  }

  async searchTeams(q) {
    if (!this.collections) await this.init();
    const { teams } = this.collections;
    const lower = q.toLowerCase();
    const all = await teams.find({}).toArray();
    return all.filter(t => {
      const leader = (t.teamLeader || '').toLowerCase();
      const name = (t.teamName || '').toLowerCase();
      const members = (t.teamMembers || '').toLowerCase();
      const num = (t.teamNumber || '').toLowerCase();
      return leader.includes(lower) || name.includes(lower) || num.includes(lower) || members.includes(lower);
    });
  }

  async getAllTeams() {
    if (!this.collections) await this.init();
    const { teams } = this.collections;
    return await teams.find({}).toArray();
  }

  async deleteAllTeams() {
    if (!this.collections) await this.init();
    const { teams } = this.collections;
    const result = await teams.deleteMany({});
    return result.deletedCount || 0;
  }

  async replaceTeamsFromCSV(csvContent) {
    if (!this.collections) await this.init();
    const { teams } = this.collections;
    const lines = csvContent.trim().split(/\r?\n/).filter(Boolean);
    const [header, ...rows] = lines;
    const h = (header || '').trim().toLowerCase();
    const hasMembers = h.includes('teammembers');
    if (!header || !h.startsWith('teamnumber,teamname,teamleader')) {
      throw new Error(`CSV header must start with: teamNumber,teamName,teamLeader (optional: ,teamMembers)`);
    }
    const docs = [];
    rows.forEach((line) => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 3) return;
      const teamNumber = String(parts[0]).trim();
      const teamName = parts[1] !== undefined ? String(parts[1]).trim() : '';
      const teamLeader = parts[2] !== undefined ? String(parts[2]).trim() : '';
      const teamMembers = (hasMembers && parts.length > 3) ? parts.slice(3).join(',').trim() : '';
      if (!teamNumber) return;
      docs.push({ teamNumber, teamName, teamLeader, teamMembers });
    });
    await teams.deleteMany({});
    if (docs.length > 0) await teams.insertMany(docs);
    return docs.length;
  }

  async getAllParticipants() {
    if (!this.collections) await this.init();
    const { participants } = this.collections;
    return await participants.find({}).toArray();
  }

  async searchParticipants(q) {
    if (!this.collections) await this.init();
    const { participants } = this.collections;
    const lower = q.toLowerCase();
    const all = await participants.find({}).toArray();
    return all.filter(p => {
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
    if (!this.collections) await this.init();
    const { participants } = this.collections;
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
    await participants.deleteMany({});
    if (docs.length > 0) await participants.insertMany(docs);
    return docs.length;
  }

  async getProblemStatementReleased() {
    if (!this.collections) await this.init();
    const settings = this.db.collection(`${this.collectionPrefix}settings`);
    const doc = await settings.findOne({ id: 'config' });
    return doc ? Boolean(doc.problemStatementReleased) : false;
  }

  async setProblemStatementReleased(released) {
    if (!this.collections) await this.init();
    const settings = this.db.collection(`${this.collectionPrefix}settings`);
    await settings.updateOne(
      { id: 'config' },
      { $set: { id: 'config', problemStatementReleased: released } },
      { upsert: true }
    );
    return released;
  }

  async getAllWinners() {
    if (!this.collections) await this.init();
    const { winners } = this.collections;
    return (await winners.find({}).sort({ position: 1 }).toArray()).map(w => ({
      id: w._id.toString(),
      position: w.position,
      teamName: w.teamName || '',
      teamLeader: w.teamLeader || '',
      problemStatement: w.problemStatement || '',
      teamMembers: w.teamMembers || '',
      teamPhoto: w.teamPhoto || null
    }));
  }

  async addWinner(winner) {
    if (!this.collections) await this.init();
    const { winners } = this.collections;
    const teamName = (winner.teamName || '').trim();
    if (!teamName) return null;
    const existing = await winners.findOne({
      teamName: { $regex: new RegExp('^' + teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
    });
    if (existing) return null;
    const doc = {
      position: Number(winner.position) || 1,
      teamName: teamName,
      teamLeader: winner.teamLeader || '',
      problemStatement: winner.problemStatement || '',
      teamMembers: winner.teamMembers || '',
      teamPhoto: winner.teamPhoto || null,
      createdAt: new Date().toISOString()
    };
    const res = await winners.insertOne(doc);
    return { id: res.insertedId.toString(), changes: 1 };
  }

  async updateWinnerPhoto(id, teamPhotoBase64) {
    if (!this.collections) await this.init();
    const { winners } = this.collections;
    const { ObjectId } = require('mongodb');
    try {
      const res = await winners.updateOne(
        { _id: new ObjectId(id) },
        { $set: { teamPhoto: teamPhotoBase64 || null } }
      );
      return { changes: res.modifiedCount };
    } catch (_) {
      return { changes: 0 };
    }
  }

  async deleteWinner(id) {
    if (!this.collections) await this.init();
    const { winners } = this.collections;
    const { ObjectId } = require('mongodb');
    try {
      const res = await winners.deleteOne({ _id: new ObjectId(id) });
      return { changes: res.deletedCount };
    } catch (_) {
      return { changes: 0 };
    }
  }
}

module.exports = MongoStore;


