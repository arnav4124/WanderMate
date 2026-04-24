# WanderMate - Architecture & Design Report

## Table of Contents

1. [Design Patterns Used](#design-patterns-used)
2. [Architectural Patterns](#architectural-patterns)
3. [Architectural Tactics](#architectural-tactics)
4. [API Key Configuration Guide](#api-key-configuration-guide)

---

## 1. Design Patterns Used

### 1.1 Strategy Pattern

**Location:** `backend/src/services/overpassAdapter.js`, `placesAdapter.js`, `orsAdapter.js`

Each external API adapter implements the same interface (`searchPOIs`, `getDetails`, etc.) but uses a different underlying API (Overpass/OSM, Google Places, OpenRouteService). The `TravelService` facade selects and invokes adapters interchangeably, making it trivial to swap or add new providers (e.g., replace Google Places with Mapbox).

### 1.2 Facade Pattern

**Location:** `backend/src/services/travelService.js`

The `TravelService` class exposes a single simplified interface (`searchPOIs`, `getRouteOptimized`, `getPOIDetails`) to all API routes. Internally it orchestrates multiple adapters, merges results, handles caching, and provides graceful degradation — hiding all this complexity from consumers.

### 1.3 Adapter Pattern

**Location:** `backend/src/services/overpassAdapter.js`, `placesAdapter.js`, `orsAdapter.js`

Each adapter wraps a third-party API with a different data format and translates responses into the application's unified POI/Route schema. This decouples the application from external API contracts.

### 1.4 Singleton Pattern

**Location:**

- `backend/src/config/firebase.js` — single Firebase Admin SDK instance
- `backend/src/services/travelService.js` — exported as a single instance
- `backend/src/middleware/cache.js` — single NodeCache instance
- `frontend/config/firebase.ts` — single Firebase JS SDK app instance

Ensures expensive resources (database connections, SDK initializations, cache stores) are created exactly once and shared across the application.

### 1.5 Command Pattern

**Location:** `frontend/stores/tripStore.ts` (undo/redo stacks), `frontend/app/trip/[id].tsx`

Every mutation to the itinerary (add stop, remove stop, reorder stops) is captured as a command with the previous state stored in an undo stack. Users can undo (`Ctrl+Z`) and redo (`Ctrl+Y`) changes. This implements the classic Command pattern with execute/undo semantics.

### 1.6 Observer Pattern

**Location:**

- `frontend/stores/tripStore.ts` — `subscribeTripUpdates()` listens to Firebase Realtime Database for live trip changes
- `frontend/stores/budgetStore.ts` — `subscribeBudgetUpdates()` listens to real-time expense changes
- `frontend/stores/authStore.ts` — `onAuthStateChanged()` listener
- Zustand store subscriptions throughout all screens

Components subscribe to state changes and react automatically. The Firebase RTDB `.on('value')` pattern is a textbook observer.

### 1.7 Repository Pattern

**Location:** `backend/src/models/` (Mongoose models) + `backend/src/routes/`

Mongoose models serve as repositories that abstract database access. Routes never construct raw MongoDB queries — they use `Trip.find()`, `Trip.findByIdAndUpdate()`, etc. The data access layer is fully separated from business logic.

### 1.8 Proxy Pattern (Cache-Aside)

**Location:**

- `backend/src/middleware/cache.js` — response caching middleware
- `backend/src/services/travelService.js` — in-service caching for POI and route results
- `frontend/services/syncQueue.ts` — `localCache` acts as a local proxy for remote data

Expensive API calls are intercepted and served from cache when available, reducing latency and external API usage.

---

## 2. Architectural Patterns

### 2.1 Client-Server Architecture

The system is split into a React Native mobile client and a Node.js/Express backend server. All data flows through RESTful HTTP endpoints.

### 2.2 API Gateway Pattern

**Location:** `backend/src/index.js`

The Express server acts as an API Gateway — the single entry point for all client requests. It handles:

- Authentication verification (Firebase JWT)
- Rate limiting
- CORS
- Request routing to appropriate service handlers
- Response caching

### 2.3 Layered Architecture

**Backend layers:**

1. **Presentation Layer** — Express routes (`/src/routes/`)
2. **Business Logic Layer** — TravelService facade (`/src/services/`)
3. **Data Access Layer** — Mongoose models (`/src/models/`)
4. **Infrastructure Layer** — Config, middleware, external API adapters

**Frontend layers:**

1. **View Layer** — React Native screens and components (`/app/`)
2. **State Management Layer** — Zustand stores (`/stores/`)
3. **Service Layer** — API client, sync queue (`/services/`)
4. **Infrastructure Layer** — Config, Firebase SDK (`/config/`)

### 2.4 Event-Driven Architecture

**Location:** Firebase Realtime Database subscriptions

Real-time collaboration (multiple users editing the same trip) and live budget updates use Firebase RTDB's event-driven push model. Changes propagate instantly to all connected clients without polling.

### 2.5 Offline-First Architecture

**Location:** `frontend/services/syncQueue.ts`, all Zustand stores

The app follows an offline-first approach:

1. All reads first check local cache (AsyncStorage)
2. Writes are queued when offline
3. The sync queue flushes automatically on reconnect
4. Users see cached data immediately while fresh data loads

---

## 3. Architectural Tactics

### 3.1 Performance Tactics

| Tactic | Implementation | Location |
|--------|---------------|----------|
| **Caching** | Server-side NodeCache (60s TTL for POIs, 5min for routes) | `backend/src/services/travelService.js` |
| **Response Caching** | ETag-based cache middleware | `backend/src/middleware/cache.js` |
| **Client Caching** | AsyncStorage local cache | `frontend/services/syncQueue.ts` |
| **Lazy Loading** | Screens loaded on-demand via Expo Router | `frontend/app/` (file-based routing) |
| **Pagination** | Cursor-based pagination on feed/trip lists | `backend/src/routes/feed.js` |

### 3.2 Security Tactics

| Tactic | Implementation | Location |
|--------|---------------|----------|
| **Authentication** | Firebase JWT token verification | `backend/src/middleware/auth.js` |
| **Authorization** | Per-route ownership/collaborator checks | `backend/src/routes/trips.js` |
| **Rate Limiting** | General: 100 req/15min, API: 30 req/min | `backend/src/middleware/rateLimiter.js` |
| **Secret Proxying** | API keys kept server-side only; client never sees them | `backend/.env` |
| **Helmet** | HTTP security headers | `backend/src/index.js` |
| **Input Validation** | Request body validation in route handlers | `backend/src/routes/` |

### 3.3 Availability Tactics

| Tactic | Implementation | Location |
|--------|---------------|----------|
| **Graceful Degradation** | Falls back to Overpass-only if Google Places fails | `backend/src/services/travelService.js` |
| **Offline Resilience** | Full offline read from cache, queued writes | `frontend/services/syncQueue.ts` |
| **Error Boundaries** | Try-catch + user-friendly error messages | All screens and stores |
| **Health Check** | Root endpoint returns server status | `backend/src/index.js` |

### 3.4 Modifiability Tactics

| Tactic | Implementation | Location |
|--------|---------------|----------|
| **Separation of Concerns** | Layered architecture, single responsibility | Entire codebase |
| **Information Hiding** | Adapters hide API-specific details | `backend/src/services/*Adapter.js` |
| **Dependency Inversion** | Routes depend on TravelService interface, not adapters | `backend/src/routes/poi.js` |
| **Parameterization** | All env-specific config via .env | `backend/.env`, `frontend/config/env.ts` |

---

## 4. API Key Configuration Guide

### 4.1 Backend (`backend/.env`)

Open `backend/.env` and replace the placeholder values:

```env
# MongoDB connection string
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/wandermate

# Firebase Admin SDK (from Firebase Console → Project Settings → Service Accounts)
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com

# Google Places API key (from Google Cloud Console → APIs & Services → Credentials)
GOOGLE_PLACES_API_KEY=AIza...your-google-places-key

# OpenRouteService API key (from openrouteservice.org/dev/#/signup)
ORS_API_KEY=your-ors-api-key-here

# JWT Secret (any strong random string)
JWT_SECRET=your-jwt-secret-here
```

**How to obtain each key:**

| Key | Where to Get It |
|-----|----------------|
| `MONGODB_URI` | [MongoDB Atlas](https://cloud.mongodb.com) → Create Cluster → Connect → Connection String |
| `FIREBASE_*` | [Firebase Console](https://console.firebase.google.com) → Project Settings → Service Accounts → Generate New Private Key |
| `FIREBASE_DATABASE_URL` | Firebase Console → Realtime Database → Copy URL |
| `GOOGLE_PLACES_API_KEY` | [Google Cloud Console](https://console.cloud.google.com) → APIs → Enable Places API → Credentials → Create API Key |
| `ORS_API_KEY` | [OpenRouteService](https://openrouteservice.org/dev/#/signup) → Sign Up → Dashboard → API Key |
| `JWT_SECRET` | Self-generated (e.g., run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |

### 4.2 Frontend (`frontend/config/env.ts`)

Open `frontend/config/env.ts` and replace the Firebase config:

```typescript
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSy...your-firebase-web-api-key',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-firebase-project-id',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abc123',
  databaseURL: 'https://your-project-default-rtdb.firebaseio.com',
};
```

**Where:** Firebase Console → Project Settings → General → Your Apps → Web App → Config

```typescript
export const GOOGLE_WEB_CLIENT_ID = 'xxxxx.apps.googleusercontent.com';
```

**Where:** Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID (Web type)

```typescript
export const API_BASE_URL = 'http://10.0.2.2:5000/api'; // Android emulator
// Use 'http://localhost:5000/api' for iOS simulator
// Use 'http://YOUR_LOCAL_IP:5000/api' for physical device
```

### 4.3 Firebase Console Setup Required

1. **Enable Authentication Providers:**
   - Firebase Console → Authentication → Sign-in method
   - Enable **Email/Password**
   - Enable **Google** (add Web Client ID)

2. **Create Realtime Database:**
   - Firebase Console → Realtime Database → Create Database
   - Start in **test mode** (update rules for production)

3. **Firestore Rules (if used later):**

   ```json
   {
     "rules": {
       "trips": { "$tripId": { ".read": true, ".write": "auth != null" } },
       "budgets": { "$tripId": { ".read": true, ".write": "auth != null" } }
     }
   }
   ```

---

## 5. Quick Start

```bash
# 1. Backend
cd backend
cp .env.example .env       # Fill in your API keys
npm install
npm run dev                 # Starts on port 5000

# 2. Frontend
cd frontend
npm install
npx expo start             # Scan QR or press 'a' for Android
```

---

## 6. Feature → Requirement Traceability

| Requirement | Feature | Screen/File |
|-------------|---------|-------------|
| FR-01 | Google & Email Auth | `app/(auth)/sign-in.tsx`, `stores/authStore.ts` |
| FR-02 | Create/manage trips | `app/trip/create.tsx`, `app/(tabs)/index.tsx` |
| FR-03 | Day-by-day itinerary | `app/trip/[id].tsx` |
| FR-04 | Drag-and-drop reorder | `app/trip/[id].tsx` (DraggableFlatList) |
| FR-05 | POI discovery (Haversine proximity sorting) | `app/(tabs)/explore2.tsx` |
| FR-06 | Add POI to itinerary (13+ Categories) | `app/(tabs)/explore2.tsx` → trip selector |
| FR-07 | Budget tracking | `app/(tabs)/budget.tsx`, `stores/budgetStore.ts` |
| FR-08 | Expense split | `app/(tabs)/budget.tsx` (per-person calculation) |
| FR-09 | Interactive Leaflet map | `app/trip/map/[id].tsx` (WebView + Leaflet) |
| FR-10 | Optimized route overlay | `app/trip/map/[id].tsx` (ORS polyline) |
| FR-11 | Real-time collaboration | Firebase RTDB subscriptions in stores |
| FR-12 | Social feed (publish/clone) | `app/(tabs)/feed.tsx`, `stores/feedStore.ts` |
| FR-13 | Follow users | `app/(tabs)/feed.tsx` (Following tab) |
| FR-14 | Undo/Redo | `stores/tripStore.ts` (Command pattern) |
| FR-15 | Offline support | `services/syncQueue.ts`, store caching |
| NFR-01 | <2s API response | Server caching, pagination |
| NFR-02 | Works offline | AsyncStorage cache + sync queue |
| NFR-03 | API secret protection | Keys server-side only, proxied via backend |
| NFR-04 | Rate limiting | `middleware/rateLimiter.js` |
| NFR-05 | Material Design 3 UI | React Native Paper throughout |
