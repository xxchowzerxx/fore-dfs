import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getHeadToHeadRecord } from '@/lib/scoring'
import Anthropic from '@anthropic-ai/sdk'

interface CommentaryResponse {
  situation: string
  prediction: string
  watchPlayer: string
  trend: 'up' | 'down' | 'hold'
  trashTalk: string
}

/**
 * GET /api/commentary?contestantId=xxx
 * Generates or returns cached AI commentary for a contestant.
 */
export async function GET(req: NextRequest) {
  const contestantId = req.nextUrl.searchParams.get('contestantId')

  if (!contestantId) {
    return NextResponse.json({ error: 'Missing contestantId' }, { status: 400 })
  }

  try {
    // Check for existing fresh commentary (< 30 minutes old)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

    const { data: existingCommentary, error: fetchError } = await supabaseAdmin
      .from('commentary')
      .select('*')
      .eq('contestant_id', contestantId)
      .gt('generated_at', thirtyMinutesAgo)
      .limit(1)

    if (fetchError) throw new Error(`Fetch commentary failed: ${fetchError.message}`)

    if (existingCommentary && existingCommentary.length > 0) {
      const cached = existingCommentary[0]
      return NextResponse.json({
        ...cached,
        cached: true,
      })
    }

    // Fetch data needed to generate new commentary
    const { data: contestant, error: contestError } = await supabaseAdmin
      .from('contestants')
      .select('*, tournament_id')
      .eq('id', contestantId)
      .limit(1)

    if (contestError || !contestant || contestant.length === 0) {
      return NextResponse.json({ error: 'Contestant not found' }, { status: 404 })
    }

    const cont = contestant[0]
    const tournamentId = cont.tournament_id

    // Fetch tournament
    const { data: tournaments, error: tourError } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .limit(1)

    if (tourError || !tournaments || tournaments.length === 0) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    const tournament = tournaments[0]

    // Fetch contestant's roster with scores
    const { data: roster, error: rosterError } = await supabaseAdmin
      .from('rosters')
      .select('player_name')
      .eq('contestant_id', contestantId)

    if (rosterError) throw new Error(`Roster fetch failed: ${rosterError.message}`)

    const playerNames = (roster || []).map((r) => r.player_name)

    const { data: playerScores, error: psError } = await supabaseAdmin
      .from('player_scores')
      .select('*')
      .eq('tournament_id', tournamentId)
      .in('player_name', playerNames)

    if (psError) throw new Error(`Player scores fetch failed: ${psError.message}`)

    // Sort by FPTS descending
    const sortedPlayers = (playerScores || []).sort((a, b) => (b.fpts || 0) - (a.fpts || 0))

    // Fetch league standings
    const { data: allContestants, error: standingsError } = await supabaseAdmin
      .from('contestants')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('rank', { ascending: true })

    if (standingsError) throw new Error(`Standings fetch failed: ${standingsError.message}`)

    // Calculate H2H record
    const opponents = (allContestants || [])
      .filter((c) => c.id !== contestantId)
      .map((c) => ({ name: c.handle, pts: c.total_fpts }))

    const h2h = getHeadToHeadRecord(cont.total_fpts, opponents)

    // Build overlap analysis
    const allRosters = await supabaseAdmin
      .from('rosters')
      .select('player_name, contestant_id')
      .eq('tournament_id', tournamentId)

    const rostersByContestant = new Map<string, Set<string>>()
    for (const r of allRosters.data || []) {
      if (!rostersByContestant.has(r.contestant_id)) {
        rostersByContestant.set(r.contestant_id, new Set())
      }
      rostersByContestant.get(r.contestant_id)!.add(r.player_name)
    }

    const myPlayers = new Set(playerNames)
    const overlaps: string[] = []
    for (const [otherId, otherPlayers] of rostersByContestant) {
      if (otherId === contestantId) continue
      const shared = Array.from(otherPlayers).filter((p) => myPlayers.has(p))
      if (shared.length > 0) {
        const otherName =
          (allContestants || []).find((c) => c.id === otherId)?.handle || 'Unknown'
        overlaps.push(`${shared.join(', ')} (${otherName})`)
      }
    }

    // Generate commentary via Claude
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const userPrompt = `Tournament: ${tournament.name} at ${tournament.course}, Round ${tournament.current_round}.
Team: ${cont.handle} — ${cont.total_fpts} FPTS, ${cont.rank} of 8, Record: ${h2h.record}
Roster (sorted by fpts):
${sortedPlayers.map((p) => `  ${p.player_name}: ${p.fpts} pts (${p.position_display}, ${p.to_par >= 0 ? '+' : ''}${p.to_par})`).join('\n')}
League standings: ${(allContestants || []).map((c) => `${c.rank}. ${c.handle} ${c.total_fpts}`).join(', ')}
Shared players with opponents: ${overlaps.length > 0 ? overlaps.join('; ') : 'none'}
Respond in JSON only:
{
  "situation": "2-3 sentence current analysis",
  "prediction": "1-2 sentence weekend prediction",
  "watchPlayer": "player name to watch",
  "trend": "up | down | hold",
  "trashTalk": "one fun observation or trash-talk line about their situation"
}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      system: `You are a witty, sharp golf DFS analyst for a private 8-person league called Fore! DFS.
Generate punchy, specific commentary that references actual player names and scores.
Be analytical but fun — like a smart friend who knows golf. Max 3 sentences per section.`,
    })

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : ''

    let parsed: CommentaryResponse
    try {
      // Extract JSON from response (in case Claude adds extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : ({} as CommentaryResponse)
    } catch {
      parsed = {
        situation: 'Unable to generate analysis',
        prediction: '',
        watchPlayer: sortedPlayers[0]?.player_name || 'N/A',
        trend: 'hold',
        trashTalk: 'Check back soon!',
      }
    }

    // Normalize trend
    const trend = ['up', 'down', 'hold'].includes(parsed.trend)
      ? (parsed.trend as 'up' | 'down' | 'hold')
      : 'hold'

    // Save to database
    const { error: saveError } = await supabaseAdmin
      .from('commentary')
      .upsert(
        {
          tournament_id: tournamentId,
          contestant_id: contestantId,
          content: parsed.situation,
          prediction: parsed.prediction,
          watch_player: parsed.watchPlayer,
          trend,
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'tournament_id,contestant_id' }
      )

    if (saveError) {
      console.error('Failed to save commentary:', saveError.message)
    }

    return NextResponse.json({
      content: parsed.situation,
      prediction: parsed.prediction,
      watch_player: parsed.watchPlayer,
      trend,
      trash_talk: parsed.trashTalk,
      generated_at: new Date().toISOString(),
      cached: false,
    })
  } catch (error) {
    console.error('[Commentary] Error:', error)

    // Fallback: return stale cached commentary if available
    const { data: stale } = await supabaseAdmin
      .from('commentary')
      .select('*')
      .eq('contestant_id', contestantId)
      .limit(1)

    if (stale && stale.length > 0) {
      return NextResponse.json(
        { ...stale[0], cached: true, stale: true },
        { status: 200 }
      )
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate commentary',
      },
      { status: 500 }
    )
  }
}
