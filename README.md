# Hungry Tiger Frontend (Expo)

Mobile frontend for Hungry Tiger table-ordering flow, built with Expo + React Native.

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+
- Expo Go app on Android/iOS phone
- (Optional) Supabase project for real phone OTP login

## 1) Clone and install

```bash
git clone https://github.com/tasniaanwer/qponI-d.git
cd qponI-d
npm install
```

## 2) Environment setup

Copy `.env.example` to `.env`:

```bash
# macOS / Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

### Option A: Run quickly without backend (dev mock login)

Set this in `.env`:

```env
EXPO_PUBLIC_DEV_MOCK_AUTH=true
```

This enables **Continue without SMS (dev)** in login modal.

### Option B: Real SMS OTP login (Supabase)

Set these in `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY
```

Then in Supabase:

- Enable **Authentication -> Phone**
- Configure SMS provider (Twilio/MessageBird/etc.)
- (Optional but recommended) run SQL migration:
  - `supabase/migrations/20260413120000_table_ordering_schema.sql`

## 3) Start Expo

```bash
npm start
```

Equivalent Expo commands:

```bash
npx expo start
npx expo start --android
npx expo start --ios
npx expo start --web
```

## 4) Run on device

- Open Expo Go on your phone
- Scan the QR code from terminal
- If same Wi-Fi has issues, switch Expo connection mode to **Tunnel**

## Available scripts

- `npm start` -> start Metro bundler
- `npm run android` -> open on Android target
- `npm run ios` -> open on iOS target
- `npm run web` -> open web build

## Notes for developers

- Location picker uses `expo-location` + `react-native-maps`
- Home page fetches nearby restaurants from OpenStreetMap/Overpass (free endpoint)
- `.env` is gitignored; never commit secrets

## Common issues

- **Env changed but app still uses old values**  
  Stop Expo and restart: `npm start`

- **Port already in use (8081)**  
  Run: `npx expo start --port 8082`

- **Map not showing in standalone Android build**  
  Add Google Maps API key in Expo Android config (Expo Go usually works without this)

- **Phone OTP not sending**  
  Check Supabase env vars + Phone provider + SMS provider credentials
