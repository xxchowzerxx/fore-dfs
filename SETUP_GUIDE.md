# Fore! DFS Setup Guide

## Step 1: Update .env.local with Supabase Credentials ✅

Your Supabase project is ready. Copy these values into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://fbduoptclsooqbigshqa.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<copy from Supabase dashboard → Settings → API Keys → Legacy → anon>
SUPABASE_SERVICE_KEY=<copy from Supabase dashboard → Settings → API Keys → Legacy → service_role>
```

### How to copy from Supabase:
1. Go to https://supabase.com/dashboard/project/fbduoptclsooqbigshqa/settings/api-keys/legacy
2. Under "anon | public", click **Copy** → paste into `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Under "service_role | secret", click **Copy** → paste into `SUPABASE_SERVICE_KEY`
4. Save `.env.local`

---

## Step 2: Get SportsDataIO API Key

1. Go to https://sportsdata.io/
2. Sign up for a free account (or use existing account)
3. Go to your dashboard and find your API key
4. Copy it and add to `.env.local`:
   ```
   GOLF_API_KEY=your_sportsdata_io_key_here
   ```

**Note**: SportsDataIO has free tier with rate limits. You need a valid key even for testing.

---

## Step 3: Get Anthropic API Key

1. Go to https://console.anthropic.com/
2. Sign in with your Anthropic account (same one you're using for Claude Code)
3. Click **API Keys** in the left sidebar
4. Click **Create Key** and copy the new key
5. Add to `.env.local`:
   ```
   ANTHROPIC_API_KEY=sk-ant-your_key_here
   ```

---

## Step 4: Test Locally

Before pushing to GitHub, test everything works locally:

```bash
cd fore-dfs
npm install  # Install any missing dependencies (ts-node)
npm run dev
```

Visit http://localhost:3000 — you should see the leaderboard (empty without data imported).

---

## Step 5: Create GitHub Repository

```bash
# Initialize git
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial Fore! DFS dashboard"

# Create a new repo on GitHub and get the URL (e.g., https://github.com/YOUR_USERNAME/fore-dfs.git)
git remote add origin https://github.com/YOUR_USERNAME/fore-dfs.git
git branch -M main
git push -u origin main
```

---

## Step 6: Deploy to Vercel

1. Go to https://vercel.com/
2. Click **Add New Project** → **Import from Git**
3. Select your `fore-dfs` repo
4. Under **Environment Variables**, add ALL variables from `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL = https://fbduoptclsooqbigshqa.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = [your anon key]
   SUPABASE_SERVICE_KEY = [your service key]
   GOLF_API_KEY = [your SportsDataIO key]
   ANTHROPIC_API_KEY = [your Anthropic key]
   CRON_SECRET = fore-dfs-secret-2026
   ```
5. Click **Deploy** — wait 2–3 minutes for build
6. Once deployed, copy your Vercel URL (e.g., `https://fore-dfs-abc123.vercel.app`)

---

## Step 7: Add GitHub Secrets

These are for the GitHub Actions score-sync workflow:

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add two secrets:

   | Secret Name | Value |
   |---|---|
   | `CRON_SECRET` | `fore-dfs-secret-2026` |
   | `APP_URL` | `https://your-vercel-domain.vercel.app` |

   (Replace with your actual Vercel URL from Step 6)

---

## Step 8: Test Manual Score Sync

Test that the sync endpoint works:

```bash
curl -X POST https://your-vercel-domain.vercel.app/api/sync \
  -H "Authorization: Bearer fore-dfs-secret-2026" \
  -H "Content-Type: application/json"
```

You should see a JSON response with something like:
```json
{
  "success": true,
  "tournament": "Your Tournament Name",
  "scoresUpdated": 0,
  "scoresStale": 0,
  "timestamp": "2025-01-08T..."
}
```

(Scores are 0 until you import a contest.)

---

## Step 9: Import Your First Contest

1. Export contest standings from DraftKings as CSV
2. Save to `imports/conteststandings.csv`
3. Run import script:
   ```bash
   npm run import ./imports/conteststandings.csv
   ```
4. Answer the prompts:
   - Tournament name: (e.g., "2025 PGA Tour Championship")
   - Course name: (e.g., "East Lake Golf Club")
   - DK contest ID: (from the URL)
   - Start date: (YYYY-MM-DD)

---

## Step 10: Verify Everything

1. Open your Vercel URL in browser → leaderboard loads with contestants
2. Click a contestant name → team page loads
3. GitHub Actions workflow runs every 10 minutes (Thu–Sun, 5–11 PM ET)

---

## Troubleshooting

### "No active tournament" on leaderboard
→ Run the import script for this week's contest

### Score sync returns 401 Unauthorized
→ Check that `CRON_SECRET` in GitHub Secrets matches your `.env.local`

### API calls fail / "API key not found"
→ Verify all three API keys are in `.env.local` (Supabase, SportsDataIO, Anthropic)

### Next.js build fails on Vercel
→ Check logs in Vercel dashboard. Common issue: missing `NEXT_PUBLIC_` prefix on client-side vars

---

## What's Next

Once deployed and first contest imported:
- Dashboard syncs scores automatically every 10 min during tournaments
- AI commentary regenerates when scores change significantly
- Real-time updates via Supabase subscriptions
- Manual refresh button on leaderboard for immediate updates
