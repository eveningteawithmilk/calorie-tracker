const path = require('path');
const fs = require('fs');

let isPg = false;
let pool = null;
let sqliteDb = null;

if (process.env.DATABASE_URL) {
  isPg = true;
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
} else {
  const { DatabaseSync } = require('node:sqlite');
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'caltrack.db');
  sqliteDb = new DatabaseSync(dbPath);
}

function convertSql(sql) {
  if (!isPg) return sql;
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

async function query(sql, params = []) {
  if (isPg) {
    const pgSql = convertSql(sql);
    const res = await pool.query(pgSql, params);
    return res.rows;
  } else {
    return sqliteDb.prepare(sql).all(...params);
  }
}

async function get(sql, params = []) {
  if (isPg) {
    const pgSql = convertSql(sql);
    const res = await pool.query(pgSql, params);
    return res.rows[0] || null;
  } else {
    return sqliteDb.prepare(sql).get(...params) || null;
  }
}

async function all(sql, params = []) {
  return query(sql, params);
}

async function run(sql, params = []) {
  if (isPg) {
    const pgSql = convertSql(sql);
    const res = await pool.query(pgSql, params);
    return { changes: res.rowCount };
  } else {
    return sqliteDb.prepare(sql).run(...params);
  }
}

async function exec(sql) {
  if (isPg) {
    return pool.query(sql);
  } else {
    return sqliteDb.exec(sql);
  }
}

async function initDb() {
  const schema = `
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      calories INTEGER NOT NULL DEFAULT 2200,
      protein INTEGER NOT NULL DEFAULT 150,
      carbs INTEGER NOT NULL DEFAULT 220,
      fat INTEGER NOT NULL DEFAULT 70,
      water INTEGER NOT NULL DEFAULT 2500,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS meals (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      servings REAL NOT NULL DEFAULT 1.0,
      calories REAL NOT NULL,
      protein REAL NOT NULL DEFAULT 0,
      carbs REAL NOT NULL DEFAULT 0,
      fat REAL NOT NULL DEFAULT 0,
      ingredients TEXT,
      ai_raw TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      duration INTEGER NOT NULL DEFAULT 30,
      calories REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS water (
      date TEXT PRIMARY KEY,
      amount INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_chats (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      role TEXT NOT NULL,
      message TEXT NOT NULL,
      structured_data TEXT,
      created_at TEXT NOT NULL
    );
  `;

  await exec(schema);

  const existingGoal = await get('SELECT id FROM goals WHERE id = ?', ['default']);
  if (!existingGoal) {
    await run(`
      INSERT INTO goals (id, calories, protein, carbs, fat, water, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO NOTHING
    `, ['default', 2200, 150, 220, 70, 2500, new Date().toISOString()]);
  }
}

initDb().catch(err => {
  console.error('[DB Init Error]', err);
});

module.exports = {
  isPg,
  query,
  get,
  all,
  run,
  exec,
  initDb
};
