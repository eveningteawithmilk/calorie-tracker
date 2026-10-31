/* =========================================================
   CalTrack - Smart Full-Stack Calorie & Nutrition Tracker
   With Gemini AI & Intelligent Local Nutrition Engine
   ========================================================= */

// --- Default Food & Exercise Presets ---
const FOOD_PRESETS = [
  { 
    name: "Steel-cut Oats with Goji Berries", 
    calories: 340, 
    protein: 11, 
    carbs: 58, 
    fat: 6, 
    category: "breakfast", 
    notes: "Organic oats simmered in almond milk, topped with antioxidant-rich berries and a hint of cinnamon." 
  },
  { name: "Air-fried Chicken Breast (200g cooked)", calories: 330, protein: 62, carbs: 0, fat: 7, category: "dinner", notes: "Cooked skinless chicken breast seasoned with herbs." },
  { name: "Roti / Chapati (1 medium)", calories: 85, protein: 3, carbs: 17, fat: 0.5, category: "lunch", notes: "Traditional stoneground whole wheat flatbread." },
  { name: "Paneer (100g raw)", calories: 265, protein: 18, carbs: 4, fat: 20, category: "lunch", notes: "Fresh artisanal cottage cheese." },
  { name: "Cooked Dal (1 bowl / 150g)", calories: 150, protein: 9, carbs: 22, fat: 3, category: "lunch", notes: "Slow-simmered yellow lentils tempered with cumin." },
  { name: "Soybean Sabji (1 bowl / 150g)", calories: 180, protein: 16, carbs: 12, fat: 7, category: "lunch", notes: "Nutrient-dense soya chunks in mild spiced gravy." },
  { name: "Kadhi (1 bowl / 150g)", calories: 140, protein: 4, carbs: 12, fat: 8, category: "lunch", notes: "Yogurt and chickpea flour broth infused with fenugreek." },
  { name: "Milk Coffee with Sugar (200ml)", calories: 120, protein: 4, carbs: 16, fat: 4, category: "breakfast", notes: "Brewed roast coffee with warm milk." },
  { name: "Large Whole Egg", calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3, category: "breakfast", notes: "Pasture-raised farm egg." },
  { name: "Greek Yogurt (170g)", calories: 130, protein: 17, carbs: 6, fat: 4, category: "breakfast", notes: "Strained whole milk yogurt rich in probiotics." },
  { name: "Banana (medium)", calories: 105, protein: 1.3, carbs: 27, fat: 0.3, category: "snack", notes: "Fresh ripe banana." },
  { name: "Apple (medium)", calories: 95, protein: 0.5, carbs: 25, fat: 0.3, category: "snack", notes: "Crisp orchard apple." },
  { name: "White Rice (1 cup cooked)", calories: 205, protein: 4.2, carbs: 45, fat: 0.4, category: "lunch", notes: "Steamed fragrant grain." },
  { name: "Salmon Fillet (150g)", calories: 312, protein: 30, carbs: 0, fat: 20, category: "dinner", notes: "Wild-caught fillet rich in omega-3 fatty acids." },
  { name: "Almonds (handful / 28g)", calories: 164, protein: 6, carbs: 6, fat: 14, category: "snack", notes: "Raw whole Mediterranean almonds." }
];

const EXERCISE_PRESETS = [
  { name: "Running (Moderate Pace)", duration: 30, calories: 300 },
  { name: "Weight Training / Gym", duration: 45, calories: 220 },
  { name: "Brisk Walking", duration: 45, calories: 180 },
  { name: "Cycling / Stationary Bike", duration: 30, calories: 250 },
  { name: "HIIT Workout", duration: 20, calories: 200 },
  { name: "Swimming", duration: 30, calories: 260 },
  { name: "Yoga / Flexibility", duration: 30, calories: 110 }
];

// --- Application State ---
const STORAGE_KEY = "caltrack_store_v1";
const API_BASE = window.location.origin.includes("http") ? "" : "http://localhost:3000";

let isBackendConnected = false;
let currentAiImageBase64 = null;
let currentAiEstimation = null;

let appState = {
  selectedDate: getTodayString(),
  goals: {
    calories: 2200,
    protein: 150,
    carbs: 220,
    fat: 70,
    water: 2500
  },
  days: {}, // keyed by 'YYYY-MM-DD'
  theme: "aesop"
};

let weeklyChartInstance = null;

// --- Helper Date Functions ---
function getTodayString() {
  const now = new Date();
  return formatDateToString(now);
}

function formatDateToString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const todayStr = getTodayString();

  if (dateStr === todayStr) {
    return `Today, ${dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === formatDateToString(yesterday)) {
    return `Yesterday, ${dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }

  return dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// --- Backend API Sync & Persistence ---
async function checkBackendConnection() {
  try {
    const res = await fetch(`${API_BASE}/api/status`);
    if (res.ok) {
      const data = await res.json();
      isBackendConnected = true;
      updateAiStatusBadge(true, data.aiProvider || "AI Ready");
      await syncFromBackend();
      return true;
    }
  } catch (err) {
    // Backend server not running, use localStorage fallback
    console.log("[Sync] Backend server offline or standalone HTML mode. Using localStorage.");
  }
  isBackendConnected = false;
  updateAiStatusBadge(false, "Local Mode (Offline)");
  loadFromLocalStorage();
  return false;
}

function updateAiStatusBadge(isOnline, providerText) {
  const badgeDot = document.getElementById("aiStatusDot");
  const badgeText = document.getElementById("aiStatusText");
  if (badgeDot && badgeText) {
    badgeDot.style.background = isOnline ? "var(--color-success)" : "var(--color-carbs)";
    badgeText.textContent = providerText;
  }
}

async function syncFromBackend() {
  try {
    // 1. Fetch Goals
    const goalsRes = await fetch(`${API_BASE}/api/goals`);
    if (goalsRes.ok) {
      const goalsData = await goalsRes.json();
      appState.goals = {
        calories: goalsData.calories || 2200,
        protein: goalsData.protein || 150,
        carbs: goalsData.carbs || 220,
        fat: goalsData.fat || 70,
        water: goalsData.water || 2500
      };
    }

    // 2. Fetch Day Data
    await loadDayFromBackend(appState.selectedDate);
    renderAll();
  } catch (err) {
    console.error("[Sync] Error syncing from backend:", err);
  }
}

async function loadDayFromBackend(dateStr) {
  if (!isBackendConnected) return;

  try {
    const [mealsRes, exRes, waterRes] = await Promise.all([
      fetch(`${API_BASE}/api/meals?date=${dateStr}`),
      fetch(`${API_BASE}/api/exercises?date=${dateStr}`),
      fetch(`${API_BASE}/api/water?date=${dateStr}`)
    ]);

    const meals = mealsRes.ok ? await mealsRes.json() : { breakfast: [], lunch: [], dinner: [], snack: [] };
    const exercises = exRes.ok ? await exRes.json() : [];
    const water = waterRes.ok ? await waterRes.json() : { amount: 0 };

    appState.days[dateStr] = {
      breakfast: meals.breakfast || [],
      lunch: meals.lunch || [],
      dinner: meals.dinner || [],
      snack: meals.snack || [],
      exercises: exercises || [],
      water: water.amount || 0
    };
  } catch (err) {
    console.error("[Sync] Failed to load day data:", err);
  }
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      appState = {
        ...appState,
        ...parsed,
        selectedDate: appState.selectedDate || getTodayString()
      };
    }
  } catch (err) {
    console.error("Failed to load local storage state:", err);
  }

  const savedTheme = appState.theme || localStorage.getItem("caltrack_theme");
  if (savedTheme) {
    setTheme(savedTheme);
  } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    setTheme("dark");
  } else {
    setTheme("aesop");
  }
}

