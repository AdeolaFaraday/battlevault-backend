# Firebase Realtime Integration

## Overview

This implementation provides a flexible abstraction layer for real-time game state management that allows switching between different providers (Firebase Firestore, Socket.IO, etc.) without changing application code.

## Architecture

### Components

1. **RealtimeProvider Interface** (`services/realtime/RealtimeProvider.ts`)
   - Defines the contract for all realtime providers
   - Methods: `initialize()`, `createGameDocument()`, `updateGameState()`, `getGameState()`, `deleteGameDocument()`, `addPlayerToGame()`

2. **FirebaseRealtimeProvider** (`services/realtime/FirebaseRealtimeProvider.ts`)
   - Firebase Firestore implementation
   - Uses existing Firebase Admin SDK instance
   - Stores game state in `games` collection

3. **RealtimeProviderFactory** (`services/realtime/index.ts`)
   - Singleton factory pattern
   - Selects provider based on `REALTIME_PROVIDER` environment variable
   - Defaults to Firebase

## How It Works

### Game Creation Flow

1. **Frontend initiates game** → Calls `createGame` mutation
2. **Backend creates MongoDB record** → Persistent storage
3. **Backend creates Firebase document** → Real-time sync
4. **Frontend listens to Firebase** → Gets real-time updates

### Player Join Flow

1. **Second player joins** → Calls `joinGame` mutation
2. **Backend updates MongoDB** → Adds player to array
3. **Backend updates Firebase** → Uses `arrayUnion` for atomic update
4. **Both players get notified** → Via Firebase listeners

## GraphQL API

### Create Game
```graphql
mutation {
  createGame(input: {
    name: "Quick Match"
    type: FREE
    players: [
      { name: "Player 1", color: "BLUE", tokens: ["BLUE", "BLUE", "BLUE", "BLUE"] }
    ]
  }) {
    id
    name
    players {
      id
      name
      color
    }
  }
}
```

### Join Game
```graphql
mutation {
  joinGame(
    gameId: "game-id-here"
    player: {
      name: "Player 2"
      color: "YELLOW"
      tokens: ["YELLOW", "YELLOW", "YELLOW", "YELLOW"]
    }
  ) {
    id
    players {
      name
      color
    }
  }
}
```

### Update Game State
```graphql
mutation {
  updateGame(
    id: "game-id-here"
    input: {
      currentTurn: "player-2-id"
      diceValue: [6]
      isRolling: false
    }
  ) {
    id
    currentTurn
    diceValue
  }
}
```

## Frontend Integration

### Listening to Game Updates (Firebase)

```typescript
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';

const db = getFirestore();
const gameRef = doc(db, 'games', gameId);

// Listen for real-time updates
const unsubscribe = onSnapshot(gameRef, (snapshot) => {
  if (snapshot.exists()) {
    const gameState = snapshot.data();
    setGameState(gameState);
  }
});

// Cleanup
return () => unsubscribe();
```

## Switching Providers

To switch from Firebase to Socket.IO (future):

1. Create `SocketIORealtimeProvider.ts` implementing `RealtimeProvider`
2. Update `RealtimeProviderFactory` to include the new provider
3. Set environment variable: `REALTIME_PROVIDER=socketio`
4. No changes needed in resolvers or application code

## Data Flow

```
┌─────────────┐
│  Frontend   │
│   (Lobby)   │
└──────┬──────┘
       │ createGame mutation
       ▼
┌─────────────────────────────────┐
│  GraphQL Resolver               │
│  1. Create in MongoDB           │
│  2. Create in Firebase          │
└──────┬──────────────────────────┘
       │
       ├─────────────┬──────────────┐
       ▼             ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────────┐
│ MongoDB  │  │ Firebase │  │  Response    │
│ (Source  │  │ (Realtime│  │  to Frontend │
│  of      │  │  Sync)   │  │              │
│  Truth)  │  │          │  │              │
└──────────┘  └────┬─────┘  └──────────────┘
                   │
                   │ Real-time updates
                   ▼
            ┌─────────────┐
            │  Frontend   │
            │  Listeners  │
            └─────────────┘
```

## Best Practices

1. **MongoDB is source of truth** - Always update MongoDB first
2. **Firebase for real-time only** - Use for live game state synchronization
3. **Error handling** - Both MongoDB and Firebase operations should succeed or fail together
4. **Cleanup** - Delete Firebase documents when games end
5. **Security Rules** - Configure Firebase security rules to prevent unauthorized writes

## Firebase Security Rules (Recommended)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /games/{gameId} {
      // Allow read for all authenticated users
      allow read: if request.auth != null;
      
      // Only allow writes from backend (using Admin SDK)
      allow write: if false;
    }
  }
}
```

## Environment Variables

```env
REALTIME_PROVIDER=firebase  # Options: firebase, socketio (future)
```
