# WanderMate — Social Mobile Travel Planner

A collaborative mobile travel planner built with React Native (Expo) and Node.js/Express, enabling users to discover points of interest, build day-by-day itineraries, optimise routes, track budgets, and share trips through a social feed — all with real-time collaboration.

**Repository:** [github.com/arnav4124/WanderMate](https://github.com/arnav4124/WanderMate)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React Native (Expo SDK 54), TypeScript, Zustand, Leaflet (via WebView), React Native Paper |
| **Backend** | Node.js, Express 5, Mongoose ODM |
| **Database** | MongoDB Atlas |
| **Real-time** | Firebase Realtime Database |
| **Authentication** | Firebase Auth (Email/Password + Google OAuth 2.0) |
| **External APIs** | Google Places API, OpenRouteService (ORS), Nominatim (OSM geocoding) |

---

## Features

- **Trip Management** — Create, edit, and delete trips with auto-generated day-by-day structure
- **POI Discovery** — Search 13+ categories (hotels, restaurants, landmarks, nightlife, medical, etc.) with Haversine proximity sorting
- **Interactive Map** — Leaflet-based map with colour-coded markers, route polylines, and bidirectional React Native ↔ WebView bridge
- **Route Optimisation** — Multi-stop optimal visit order via ORS VROOM solver with GeoJSON polyline overlay
- **Budget Tracking** — Per-trip expense logging with category breakdowns and per-person split calculation
- **Real-time Collaboration** — Firebase RTDB-powered live sync; invite followers as trip collaborators
- **Social Feed** — Publish trips, follow users, like/unlike posts, clone public itineraries
- **Undo/Redo** — Command pattern with multi-level undo/redo stacks for all itinerary edits
- **Offline Support** — AsyncStorage-backed local cache + persistent sync queue for offline-first editing

---

## Architecture Overview

WanderMate follows a **Facade + API Gateway** architecture:

- **API Gateway** (Express) — single entry point proxying all external API calls, keeping API keys server-side
- **TravelService Facade** — unified interface wrapping Google Places, ORS, and Nominatim adapters with caching, fallback, and proximity sorting
- **Observer Pattern** — Firebase RTDB event-driven sync for real-time collaboration
- **Command Pattern** — undo/redo stacks in the frontend `tripStore`
- **Offline-First** — `localCache` + `syncQueue` modules backed by AsyncStorage

See the `docs/` directory for full architectural documentation (IEEE 42010 stakeholder analysis, Nygard ADRs, architectural tactics, design patterns, and architecture analysis).

---

## Project Structure

```
WanderMate/
├── backend/
│   ├── src/
│   │   ├── config/         # Database & Firebase config
│   │   ├── controllers/    # TripController (trip lifecycle)
│   │   ├── middleware/      # auth.js, cache.js, rateLimiter.js
│   │   ├── models/          # Mongoose: Trip, Expense, FeedPost, User
│   │   ├── routes/          # Express routes: trips, poi, routes, budget, feed, users
│   │   ├── services/        # TravelService, PlacesAdapter, ORSAdapter, TripObserver
│   │   └── index.js         # Express app entry point
│   ├── .env.example         # Environment variable template
│   └── package.json
├── frontend/
│   ├── app/
│   │   ├── (auth)/          # Sign-in/sign-up screens
│   │   ├── (tabs)/          # Bottom tab screens (Trips, Explore, Feed, Budget, Profile)
│   │   └── trip/            # Trip detail, map screens
│   ├── components/          # Reusable UI components
│   ├── config/              # Firebase & env config
│   ├── hooks/               # Custom hooks (useLocation, usePOISearch)
│   ├── services/            # api.ts (Axios + JWT), syncQueue.ts (offline)
│   ├── stores/              # Zustand stores (trip, budget, feed, auth, activeTrip)
│   └── package.json
└── docs/
    ├── task1/               # Requirements & Subsystem Overview
    ├── task2/               # Architecture Framework (IEEE 42010 + ADRs)
    ├── task3/               # Architectural Tactics & Design Patterns
    └── task4/               # Prototype Implementation & Architecture Analysis
```

---

## Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- **Expo CLI** — installed globally or via `npx`
- **MongoDB Atlas** account (free tier works)
- **Firebase** project (Auth + Realtime Database)
- **Google Places API** key (Google Cloud Console)
- **OpenRouteService API** key (openrouteservice.org)
- **Android Studio** (for emulator) or **Expo Go** app on a physical device

---

## Setup & Installation

### 1. Clone the Repository

```bash
git clone git@github.com:arnav4124/WanderMate.git
cd WanderMate
```

### 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `backend/.env` with your credentials:

```env
PORT=5000
NODE_ENV=development

# MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/wandermate

# Firebase Admin SDK (from Firebase Console → Project Settings → Service Accounts)
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com

# Google Places API key (Google Cloud Console → APIs & Services → Credentials)
GOOGLE_PLACES_API_KEY=AIza...your-key

# OpenRouteService API key (openrouteservice.org/dev/#/signup)
ORS_API_KEY=your-ors-api-key
```

**How to obtain each key:**

| Key | Where to Get It |
|-----|----------------|
| `MONGODB_URI` | [MongoDB Atlas](https://cloud.mongodb.com) → Create Cluster → Connect → Connection String |
| `FIREBASE_*` | [Firebase Console](https://console.firebase.google.com) → Project Settings → Service Accounts → Generate New Private Key |
| `FIREBASE_DATABASE_URL` | Firebase Console → Realtime Database → Copy URL |
| `GOOGLE_PLACES_API_KEY` | [Google Cloud Console](https://console.cloud.google.com) → APIs → Enable Places API → Credentials → Create API Key |
| `ORS_API_KEY` | [OpenRouteService](https://openrouteservice.org/dev/#/signup) → Sign Up → Dashboard → API Key |

### 3. Frontend Setup

```bash
cd ../frontend
npm install
```

Open `frontend/config/env.ts` and update the `API_BASE_URL` to point to your backend:

```typescript
// Android Emulator: 10.0.2.2 maps to host machine's localhost
export const API_BASE_URL = 'http://10.0.2.2:5000/api';

// iOS Simulator: use 127.0.0.1
// export const API_BASE_URL = 'http://127.0.0.1:5000/api';

// Physical device: use your machine's local IP address
// export const API_BASE_URL = 'http://192.168.x.x:5000/api';
```

The Firebase client config (`FIREBASE_CONFIG`) and `GOOGLE_WEB_CLIENT_ID` in `env.ts` are already set for the project. If you fork the project and use your own Firebase instance, replace those values with your own from the Firebase Console.

### 4. Firebase Console Setup

1. **Enable Authentication Providers:**
   - Firebase Console → Authentication → Sign-in method
   - Enable **Email/Password**
   - Enable **Google** (add Web Client ID)

2. **Create Realtime Database:**
   - Firebase Console → Realtime Database → Create Database
   - Start in **test mode** (update rules for production)

---

## Running the Application

### Start the Backend

```bash
cd backend
npm run dev          # Starts on port 5000 with --watch for auto-reload
```

You should see:

```
WanderMate API Gateway running on port 5000
```

### Start the Frontend

```bash
cd frontend
npx expo start       # Opens Expo dev tools
```

Then:

- Press `a` to open in Android emulator
- Or scan the QR code with the **Expo Go** app on your phone

### Verify

- Health check: `curl http://localhost:5000/api/health`
- Expected response: `{"status":"ok","timestamp":"..."}`

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|--------------|
| `GET` | `/api/health` | Health check (unauthenticated) |
| `GET` | `/api/trips` | List all trips for the authenticated user |
| `POST` | `/api/trips` | Create a new trip |
| `GET` | `/api/trips/:id` | Get a single trip |
| `PUT` | `/api/trips/:id` | Update trip metadata |
| `DELETE` | `/api/trips/:id` | Delete a trip (owner only) |
| `POST` | `/api/trips/:id/days/:dayIndex/stops` | Add a stop to a day |
| `PUT` | `/api/trips/:id/days/:dayIndex/stops/:stopId` | Update a stop |
| `DELETE` | `/api/trips/:id/days/:dayIndex/stops/:stopId` | Remove a stop |
| `PUT` | `/api/trips/:id/days/:dayIndex/reorder` | Reorder stops in a day |
| `POST` | `/api/trips/:id/collaborators` | Add a collaborator (must be a follower) |
| `GET` | `/api/poi/search?q=&lat=&lng=` | Text search for POIs |
| `GET` | `/api/poi/category/:cat?lat=&lng=` | Browse POIs by category |
| `GET` | `/api/poi/geocode?q=` | Geocode a destination name |
| `GET` | `/api/poi/details/:placeId` | Get enriched place details |
| `POST` | `/api/routes/calculate` | Calculate a point-to-point route |
| `POST` | `/api/routes/optimize` | Optimise a multi-stop route (VROOM) |
| `GET` | `/api/budget/:tripId` | Get all expenses and budget summary |
| `POST` | `/api/budget/:tripId` | Add an expense |
| `PUT` | `/api/budget/:tripId/:expenseId` | Update an expense |
| `DELETE` | `/api/budget/:tripId/:expenseId` | Delete an expense |
| `GET` | `/api/feed` | Paginated social feed (`?type=following` or discover) |
| `POST` | `/api/feed/publish/:tripId` | Publish a trip to the feed |
| `POST` | `/api/feed/:postId/like` | Like / unlike a feed post |
| `POST` | `/api/feed/:postId/clone` | Clone a published itinerary |
| `GET` | `/api/users/me` | Get current user profile (creates on first login) |
| `PUT` | `/api/users/me` | Update display name / avatar |
| `GET` | `/api/users/search?q=` | Search users by name or email |
| `GET` | `/api/users/me/friends` | Get mutual friends (following + followers) |
| `GET` | `/api/users/me/requests` | Get incoming follow requests |
| `POST` | `/api/users/:uid/follow` | Send a follow request |
| `POST` | `/api/users/:uid/accept-follow` | Accept a follow request |
| `POST` | `/api/users/:uid/deny-follow` | Deny a follow request |
| `POST` | `/api/users/:uid/unfollow` | Unfollow a user |
| `GET` | `/api/users/:uid` | Get a user's public profile |

All endpoints except `/api/health` require a `Authorization: Bearer <firebase-jwt>` header.