function saveLocalState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (err) {
    console.error("Failed to save state to localStorage:", err);
  }
}

function getDayData(dateStr) {
  if (!appState.days[dateStr]) {
    appState.days[dateStr] = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
      exercises: [],
      water: 0
    };
  }
  return appState.days[dateStr];
}

// --- Render & UI Updates ---
function renderAll() {
  renderHeaderDate();
  renderDailySummary();
  renderMealLists();
  renderExerciseList();
  renderWeeklyChart();
}

function formatEditorialDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const formatted = dateObj.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });
  return `Journal • ${formatted}`;
}

function renderHeaderDate() {
  const dateLabel = document.getElementById("currentDateLabel");
  const datePicker = document.getElementById("datePickerInput");
  const editorialDateLabel = document.getElementById("editorialDateLabel");

  if (dateLabel) dateLabel.textContent = formatDisplayDate(appState.selectedDate);
  if (datePicker) datePicker.value = appState.selectedDate;
  if (editorialDateLabel) editorialDateLabel.textContent = formatEditorialDate(appState.selectedDate);
}

function renderDailySummary() {
  const day = getDayData(appState.selectedDate);
  const goals = appState.goals;

  let foodKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  const mealCategories = ["breakfast", "lunch", "dinner", "snack"];
  mealCategories.forEach(cat => {
    (day[cat] || []).forEach(item => {
      foodKcal += Number(item.calories) || 0;
      totalProtein += Number(item.protein) || 0;
      totalCarbs += Number(item.carbs) || 0;
      totalFat += Number(item.fat) || 0;
    });
  });

  let burnKcal = 0;
  (day.exercises || []).forEach(ex => {
    burnKcal += Number(ex.calories) || 0;
  });

  const netKcal = foodKcal - burnKcal;
  const remainingKcal = goals.calories - netKcal;

  // Header & Badges
  document.getElementById("netBudgetBadge").textContent = `Target: ${goals.calories.toLocaleString()} kcal`;
  document.getElementById("foodCaloriesVal").innerHTML = `${Math.round(foodKcal)} <span class="unit">kcal</span>`;
  document.getElementById("burnCaloriesVal").innerHTML = `${Math.round(burnKcal)} <span class="unit">kcal</span>`;
  document.getElementById("netCaloriesVal").innerHTML = `${Math.round(netKcal)} <span class="unit">kcal</span>`;

  const remainingEl = document.getElementById("remainingCaloriesVal");
  const remainingStatusEl = document.getElementById("remainingStatusLabel");

  if (remainingKcal >= 0) {
    remainingEl.textContent = Math.round(remainingKcal).toLocaleString();
    remainingEl.style.color = "var(--text-primary)";
    remainingStatusEl.textContent = "Remaining";
  } else {
    remainingEl.textContent = Math.abs(Math.round(remainingKcal)).toLocaleString();
    remainingEl.style.color = "var(--color-burn)";
    remainingStatusEl.textContent = "Over Target";
  }

  // Circular Ring
  const ringCircle = document.getElementById("calorieRingCircle");
  const circumference = 2 * Math.PI * 74; // ~464.95
  const netRatio = Math.min(Math.max(netKcal / goals.calories, 0), 1.5);
  const offset = circumference - (Math.min(netRatio, 1) * circumference);

  ringCircle.style.strokeDashoffset = offset;
  ringCircle.style.stroke = netKcal > goals.calories ? "var(--color-burn)" : "var(--accent-color)";

  // Macronutrient Bars
  updateMacroCard("protein", totalProtein, goals.protein);
  updateMacroCard("carbs", totalCarbs, goals.carbs);
  updateMacroCard("fat", totalFat, goals.fat);

  // Water Tracker
  const waterCurrent = day.water || 0;
  document.getElementById("waterCurrentVal").textContent = waterCurrent;
  document.getElementById("waterTargetVal").textContent = goals.water;
  const waterPct = Math.min(Math.round((waterCurrent / goals.water) * 100), 100);
  document.getElementById("waterProgressBar").style.width = `${waterPct}%`;
}

function updateMacroCard(type, currentVal, targetVal) {
  const currentEl = document.getElementById(`${type}CurrentVal`);
  const targetEl = document.getElementById(`${type}TargetVal`);
  const pctEl = document.getElementById(`${type}Pct`);
  const barEl = document.getElementById(`${type}ProgressBar`);
  const kcalEl = document.getElementById(`${type}Kcal`);

  const rounded = Math.round(currentVal * 10) / 10;
  if (currentEl) currentEl.textContent = rounded;
  if (targetEl) targetEl.textContent = targetVal;

  const pct = targetVal > 0 ? Math.round((currentVal / targetVal) * 100) : 0;
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (barEl) barEl.style.width = `${Math.min(pct, 100)}%`;

  const multiplier = type === "fat" ? 9 : 4;
  if (kcalEl) kcalEl.textContent = `${Math.round(currentVal * multiplier)} kcal`;
}

