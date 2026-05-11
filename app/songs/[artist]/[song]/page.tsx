'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface SetlistShow {
  id: string
  eventDate: string
  venue?: {
    name: string
    city?: { name: string; stateCode?: string; country?: { code: string; name: string } }
  }
  sets?: {
    set: Array<{
      song?: Array<{ name: string; with?: { name: string } }>
      encore?: number
    }>
  }
}

interface SongPosition {
  setLabel: string
  position: number
  segue: boolean
}

function formatCity(venue: SetlistShow['venue']) {
  const city = venue?.city
  if (!city) return ''
  if (city.stateCode) return `${city.name}, ${city.stateCode}`
  if (city.country?.code) return `${city.name}, ${city.country.name}`
  return city.name
}

function parseSfmDate(eventDate: string): Date {
  const [day, month, year] = eventDate.split('-')
  return new Date(`${year}-${month}-${day}T00:00:00`)
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('default', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

function findSongPosition(show: SetlistShow, songName: string): SongPosition | null {
  if (!show.sets?.set) return null
  const sets = show.sets.set
  for (let i = 0; i < sets.length; i++) {
    const set = sets[i]
    const isEncore = i === sets.length - 1 && !!set.encore
    const setLabel = isEncore ? 'Encore' : `Set ${i + 1}`
    const songs = set.song ?? []
    for (let j = 0; j < songs.length; j++) {
      if (songs[j].name === songName) {
        return { setLabel, position: j + 1, segue: !!songs[j].with }
      }
    }
  }
  return null
}

export default function SongPage({ params }: { params: Promise<{ artist: string; song: string }> }) {
  const { artist, song } = React.use(params)
  const artistName = decodeURIComponent(artist)
  const songName = decodeURIComponent(song)
  const router = useRouter()

  // Global history from Setlist.fm
  const [performances, setPerformances] = useState<SetlistShow[]>([])
  const [nextStartPage, setNextStartPage] = useState(2)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [resolvedMbid, setResolvedMbid] = useState<string | null>(null)

  // User's personal data (accurate regardless of pagination)
  const [loggedShows, setLoggedShows] = useState<Record<string, string>>({}) // setlistfm_id → local show id
  const [timesHeard, setTimesHeard] = useState(0)
  const [firstHeard, setFirstHeard] = useState<string | null>(null)
  const [lastHeard, setLastHeard] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // 1. Get all of the user's shows for this artist that have a Setlist.fm ID
      const { data: userShowsData } = await supabase
        .from('shows')
        .select('id, setlistfm_id, show_date, artist_mbid')
        .eq('user_id', user.id)
        .eq('artist', artistName)
        .not('setlistfm_id', 'is', null)

      const idMap: Record<string, string> = {}
      let artistMbid: string | null = null

      if (userShowsData && userShowsData.length > 0) {
        for (const s of userShowsData) {
          if (s.setlistfm_id) idMap[s.setlistfm_id] = s.id
          if (s.artist_mbid && !artistMbid) artistMbid = s.artist_mbid
        }

        // 2. If no stored MBID (pre-migration shows), look it up from a setlist
        if (!artistMbid) {
          const showWithSfmId = userShowsData.find(s => s.setlistfm_id)
          if (showWithSfmId?.setlistfm_id) {
            try {
              const sfmRes = await fetch(`/api/setlistfm/setlist/${showWithSfmId.setlistfm_id}`)
              const sfmData = await sfmRes.json()
              artistMbid = sfmData?.artist?.mbid ?? null
            } catch {
              // If this fails, fall back to name-based search
            }
          }
        }

        // 3. Find which of those shows contain this song
        const showIds = userShowsData.map(s => s.id)
        const { data: songRows } = await supabase
          .from('setlist_songs')
          .select('show_id')
          .in('show_id', showIds)
          .eq('song_name', songName)

        if (songRows && songRows.length > 0) {
          setTimesHeard(songRows.length)
          const songShowIdSet = new Set(songRows.map(r => r.show_id))
          const datesWithSong = userShowsData
            .filter(s => songShowIdSet.has(s.id))
            .map(s => s.show_date)
            .sort()
          setFirstHeard(datesWithSong[0])
          setLastHeard(datesWithSong[datesWithSong.length - 1])
        }
      }

      setLoggedShows(idMap)
      setResolvedMbid(artistMbid)

      // 4. Fetch global performance history from Setlist.fm
      //    We use /artist/{mbid}/setlists and filter client-side because
      //    Setlist.fm's songName search parameter doesn't actually filter results.
      const historyParams = artistMbid
        ? `mbid=${encodeURIComponent(artistMbid)}`
        : `artist=${encodeURIComponent(artistName)}`

      try {
        const res = await fetch(
          `/api/setlistfm/song-history?${historyParams}&song=${encodeURIComponent(songName)}&startPage=1`
        )
        const data = await res.json()
        if (data.error) {
          setError(data.error)
        } else {
          setPerformances(data.setlist ?? [])
          setNextStartPage(data.nextStartPage ?? 2)
          setHasMore(data.hasMore ?? false)
          if (data.rateLimited) setRateLimited(true)
        }
      } catch {
        setError('Failed to load performance history from Setlist.fm')
      }

      setLoading(false)
    }
    init()
  }, [artistName, songName])

  const loadMore = async () => {
    setLoadingMore(true)
    const params = resolvedMbid
      ? `mbid=${encodeURIComponent(resolvedMbid)}`
      : `artist=${encodeURIComponent(artistName)}`
    try {
      const res = await fetch(
        `/api/setlistfm/song-history?${params}&song=${encodeURIComponent(songName)}&startPage=${nextStartPage}`
      )
      const data = await res.json()
      if (!data.error) {
        setPerformances(prev => [...prev, ...(data.setlist ?? [])])
        setNextStartPage(data.nextStartPage ?? nextStartPage)
        setHasMore(data.hasMore ?? false)
      }
    } catch {
      // silently fail on load more
    } finally {
      setLoadingMore(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading...</div>
      </div>
    )
  }

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

        {/* Header */}
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

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">You've heard it</div>
            <div className="text-2xl font-medium text-gray-900">{timesHeard}×</div>
            <div className="text-xs text-gray-400 mt-0.5">{timesHeard === 0 ? 'not in logged shows' : 'in your history'}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Performances found</div>
            <div className="text-2xl font-medium text-gray-900">{performances.length}</div>
            <div className="text-xs text-gray-400 mt-0.5">in recent shows</div>
          </div>
        </div>

        {timesHeard > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            {firstHeard && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">First heard</div>
                <div className="text-sm font-medium text-gray-900">{formatShortDate(firstHeard)}</div>
              </div>
            )}
            {lastHeard && lastHeard !== firstHeard && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Last heard</div>
                <div className="text-sm font-medium text-gray-900">{formatShortDate(lastHeard)}</div>
              </div>
            )}
          </div>
        )}

        {!timesHeard && <div className="mb-6" />}

        {/* Performance history */}
        {rateLimited && (
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-3">
            <span>⏱</span>
            <span>Setlist.fm is a bit slow right now — results may be incomplete. Try loading more in a moment.</span>
          </div>
        )}
        {error ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <div className="text-sm text-gray-500 mb-1">Couldn't load performance history right now</div>
            <div className="text-xs text-gray-400">Setlist.fm may be busy — try again in a moment. Your personal stats above are unaffected.</div>
          </div>
        ) : performances.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <div className="text-sm text-gray-400">No global performance history found on Setlist.fm</div>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2 mb-2">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Performance history
              </div>
              <div className="text-xs text-gray-400">most recent first</div>
            </div>

            <div className="flex flex-col gap-2">
              {performances.map(performance => {
                const localShowId = loggedShows[performance.id]
                const wasThere = !!localShowId
                const date = parseSfmDate(performance.eventDate)
                const month = date.toLocaleString('default', { month: 'short' })
                const day = date.getDate()
                const year = date.getFullYear()
                const city = formatCity(performance.venue)
                const pos = findSongPosition(performance, songName)

                const cardContent = (
                  <div
                    className={`rounded-xl px-4 py-3 flex items-center gap-4 transition-colors ${
                      wasThere
                        ? 'bg-indigo-50/70 border border-indigo-200 hover:border-indigo-300'
                        : 'bg-white border border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-center min-w-10 flex-shrink-0">
                      <div className="text-xs text-gray-500 uppercase">{month}</div>
                      <div className="text-xl font-medium text-gray-900 leading-tight">{day}</div>
                      <div className="text-xs text-gray-400">{year}</div>
                    </div>
                    <div className="w-px bg-gray-100 self-stretch" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {performance.venue?.name ?? 'Unknown venue'}
                        </div>
                        {wasThere && (
                          <span className="text-xs bg-indigo-500 text-white px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                            You were here
                          </span>
                        )}
                      </div>
                      {city && (
                        <div className="text-xs text-gray-500 mt-0.5">{city}</div>
                      )}
                      {pos && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            pos.setLabel === 'Encore'
                              ? 'bg-purple-50 text-purple-600'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {pos.setLabel}
                          </span>
                          <span className="text-xs text-gray-400">#{pos.position}</span>
                          {pos.segue && (
                            <span className="text-xs text-indigo-400">› segue</span>
                          )}
                        </div>
                      )}
                    </div>
                    {wasThere && (
                      <div className="text-gray-400 text-lg flex-shrink-0">›</div>
                    )}
                  </div>
                )

                return wasThere ? (
                  <Link key={performance.id} href={`/shows/${localShowId}`}>
                    {cardContent}
                  </Link>
                ) : (
                  <div key={performance.id}>{cardContent}</div>
                )
              })}
            </div>

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full mt-3 py-2.5 text-sm text-indigo-500 hover:text-indigo-600 disabled:opacity-50 border border-gray-200 rounded-xl bg-white hover:border-gray-300 transition-colors"
              >
                {loadingMore ? 'Searching more shows...' : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
