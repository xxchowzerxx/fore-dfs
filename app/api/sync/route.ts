import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchLiveLeaderboard } from '@/lib/golf-api'

/**
 * POST /api/sync
 * Syncs live scores from SportsDataIO to Supabase.
 * Requires: Authorization header with Bearer token matching CRON_SECRET.
 */
export async function POST(req: NextRequest) {
  // Verify authorization
  const authHeader = req.headers.get('Authorization') || ''
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

  if (authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get the active tournament
    const { data: tournaments, error: tourError } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .eq('is_active', true)
      .limit(1)

    if (tourError) throw new Error(`Tournament fetch failed: ${tourError.message}`)
    if (!tournaments || tournaments.length === 0) {
      return NextResponse.json({ error: 'No active tournament' }, { status: 404 })
    }

    const tournament = tournaments[0]
    console.log(`[Sync] Active tournament: ${tournament.name} (${tournament.id})`)

    // Fetch live leaderboard
    const liveScores = await fetchLiveLeaderboard(tournament.id)
    if (!liveScores.length) {
      return NextResponse.json({ error: 'Failed to fetch live scores' }, { status: 500 })
    }

    // Get all rosters to match players
    const { data: rosters, error: rosterError } = await supabaseAdmin
      .from('rosters')
      .select('*, player_scores(id, player_name, fpts)')
      .eq('tournament_id', tournament.id)

    if (rosterError) throw new Error(`Rosters fetch failed: ${rosterError.message}`)

    // Update player_scores table with live data
    let scoresUpdated = 0
    let scoresStale = 0

    for (const roster of rosters || []) {
      const livePlayer = liveScores.find(
        (p) =>
          p.player_name.toLowerCase() === roster.player_name.toLowerCase() ||
          // Fuzzy match: handle initials and variations
          p.player_name.split(' ')[1]?.toLowerCase() ===
            roster.player_name.split(' ')[1]?.toLowerCase()
      )

      if (!livePlayer) continue

      // Check if score changed significantly
      const playerScoreData = roster.player_scores as { fpts?: number } | null
      const oldFpts = playerScoreData?.fpts || 0
      const newFpts = livePlayer.fpts
      const delta = Math.abs(newFpts - oldFpts)

      if (delta > 5) {
        scoresStale++
      }

      const { error: updateError } = await supabaseAdmin
        .from('player_scores')
        .update({
          fpts: livePlayer.fpts,
          position: livePlayer.position,
          position_display: livePlayer.position_display,
          to_par: livePlayer.to_par,
          thru: livePlayer.thru,
          round_scores: livePlayer.round_scores,
          updated_at: new Date().toISOString(),
        })
        .eq('tournament_id', tournament.id)
        .eq('player_name', livePlayer.player_name)

      if (updateError) {
        console.error(`Failed to update ${livePlayer.player_name}:`, updateError.message)
      } else {
        scoresUpdated++
      }
    }

    // Recalculate contestant totals and ranks
    const { data: contestants, error: contestError } = await supabaseAdmin
      .from('contestants')
      .select('id, dk_entry_id')
      .eq('tournament_id', tournament.id)

    if (contestError) throw new Error(`Contestants fetch failed: ${contestError.message}`)

    for (const contestant of contestants || []) {
      // Get contestant's roster with current scores
      const { data: playerScores, error: psError } = await supabaseAdmin
        .from('player_scores')
        .select('fpts')
        .eq('tournament_id', tournament.id)
        .in(
          'player_name',
          (rosters || [])
            .filter((r) => r.contestant_id === contestant.id)
            .map((r) => r.player_name)
        )

      if (psError) continue

      const totalFpts = (playerScores || []).reduce((sum, p) => sum + (p.fpts || 0), 0)

      const { error: updateError } = await supabaseAdmin
        .from('contestants')
        .update({ total_fpts: totalFpts })
        .eq('id', contestant.id)

      if (updateError) {
        console.error(`Failed to update contestant ${contestant.id}:`, updateError.message)
      }
    }

    // Recalculate ranks
    const { data: allContestants, error: allContError } = await supabaseAdmin
      .from('contestants')
      .select('id, total_fpts')
      .eq('tournament_id', tournament.id)
      .order('total_fpts', { ascending: false })

    if (!allContError && allContestants) {
      for (let i = 0; i < allContestants.length; i++) {
        await supabaseAdmin
          .from('contestants')
          .update({ rank: i + 1 })
          .eq('id', allContestants[i].id)
      }
    }

    // Mark commentary as stale if scores changed significantly
    if (scoresStale > 0) {
      const { error: commentError } = await supabaseAdmin
        .from('commentary')
        .update({ generated_at: null })
        .eq('tournament_id', tournament.id)

      if (commentError) {
        console.error('Failed to invalidate commentary:', commentError.message)
      }
    }

    return NextResponse.json({
      success: true,
      tournament: tournament.name,
      scoresUpdated,
      scoresStale,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Sync] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