function renderMealLists() {
  const day = getDayData(appState.selectedDate);
  const categories = [
    { key: "breakfast", name: "Breakfast", label: "MORNING" },
    { key: "lunch", name: "Lunch", label: "MIDDAY" },
    { key: "dinner", name: "Dinner", label: "EVENING" },
    { key: "snack", name: "Snacks", label: "NOURISHMENT" }
  ];

  categories.forEach(cat => {
    const items = day[cat.key] || [];
    const listEl = document.getElementById(`${cat.key}ItemsList`);
    const macrosEl = document.getElementById(`${cat.key}Macros`);

    let catKcal = 0;
    let catP = 0;
    let catC = 0;
    let catF = 0;

    if (!items || items.length === 0) {
      listEl.innerHTML = `<div class="empty-meal-state">No foods logged for ${cat.name.toLowerCase()}</div>`;
    } else {
      listEl.innerHTML = items.map((item, idx) => {
        catKcal += Number(item.calories) || 0;
        catP += Number(item.protein) || 0;
        catC += Number(item.carbs) || 0;
        catF += Number(item.fat) || 0;

        const portionLabel = item.servings && item.servings != 1 ? `(${item.servings}x serving)` : "";
        const descText = item.notes || item.description || (item.ingredients && Array.isArray(item.ingredients) ? item.ingredients.map(i => i.name || i).join(', ') : `P: ${item.protein || 0}g • C: ${item.carbs || 0}g • F: ${item.fat || 0}g`);

        return `
          <div class="logged-item-row">
            <div class="logged-item-category-tag">${cat.label}</div>
            <div class="logged-item-main">
              <span class="logged-item-name">${escapeHtml(item.name)} <span class="logged-item-portion">${portionLabel}</span></span>
              <div class="logged-item-desc">${escapeHtml(descText)}</div>
              <div class="logged-item-tags">
                <span class="tag-p">P: ${item.protein || 0}g</span>
                <span class="tag-c">C: ${item.carbs || 0}g</span>
                <span class="tag-f">F: ${item.fat || 0}g</span>
              </div>
            </div>
            <div class="logged-item-end">
              <span class="logged-item-calories">${Math.round(item.calories)} kcal</span>
              <button class="btn-delete-item" onclick="deleteFoodItem('${cat.key}', ${idx}, '${item.id || ''}')" title="Delete entry">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
        `;
      }).join("");
    }

    if (macrosEl) {
      macrosEl.textContent = `${Math.round(catKcal)} kcal • ${Math.round(catP)}P • ${Math.round(catC)}C • ${Math.round(catF)}F`;
    }
  });
}

function renderExerciseList() {
  const day = getDayData(appState.selectedDate);
  const items = day.exercises || [];
  const listEl = document.getElementById("exerciseItemsList");

  if (!items || items.length === 0) {
    listEl.innerHTML = `<div class="empty-meal-state">No workouts logged today</div>`;
  } else {
    listEl.innerHTML = items.map((ex, idx) => {
      const durText = ex.duration ? `${ex.duration} mins` : "";
      return `
        <div class="exercise-row">
          <div class="exercise-details">
            <span class="exercise-title"><i class="fa-solid fa-person-running text-accent"></i> ${escapeHtml(ex.name)}</span>
            <span class="exercise-duration">${durText}</span>
          </div>
          <div class="logged-item-end">
            <span class="exercise-burn-val">-${Math.round(ex.calories)} kcal</span>
            <button class="btn-delete-item" onclick="deleteExerciseItem(${idx}, '${ex.id || ''}')" title="Delete workout">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      `;
    }).join("");
  }
}

// --- Chart.js Weekly Analytics ---
async function renderWeeklyChart() {
  const canvas = document.getElementById("weeklyChart");
  if (!canvas || typeof Chart === "undefined") return;

  let labels = [];
  let intakeData = [];
  let burnData = [];
  let totalWeekKcal = 0;
  let daysMetGoal = 0;

  // Check if backend analytics endpoint is available
  if (isBackendConnected) {
    try {
      const res = await fetch(`${API_BASE}/api/analytics/weekly?endDate=${appState.selectedDate}`);
      if (res.ok) {
        const data = await res.json();
        labels = data.map(d => d.dayLabel);
        intakeData = data.map(d => d.foodKcal);
        burnData = data.map(d => d.burnKcal);
        totalWeekKcal = intakeData.reduce((a, b) => a + b, 0);
        daysMetGoal = intakeData.filter(v => v > 0 && Math.abs(v - appState.goals.calories) <= 200).length;
      }
    } catch (e) {
      console.warn("Analytics fetch failed, falling back to state:", e);
    }
  }

  // Local fallback if no data loaded
  if (labels.length === 0) {
    const [currY, currM, currD] = appState.selectedDate.split("-").map(Number);
    const baseDate = new Date(currY, currM - 1, currD);

    for (let i = 6; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      const dateStr = formatDateToString(d);
      const dayData = appState.days[dateStr] || { breakfast: [], lunch: [], dinner: [], snack: [], exercises: [] };

      let foodSum = 0;
      ["breakfast", "lunch", "dinner", "snack"].forEach(cat => {
        (dayData[cat] || []).forEach(f => foodSum += (Number(f.calories) || 0));
      });

      let burnSum = 0;
      (dayData.exercises || []).forEach(ex => burnSum += (Number(ex.calories) || 0));

      labels.push(d.toLocaleDateString("en-US", { weekday: "short" }));
      intakeData.push(Math.round(foodSum));
      burnData.push(Math.round(burnSum));
      totalWeekKcal += foodSum;
      if (foodSum > 0 && Math.abs(foodSum - appState.goals.calories) <= 200) daysMetGoal++;
    }
  }

  const avgKcal = Math.round(totalWeekKcal / 7);
  const weeklyAvgEl = document.getElementById("weeklyAvgVal");
  if (weeklyAvgEl) weeklyAvgEl.textContent = `${avgKcal} kcal`;

  const adherenceEl = document.getElementById("weeklyAdherenceVal");
  if (adherenceEl) {
    const trackedDays = intakeData.filter(v => v > 0).length || 1;
    adherenceEl.textContent = `${Math.round((daysMetGoal / trackedDays) * 100)}%`;
  }

  const isDark = document.body.classList.contains("theme-dark");
  const textColor = isDark ? "#94a3b8" : "#64748b";
  const gridColor = isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)";

  if (weeklyChartInstance) {
    weeklyChartInstance.destroy();
  }

  weeklyChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Food Intake (kcal)",
          data: intakeData,
          backgroundColor: "#f97316",
          borderRadius: 6
        },
        {
          label: "Burned (kcal)",
          data: burnData,
          backgroundColor: "#ef4444",
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: { color: textColor, boxWidth: 12, font: { size: 11, family: "Plus Jakarta Sans" } }
        },
        tooltip: {
          callbacks: {
            afterBody: () => `Target: ${appState.goals.calories} kcal`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { size: 11 } }
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { size: 11 } },
          suggestedMax: appState.goals.calories + 400
        }
      }
    }
  });
}

