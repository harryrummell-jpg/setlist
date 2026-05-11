'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Appearance {
  id: string
  show_id: string
  song_name: string
  set_number: string
  position: number
  segue: string | null
  show: {
    id: string
    artist: string
    venue: string
    city: string
    show_date: string
  }
}

export default function SongPage({ params }: { params: Promise<{ artist: string; song: string }> }) {
  const { artist, song } = React.use(params)
  const artistName = decodeURIComponent(artist)
  const songName = decodeURIComponent(song)
  const router = useRouter()

  const [appearances, setAppearances] = useState<Appearance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: showsData } = await supabase
        .from('shows')
        .select('id, artist, venue, city, show_date')
        .eq('user_id', user.id)
        .eq('artist', artistName)

      if (!showsData || showsData.length === 0) {
        setLoading(false)
        return
      }

      const showIds = showsData.map(s => s.id)

      const { data: songsData } = await supabase
        .from('setlist_songs')
        .select('*')
        .in('show_id', showIds)
        .eq('song_name', songName)

      const showMap: Record<string, any> = {}
      for (const s of showsData) showMap[s.id] = s

      const enriched: Appearance[] = (songsData ?? [])
        .map(s => ({ ...s, show: showMap[s.show_id] }))
        .filter(s => s.show)
        .sort((a, b) => b.show.show_date.localeCompare(a.show.show_date))

      setAppearances(enriched)
      setLoading(false)
    }
    init()
  }, [artistName, songName])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading...</div>
      </div>
    )
  }

  const chronological = [...appearances].sort((a, b) =>
    a.show.show_date.localeCompare(b.show.show_date)
  )
  const firstAppearance = chronological[0]
  const lastAppearance = appearances[0] // already sorted desc

  const formatShortDate = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('default', {
      month: 'short', day: 'numeric', year: 'numeric'
    })

  // Position stats: how often opener, closer, encore
  const openerCount = appearances.filter(a => a.position === 1 && a.set_number !== 'Encore').length
  const encoreCount = appearances.filter(a => a.set_number === 'Encore').length

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 h-13 flex items-center justify-between">
        <div className="text-lg font-medium text-gray-900">
          show<span className="text-indigo-500">book</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/shows/add" className="text-sm text-gray-500 hover:text-gray-900">Search</Link>
          <Link href="/shows" className="text-sm text-gray-500 hover:text-gray-900">My shows</Link>
          <Link href="/friends" className="text-sm text-gray-500 hover:text-gray-900">Friends</Link>
          <Link href="/profile" className="text-sm text-gray-500 hover:text-gray-900">Profile</Link>
        </div>
        <div />
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-6">
        <Link
          href={`/artists/${encodeURIComponent(artistName)}`}
          className="text-sm text-indigo-500"
        >
          ‹ {artistName}
        </Link>

        <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 mb-4">
          <div className="text-xs font-medium text-indigo-500 uppercase tracking-wide mb-1">Song</div>
          <h1 className="text-2xl font-medium text-gray-900">{songName}</h1>
          <Link
            href={`/artists/${encodeURIComponent(artistName)}`}
            className="text-sm text-gray-500 hover:text-indigo-500 transition-colors mt-1 inline-block"
          >
            {artistName}
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Times heard</div>
            <div className="text-2xl font-medium text-gray-900">{appearances.length}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">First heard</div>
            <div className="text-sm font-medium text-gray-900">
              {firstAppearance ? formatShortDate(firstAppearance.show.show_date) : '—'}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Last heard</div>
            <div className="text-sm font-medium text-gray-900">
              {lastAppearance && appearances.length > 1
                ? formatShortDate(lastAppearance.show.show_date)
                : '—'}
            </div>
          </div>
        </div>

        {(openerCount > 0 || encoreCount > 0) && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {openerCount > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Set opener</div>
                <div className="text-2xl font-medium text-gray-900">{openerCount}×</div>
              </div>
            )}
            {encoreCount > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">In encore</div>
                <div className="text-2xl font-medium text-gray-900">{encoreCount}×</div>
              </div>
            )}
          </div>
        )}

        {appearances.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <div className="text-sm text-gray-400">This song doesn't appear in any of your logged shows</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Appearances
            </div>
            {appearances.map(a => {
              const date = new Date(a.show.show_date + 'T00:00:00')
              const month = date.toLocaleString('default', { month: 'short' })
              const day = date.getDate()
              const year = date.getFullYear()

              return (
                <Link key={a.id} href={`/shows/${a.show_id}`}>
                  <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-4 hover:border-gray-300 transition-colors cursor-pointer">
                    <div className="text-center min-w-10">
                      <div className="text-xs text-gray-500 uppercase">{month}</div>
                      <div className="text-xl font-medium text-gray-900 leading-tight">{day}</div>
                      <div className="text-xs text-gray-400">{year}</div>
                    </div>
                    <div className="w-px bg-gray-100 self-stretch" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{a.show.venue}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{a.show.city}</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                          {a.set_number}
                        </span>
                        <span className="text-xs text-gray-400">#{a.position} in set</span>
                        {a.segue && (
                          <span className="text-xs text-indigo-400">› segue</span>
                        )}
                      </div>
                    </div>
                    <div className="text-gray-400 text-lg">›</div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
