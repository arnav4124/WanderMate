# Collaborative Trip Editing: Architecture & Design Report

## 1. Introduction
The collaborative editing feature allows multiple users to plan trips, manage budgets, and edit itineraries in real-time. To ensure a seamless, low-latency, and offline-resilient experience, WanderMate employs a hybrid database strategy, combining MongoDB as the persistent source of truth with Firebase Realtime Database for instantaneous state synchronization.

## 2. Architecture Choices
### Hybrid Data Sync (MongoDB + Firebase)
Instead of relying solely on HTTP polling (which introduces heavy server loads and UI lag) or building custom WebSocket infrastructure (which adds maintenance overhead), the application utilizes a hybrid approach:
*   **MongoDB (Source of Truth):** Handles complex relational queries, data integrity, user management (followers, feeds), and permanent storage.
*   **Firebase Realtime Database (Sync Layer):** Provides an out-of-the-box WebSocket layer that broadcasts state changes payload to subscribed clients (collaborators) under 500ms.

This choice satisfies strict Non-Functional Requirements (NFRs) for low-latency synchronization while retaining the scalability of MongoDB for feed/social features.

## 3. Core Design Patterns

### The Observer Pattern
The backbone of the real-time syncing mechanism is the Observer pattern, executed on both the frontend and backend.
*   **Backend (`tripObserver.js`):** Node.js `EventEmitter` acts as the Subject. Whenever a REST API endpoint modifies a trip in MongoDB (e.g., `COLLABORATORS_UPDATED`, `TRIP_UPDATED`), an event is dispatched. The observer listens to this event, retrieves the `lean()` document, and pushes a sanitized copy to Firebase.
*   **Frontend (`tripStore.ts` & `budgetStore.ts`):** Zustand acts as the local Subject for the UI components, while subscribing as an Observer to Firebase. The `subscribeTripUpdates` function attaches an `onValue` listener to `trips/{tripId}`, hydrating the store immediately when remote collaborators make adjustments.

### The Command Pattern
To satisfy the requirement for Undo/Redo capabilities and Optimistic UI updates, the frontend utilizes the Command pattern.
*   Mutations (like `ADD_STOP`, `REMOVE_STOP`, `REORDER_STOPS`) are modeled as discrete `Command` objects containing `tripId`, `data`, and a snapshot of the `previousState`.
*   These are pushed into an `undoStack` array. When a user taps "Undo", the state is rolled back by firing a `PUT` request with the `previousState` and transferring the command to a `redoStack`.

## 4. Tactics and Mechanisms

### Last-Write-Wins (LWW) Conflict Resolution
To handle concurrent edits by multiple users, the frontend implements a primitive Last-Write-Wins (LWW) strategy inside the Firebase listener:
```typescript
if (!localTrip || new Date(data.updatedAt) >= new Date(localTrip.updatedAt || 0)) {
    // Apply remote data over local state
}
```
This ensures that older remote syncs don't accidentally overwrite newer local modifications if network packets arrive out of order.

### Disconnected / Offline Tactics
If a user edits a trip while offline:
1.  **Optimistic Updates:** The UI reflects changes immediately using Zustand state updates.
2.  **Sync Queue:** API calls fail and are caught by an offline fallback mechanism, moving the mutation into a `syncQueue` backed by `AsyncStorage`.
3.  **Eventual Replay:** Once connection is restored, `syncQueue.flush()` replays mutations in timestamp order to the API Gateway. The backend updates MongoDB, fires the Observer, and Firebase broadcasts the resolved state to other collaborators, converging their views.

### Security and Authorization
Per-trip access control protects editing capabilities.
*   **Middleware:** The backend `authenticate` middleware verifies Firebase ID tokens.
*   **Route Guards:** Controllers verify that the requesting user's Firebase UID exists in either the `owner` field or the `collaborators[]` array. Owners have elevated capabilities (e.g., deleting trips, broadcasting to the feed). Collaborators must be accepted friends/followers.

## 5. Known Limitations & edge cases
**The Firebase Array Omission Effect**
A critical tactical edge case encountered during development resides in how Firebase Realtime DB handles array deletion. **Firebase automatically deletes keys if their assigned value is an empty array (`[]`) or `null`.** 
When a collaborator deletes the last stop in a day, Firebase drops the `stops` array from the payload entirely. When this synced to other clients, their code expected an array and crashed when calling `.length` on `undefined`.
*   **Mitigation Tactic:** Strict defensive programming. Defensive optional chaining (`day?.stops?.length`) and fallback default values (`day.stops || []`) are explicitly required across all frontend rendering maps/lists and backend API tallying logic to safeguard against stripped keys.