const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const db = require('./db');
const { estimateMeal, getApiKey } = require('./aiService');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' })); // Support base64 food photo uploads
app.use(express.static(path.join(__dirname, '..'))); // Serve frontend directly

// --- API Status & Config ---
app.get('/api/status', (req, res) => {
  const hasKey = !!getApiKey();
  res.json({
    status: 'ok',
    version: '1.0.0',
    aiProvider: hasKey ? 'Gemini 2.5 Flash' : 'Built-in Nutrition Engine',
    hasApiKey: hasKey
  });
});

app.get('/api/mobile-info', (req, res) => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({ name, address: iface.address });
      }
    }
  }
  const primaryIp = addresses.find(a => a.name.toLowerCase().includes('wi-fi'))?.address || addresses[0]?.address || 'localhost';
  const url = `http://${primaryIp}:${PORT}`;
  res.json({
    primaryIp,
    url,
    qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`
  });
});

app.post('/api/settings/apikey', (req, res) => {
  const { apiKey } = req.body;
  if (apiKey !== undefined) {
    db.prepare(`
      INSERT INTO settings (key, value) VALUES ('gemini_api_key', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(apiKey.trim());
    res.json({ success: true, message: 'Gemini API key updated successfully.' });
  } else {
    res.status(400).json({ error: 'Missing apiKey in request body' });
  }
});

app.get('/api/settings/apikey', (req, res) => {
  const key = getApiKey();
  res.json({
    isSet: !!key,
    masked: key ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : null
  });
});

// --- Goals Routes ---
app.get('/api/goals', (req, res) => {
  const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get('default');
  res.json(goal || { calories: 2200, protein: 150, carbs: 220, fat: 70, water: 2500 });
});

app.put('/api/goals', (req, res) => {
  const { calories, protein, carbs, fat, water } = req.body;
  db.prepare(`
    INSERT INTO goals (id, calories, protein, carbs, fat, water, updated_at)
    VALUES ('default', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      calories = excluded.calories,
      protein = excluded.protein,
      carbs = excluded.carbs,
      fat = excluded.fat,
      water = excluded.water,
      updated_at = excluded.updated_at
  `).run(
    calories || 2200,
    protein || 150,
    carbs || 220,
    fat || 70,
    water || 2500,
    new Date().toISOString()
  );
  res.json({ success: true });
});

// --- Meals Routes ---
app.get('/api/meals', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const rows = db.prepare('SELECT * FROM meals WHERE date = ? ORDER BY created_at ASC').all(date);
  
  const categories = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: []
  };

  rows.forEach(row => {
    const cat = row.category.toLowerCase();
    if (categories[cat]) {
      categories[cat].push({
        id: row.id,
        name: row.name,
        servings: row.servings,
        calories: row.calories,
        protein: row.protein,
        carbs: row.carbs,
        fat: row.fat,
        ingredients: row.ingredients ? JSON.parse(row.ingredients) : null,
        created_at: row.created_at
      });
    }
  });

  res.json(categories);
});

app.post('/api/meals', (req, res) => {
  const { date, category, name, servings, calories, protein, carbs, fat, ingredients, ai_raw } = req.body;
  if (!name || calories === undefined || !date || !category) {
    return res.status(400).json({ error: 'Missing required meal fields' });
  }

  const id = 'm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  db.prepare(`
    INSERT INTO meals (id, date, category, name, servings, calories, protein, carbs, fat, ingredients, ai_raw, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    date,
    category.toLowerCase(),
    name,
    servings || 1.0,
    calories,
    protein || 0,
    carbs || 0,
    fat || 0,
    ingredients ? JSON.stringify(ingredients) : null,
    ai_raw || null,
    new Date().toISOString()
  );

  res.json({ success: true, id });
});

