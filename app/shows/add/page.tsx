'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Artist {
  mbid: string
  name: string
  disambiguation?: string
}

interface Song {
  name: string
  with?: { name: string }
}

interface SetlistSet {
  song?: Song[]
  encore?: number
}

interface Show {
  id: string
  url?: string
  artist: { name: string }
  eventDate: string
  venue?: {
    name: string
    city?: {
      name: string
      stateCode?: string
      country?: { code: string; name: string }
    }
  }
  sets?: { set: SetlistSet[] }
}

function formatDate(eventDate: string) {
  const [day, month, year] = eventDate.split('-')
  return new Date(`${year}-${month}-${day}T00:00:00`).toLocaleDateString('default', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

function formatCity(venue: Show['venue']) {
  const city = venue?.city
  if (!city) return ''
  if (city.stateCode) return `${city.name}, ${city.stateCode}`
  if (city.country?.code) return `${city.name}, ${city.country.name}`
  return city.name
}

function getSetLabel(set: SetlistSet, index: number, total: number) {
  if (index === total - 1 && set.encore) return 'Encore'
  return `Set ${index + 1}`
}

function getSongCount(sets?: { set: SetlistSet[] }) {
  return sets?.set?.reduce((acc, s) => acc + (s.song?.length ?? 0), 0) ?? 0
}

export default function AddShowPage() {
  const router = useRouter()

  // Artist autocomplete
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Artist[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Show results
  const [results, setResults] = useState<Show[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  // setlistfm_id → local show id, for shows already in the user's history
  const [alreadyLogged, setAlreadyLogged] = useState<Record<string, string>>({})
  const [toAdd, setToAdd] = useState<Set<string>>(new Set())
  const [toRemove, setToRemove] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debounced artist suggestions with request cancellation
  useEffect(() => {
    if (!query.trim() || selectedArtist) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/setlistfm/artists?q=${encodeURIComponent(query)}`, {
          signal: controller.signal
        })
        const data = await res.json()
        setSuggestions(data.artists ?? [])
        setShowSuggestions(true)
      } catch {
        // Ignore aborted requests
      }
    }, 600)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, selectedArtist])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        !inputRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectArtist = (artist: Artist) => {
    setSelectedArtist(artist)
    setQuery(artist.name)
    setShowSuggestions(false)
    fetchPage(1, false, artist.mbid)
  }

  const clearArtist = () => {
    setSelectedArtist(null)
    setQuery('')
    setResults([])
    setToAdd(new Set())
    setToRemove(new Set())
    setExpanded(new Set())
    setError(null)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const fetchPage = async (pageNum: number, append: boolean, mbid: string) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/setlistfm/search?mbid=${encodeURIComponent(mbid)}&page=${pageNum}`)
      const data = await res.json()

      if (data.error) { setError(data.error); return }

      const shows: Show[] = data.setlist ?? []

      if (append) {
        setResults(prev => [...prev, ...shows])
      } else {
        setResults(shows)
        setToAdd(new Set())
        setToRemove(new Set())
        setExpanded(new Set())

        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: logged } = await supabase
            .from('shows')
            .select('id, setlistfm_id')
            .eq('user_id', user.id)
            .not('setlistfm_id', 'is', null)
          const map: Record<string, string> = {}
          for (const s of (logged ?? [])) map[s.setlistfm_id] = s.id
          setAlreadyLogged(map)
        }
      }

      const itemsPerPage = data.itemsPerPage ?? 20
      setHasMore(pageNum * itemsPerPage < (data.total ?? 0))
      setPage(pageNum)
    } catch {
      setError('Failed to load shows — please try again')
    } finally {
      if (append) setLoadingMore(false)
      else setLoading(false)
    }
  }

  const toggleShow = (id: string) => {
    if (alreadyLogged[id]) {
      // Already logged: toggle removal
      setToRemove(prev => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      })
    } else {
      // Not logged: toggle add
      setToAdd(prev => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      })
    }
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const saveChanges = async () => {
    if (!toAdd.size && !toRemove.size) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Remove unchecked shows
    for (const sfmId of toRemove) {
      const localId = alreadyLogged[sfmId]
      if (!localId) continue
      await supabase.from('setlist_songs').delete().eq('show_id', localId)
      await supabase.from('shows').delete().eq('id', localId)
    }

    // Add newly checked shows
    for (const show of results.filter(s => toAdd.has(s.id))) {
      const [day, month, year] = show.eventDate.split('-')

      const { data: savedShow, error: showError } = await supabase
        .from('shows')
        .insert({
          user_id: user.id,
          artist: show.artist?.name,
          venue: show.venue?.name ?? 'Unknown Venue',
          city: formatCity(show.venue),
          show_date: `${year}-${month}-${day}`,
          setlistfm_id: show.id,
        })
        .select()
        .single()

      if (showError || !savedShow) continue

      const songs: any[] = []
      show.sets?.set?.forEach((set, setIndex) => {
        const setName = getSetLabel(set, setIndex, show.sets!.set.length)
        set.song?.forEach((song, songIndex) => {
          songs.push({
            show_id: savedShow.id,
            song_name: song.name,
            set_number: setName,
            position: songIndex + 1,
            segue: song.with ? '>' : null,
          })
        })
      })

      if (songs.length > 0) await supabase.from('setlist_songs').insert(songs)
    }

    router.push('/shows')
  }

  const hasChanges = toAdd.size > 0 || toRemove.size > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 h-13 flex items-center justify-between">
        <div className="text-lg font-medium text-gray-900">
          show<span className="text-indigo-500">book</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/shows/add" className="text-sm text-indigo-500 font-medium border-b-2 border-indigo-500 pb-0.5">Search</Link>
          <Link href="/shows" className="text-sm text-gray-500 hover:text-gray-900">My shows</Link>
          <Link href="/friends" className="text-sm text-gray-500 hover:text-gray-900">Friends</Link>
          <Link href="/profile" className="text-sm text-gray-500 hover:text-gray-900">Profile</Link>
        </div>
        <div />
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-6 pb-28">
        <div className="mb-5">
          <Link href="/shows" className="text-sm text-indigo-500">‹ My shows</Link>
          <h1 className="text-xl font-medium text-gray-900 mt-2">Search shows</h1>
          <p className="text-sm text-gray-500 mt-0.5">Browse any artist's past shows. Check the ones you've attended to add them to your history.</p>
        </div>

        {/* Artist search */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 relative">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Artist</label>
          <div className="relative mt-1">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => {
                setQuery(e.target.value)
                if (selectedArtist) setSelectedArtist(null)
              }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Search for an artist..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-400 pr-8"
            />
            {query && (
              <button
                onClick={clearArtist}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ×
              </button>
            )}
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute left-4 right-4 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden"
            >
              {suggestions.slice(0, 8).map(artist => (
                <button
                  key={artist.mbid}
                  onClick={() => selectArtist(artist)}
                  className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors border-b border-gray-100 last:border-0"
                >
                  <div className="text-sm font-medium text-gray-900">{artist.name}</div>
                  {artist.disambiguation && (
                    <div className="text-xs text-gray-400">{artist.disambiguation}</div>
                  )}
                </button>
              ))}
            </div>
          )}

          {selectedArtist && (
            <div className="mt-2 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              <span className="text-xs text-gray-500">
                Showing all shows for <span className="text-gray-900 font-medium">{selectedArtist.name}</span>
              </span>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

        {loading && (
          <div className="text-sm text-gray-400 text-center py-8">Loading shows...</div>
        )}

        {!loading && results.length > 0 && (
          <>
            <div className="mb-2">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {results.length} show{results.length !== 1 ? 's' : ''} loaded
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {results.map(show => {
                const loggedId = alreadyLogged[show.id]
                const isLogged = !!loggedId
                const markedForRemoval = toRemove.has(show.id)
                const markedToAdd = toAdd.has(show.id)
                const isChecked = (isLogged && !markedForRemoval) || markedToAdd
                const isExpanded = expanded.has(show.id)
                const songCount = getSongCount(show.sets)
                const setCount = show.sets?.set?.filter(s => !s.encore).length ?? 0
                const hasEncore = show.sets?.set?.some(s => s.encore)
                const cityStr = formatCity(show.venue)

                let cardClass = 'bg-white border border-gray-200'
                if (markedForRemoval) cardClass = 'bg-red-50/40 border border-red-200'
                else if (markedToAdd) cardClass = 'bg-indigo-50/40 border border-indigo-300'
                else if (isLogged) cardClass = 'bg-white border border-gray-200'

                return (
                  <div key={show.id} className={`rounded-xl transition-colors ${cardClass}`}>
                    <div
                      className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                      onClick={() => toggleShow(show.id)}
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleShow(show.id)}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 accent-indigo-500 cursor-pointer"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-gray-900">{formatDate(show.eventDate)}</span>
                          {markedForRemoval && (
                            <span className="text-xs text-red-400">Will be removed</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 truncate">
                          {show.venue?.name}{cityStr ? ` — ${cityStr}` : ''}
                        </div>
                        {songCount > 0 && (
                          <div className="text-xs text-gray-400 mt-1">
                            {songCount} songs · {setCount} set{setCount !== 1 ? 's' : ''}{hasEncore ? ' + encore' : ''}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        {isLogged && !markedForRemoval ? (
                          <Link
                            href={`/shows/${loggedId}`}
                            onClick={e => e.stopPropagation()}
                            className="text-xs font-medium text-indigo-500 hover:text-indigo-700 border border-indigo-200 rounded-md px-2 py-1 hover:border-indigo-400 transition-colors"
                          >
                            View
                          </Link>
                        ) : !markedForRemoval ? (
                          <Link
                            href={`/shows/preview/${show.id}`}
                            onClick={e => e.stopPropagation()}
                            className="text-xs font-medium text-gray-400 hover:text-gray-600 border border-gray-200 rounded-md px-2 py-1 hover:border-gray-300 transition-colors"
                          >
                            Preview
                          </Link>
                        ) : null}
                        {songCount > 0 && (
                          <button
                            onClick={e => { e.stopPropagation(); toggleExpand(show.id) }}
                            className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0"
                          >
                            {isExpanded ? 'Hide' : 'Setlist'}
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && show.sets?.set && (
                      <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                        {show.sets.set.map((set, setIndex) => (
                          <div key={setIndex} className="mb-3 last:mb-0">
                            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                              {getSetLabel(set, setIndex, show.sets!.set.length)}
                            </div>
                            <div className="text-xs text-gray-600 leading-relaxed">
                              {set.song?.map((song, i) => (
                                <span key={i}>
                                  {song.name}{i < (set.song?.length ?? 1) - 1 ? ', ' : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {hasMore && (
              <button
                onClick={() => fetchPage(page + 1, true, selectedArtist!.mbid)}
                disabled={loadingMore}
                className="w-full mt-3 py-2.5 text-sm text-indigo-500 hover:text-indigo-600 disabled:opacity-50 border border-gray-200 rounded-xl bg-white hover:border-gray-300 transition-colors"
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>

      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="text-sm text-gray-600 flex gap-3">
              {toAdd.size > 0 && (
                <span className="text-indigo-600">+{toAdd.size} to add</span>
              )}
              {toRemove.size > 0 && (
                <span className="text-red-500">−{toRemove.size} to remove</span>
              )}
            </div>
            <button
              onClick={saveChanges}
              disabled={saving}
              className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
