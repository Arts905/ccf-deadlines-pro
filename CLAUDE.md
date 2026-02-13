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
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

The DeepSeek API is used for the AI chat assistant. If not provided, the chat API falls back to a rule-based keyword matching system.

## Database (Supabase)

Conference data is stored in Supabase PostgreSQL with the following tables:

- `conferences` - Main conference metadata (id, title, description, sub)
- `ranks` - CCF/CORE/THCPL rankings (one-to-one with conferences)
- `conference_instances` - Specific year/edition data (many-to-one with conferences)
- `timeline_items` - Deadline information (many-to-one with instances)

**Migration:** Run `npm run migrate-db` to migrate data from `public/conferences.json` to Supabase.

**Data Access:** Use `getConferencesFromDB()` in `lib/supabase.ts` which fetches and transforms data to match the original `Conference` type.

## QR Code Configuration

WeChat group QR codes are configured based on conference deadline month in `ConferenceList.tsx`:

```typescript
const DEADLINE_QR_MAP = [
  { months: [1, 2, 3, 4], qrImage: '', groupName: 'CCF 1-4月投稿群' },  // No QR yet
  { months: [5, 6], qrImage: '/ccf五六月投稿群.jpg', groupName: 'CCF 五六月投稿群' },
  { months: [7, 8, 9], qrImage: '/CCF7-9月投稿群.jpg', groupName: 'CCF 7-9月投稿群' },
  { months: [10, 11, 12], qrImage: '/ccf9-12月投稿群.jpg', groupName: 'CCF 10-12月投稿群' },
];
```

**QR Images Location:** Place QR code images in `public/` directory. Images are phone screenshots, displayed at 288x288px in modal.

**Adding New QR Codes:**
1. Add image file to `public/` directory
2. Update `DEADLINE_QR_MAP` with correct months mapping
3. If `qrImage` is empty, modal shows "暂无二维码" placeholder

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
