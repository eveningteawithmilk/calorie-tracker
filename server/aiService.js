const db = require('./db');

// Built-in Nutritional Reference Database for Intelligent Fallback Engine
const NUTRITION_KNOWLEDGE_BASE = [
  { keywords: ['air-fried chicken', 'chicken breast', 'grilled chicken'], raw_or_cooked: 'cooked', calPer100g: 165, pPer100g: 31, cPer100g: 0, fPer100g: 3.6 },
  { keywords: ['chicken', 'chicken curry'], raw_or_cooked: 'cooked', calPer100g: 195, pPer100g: 24, cPer100g: 2, fPer100g: 10 },
  { keywords: ['roti', 'chapati', 'phulka'], defaultWeight: 35, calPer100g: 250, pPer100g: 8.5, cPer100g: 48, fPer100g: 1.5 },
  { keywords: ['paneer', 'cottage cheese'], calPer100g: 265, pPer100g: 18.3, cPer100g: 3.5, fPer100g: 20 },
  { keywords: ['egg', 'eggs'], defaultWeight: 50, calPerPiece: 78, pPerPiece: 6.3, cPerPiece: 0.6, fPerPiece: 5.3 },
  { keywords: ['egg white', 'egg whites'], defaultWeight: 33, calPerPiece: 17, pPerPiece: 3.6, cPerPiece: 0.2, fPerPiece: 0.1 },
  { keywords: ['soybean sabji', 'soya chunks', 'soybean curry', 'soya'], calPer100g: 120, pPer100g: 11, cPer100g: 8, fPer100g: 5 },
  { keywords: ['kadhi', 'dahi kadhi'], calPer100g: 95, pPer100g: 2.7, cPer100g: 8, fPer100g: 5.5 },
  { keywords: ['dal', 'daal', 'lentil', 'cooked dal'], calPer100g: 105, pPer100g: 6.8, cPer100g: 15.5, fPer100g: 2.2 },
  { keywords: ['rice', 'white rice', 'cooked rice'], calPer100g: 130, pPer100g: 2.7, cPer100g: 28, fPer100g: 0.3 },
  { keywords: ['brown rice'], calPer100g: 111, pPer100g: 2.6, cPer100g: 23, fPer100g: 0.9 },
  { keywords: ['bread', 'white bread', 'wheat bread'], defaultWeight: 30, calPerPiece: 80, pPerPiece: 3.5, cPerPiece: 14, fPerPiece: 1 },
  { keywords: ['oil', 'cooking oil', 'mustard oil', 'olive oil', 'ghee', 'butter'], calPer100g: 884, pPer100g: 0, cPer100g: 0, fPer100g: 100 },
  { keywords: ['milk coffee', 'coffee with milk'], defaultWeight: 200, calPer100g: 60, pPer100g: 2, cPer100g: 8, fPer100g: 2 },
  { keywords: ['milk', 'whole milk'], calPer100g: 65, pPer100g: 3.3, cPer100g: 4.8, fPer100g: 3.6 },
  { keywords: ['sugar'], calPer100g: 387, pPer100g: 0, cPer100g: 100, fPer100g: 0 },
  { keywords: ['noodles', 'maggi', 'smith & jones', 'instant noodles'], defaultWeight: 75, calPer100g: 430, pPer100g: 8.5, cPer100g: 62, fPer100g: 16 },
  { keywords: ['whey protein', 'protein shake', 'whey'], defaultWeight: 30, calPer100g: 400, pPer100g: 80, cPer100g: 10, fPer100g: 5 },
  { keywords: ['banana'], defaultWeight: 118, calPerPiece: 105, pPerPiece: 1.3, cPerPiece: 27, fPerPiece: 0.3 },
  { keywords: ['apple'], defaultWeight: 150, calPerPiece: 95, pPerPiece: 0.5, cPerPiece: 25, fPerPiece: 0.3 },
  { keywords: ['oatmeal', 'oats'], calPer100g: 389, pPer100g: 16.9, cPer100g: 66, fPer100g: 6.9 },
  { keywords: ['greek yogurt', 'curd', 'dahi'], calPer100g: 75, pPer100g: 10, cPer100g: 3.6, fPer100g: 2.5 },
  { keywords: ['salmon'], calPer100g: 208, pPer100g: 20, cPer100g: 0, fPer100g: 13 }
];