// --- AI Estimation & Logging ---
function focusAiLogger() {
  const section = document.getElementById("aiSection");
  if (section) {
    section.scrollIntoView({ behavior: "smooth" });
    const textarea = document.getElementById("aiPromptInput");
    if (textarea) textarea.focus();
  }
}

function handleAiPhotoSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    currentAiImageBase64 = e.target.result;
    document.getElementById("aiImagePreviewImg").src = currentAiImageBase64;
    document.getElementById("aiImagePreviewName").textContent = file.name;
    document.getElementById("aiImagePreviewRow").style.display = "flex";
    showToast("Food photo attached! Click 'Estimate with AI'", "info");
  };
  reader.readAsDataURL(file);
}

function clearAiImage() {
  currentAiImageBase64 = null;
  document.getElementById("aiPhotoInput").value = "";
  document.getElementById("aiImagePreviewRow").style.display = "none";
}

async function handleAiEstimate() {
  const promptInput = document.getElementById("aiPromptInput");
  const promptText = promptInput.value.trim();

  if (!promptText && !currentAiImageBase64) {
    showToast("Please enter meal description or upload a food photo.", "warning");
    promptInput.focus();
    return;
  }

  const btn = document.getElementById("aiEstimateBtn");
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Estimating...`;

  try {
    let result = null;

    if (isBackendConnected) {
      // Use Backend AI route
      const res = await fetch(`${API_BASE}/api/ai/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          imageBase64: currentAiImageBase64
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "AI estimation failed");
      }
      result = await res.json();
    } else {
      // Offline fallback: Use built-in client engine
      result = localBuiltinEstimate(promptText);
    }

    currentAiEstimation = result;
    renderAiResultCard(result);
    showToast("AI estimated your meal successfully!", "success");
  } catch (err) {
    console.error("[AI Estimation Error]", err);
    showToast(`Error: ${err.message}`, "warning");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

function renderAiResultCard(data) {
  const card = document.getElementById("aiResultCard");
  document.getElementById("aiResultMealName").textContent = data.mealName || "Estimated Meal";
  document.getElementById("aiResultCategoryBadge").textContent = capitalize(data.category || "lunch");
  
  if (document.getElementById("aiLogCategorySelect") && data.category) {
    document.getElementById("aiLogCategorySelect").value = data.category.toLowerCase();
  }

  const totals = data.totals || { calories: 0, protein: 0, carbs: 0, fat: 0 };
  document.getElementById("aiResultKcal").textContent = `${Math.round(totals.calories)} kcal`;
  document.getElementById("aiResultProtein").textContent = `${totals.protein}g Protein`;
  document.getElementById("aiResultCarbs").textContent = `${totals.carbs}g Carbs`;
  document.getElementById("aiResultFat").textContent = `${totals.fat}g Fats`;

  const tbody = document.getElementById("aiResultItemsBody");
  tbody.innerHTML = (data.items || []).map(item => `
    <tr>
      <td><strong>${escapeHtml(item.name)}</strong></td>
      <td>${escapeHtml(item.portion || "-")}</td>
      <td><strong>${Math.round(item.calories)} kcal</strong></td>
      <td class="tag-p">${item.protein}g</td>
      <td class="tag-c">${item.carbs}g</td>
      <td class="tag-f">${item.fat}g</td>
      <td class="subtext-sm">${escapeHtml(item.notes || "")}</td>
    </tr>
  `).join("");

  document.getElementById("aiResultExplanation").textContent = data.explanation || "";
  card.style.display = "flex";
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function dismissAiResult() {
  currentAiEstimation = null;
  document.getElementById("aiResultCard").style.display = "none";
}

async function confirmAiLogMeal() {
  if (!currentAiEstimation) return;

  const category = document.getElementById("aiLogCategorySelect").value;
  const day = getDayData(appState.selectedDate);

  if (isBackendConnected) {
    try {
      const res = await fetch(`${API_BASE}/api/ai/log-meal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: appState.selectedDate,
          estimation: currentAiEstimation,
          categoryOverride: category
        })
      });

      if (res.ok) {
        await loadDayFromBackend(appState.selectedDate);
      }
    } catch (err) {
      console.error("Backend log meal error:", err);
    }
  } else {
    // Local fallback
    const totals = currentAiEstimation.totals;
    const newItem = {
      id: "m_ai_" + Date.now(),
      name: currentAiEstimation.mealName,
      servings: 1.0,
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      ingredients: currentAiEstimation.items
    };
    if (!day[category]) day[category] = [];
    day[category].push(newItem);
    saveLocalState();
  }

  renderAll();
  showToast(`Logged "${currentAiEstimation.mealName}" to ${category}!`, "success");
  dismissAiResult();
  document.getElementById("aiPromptInput").value = "";
  clearAiImage();
}

// Client-side quick nutrition estimator fallback when offline
function localBuiltinEstimate(input) {
  const lower = (input || "").toLowerCase();
  const segments = lower.split(/,|\+|\band\b|&|\n/).map(s => s.trim()).filter(Boolean);
  const items = [];

  for (const seg of segments) {
    let cal = 150, p = 10, c = 15, f = 5;
    let name = capitalize(seg);

    if (seg.includes("chicken")) {
      const gMatch = seg.match(/(\d+)\s*g/);
      const grams = gMatch ? parseFloat(gMatch[1]) : 200;
      cal = Math.round((grams / 100) * 165);
      p = Math.round((grams / 100) * 31);
      c = 0; f = Math.round((grams / 100) * 3.5);
      name = `Air-fried Chicken Breast (${grams}g cooked)`;
    } else if (seg.includes("roti") || seg.includes("chapati")) {
      const countMatch = seg.match(/(\d+)/);
      const count = countMatch ? parseInt(countMatch[1]) : 2;
      cal = count * 85; p = count * 3; c = count * 17; f = count * 0.5;
      name = `${count} Roti / Chapati`;
    } else if (seg.includes("paneer")) {
      const gMatch = seg.match(/(\d+)\s*g/);
      const grams = gMatch ? parseFloat(gMatch[1]) : 100;
      cal = Math.round((grams / 100) * 265);
      p = Math.round((grams / 100) * 18);
      c = Math.round((grams / 100) * 4);
      f = Math.round((grams / 100) * 20);
      name = `Paneer (${grams}g)`;
    } else if (seg.includes("oil")) {
      const gMatch = seg.match(/(\d+)\s*g/);
      const grams = gMatch ? parseFloat(gMatch[1]) : 10;
      cal = Math.round(grams * 9);
      p = 0; c = 0; f = grams;
      name = `Cooking Oil (${grams}g)`;
    } else if (seg.includes("egg")) {
      const countMatch = seg.match(/(\d+)/);
      const count = countMatch ? parseInt(countMatch[1]) : 2;
      cal = count * 78; p = count * 6.3; c = count * 0.6; f = count * 5.3;
      name = `${count} Whole Eggs`;
    }

    items.push({ name, portion: "Standard", calories: cal, protein: p, carbs: c, fat: f, notes: "Offline estimate" });
  }

  const totals = items.reduce((acc, curr) => ({
    calories: acc.calories + curr.calories,
    protein: Math.round((acc.protein + curr.protein) * 10) / 10,
    carbs: Math.round((acc.carbs + curr.carbs) * 10) / 10,
    fat: Math.round((acc.fat + curr.fat) * 10) / 10
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  return {
    mealName: items.map(i => i.name).join(" + ") || "Meal Log",
    category: "lunch",
    items: items,
    totals: totals,
    explanation: `Calculated ${totals.calories} kcal and ${totals.protein}g protein using local nutrition engine.`
  };
}

// --- AI Settings Modal ---
async function openAiSettingsModal() {
  if (isBackendConnected) {
    try {
      const res = await fetch(`${API_BASE}/api/settings/apikey`);
      if (res.ok) {
        const data = await res.json();
        const box = document.getElementById("apiKeyStatusText");
        if (data.isSet) {
          box.textContent = `Active Key: ${data.masked} (Gemini AI Enabled)`;
        } else {
          box.textContent = "No API key configured. Using built-in local engine.";
        }
      }
    } catch (e) {
      console.warn("Failed to check API key:", e);
    }
  } else {
    document.getElementById("apiKeyStatusText").textContent = "Backend offline. Running in local standalone mode.";
  }
  openModal("aiSettingsModal");
}

async function saveGeminiApiKey() {
  const input = document.getElementById("geminiApiKeyInput");
  const key = input.value.trim();

  if (!key) {
    showToast("Please enter an API key", "warning");
    return;
  }

  if (isBackendConnected) {
    try {
      const res = await fetch(`${API_BASE}/api/settings/apikey`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key })
      });
      if (res.ok) {
        showToast("Gemini API key saved! AI is active.", "success");
        updateAiStatusBadge(true, "Gemini 2.5 Flash");
        closeModal("aiSettingsModal");
        input.value = "";
      }
    } catch (err) {
      showToast("Error saving API key to backend", "warning");
    }
  } else {
    showToast("Start the backend server (npm start) to persist API keys to SQLite.", "info");
  }
}

// --- Food Logging Actions ---
function openAddFoodModal(preferredCategory = "breakfast") {
  const catSelect = document.getElementById("mealCategorySelect");
  if (catSelect && preferredCategory) catSelect.value = preferredCategory;
  renderFoodPresets();
  document.getElementById("foodSearchInput").value = "";
  document.getElementById("foodNameInput").value = "";
  document.getElementById("foodCaloriesInput").value = "";
  document.getElementById("foodProteinInput").value = "";
  document.getElementById("foodCarbsInput").value = "";
  document.getElementById("foodFatInput").value = "";
  document.getElementById("foodServingsInput").value = "1.0";
  openModal("addFoodModal");
}

function renderFoodPresets(filterText = "") {
  const container = document.getElementById("presetPillsContainer");
  if (!container) return;

  const filtered = FOOD_PRESETS.filter(item => 
    item.name.toLowerCase().includes(filterText.toLowerCase())
  );

  container.innerHTML = filtered.map(item => `
    <button type="button" class="preset-pill" onclick='selectFoodPreset(${JSON.stringify(item)})'>
      <span>${escapeHtml(item.name)}</span>
      <span class="preset-cal-tag">${item.calories} kcal</span>
    </button>
  `).join("");
}

function selectFoodPreset(item) {
  document.getElementById("foodNameInput").value = item.name;
  document.getElementById("foodCaloriesInput").value = item.calories;
  document.getElementById("foodProteinInput").value = item.protein;
  document.getElementById("foodCarbsInput").value = item.carbs;
  document.getElementById("foodFatInput").value = item.fat;
  document.getElementById("foodServingsInput").value = "1.0";
  if (item.category && document.getElementById("mealCategorySelect")) {
    document.getElementById("mealCategorySelect").value = item.category;
  }
  showToast(`Selected ${item.name}`, "info");
}

async function handleFoodFormSubmit(event) {
  event.preventDefault();

  const name = document.getElementById("foodNameInput").value.trim();
  const category = document.getElementById("mealCategorySelect").value;
  const servings = parseFloat(document.getElementById("foodServingsInput").value) || 1.0;
  const baseCalories = parseFloat(document.getElementById("foodCaloriesInput").value) || 0;
  const baseProtein = parseFloat(document.getElementById("foodProteinInput").value) || 0;
  const baseCarbs = parseFloat(document.getElementById("foodCarbsInput").value) || 0;
  const baseFat = parseFloat(document.getElementById("foodFatInput").value) || 0;

  if (!name) return;

  const newItem = {
    id: "m_" + Date.now(),
    date: appState.selectedDate,
    category: category,
    name: name,
    servings: servings,
    calories: Math.round(baseCalories * servings),
    protein: Math.round(baseProtein * servings * 10) / 10,
    carbs: Math.round(baseCarbs * servings * 10) / 10,
    fat: Math.round(baseFat * servings * 10) / 10
  };

  if (isBackendConnected) {
    try {
      await fetch(`${API_BASE}/api/meals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem)
      });
      await loadDayFromBackend(appState.selectedDate);
    } catch (e) {
      console.warn("Backend save failed, using local:", e);
    }
  } else {
    const day = getDayData(appState.selectedDate);
    if (!day[category]) day[category] = [];
    day[category].push(newItem);
    saveLocalState();
  }

  renderAll();
  closeModal("addFoodModal");
  showToast(`Added ${name} to ${category}!`, "success");
}

