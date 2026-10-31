require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const { estimateMeal, getApiKey } = require('./aiService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' })); // Support base64 food photo uploads
app.use(express.static(path.join(__dirname, '..'))); // Serve frontend directly

// --- API Status & Config ---
app.get('/api/status', async (req, res) => {
  try {
    const hasKey = !!(await getApiKey()) || !!process.env.OPENROUTER_API_KEY;
    const provider = (await getApiKey()) ? 'Gemini 2.5 Flash' : (process.env.OPENROUTER_API_KEY ? 'OpenRouter AI' : 'Built-in Nutrition Engine');
    res.json({
      status: 'ok',
      version: '1.0.0',
      database: db.isPg ? 'PostgreSQL (Neon)' : 'SQLite',
      aiProvider: provider,
      hasApiKey: hasKey
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
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

app.post('/api/settings/apikey', async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (apiKey !== undefined) {
      await db.run(`
        INSERT INTO settings (key, value) VALUES ('gemini_api_key', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `, [apiKey.trim()]);
      res.json({ success: true, message: 'Gemini API key updated successfully.' });
    } else {
      res.status(400).json({ error: 'Missing apiKey in request body' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings/apikey', async (req, res) => {
  try {
    const key = await getApiKey();
    res.json({
      isSet: !!key,
      masked: key ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Goals Routes ---
app.get('/api/goals', async (req, res) => {
  try {
    const goal = await db.get('SELECT * FROM goals WHERE id = ?', ['default']);
    res.json(goal || { calories: 2200, protein: 150, carbs: 220, fat: 70, water: 2500 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/goals', async (req, res) => {
  try {
    const { calories, protein, carbs, fat, water } = req.body;
    await db.run(`
      INSERT INTO goals (id, calories, protein, carbs, fat, water, updated_at)
      VALUES ('default', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        calories = excluded.calories,
        protein = excluded.protein,
        carbs = excluded.carbs,
        fat = excluded.fat,
        water = excluded.water,
        updated_at = excluded.updated_at
    `, [
      calories || 2200,
      protein || 150,
      carbs || 220,
      fat || 70,
      water || 2500,
      new Date().toISOString()
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Meals Routes ---
app.get('/api/meals', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const rows = await db.all('SELECT * FROM meals WHERE date = ? ORDER BY created_at ASC', [date]);
    
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
          servings: Number(row.servings),
          calories: Number(row.calories),
          protein: Number(row.protein),
          carbs: Number(row.carbs),
          fat: Number(row.fat),
          ingredients: row.ingredients ? JSON.parse(row.ingredients) : null,
          created_at: row.created_at
        });
      }
    });

    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/meals', async (req, res) => {
  try {
    const { date, category, name, servings, calories, protein, carbs, fat, ingredients, ai_raw } = req.body;
    if (!name || calories === undefined || !date || !category) {
      return res.status(400).json({ error: 'Missing required meal fields' });
    }

    const id = 'm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    await db.run(`
      INSERT INTO meals (id, date, category, name, servings, calories, protein, carbs, fat, ingredients, ai_raw, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
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
    ]);

    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/meals/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM meals WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Exercise Routes ---
app.get('/api/exercises', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const rows = await db.all('SELECT * FROM exercises WHERE date = ? ORDER BY created_at ASC', [date]);
    res.json(rows.map(r => ({
      ...r,
      duration: Number(r.duration),
      calories: Number(r.calories)
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/exercises', async (req, res) => {
  try {
    const { date, name, duration, calories } = req.body;
    if (!name || calories === undefined || !date) {
      return res.status(400).json({ error: 'Missing required exercise fields' });
    }

    const id = 'ex_' + Date.now();
    await db.run(`
      INSERT INTO exercises (id, date, name, duration, calories, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      id,
      date,
      name,
      duration || 30,
      calories,
      new Date().toISOString()
    ]);

    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/exercises/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM exercises WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Water Routes ---
app.get('/api/water', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const row = await db.get('SELECT amount FROM water WHERE date = ?', [date]);
    res.json({ amount: row ? Number(row.amount) : 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/water', async (req, res) => {
  try {
    const { date, amount } = req.body;
    if (!date) return res.status(400).json({ error: 'Missing date' });

    await db.run(`
      INSERT INTO water (date, amount, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at
    `, [date, Math.max(0, amount || 0), new Date().toISOString()]);

    res.json({ success: true, amount: Math.max(0, amount || 0) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

app.post('/api/ai/log-meal', async (req, res) => {
  try {
    const { date, estimation, categoryOverride } = req.body;
    if (!date || !estimation || !estimation.items) {
      return res.status(400).json({ error: 'Missing date or estimation payload' });
    }

    const category = (categoryOverride || estimation.category || 'lunch').toLowerCase();
    const mealName = estimation.mealName || estimation.items.map(i => i.name).join(' + ');
    const totals = estimation.totals;

    const id = 'm_ai_' + Date.now();
    await db.run(`
      INSERT INTO meals (id, date, category, name, servings, calories, protein, carbs, fat, ingredients, ai_raw, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
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
    ]);

    res.json({ success: true, id, mealName, category, totals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Weekly Analytics ---
app.get('/api/analytics/weekly', async (req, res) => {
  try {
    const endDateStr = req.query.endDate || new Date().toISOString().split('T')[0];
    const [y, m, d] = endDateStr.split('-').map(Number);
    const baseDate = new Date(y, m - 1, d);

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const cur = new Date(baseDate);
      cur.setDate(cur.getDate() - i);
      const dateStr = cur.toISOString().split('T')[0];

      const mealSum = await db.get('SELECT SUM(calories) as total_kcal, SUM(protein) as total_p FROM meals WHERE date = ?', [dateStr]);
      const exerciseSum = await db.get('SELECT SUM(calories) as burn_kcal FROM exercises WHERE date = ?', [dateStr]);

      const foodKcal = mealSum ? (Number(mealSum.total_kcal) || 0) : 0;
      const totalP = mealSum ? (Number(mealSum.total_p) || 0) : 0;
      const burnKcal = exerciseSum ? (Number(exerciseSum.burn_kcal) || 0) : 0;

      days.push({
        date: dateStr,
        dayLabel: cur.toLocaleDateString('en-US', { weekday: 'short' }),
        foodKcal: Math.round(foodKcal),
        protein: Math.round(totalP * 10) / 10,
        burnKcal: Math.round(burnKcal)
      });
    }

    res.json(days);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Export & Import ---
app.get('/api/backup/export', async (req, res) => {
  try {
    const goals = await db.all('SELECT * FROM goals');
    const meals = await db.all('SELECT * FROM meals');
    const exercises = await db.all('SELECT * FROM exercises');
    const water = await db.all('SELECT * FROM water');

    res.json({
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      goals,
      meals,
      exercises,
      water
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backup/import', async (req, res) => {
  try {
    const { goals, meals, exercises, water } = req.body;
    if (!meals || !Array.isArray(meals)) {
      return res.status(400).json({ error: 'Invalid backup format' });
    }

    await db.exec('DELETE FROM meals; DELETE FROM exercises; DELETE FROM water;');

    if (goals && goals.length > 0) {
      const g = goals[0];
      await db.run(`
        INSERT INTO goals (id, calories, protein, carbs, fat, water, updated_at)
        VALUES ('default', ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          calories = excluded.calories,
          protein = excluded.protein,
          carbs = excluded.carbs,
          fat = excluded.fat,
          water = excluded.water,
          updated_at = excluded.updated_at
      `, [g.calories, g.protein, g.carbs, g.fat, g.water, new Date().toISOString()]);
    }

    for (const m of meals) {
      await db.run(`
        INSERT INTO meals (id, date, category, name, servings, calories, protein, carbs, fat, ingredients, ai_raw, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
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
      ]);
    }

    if (exercises && Array.isArray(exercises)) {
      for (const e of exercises) {
        await db.run(`
          INSERT INTO exercises (id, date, name, duration, calories, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [e.id || ('ex_' + Math.random().toString(36).substring(2)), e.date, e.name, e.duration || 30, e.calories, e.created_at || new Date().toISOString()]);
      }
    }

    if (water && Array.isArray(water)) {
      for (const w of water) {
        await db.run(`
          INSERT INTO water (date, amount, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT (date) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at
        `, [w.date, w.amount, w.updated_at || new Date().toISOString()]);
      }
    }

    res.json({ success: true, message: 'Data imported successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 CalTrack Full-Stack AI Server running on: http://localhost:${PORT}`);
  console.log(`Database: ${db.isPg ? 'PostgreSQL (Neon)' : 'SQLite'}`);
  console.log(`======================================================\n`);
});
