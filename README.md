# Fore! DFS Dashboard

A real-time golf DFS scoring dashboard for private 8-person leagues. Syncs live tournament data from SportsDataIO, calculates DraftKings classic scoring, and generates AI-powered team analysis.

## Features

- **Live Leaderboard**: Real-time contestant standings with FPTS, rankings, and trends
- **Team Pages**: Detailed roster views with player scores, H2H matchups, and shared player analysis
- **AI Commentary**: Claude-powered analysis of team situations, predictions, and strategy
- **Score Sync**: Automated sync every 10 minutes (Thu–Sun, 5–11 PM ET)
- **Real-time Updates**: Supabase subscriptions for instant data changes

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Backend**: Next.js API routes, Node.js
- **Database**: Supabase (PostgreSQL)
- **APIs**: SportsDataIO (PGA leaderboard), Anthropic Claude (commentary)
- **Deployment**: Vercel

## Weekly Workflow

1. Export contest standings from DraftKings as CSV
2. Run: `npm run import ./imports/conteststandings.csv`
3. Answer prompts for tournament name, course, DK contest ID, start date
4. Dashboard automatically syncs scores every 10 minutes during tournament
5. AI commentary updates when scores change significantly

## Manual Score Sync

To trigger an immediate score update:

```bash
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer fore-dfs-secret-2026"
```

(Replace `http://localhost:3000` with your production URL on Vercel)

## Environment Variables

Required in `.env.local` or Vercel settings:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
GOLF_API_KEY=your-sportsdata-io-key
ANTHROPIC_API_KEY=sk-ant-...
CRON_SECRET=fore-dfs-secret-2026
```

## Getting Started

### Local Development

```bash
# Install dependencies
npm install

# Set up environment variables in .env.local

# Start dev server
npm run dev

# Open http://localhost:3000
```

### Import Contest

```bash
npm run import ./imports/contest.csv
```

### Deploy to Vercel

1. Push code to GitHub
2. Connect repo to Vercel
3. Add environment variables in Vercel project settings
4. Add GitHub secrets (`CRON_SECRET`, `APP_URL`)
5. Deploy

## GitHub Actions Setup

The workflow `score-sync.yml` runs every 10 minutes during tournament hours (Thu–Sun, 5–11 PM ET).

Required GitHub secrets:
- `CRON_SECRET` = your `fore-dfs-secret-2026`
- `APP_URL` = https://your-app.vercel.app

## Adding a New Tournament

1. Get contest standings CSV from DraftKings
2. Run `npm run import ./imports/conteststandings.csv`
3. Select "Yes" to mark as active
4. Dashboard will sync scores automatically

## Scripts

- `npm run dev` — Start Next.js dev server
- `npm run build` — Build for production
- `npm run start` — Start production server
- `npm run import` — Import contest standings from CSV

## Project Structure

```
fore-dfs/
├── app/
│   ├── page.tsx              # Leaderboard
│   ├── team/[handle]/        # Team detail page
│   └── api/
│       ├── sync/route.ts     # Score sync endpoint
│       └── commentary/route.ts # AI commentary endpoint
├── lib/
│   ├── supabase.ts           # Supabase client
│   ├── types.ts              # TypeScript interfaces
│   ├── scoring.ts            # DK scoring engine
│   └── golf-api.ts           # SportsDataIO integration
├── scripts/
│   └── import-contest.ts     # CSV import script
└── .env.local                # Environment variables
```

## Scoring

DraftKings Classic Golf scoring:

- **Stroke play**: Double Eagle +13, Eagle +8, Birdie +3, Par +0.5, Bogey -0.5, Double Bogey or worse -1
- **Finish bonus**: Positions 1–50 get 30–1 bonus points respectively
- **Contestant total**: Sum of all 6 roster players' FPTS

## License

Private use only.