async function getApiKey() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
    return process.env.GEMINI_API_KEY.trim();
  }
  const row = await db.get("SELECT value FROM settings WHERE key = 'gemini_api_key'");
  return row ? row.value.trim() : null;
}

const SYSTEM_INSTRUCTION = `
You are CalTrack AI, an expert precision Calorie and Nutrition Tracker assistant.
You strictly follow these operational rules:

1. User Targets:
- Daily calorie target: 2,200 kcal
- Daily protein target: 150 g

2. Estimation Methodology:
- Break any reported meal into distinct ingredients.
- Estimate realistic portion sizes in grams or milliliters.
- Clarify whether weight is cooked or raw (e.g. 200 g air-fried chicken = 200 g cooked skinless chicken breast: 330 kcal, 62g protein, 0g carbs, 7g fat).
- For homemade Indian food (sabji, dal, kadhi, roti, curry, paneer), estimate realistic cooking oil and ingredient proportions.
- If user provides exact oil quantity or nutrition label, prioritize those exact figures.
- Do NOT double-count cooking oil.

3. Output Requirement:
You MUST respond with valid JSON matching this schema:
{
  "mealName": "Summary title of the meal",
  "category": "breakfast" | "lunch" | "dinner" | "snack",
  "items": [
    {
      "name": "Ingredient / item name (e.g. Cooked Chicken Breast, Roti, Cooking Oil)",
      "portion": "e.g. 200g cooked, 2 pcs, 10g",
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "notes": "Assumptions or nutritional basis"
    }
  ],
  "totals": {
    "calories": number,
    "protein": number,
    "carbs": number,
    "fat": number
  },
  "explanation": "Human-friendly explanation following the user's style: table breakdown, assumptions, and comparison to remaining targets."
}
Only return the JSON object, without markdown code fences if possible, or inside standard json fences.
`;

/**
 * Estimate nutrition using Gemini API (Text or Vision)
 */
async function estimateWithGemini(promptText, imageBase64 = null) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error("NO_API_KEY");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const contentsParts = [];

  if (imageBase64) {
    let mimeType = 'image/jpeg';
    let rawBase64 = imageBase64;
    const match = imageBase64.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      rawBase64 = match[2];
    }
    contentsParts.push({
      inlineData: {
        mimeType: mimeType,
        data: rawBase64
      }
    });
  }

  contentsParts.push({
    text: `${promptText || "Analyze this food/meal image and provide an exact nutritional breakdown."}`
  });

  const requestBody = {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }]
    },
    contents: [
      {
        role: "user",
        parts: contentsParts
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textResponse) {
    throw new Error("Empty response from Gemini AI");
  }

  let cleaned = textResponse.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();
  }

  return JSON.parse(cleaned);
}

/**
 * Estimate nutrition using OpenRouter API
 */
async function estimateWithOpenRouter(promptText, imageBase64 = null) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("NO_OPENROUTER_KEY");

  const endpoint = "https://openrouter.ai/api/v1/chat/completions";
  const content = [];

  if (imageBase64) {
    content.push({
      type: "image_url",
      image_url: { url: imageBase64 }
    });
  }

  content.push({
    type: "text",
    text: promptText || "Analyze this food/meal and provide an exact nutritional breakdown in the requested JSON schema."
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: content }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const textResponse = data.choices?.[0]?.message?.content;
  if (!textResponse) throw new Error("Empty response from OpenRouter AI");

  let cleaned = textResponse.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();
  }

  return JSON.parse(cleaned);
}

/**
 * Built-in Intelligent Fallback Nutrition Engine
 */