async function deleteFoodItem(category, index, itemId) {
  if (isBackendConnected && itemId) {
    try {
      await fetch(`${API_BASE}/api/meals/${itemId}`, { method: "DELETE" });
      await loadDayFromBackend(appState.selectedDate);
      renderAll();
      showToast("Meal item deleted", "info");
      return;
    } catch (e) {
      console.warn("Backend delete error:", e);
    }
  }

  const day = getDayData(appState.selectedDate);
  if (day[category] && day[category][index]) {
    const deleted = day[category].splice(index, 1);
    saveLocalState();
    renderAll();
    showToast(`Removed ${deleted[0].name}`, "info");
  }
}

// --- Exercise Actions ---
function openAddExerciseModal() {
  renderActivityPresets();
  document.getElementById("exerciseNameInput").value = "";
  document.getElementById("exerciseDurationInput").value = "30";
  document.getElementById("exerciseCaloriesInput").value = "";
  openModal("addExerciseModal");
}

function renderActivityPresets() {
  const container = document.getElementById("activityPillsContainer");
  if (!container) return;

  container.innerHTML = EXERCISE_PRESETS.map(item => `
    <button type="button" class="preset-pill" onclick='selectExercisePreset(${JSON.stringify(item)})'>
      <span>${escapeHtml(item.name)}</span>
      <span class="preset-cal-tag">-${item.calories} kcal</span>
    </button>
  `).join("");
}

