const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'caltrack.db');
const db = new DatabaseSync(dbPath);

// Initialize Tables
function initDb() {
  db.exec(`
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
      category TEXT NOT NULL, -- breakfast, lunch, dinner, snack
      name TEXT NOT NULL,
      servings REAL NOT NULL DEFAULT 1.0,
      calories REAL NOT NULL,
      protein REAL NOT NULL DEFAULT 0,
      carbs REAL NOT NULL DEFAULT 0,
      fat REAL NOT NULL DEFAULT 0,
      ingredients TEXT, -- JSON array of ingredient breakdown
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
  `);

  // Insert default goals if not exists
  const existingGoal = db.prepare('SELECT id FROM goals WHERE id = ?').get('default');
  if (!existingGoal) {
    db.prepare(`
      INSERT INTO goals (id, calories, protein, carbs, fat, water, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('default', 2200, 150, 220, 70, 2500, new Date().toISOString());
  }
}

initDb();

module.exports = db;
