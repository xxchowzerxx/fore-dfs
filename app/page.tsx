'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Tournament, Contestant } from '@/lib/types'

export default function Home() {
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [contestants, setContestants] = useState<Contestant[]>([])
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: tours } = await supabase
          .from('tournaments')
          .select('*')
          .eq('is_active', true)
          .limit(1)

        if (tours && tours.length > 0) {
          setTournament(tours[0])

          const { data: conts } = await supabase
            .from('contestants')
            .select('*')
            .eq('tournament_id', tours[0].id)
            .order('rank', { ascending: true })

          if (conts) {
            setContestants(conts)
          }
        }

        setLastSynced(new Date())
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  useEffect(() => {
    if (!tournament) return

    const channel = supabase
      .channel(`contestants:${tournament.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contestants',
          filter: `tournament_id=eq.${tournament.id}`,
        },
        (payload) => {
          const newContestant = payload.new as Contestant
          setContestants((prev) => {
            const updated = [...prev]
            const idx = updated.findIndex((c) => c.id === newContestant.id)
            if (idx >= 0) {
              updated[idx] = newContestant
            } else {
              updated.push(newContestant)
            }
            return updated.sort((a, b) => (a.rank || 0) - (b.rank || 0))
          })
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [tournament])

  const handleRefresh = async () => {
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}`,
        },
      })
      if (res.ok) {
        setLastSynced(new Date())
      }
    } catch (error) {
      console.error('Sync failed:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-white">Loading tournament...</div>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-white text-center">
          <h1 className="text-3xl font-bold mb-4">No active tournament</h1>
          <p>Import a contest to get started.</p>
        </div>
      </div>
    )
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6">
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">{tournament.name}</h1>
              <p className="text-slate-400">
                {tournament.course} • Round {tournament.current_round}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400 mb-2">
                {lastSynced && `Last synced: ${Math.round((Date.now() - lastSynced.getTime()) / 60000)}m ago`}
              </div>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium text-sm"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900">
                <th className="text-left p-4 text-slate-300 font-semibold">Rank</th>
                <th className="text-left p-4 text-slate-300 font-semibold">Contestant</th>
                <th className="text-right p-4 text-slate-300 font-semibold">FPTS</th>
                <th className="text-left p-4 text-slate-300 font-semibold">Record</th>
                <th className="text-left p-4 text-slate-300 font-semibold">Top Scorer</th>
                <th className="text-center p-4 text-slate-300 font-semibold">Trend</th>
              </tr>
            </thead>
            <tbody>
              {contestants.map((c, idx) => {
                const medal = idx < 3 ? medals[idx] : null
                return (
                  <tr
                    key={c.id}
                    className="border-b border-slate-700 hover:bg-slate-700/50 cursor-pointer transition"
                  >
                    <td className="p-4 text-white font-bold text-xl">
                      {medal} {c.rank}
                    </td>
                    <td className="p-4">
                      <Link href={`/team/${c.handle}`}>
                        <span className="text-blue-400 hover:underline">{c.handle}</span>
                      </Link>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-white font-bold text-lg">{c.total_fpts}</span>
                    </td>
                    <td className="p-4 text-slate-300 text-sm">—</td>
                    <td className="p-4 text-slate-300 text-sm">—</td>
                    <td className="p-4 text-center">
                      <span className="text-lg">
                        {c.rank && c.rank <= 4 ? '📈' : '📉'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