function estimateWithBuiltinEngine(input) {
  const lower = input.toLowerCase();

  const segments = lower.split(/,|\+|\band\b|&|\n/).map(s => s.trim()).filter(Boolean);
  const items = [];

  for (const seg of segments) {
    let matchedKnowledge = null;
    let bestKeyword = '';

    for (const entry of NUTRITION_KNOWLEDGE_BASE) {
      for (const kw of entry.keywords) {
        if (seg.includes(kw) && kw.length > bestKeyword.length) {
          bestKeyword = kw;
          matchedKnowledge = entry;
        }
      }
    }

    if (!matchedKnowledge) {
      const numMatch = seg.match(/(\d+(?:\.\d+)?)\s*(g|grams|ml|pcs|piece|bowl|cup|tbsp)?/i);
      const qty = numMatch ? parseFloat(numMatch[1]) : 1;
      items.push({
        name: capitalize(seg),
        portion: numMatch ? `${qty} ${numMatch[2] || 'serving'}` : '1 serving',
        calories: 120,
        protein: 4,
        carbs: 15,
        fat: 4,
        notes: "General food estimate"
      });
      continue;
    }

    let cal = 0, p = 0, c = 0, f = 0;
    let portionLabel = '';

    const gramMatch = seg.match(/(\d+(?:\.\d+)?)\s*(?:g|grams|ml)/i);
    const pieceMatch = seg.match(/(\d+(?:\.\d+)?)\s*(?:pcs|pc|piece|pieces|slice|slices|bowl|cup|tbsp)?/i);

    if (gramMatch) {
      const grams = parseFloat(gramMatch[1]);
      portionLabel = `${grams}g`;
      cal = (grams / 100) * (matchedKnowledge.calPer100g || 0);
      p = (grams / 100) * (matchedKnowledge.pPer100g || 0);
      c = (grams / 100) * (matchedKnowledge.cPer100g || 0);
      f = (grams / 100) * (matchedKnowledge.fPer100g || 0);
    } else if (matchedKnowledge.calPerPiece && pieceMatch) {
      const count = parseFloat(pieceMatch[1]) || 1;
      portionLabel = `${count} pcs`;
      cal = count * matchedKnowledge.calPerPiece;
      p = count * matchedKnowledge.pPerPiece;
      c = count * matchedKnowledge.cPerPiece;
      f = count * matchedKnowledge.fPerPiece;
    } else {
      const count = pieceMatch ? (parseFloat(pieceMatch[1]) || 1) : 1;
      const weight = (matchedKnowledge.defaultWeight || 100) * count;
      portionLabel = `${weight}g`;
      cal = (weight / 100) * (matchedKnowledge.calPer100g || 0);
      p = (weight / 100) * (matchedKnowledge.pPer100g || 0);
      c = (weight / 100) * (matchedKnowledge.cPer100g || 0);
      f = (weight / 100) * (matchedKnowledge.fPer100g || 0);
    }

    items.push({
      name: capitalize(bestKeyword),
      portion: portionLabel,
      calories: Math.round(cal),
      protein: Math.round(p * 10) / 10,
      carbs: Math.round(c * 10) / 10,
      fat: Math.round(f * 10) / 10,
      notes: matchedKnowledge.raw_or_cooked ? `Estimated as ${matchedKnowledge.raw_or_cooked}` : "Standard reference"
    });
  }

  const totals = items.reduce((acc, curr) => ({
    calories: acc.calories + curr.calories,
    protein: Math.round((acc.protein + curr.protein) * 10) / 10,
    carbs: Math.round((acc.carbs + curr.carbs) * 10) / 10,
    fat: Math.round((acc.fat + curr.fat) * 10) / 10
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  let category = "lunch";
  const h = new Date().getHours();
  if (h < 11) category = "breakfast";
  else if (h >= 11 && h < 16) category = "lunch";
  else if (h >= 16 && h < 19) category = "snack";
  else category = "dinner";

  return {
    mealName: items.map(i => i.name).join(" + ") || "Meal Log",
    category: category,
    items: items,
    totals: totals,
    explanation: `Estimated ${totals.calories} kcal and ${totals.protein}g protein across ${items.length} items using local nutritional reference engine. Connect your Gemini API key in Settings for full conversational AI and photo plate recognition.`
  };
}

/**
 * Main AI estimation dispatcher
 */
async function estimateMeal(promptText, imageBase64 = null) {
  // 1. Try Gemini if available
  try {
    const key = await getApiKey();
    if (key) {
      return await estimateWithGemini(promptText, imageBase64);
    }
  } catch (err) {
    console.warn("[AI] Gemini attempt failed:", err.message);
  }

  // 2. Try OpenRouter if available
  if (process.env.OPENROUTER_API_KEY) {
    try {
      return await estimateWithOpenRouter(promptText, imageBase64);
    } catch (err) {
      console.warn("[AI] OpenRouter attempt failed:", err.message);
    }
  }

  // 3. Fallback to built-in offline engine
  return estimateWithBuiltinEngine(promptText || "Food item");
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

module.exports = {
  estimateMeal,
  getApiKey
};
