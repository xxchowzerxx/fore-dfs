import 'dotenv/config'
import * as fs from 'fs'
import * as readline from 'readline'
import { supabaseAdmin } from '../lib/supabase'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer)
    })
  })
}

interface ContestantRow {
  rank: number
  entryId: string
  entryName: string
  points: number
  lineup: string
}

interface PlayerRow {
  playerName: string
  fpts: number
}

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: npx ts-node scripts/import-contest.ts <csv-file-path>')
    process.exit(1)
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8')
  const lines = fileContent.split('\n').filter((l) => l.trim())

  // Parse contestants (top section) and players (bottom section)
  const contestants: ContestantRow[] = []
  const playerMap: Record<string, number> = {}

  let parsingContestants = true
  for (const line of lines) {
    const cols = line.split('\t').map((c) => c.trim())
    if (!cols[0]) continue

    // Heuristic: if row has "Rank" header or "EntryId", skip
    if (cols[0] === 'Rank' || cols[0] === 'EntryId') continue

    // Check if this looks like a contestant row (has numeric rank and entry ID)
    const rankNum = parseInt(cols[0])
    if (!isNaN(rankNum) && rankNum > 0 && rankNum <= 100 && cols[1]) {
      parsingContestants = true
      contestants.push({
        rank: rankNum,
        entryId: cols[1],
        entryName: cols[2] || '',
        points: parseFloat(cols[4]) || 0,
        lineup: cols[5] || '',
      })
    } else if (parsingContestants && cols[0] && !rankNum) {
      // Switched to player section
      parsingContestants = false
      const playerName = cols[0]
      const fpts = parseFloat(cols[1]) || 0
      if (playerName && !playerName.includes('Player')) {
        playerMap[playerName] = fpts
      }
    } else if (!parsingContestants && cols[0]) {
      const playerName = cols[0]
      const fpts = parseFloat(cols[1]) || 0
      if (playerName && playerName !== 'Player') {
        playerMap[playerName] = fpts
      }
    }
  }

  console.log(`Parsed ${contestants.length} contestants and ${Object.keys(playerMap).length} players\n`)

  // Prompt for tournament info
  const tournamentName = await prompt('Tournament name: ')
  const course = await prompt('Course name: ')
  const dkContestId = await prompt('DK contest ID: ')
  const startDate = await prompt('Start date (YYYY-MM-DD): ')

  rl.close()

  // Insert into Supabase
  try {
    // Create tournament
    const { data: tournament, error: tourError } = await supabaseAdmin
      .from('tournaments')
      .insert({
        name: tournamentName,
        course,
        dk_contest_id: dkContestId,
        start_date: startDate,
        current_round: 1,
        is_active: true,
      })
      .select()

    if (tourError) throw new Error(`Tournament insert failed: ${tourError.message}`)
    const tournamentId = tournament?.[0]?.id
    if (!tournamentId) throw new Error('No tournament ID returned')

    console.log(`✓ Tournament created: ${tournamentId}`)

    // Insert contestants
    const contestantIds: Record<string, string> = {}
    const { data: contestantsData, error: contestError } = await supabaseAdmin
      .from('contestants')
      .insert(
        contestants.map((c) => ({
          tournament_id: tournamentId,
          name: c.entryName,
          handle: c.entryName.replace(/\s+/g, '_').toLowerCase(),
          dk_entry_id: c.entryId,
          total_fpts: c.points,
          rank: c.rank,
        }))
      )
      .select()

    if (contestError) throw new Error(`Contestants insert failed: ${contestError.message}`)
    contestantsData?.forEach((c) => {
      contestantIds[c.dk_entry_id] = c.id
    })
    console.log(`✓ ${contestantsData?.length || 0} contestants created`)

    // Parse rosters and insert
    const rosterRows: Array<{
      contestant_id: string
      tournament_id: string
      player_name: string
    }> = []

    for (const contestant of contestants) {
      const playerNames = contestant.lineup
        .split(' ')
        .filter((p) => p && !p.match(/^[A-Z]$/)) // Filter out position codes
      for (const playerName of playerNames) {
        rosterRows.push({
          contestant_id: contestantIds[contestant.entryId],
          tournament_id: tournamentId,
          player_name: playerName,
        })
      }
    }

    const { error: rosterError } = await supabaseAdmin
      .from('rosters')
      .insert(rosterRows)

    if (rosterError) throw new Error(`Rosters insert failed: ${rosterError.message}`)
    console.log(`✓ ${rosterRows.length} roster entries created`)

    // Insert player scores
    const playerScoreRows = Object.entries(playerMap).map(([name, fpts]) => ({
      tournament_id: tournamentId,
      player_name: name,
      fpts,
      position: null,
      position_display: null,
      to_par: 0,
      thru: 0,
      round_scores: [],
    }))

    const { error: scoresError } = await supabaseAdmin
      .from('player_scores')
      .insert(playerScoreRows)

    if (scoresError) throw new Error(`Player scores insert failed: ${scoresError.message}`)
    console.log(`✓ ${playerScoreRows.length} player scores created`)

    console.log('\n✅ Import complete!\n')
    console.log('Summary:')
    console.log(`  Tournament: ${tournamentName} at ${course}`)
    console.log(`  Contestants: ${contestants.length}`)
    console.log(`  Rosters: ${rosterRows.length}`)
    console.log(`  Players: ${playerScoreRows.length}`)
  } catch (error) {
    console.error('\n❌ Import failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