function selectExercisePreset(item) {
  document.getElementById("exerciseNameInput").value = item.name;
  document.getElementById("exerciseDurationInput").value = item.duration;
  document.getElementById("exerciseCaloriesInput").value = item.calories;
}

async function handleExerciseFormSubmit(event) {
  event.preventDefault();

  const name = document.getElementById("exerciseNameInput").value.trim();
  const duration = parseInt(document.getElementById("exerciseDurationInput").value, 10) || 0;
  const calories = parseFloat(document.getElementById("exerciseCaloriesInput").value) || 0;

  if (!name || calories <= 0) return;

  const newExercise = {
    id: "ex_" + Date.now(),
    date: appState.selectedDate,
    name: name,
    duration: duration,
    calories: Math.round(calories)
  };

  if (isBackendConnected) {
    try {
      await fetch(`${API_BASE}/api/exercises`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newExercise)
      });
      await loadDayFromBackend(appState.selectedDate);
    } catch (e) {
      console.warn("Backend exercise save failed:", e);
    }
  } else {
    const day = getDayData(appState.selectedDate);
    if (!day.exercises) day.exercises = [];
    day.exercises.push(newExercise);
    saveLocalState();
  }

  renderAll();
  closeModal("addExerciseModal");
  showToast(`Logged workout: ${name}`, "success");
}

async function deleteExerciseItem(index, itemId) {
  if (isBackendConnected && itemId) {
    try {
      await fetch(`${API_BASE}/api/exercises/${itemId}`, { method: "DELETE" });
      await loadDayFromBackend(appState.selectedDate);
      renderAll();
      showToast("Workout deleted", "info");
      return;
    } catch (e) {
      console.warn("Backend delete exercise error:", e);
    }
  }

  const day = getDayData(appState.selectedDate);
  if (day.exercises && day.exercises[index]) {
    const removed = day.exercises.splice(index, 1);
    saveLocalState();
    renderAll();
    showToast(`Deleted ${removed[0].name}`, "info");
  }
}

// --- Water Tracker Actions ---
async function addWater(amount) {
  const day = getDayData(appState.selectedDate);
  const newAmount = (day.water || 0) + amount;
  day.water = newAmount;

  if (isBackendConnected) {
    try {
      await fetch(`${API_BASE}/api/water`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: appState.selectedDate, amount: newAmount })
      });
    } catch (e) {
      console.warn("Water backend sync error:", e);
    }
  } else {
    saveLocalState();
  }

  renderDailySummary();
  showToast(`+${amount}ml water logged! Stay hydrated 💧`, "info");
}

async function resetWater() {
  const day = getDayData(appState.selectedDate);
  day.water = 0;

  if (isBackendConnected) {
    try {
      await fetch(`${API_BASE}/api/water`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: appState.selectedDate, amount: 0 })
      });
    } catch (e) {
      console.warn("Water reset error:", e);
    }
  } else {
    saveLocalState();
  }

  renderDailySummary();
  showToast("Water log reset to 0ml", "info");
}

// --- Goals & TDEE Calculations ---
function calculateTDEE() {
  const gender = document.getElementById("calcGender").value;
  const age = parseFloat(document.getElementById("calcAge").value) || 25;
  const weight = parseFloat(document.getElementById("calcWeight").value) || 70;
  const height = parseFloat(document.getElementById("calcHeight").value) || 175;
  const activityMult = parseFloat(document.getElementById("calcActivity").value) || 1.375;
  const goalOffset = parseFloat(document.getElementById("calcGoal").value) || 0;

  let bmr = (10 * weight) + (6.25 * height) - (5 * age);
  bmr += (gender === "male" ? 5 : -161);

  const tdee = Math.round(bmr * activityMult);
  const targetCalories = Math.max(1200, Math.round(tdee + goalOffset));

  document.getElementById("estTdeeVal").textContent = tdee.toLocaleString();
  document.getElementById("recTargetVal").textContent = targetCalories.toLocaleString();
  document.getElementById("targetCaloriesInput").value = targetCalories;

  applyMacroSplitPreset(document.getElementById("macroSplitPreset").value, targetCalories);
  showToast("Calculated personalized TDEE & macro targets!", "success");
}

