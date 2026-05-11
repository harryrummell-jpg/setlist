'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ArtistPage({ params }: { params: Promise<{ artist: string }> }) {
  const { artist } = React.use(params)
  const artistName = decodeURIComponent(artist)
  const router = useRouter()

  const [shows, setShows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: showsData } = await supabase
        .from('shows')
        .select('*, setlist_songs(*)')
        .eq('user_id', user.id)
        .eq('artist', artistName)
        .order('show_date', { ascending: true })

      setShows(showsData ?? [])
      setLoading(false)
    }
    init()
  }, [artistName])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading...</div>
      </div>
    )
  }

  const allSongs: any[] = shows.flatMap(s => s.setlist_songs ?? [])
  const uniqueSongNames = new Set(allSongs.map((s: any) => s.song_name))
  const uniqueVenues = new Set(shows.map(s => s.venue))

  const songCounts: Record<string, number> = {}
  for (const song of allSongs) {
    songCounts[song.song_name] = (songCounts[song.song_name] || 0) + 1
  }
  const topSongs = Object.entries(songCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)

  const firstShow = shows[0]
  const lastShow = shows[shows.length - 1]
  const firstYear = firstShow ? new Date(firstShow.show_date + 'T00:00:00').getFullYear() : null
  const lastYear = lastShow ? new Date(lastShow.show_date + 'T00:00:00').getFullYear() : null
  const yearSpan = firstYear && lastYear && firstYear !== lastYear
    ? `${firstYear} – ${lastYear}`
    : firstYear
    ? String(firstYear)
    : ''

  const sortedShows = [...shows].sort((a, b) => b.show_date.localeCompare(a.show_date))

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
        <Link href="/shows" className="text-sm text-indigo-500">‹ My shows</Link>

        <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 mb-4">
          <div className="text-xs font-medium text-indigo-500 uppercase tracking-wide mb-1">Artist</div>
          <h1 className="text-2xl font-medium text-gray-900">{artistName}</h1>
          {yearSpan && <div className="text-sm text-gray-400 mt-1">{yearSpan}</div>}
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Shows seen</div>
            <div className="text-2xl font-medium text-gray-900">{shows.length}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Unique songs</div>
            <div className="text-2xl font-medium text-gray-900">{uniqueSongNames.size}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total songs</div>
            <div className="text-2xl font-medium text-gray-900">{allSongs.length}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Venues</div>
            <div className="text-2xl font-medium text-gray-900">{uniqueVenues.size}</div>
          </div>
        </div>

        {shows.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <div className="text-sm text-gray-400">No shows logged for this artist yet</div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {/* Shows list */}
            <div className="col-span-2 flex flex-col gap-2">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Shows</div>
              {sortedShows.map(show => {
                const date = new Date(show.show_date + 'T00:00:00')
                const month = date.toLocaleString('default', { month: 'short' })
                const day = date.getDate()
                const year = date.getFullYear()
                const songCount = (show.setlist_songs ?? []).length

                return (
                  <Link key={show.id} href={`/shows/${show.id}`}>
                    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-4 hover:border-gray-300 transition-colors cursor-pointer">
                      <div className="text-center min-w-10">
                        <div className="text-xs text-gray-500 uppercase">{month}</div>
                        <div className="text-xl font-medium text-gray-900 leading-tight">{day}</div>
                        <div className="text-xs text-gray-400">{year}</div>
                      </div>
                      <div className="w-px bg-gray-100 self-stretch" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{show.venue}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{show.city}</div>
                        {songCount > 0 && (
                          <div className="text-xs text-gray-400 mt-1">{songCount} songs</div>
                        )}
                      </div>
                      <div className="text-gray-400 text-lg">›</div>
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Top songs */}
            <div className="flex flex-col gap-2">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Top songs</div>
              {topSongs.length > 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-50">
                  {topSongs.map(([songName, count], i) => (
                    <Link
                      key={songName}
                      href={`/songs/${encodeURIComponent(artistName)}/${encodeURIComponent(songName)}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50/60 transition-colors first:rounded-t-xl last:rounded-b-xl"
                    >
                      <span className="text-xs text-gray-400 min-w-4 flex-shrink-0">{i + 1}</span>
                      <span className="flex-1 text-sm text-gray-900 truncate">{songName}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">×{count}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-sm text-gray-400">No setlist data</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
