'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Contestant, Tournament, Commentary } from '@/lib/types'

interface PageProps {
  params: { handle: string }
}

export default function TeamPage({ params }: PageProps) {
  const [contestant, setContestant] = useState<Contestant | null>(null)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [commentary, setCommentary] = useState<Commentary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get active tournament
        const { data: tours } = await supabase
          .from('tournaments')
          .select('*')
          .eq('is_active', true)
          .limit(1)

        if (!tours || tours.length === 0) {
          setLoading(false)
          return
        }

        setTournament(tours[0])

        // Get contestant by handle
        const { data: conts } = await supabase
          .from('contestants')
          .select('*')
          .eq('tournament_id', tours[0].id)
          .eq('handle', params.handle)
          .limit(1)

        if (conts && conts.length > 0) {
          setContestant(conts[0])

          // Get commentary
          const { data: comm } = await supabase
            .from('commentary')
            .select('*')
            .eq('contestant_id', conts[0].id)
            .limit(1)

          if (comm && comm.length > 0) {
            setCommentary(comm[0])
          }
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [params.handle])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-white">Loading team...</div>
      </div>
    )
  }

  if (!contestant || !tournament) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-white text-center">
          <h1 className="text-3xl font-bold mb-4">Team not found</h1>
          <Link href="/">
            <span className="text-blue-400 hover:underline">← Back to Standings</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Back button */}
        <Link href="/">
          <span className="text-blue-400 hover:underline text-sm mb-6 inline-block">
            ← Back to Standings
          </span>
        </Link>

        {/* Team header */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-5xl font-bold text-white mb-2">{contestant.handle}</h1>
              <p className="text-2xl text-white font-semibold">
                {contestant.total_fpts} FPTS
              </p>
              <p className="text-slate-400 mt-2">Rank {contestant.rank} of 8</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-yellow-400 mb-2">
                {contestant.rank === 1
                  ? '🥇'
                  : contestant.rank === 2
                  ? '🥈'
                  : contestant.rank === 3
                  ? '🥉'
                  : ''}
              </div>
              <p className="text-slate-400">Trend {commentary?.trend === 'up' ? '📈' : '📉'}</p>
            </div>
          </div>
        </div>

        {/* Roster grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Roster</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {/* Placeholder roster cards - would fetch player scores in real app */}
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-slate-800 border border-slate-700 rounded-lg p-4"
              >
                <div className="h-20 bg-slate-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Commentary panel */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-white mb-4">AI Analysis</h2>
          {commentary ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-slate-300 font-semibold mb-2">Situation</h3>
                <p className="text-slate-400">{commentary.content}</p>
              </div>
              <div>
                <h3 className="text-slate-300 font-semibold mb-2">Prediction</h3>
                <p className="text-slate-400">{commentary.prediction}</p>
              </div>
              <div>
                <h3 className="text-slate-300 font-semibold mb-2">Watch Player</h3>
                <p className="text-slate-400">{commentary.watch_player}</p>
              </div>
            </div>
          ) : (
            <p className="text-slate-400">Generating commentary...</p>
          )}
        </div>
      </div>
    </div>
  )
}