function applyMacroSplitPreset(preset, overrideCalories = null) {
  const calories = overrideCalories !== null 
    ? overrideCalories 
    : (parseFloat(document.getElementById("targetCaloriesInput").value) || 2200);

  let pPct = 0.3, cPct = 0.4, fPct = 0.3;

  if (preset === "high-protein") {
    pPct = 0.40; cPct = 0.35; fPct = 0.25;
  } else if (preset === "low-carb") {
    pPct = 0.35; cPct = 0.15; fPct = 0.50;
  } else if (preset === "balanced") {
    pPct = 0.30; cPct = 0.40; fPct = 0.30;
  } else {
    return;
  }

  document.getElementById("targetProteinInput").value = Math.round((calories * pPct) / 4);
  document.getElementById("targetCarbsInput").value = Math.round((calories * cPct) / 4);
  document.getElementById("targetFatInput").value = Math.round((calories * fPct) / 9);
}

async function saveGoalsSettings() {
  const calories = parseInt(document.getElementById("targetCaloriesInput").value, 10) || 2200;
  const protein = parseInt(document.getElementById("targetProteinInput").value, 10) || 150;
  const carbs = parseInt(document.getElementById("targetCarbsInput").value, 10) || 220;
  const fat = parseInt(document.getElementById("targetFatInput").value, 10) || 70;
  const water = parseInt(document.getElementById("targetWaterInput").value, 10) || 2500;

  appState.goals = { calories, protein, carbs, fat, water };

  if (isBackendConnected) {
    try {
      await fetch(`${API_BASE}/api/goals`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appState.goals)
      });
    } catch (e) {
      console.warn("Goals sync error:", e);
    }
  } else {
    saveLocalState();
  }

  renderAll();
  closeModal("goalsModal");
  showToast("Goals updated successfully!", "success");
}

function openGoalsModal() {
  document.getElementById("targetCaloriesInput").value = appState.goals.calories;
  document.getElementById("targetProteinInput").value = appState.goals.protein;
  document.getElementById("targetCarbsInput").value = appState.goals.carbs;
  document.getElementById("targetFatInput").value = appState.goals.fat;
  document.getElementById("targetWaterInput").value = appState.goals.water;
  calculateTDEE();
  openModal("goalsModal");
}

// --- Date Navigation ---
async function changeDateByOffset(offset) {
  const [y, m, d] = appState.selectedDate.split("-").map(Number);
  const cur = new Date(y, m - 1, d);
  cur.setDate(cur.getDate() + offset);
  await setDate(formatDateToString(cur));
}

async function setDate(dateStr) {
  if (dateStr) {
    appState.selectedDate = dateStr;
    if (isBackendConnected) {
      await loadDayFromBackend(dateStr);
    }
    renderAll();
  }
}

// --- Modal Utilities ---
function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add("show");
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove("show");
}

// --- Toast Notifications ---
function showToast(message, type = "info") {
  const toast = document.getElementById("toastNotification");
  if (!toast) return;

  toast.className = `toast ${type} show`;
  toast.innerHTML = `<i class="fa-solid fa-circle-info"></i> <span>${escapeHtml(message)}</span>`;

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// --- Theme & Dark Mode Management ---
function isDarkMode() {
  return document.body.classList.contains("theme-dark");
}

function setTheme(themeName) {
  document.body.classList.remove("theme-aesop", "theme-dark", "theme-light");
  document.body.classList.add(`theme-${themeName}`);
  appState.theme = themeName;
  localStorage.setItem("caltrack_theme", themeName);
  saveLocalState();
  updateThemeUI();
  renderWeeklyChart();
}

function toggleDarkMode(event) {
  if (event && event.stopPropagation) {
    event.stopPropagation();
  }
  if (isDarkMode()) {
    // Switch dark mode OFF -> return to light theme
    const lightTheme = (appState.lastLightTheme && appState.lastLightTheme !== "dark") ? appState.lastLightTheme : "aesop";
    setTheme(lightTheme);
  } else {
    // Switch dark mode ON
    if (appState.theme && appState.theme !== "dark") {
      appState.lastLightTheme = appState.theme;
    }
    setTheme("dark");
  }
}

// Keep toggleTheme as alias
function toggleTheme(event) {
  toggleDarkMode(event);
}

function updateThemeUI() {
  const isDark = isDarkMode();

  // 1. Header toggle button & label
  const btn = document.getElementById("themeToggleBtn");
  const label = document.getElementById("darkModeStatusLabel");
  if (btn) {
    btn.setAttribute("aria-checked", isDark ? "true" : "false");
    btn.setAttribute("title", isDark ? "Dark Mode is ON. Click to switch to Light Mode." : "Dark Mode is OFF. Click to switch to Dark Mode.");
  }
  if (label) {
    label.textContent = isDark ? "Dark" : "Light";
  }

  // 2. Dropdown menu mini toggle
  const menuToggle = document.getElementById("menuDarkToggle");
  if (menuToggle) {
    menuToggle.classList.toggle("active", isDark);
  }

  // 3. Settings modal mini toggle
  const modalToggle = document.getElementById("settingsModalDarkToggle");
  const modalLabel = document.getElementById("modalDarkModeLabel");
  if (modalToggle) {
    modalToggle.classList.toggle("active", isDark);
  }
  if (modalLabel) {
    modalLabel.textContent = isDark ? "Dark Mode (Enabled)" : "Dark Mode (Disabled)";
  }

  // 4. Update mobile/PWA meta theme-color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute("content", isDark ? "#151413" : "#f4f0ea");
  }
}

function updateThemeIcon() {
  updateThemeUI();
}

