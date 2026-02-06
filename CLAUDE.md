# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

- `npm run dev` - Start development server (http://localhost:3000)
- `npm run build` - Build production bundle
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run generate-data` - Generate `public/conferences.json` from YAML source files in `ccf-deadlines-main/conference/`

## Environment Setup

Create `.env.local` with:
```env
DEEPSEEK_API_KEY=sk-your-api-key-here
```

The DeepSeek API is used for the AI chat assistant. If not provided, the chat API falls back to a rule-based keyword matching system.

## Architecture Overview

### Data Source & Pipeline

Conference data originates from `ccf-deadlines-main/conference/` (YAML files). The `scripts/generate-data.js` script converts these YAML files into a single JSON database at `public/conferences.json`, which is loaded at build time and runtime.

**Hot Reload:** The API routes implement file watching with a 5-minute TTL cache fallback. Updates to `public/conferences.json` are reflected without server restart (via `fs.watch` in `app/api/chat/route.ts:28-43`).

### Core Types

- `Conference` - Top-level conference data (title, description, sub category, rank, confs array)
- `ConferenceInstance` - Specific year/instance with timeline, timezone, date, place, link
- `TimelineItem` - Deadline entries (deadline, abstract_deadline, comment)
- `Rank` - Ranking system (ccf, core, thcpl)

Key categories: DS (Systems), NW (Network), SC (Security), SE (Software), DB (Database), CT (Theory), CG (Graphics), AI (AI), HI (HCI), MX (Interdisciplinary)

### Time Handling

All deadline calculations use **Asia/Shanghai timezone** as the server time reference (defined in `app/api/chat/route.ts:72`). The `getNextDeadline()` function:
- Parses timezone strings (UTC±X, AoE → UTC-12)
- Finds the next upcoming deadline across all conference instances
- If no future deadlines exist, returns the most recent past one

### AI Chat Architecture

`app/api/chat/route.ts` implements a hybrid approach:

1. **DeepSeek API** (primary): Calls DeepSeek with a system prompt including server time and filtered conference data
2. **Rule-based fallback**: Local keyword matching for rank filtering (CCF A/B/C), category detection, date/location filtering

The `analyzeQuery()` function filters conferences based on natural language patterns before sending context to the AI.

### Internationalization (i18n)

Three languages supported: en, zh (Chinese), tw (Traditional Chinese).

- Translation strings in `app/contexts/LanguageContext.tsx`
- Uses React Context + localStorage for persistence
- Conference locations translated via Google Translate API (`/api/translate`) with client-side caching in `ConferenceList.tsx:120-284`
- Hardcoded dictionary for common place names (China, USA, cities) as fallback

### Component Structure

- `app/page.tsx` - Server component, loads conference data at build time via `getConferences()`
- `app/components/ConferenceList.tsx` - Client component with filtering, search, countdown timers, favorites (localStorage), QR code modal
- `app/components/ChatWidget/` - Floating chat interface with message history
- `app/contexts/LanguageContext.tsx` - Global language state

### Path Alias

TypeScript paths are configured: `@/*` maps to project root (used in imports like `@/app/types`).

## Data Generation Workflow

When updating conference data:
1. Place updated YAML files in `ccf-deadlines-main/conference/`
2. Run `npm run generate-data` to rebuild `public/conferences.json`
3. The file watcher in production will pick up changes automatically within 5 minutes

## Third-Party Dependencies

- **DeepSeek API** - AI chat responses (requires API key)
- **google-translate-api-x** - Translation service (unofficial)
- **dayjs** - Date/time manipulation with UTC and timezone plugins
- **framer-motion** - Animation library for modals and transitions
- **lucide-react** - Icon set
