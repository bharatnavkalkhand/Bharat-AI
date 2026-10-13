# Bharat AI

**Avatar Movie Studio** — Create story-driven 5–10 minute movies with characters, fight scenes, romance gestures, and avatar-style consistency.

> **Fundamental design goal: ₹0 operating cost**

## What this app is built for

- **Characters / Avatars** — name, appearance, role, reference photo upload for face consistency
- **Fight scenes** — marked with action notes
- **Romance scenes** — soft gestures
- **Gesture / body language** scenes
- Hindi + English
- 5 min / 10 min target durations

## Honest status

### Working now
- Mobile-first UI
- Create movie with genre focus (Action/Fight, Romance, Drama, Comedy)
- Character & Avatar Studio with reference image upload
- Scene Planner with mood tags: fight · romance · gesture · dialogue · action · emotional
- Local persistence

### Not yet
- Full AI script generation
- Free image / video generation pipeline
- Talking-avatar / lip-sync
- Multi-scene assembly + MP4 export

## Run locally

```bash
npm install
npm run dev
```

## Tech

- Vite + React 19 + TypeScript + Tailwind CSS v4
- Zustand (persisted)
- React Router
- Zod