function focusInsights() {
  const el = document.querySelector(".analytics-card") || document.getElementById("weeklyChart");
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

// --- Demo Data Generator ---
async function loadDemoData() {
  if (!confirm("Load sample 7-day Indian meal plan and workouts?")) return;

  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = formatDateToString(d);

    const sampleDay = {
      breakfast: [
        { 
          id: "d1", 
          name: "Steel-cut Oats with Goji Berries", 
          servings: 1, 
          calories: 340, 
          protein: 11, 
          carbs: 58, 
          fat: 6,
          notes: "Organic oats simmered in almond milk, topped with antioxidant-rich berries and a hint of cinnamon."
        }
      ],
      lunch: [
        { 
          id: "d2", 
          name: "Roti with Soybean Sabji & Kadhi", 
          servings: 1, 
          calories: 1030, 
          protein: 44, 
          carbs: 110, 
          fat: 38,
          notes: "Stoneground whole wheat rotis served with protein-rich soya curry and traditional yogurt kadhi."
        }
      ],
      dinner: [
        { 
          id: "d3", 
          name: "Air-fried Chicken Breast (200g)", 
          servings: 1, 
          calories: 330, 
          protein: 62, 
          carbs: 0, 
          fat: 7,
          notes: "Skinless cooked chicken breast prepared with sea salt, cracked black pepper, and rosemary."
        }
      ],
      snack: [
        { 
          id: "d4", 
          name: "Raw Almonds & Green Botanical Tea", 
          servings: 1, 
          calories: 180, 
          protein: 6, 
          carbs: 12, 
          fat: 14,
          notes: "Whole raw almonds paired with an antioxidant-rich botanical infusion."
        }
      ],
      exercises: [
        { id: "e1", name: i % 2 === 0 ? "Mindful Strength Training" : "Morning Brisk Walk", duration: 40, calories: 240 + (i * 10) }
      ],
      water: 2500
    };

    if (isBackendConnected) {
      // Post sample meals
      for (const cat of ["breakfast", "lunch", "dinner", "snack"]) {
        for (const item of sampleDay[cat]) {
          await fetch(`${API_BASE}/api/meals`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...item, date: dateStr, category: cat })
          });
        }
      }
      for (const ex of sampleDay.exercises) {
        await fetch(`${API_BASE}/api/exercises`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...ex, date: dateStr })
        });
      }
    } else {
      appState.days[dateStr] = sampleDay;
    }
  }

  if (isBackendConnected) {
    await loadDayFromBackend(appState.selectedDate);
  } else {
    saveLocalState();
  }

  renderAll();
  showToast("7-day demo data loaded successfully!", "success");
}

// --- Backup & Restore ---
async function exportData() {
  if (isBackendConnected) {
    try {
      const res = await fetch(`${API_BASE}/api/backup/export`);
      if (res.ok) {
        const data = await res.json();
        downloadJsonFile(data, `caltrack-sqlite-backup-${getTodayString()}.json`);
        showToast("Backup exported from SQLite!", "success");
        return;
      }
    } catch (e) {
      console.warn("Backend export error, falling back to local:", e);
    }
  }

  downloadJsonFile(appState, `caltrack-backup-${getTodayString()}.json`);
  showToast("Backup exported successfully!", "success");
}

function downloadJsonFile(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (isBackendConnected && parsed.meals) {
        const res = await fetch(`${API_BASE}/api/backup/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed)
        });
        if (res.ok) {
          await syncFromBackend();
          showToast("Data imported to SQLite successfully!", "success");
          return;
        }
      }

      if (parsed.goals && parsed.days) {
        appState = parsed;
        saveLocalState();
        renderAll();
        showToast("Backup imported successfully!", "success");
      } else {
        alert("Invalid backup file format.");
      }
    } catch (err) {
      alert("Error parsing JSON file: " + err.message);
    }
  };
  reader.readAsText(file);
}

function clearTodayLog() {
  if (confirm("Are you sure you want to clear all logged food, workouts, and water for this day?")) {
    appState.days[appState.selectedDate] = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
      exercises: [],
      water: 0
    };
    saveLocalState();
    renderAll();
    showToast("Cleared log for this day.", "info");
  }
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function capitalize(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Mobile Installation Modal ---
async function openMobileInstallModal() {
  try {
    const res = await fetch(`${API_BASE}/api/mobile-info`);
    if (res.ok) {
      const data = await res.json();
      const urlInput = document.getElementById("mobileUrlInput");
      const qrImg = document.getElementById("mobileQrCodeImg");
      if (urlInput && data.url) urlInput.value = data.url;
      if (qrImg && data.qrCodeUrl) qrImg.src = data.qrCodeUrl;
    }
  } catch (e) {
    console.warn("Mobile info fetch error:", e);
  }
  openModal("mobileInstallModal");
}

function copyMobileUrl() {
  const urlInput = document.getElementById("mobileUrlInput");
  if (urlInput) {
    urlInput.select();
    navigator.clipboard.writeText(urlInput.value).then(() => {
      showToast("Link copied to clipboard!", "success");
    }).catch(() => {
      document.execCommand("copy");
      showToast("Link copied!", "success");
    });
  }
}

// --- Initialization ---
document.addEventListener("DOMContentLoaded", async () => {
  // Check backend connection first
  await checkBackendConnection();

  // Date Navigation buttons
  document.getElementById("prevDayBtn").addEventListener("click", () => changeDateByOffset(-1));
  document.getElementById("nextDayBtn").addEventListener("click", () => changeDateByOffset(1));
  document.getElementById("todayBtn").addEventListener("click", () => setDate(getTodayString()));
  
  const datePicker = document.getElementById("datePickerInput");
  datePicker.addEventListener("change", (e) => setDate(e.target.value));
  document.getElementById("currentDateLabel").addEventListener("click", () => {
    datePicker.showPicker ? datePicker.showPicker() : datePicker.click();
  });

  // Action buttons
  document.getElementById("themeToggleBtn").addEventListener("click", toggleDarkMode);
  document.getElementById("calcModalBtn").addEventListener("click", openGoalsModal);

  // More menu dropdown
  const moreMenuBtn = document.getElementById("moreMenuBtn");
  const moreMenuDropdown = document.getElementById("moreMenuDropdown");
  moreMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    moreMenuDropdown.classList.toggle("active");
  });
  document.addEventListener("click", () => moreMenuDropdown.classList.remove("active"));

  document.getElementById("loadDemoDataBtn").addEventListener("click", loadDemoData);
  document.getElementById("exportDataBtn").addEventListener("click", exportData);
  document.getElementById("importFileInput").addEventListener("change", handleImportFile);
  document.getElementById("clearTodayBtn").addEventListener("click", clearTodayLog);

  // Search input in Add Food modal
  const searchInput = document.getElementById("foodSearchInput");
  searchInput.addEventListener("input", (e) => renderFoodPresets(e.target.value));

  // Enter key in AI textarea to estimate (Ctrl+Enter or Cmd+Enter)
  document.getElementById("aiPromptInput").addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleAiEstimate();
    }
  });

  // Close modals on clicking outside content
  document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove("show");
      }
    });
  });

  renderAll();
});