app.delete('/api/meals/:id', (req, res) => {
  db.prepare('DELETE FROM meals WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// --- Exercise Routes ---
app.get('/api/exercises', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const rows = db.prepare('SELECT * FROM exercises WHERE date = ? ORDER BY created_at ASC').all(date);
  res.json(rows);
});

app.post('/api/exercises', (req, res) => {
  const { date, name, duration, calories } = req.body;
  if (!name || calories === undefined || !date) {
    return res.status(400).json({ error: 'Missing required exercise fields' });
  }

  const id = 'ex_' + Date.now();
  db.prepare(`
    INSERT INTO exercises (id, date, name, duration, calories, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    date,
    name,
    duration || 30,
    calories,
    new Date().toISOString()
  );

  res.json({ success: true, id });
});

app.delete('/api/exercises/:id', (req, res) => {
  db.prepare('DELETE FROM exercises WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// --- Water Routes ---
app.get('/api/water', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const row = db.prepare('SELECT amount FROM water WHERE date = ?').get(date);
  res.json({ amount: row ? row.amount : 0 });
});

app.post('/api/water', (req, res) => {
  const { date, amount } = req.body;
  if (!date) return res.status(400).json({ error: 'Missing date' });

  db.prepare(`
    INSERT INTO water (date, amount, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at
  `).run(date, Math.max(0, amount || 0), new Date().toISOString());

  res.json({ success: true, amount: Math.max(0, amount || 0) });
});

// --- AI Estimation & Direct Log ---
app.post('/api/ai/estimate', async (req, res) => {
  try {
    const { prompt, imageBase64 } = req.body;
    if (!prompt && !imageBase64) {
      return res.status(400).json({ error: 'Please provide text description or food photo.' });
    }

    const estimation = await estimateMeal(prompt, imageBase64);
    res.json(estimation);
  } catch (err) {
    console.error('[AI Error]', err);
    res.status(500).json({ error: err.message || 'Failed to estimate meal' });
  }
});

app.post('/api/ai/log-meal', (req, res) => {
  const { date, estimation, categoryOverride } = req.body;
  if (!date || !estimation || !estimation.items) {
    return res.status(400).json({ error: 'Missing date or estimation payload' });
  }

  const category = (categoryOverride || estimation.category || 'lunch').toLowerCase();
  const mealName = estimation.mealName || estimation.items.map(i => i.name).join(' + ');
  const totals = estimation.totals;

  const id = 'm_ai_' + Date.now();
  db.prepare(`
    INSERT INTO meals (id, date, category, name, servings, calories, protein, carbs, fat, ingredients, ai_raw, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    date,
    category,
    mealName,
    1.0,
    totals.calories,
    totals.protein,
    totals.carbs,
    totals.fat,
    JSON.stringify(estimation.items),
    JSON.stringify(estimation),
    new Date().toISOString()
  );

  res.json({ success: true, id, mealName, category, totals });
});

// --- Weekly Analytics ---
app.get('/api/analytics/weekly', (req, res) => {
  const endDateStr = req.query.endDate || new Date().toISOString().split('T')[0];
  const [y, m, d] = endDateStr.split('-').map(Number);
  const baseDate = new Date(y, m - 1, d);

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const cur = new Date(baseDate);
    cur.setDate(cur.getDate() - i);
    const dateStr = cur.toISOString().split('T')[0];

    const mealSum = db.prepare('SELECT SUM(calories) as totalKcal, SUM(protein) as totalP FROM meals WHERE date = ?').get(dateStr);
    const exerciseSum = db.prepare('SELECT SUM(calories) as burnKcal FROM exercises WHERE date = ?').get(dateStr);

    days.push({
      date: dateStr,
      dayLabel: cur.toLocaleDateString('en-US', { weekday: 'short' }),
      foodKcal: Math.round(mealSum.totalKcal || 0),
      protein: Math.round((mealSum.totalP || 0) * 10) / 10,
      burnKcal: Math.round(exerciseSum.burnKcal || 0)
    });
  }

  res.json(days);
});

// --- Export & Import ---
app.get('/api/backup/export', (req, res) => {
  const goals = db.prepare('SELECT * FROM goals').all();
  const meals = db.prepare('SELECT * FROM meals').all();
  const exercises = db.prepare('SELECT * FROM exercises').all();
  const water = db.prepare('SELECT * FROM water').all();

  res.json({
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    goals,
    meals,
    exercises,
    water
  });
});

app.post('/api/backup/import', (req, res) => {
  const { goals, meals, exercises, water } = req.body;
  if (!meals || !Array.isArray(meals)) {
    return res.status(400).json({ error: 'Invalid backup format' });
  }

  // Clear existing and replace
  db.exec('DELETE FROM meals; DELETE FROM exercises; DELETE FROM water;');

  if (goals && goals.length > 0) {
    const g = goals[0];
    db.prepare(`
      INSERT OR REPLACE INTO goals (id, calories, protein, carbs, fat, water, updated_at)
      VALUES ('default', ?, ?, ?, ?, ?, ?)
    `).run(g.calories, g.protein, g.carbs, g.fat, g.water, new Date().toISOString());
  }

  const insertMeal = db.prepare(`
    INSERT INTO meals (id, date, category, name, servings, calories, protein, carbs, fat, ingredients, ai_raw, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  meals.forEach(m => {
    insertMeal.run(
      m.id || ('m_' + Math.random().toString(36).substring(2)),
      m.date,
      m.category,
      m.name,
      m.servings || 1.0,
      m.calories,
      m.protein || 0,
      m.carbs || 0,
      m.fat || 0,
      m.ingredients || null,
      m.ai_raw || null,
      m.created_at || new Date().toISOString()
    );
  });

  if (exercises && Array.isArray(exercises)) {
    const insertEx = db.prepare(`
      INSERT INTO exercises (id, date, name, duration, calories, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    exercises.forEach(e => {
      insertEx.run(e.id || ('ex_' + Math.random().toString(36).substring(2)), e.date, e.name, e.duration || 30, e.calories, e.created_at || new Date().toISOString());
    });
  }

  if (water && Array.isArray(water)) {
    const insertWater = db.prepare(`
      INSERT INTO water (date, amount, updated_at)
      VALUES (?, ?, ?)
    `);
    water.forEach(w => {
      insertWater.run(w.date, w.amount, w.updated_at || new Date().toISOString());
    });
  }

  res.json({ success: true, message: 'Data imported successfully' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 CalTrack Full-Stack AI Server running on: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
