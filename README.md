# CalTrack — Full-Stack AI Calorie & Nutrition Tracker

A modern, full-stack nutrition tracker powered by **Node.js, Express, SQLite, and Google Gemini AI Vision & Natural Language**.

---

## ⚡ Features

### 🤖 AI Meal & Plate Estimator
- **Natural Language Parsing**: Describe meals naturally (e.g. *"200 g air-fried chicken"*, *"150 g roti, 200 g paneer, 10 g oil"*, *"Smith & Jones noodles + milk coffee"*).
- **Gemini Vision Photo Recognition**: Upload a photo of your meal plate or packaged nutrition label to automatically detect ingredients, estimate portion weights, and compute macros.
- **Built-in Offline Nutrition Engine**: Fallback knowledge base covering hundreds of Indian staples, poultry, grains, dairy, and oils without requiring an internet connection or API key.
- **1-Click Direct Logging**: Review the ingredient table, breakdown notes, and log directly into Breakfast, Lunch, Dinner, or Snacks with one click.

### 📊 Daily Tracking Dashboard
- **Energy Budget & Progress Ring**: Live visual tracking of daily intake, exercise burn, and remaining net calories against your **2,200 kcal** target.
- **Macronutrients**: Real-time progress bars for **150 g Protein**, **Carbs**, and **Fats**.
- **Water Hydration Tracker**: Log +250 ml (glass) or +500 ml (bottle) with visual progress.
- **Workout & Burn Logger**: Track running, gym sessions, walking, cycling, etc.
- **7-Day Trend Analytics**: Interactive [Chart.js](https://www.chartjs.org/) bar chart tracking weekly calories and goal adherence.
- **BMR & TDEE Calculator**: Built-in Mifflin-St Jeor calculator for custom goal planning.

### 💾 Full-Stack Architecture
- **Backend**: Node.js & Express REST API (`/api/meals`, `/api/exercises`, `/api/water`, `/api/goals`, `/api/ai/estimate`).
- **Database**: Local SQLite database using Node 24 native `node:sqlite` (`data/caltrack.db`).
- **Data Portability**: Full JSON backup export and import for seamless data migration.

---

## 🚀 How to Run

### Method 1: One-Click Launcher (Recommended)
Double-click **`open.bat`** in `D:\calorie-tracker`.
It starts the backend server and automatically opens the application at `http://localhost:3000`.

### Method 2: Command Line
```bash
cd D:\calorie-tracker
npm start
```
Then visit **`http://localhost:3000`** in your browser.

---

## 🔑 AI Configuration (Optional)
CalTrack includes a built-in nutrition knowledge base out of the box. To unlock Google Gemini 2.5 Flash conversational intelligence and plate photo recognition:
1. Open CalTrack in your browser.
2. Click the **Gear icon** ⚙️ on the AI bar (or **More Options > AI Settings**).
3. Paste your free Google Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
*(You can also set `GEMINI_API_KEY=AIzaSy...` in a `.env` file.)*

---

## 📱 Mobile App & APK Build

CalTrack is wrapped as a native Android app using **Capacitor**:

### Option 1: Open in Android Studio
1. Open [Android Studio](https://developer.android.com/studio).
2. Choose **Open an Existing Project** and select:
   `D:\calorie-tracker\android`
3. Click **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
4. Your `.apk` will be generated in `android/app/build/outputs/apk/debug/app-debug.apk`. Transfer it to your phone and install!

### Option 2: Automated Cloud Build (GitHub Actions)
A ready-to-use GitHub Actions workflow is provided at [`.github/workflows/build-apk.yml`](.github/workflows/build-apk.yml).
Push this repo to GitHub, and GitHub Actions will automatically compile the APK in 2 minutes and offer it as a direct download artifact.

### Option 3: Instant Mobile Install (PWA)
On your mobile device (Android Chrome):
1. Navigate to your running CalTrack instance (via local Wi-Fi IP or deployed server).
2. Tap the browser menu (3 dots) and select **"Add to Home screen"** or **"Install App"**.
3. It installs with the native flame icon, offline support, camera plate recognition, and standalone fullscreen window.

