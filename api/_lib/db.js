const { neon } = require('@neondatabase/serverless');

let _sql = null;

function getSql() {
  if (_sql) return _sql;
  let dbUrl = process.env.NEON_DB_URL || '';
  if (dbUrl.includes('channel_binding')) {
    const [base, params] = dbUrl.split('?');
    const filtered = params.split('&').filter(p => !p.includes('channel_binding')).join('&');
    dbUrl = filtered ? `${base}?${filtered}` : base;
  }
  _sql = neon(dbUrl);
  return _sql;
}

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Planning Poker',
    link_hash TEXT UNIQUE NOT NULL,
    timer_minutes INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'ready' CHECK (status IN ('ready', 'voting', 'completed')),
    avg_points TEXT,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
    voter_name TEXT NOT NULL,
    voter_id TEXT NOT NULL,
    value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(story_id, voter_id)
);`;

async function initDb() {
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Planning Poker',
    link_hash TEXT UNIQUE NOT NULL,
    timer_minutes INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'ready' CHECK (status IN ('ready', 'voting', 'completed')),
    avg_points TEXT,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
    voter_name TEXT NOT NULL,
    voter_id TEXT NOT NULL,
    value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(story_id, voter_id)
  )`;
  console.log('Database tables created/verified');
}

async function getRoomByHash(hash) {
  const sql = getSql();
  const rows = await sql`SELECT * FROM rooms WHERE link_hash = ${hash}`;
  return rows[0] || null;
}

async function getRoomWithStories(hash) {
  const sql = getSql();
  const rooms = await sql`SELECT * FROM rooms WHERE link_hash = ${hash}`;
  if (!rooms[0]) return null;
  const room = rooms[0];
  const stories = await sql`SELECT * FROM stories WHERE room_id = ${room.id} ORDER BY position, created_at`;
  const storyIds = stories.map(s => s.id);
  let votes = [];
  if (storyIds.length > 0) {
    votes = await sql`SELECT * FROM votes WHERE story_id = ANY(${storyIds}::uuid[])`;
  }
  const storiesList = stories.map(s => ({
    id: s.id, room_id: s.room_id, title: s.title,
    description: s.description || '', status: s.status, avg_points: s.avg_points,
    position: s.position, created_at: s.created_at,
    votes: votes.filter(v => v.story_id === s.id).map(v => ({
      id: v.id, story_id: v.story_id, voter_name: v.voter_name,
      voter_id: v.voter_id, value: v.value, created_at: v.created_at
    }))
  }));
  return {
    id: room.id, owner_id: room.owner_id, owner_name: room.owner_name,
    name: room.name, link_hash: room.link_hash, timer_minutes: room.timer_minutes,
    created_at: room.created_at, stories: storiesList
  };
}

module.exports = { getSql, initDb, getRoomByHash, getRoomWithStories };
