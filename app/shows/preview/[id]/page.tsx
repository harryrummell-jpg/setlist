'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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

export default function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const router = useRouter()
  const [show, setShow] = useState<Show | null>(null)
  const [loggedLocalId, setLoggedLocalId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [logging, setLogging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const res = await fetch(`/api/setlistfm/setlist/${id}`)
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(false); return }
      setShow(data)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: existing } = await supabase
          .from('shows')
          .select('id')
          .eq('user_id', user.id)
          .eq('setlistfm_id', id)
          .maybeSingle()
        if (existing) setLoggedLocalId(existing.id)
      }

      setLoading(false)
    }
    init()
  }, [id])

  const logShow = async () => {
    if (!show) return
    setLogging(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [day, month, year] = show.eventDate.split('-')
    const city = formatCity(show.venue)

    const { data: savedShow, error: showError } = await supabase
      .from('shows')
      .insert({
        user_id: user.id,
        artist: show.artist?.name,
        venue: show.venue?.name ?? 'Unknown Venue',
        city,
        show_date: `${year}-${month}-${day}`,
        setlistfm_id: show.id,
      })
      .select()
      .single()

    if (showError || !savedShow) {
      setError('Failed to log show — ' + showError?.message)
      setLogging(false)
      return
    }

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

    router.push(`/shows/${savedShow.id}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading...</div>
      </div>
    )
  }

  if (error || !show) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm text-red-500 mb-3">{error ?? 'Show not found'}</div>
          <button onClick={() => router.back()} className="text-sm text-indigo-500 hover:underline">Go back</button>
        </div>
      </div>
    )
  }

  const [day, month, year] = show.eventDate.split('-')
  const date = new Date(`${year}-${month}-${day}T00:00:00`)
  const formattedDate = date.toLocaleDateString('default', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  const cityStr = formatCity(show.venue)
  const songs = show.sets?.set?.flatMap((set, setIndex) =>
    (set.song ?? []).map((song, i) => ({
      ...song,
      set_number: getSetLabel(set, setIndex, show.sets!.set.length),
      position: i + 1,
    }))
  ) ?? []

  const sets = songs.reduce((acc: Record<string, typeof songs>, song) => {
    if (!acc[song.set_number]) acc[song.set_number] = []
    acc[song.set_number].push(song)
    return acc
  }, {})

  const setOrder = Object.keys(sets).sort((a, b) => {
    if (a === 'Encore') return 1
    if (b === 'Encore') return -1
    return a.localeCompare(b)
  })

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
        <button onClick={() => router.back()} className="text-sm text-indigo-500">‹ Back</button>

        <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-indigo-500 uppercase tracking-wide mb-1">Preview</div>
            <h1 className="text-2xl font-medium text-gray-900">{show.artist?.name}</h1>
            <div className="text-sm text-gray-500 mt-1">{formattedDate}</div>
            <div className="text-sm text-gray-500">{show.venue?.name}{cityStr ? ` — ${cityStr}` : ''}</div>
          </div>
          <div className="flex-shrink-0">
            {loggedLocalId ? (
              <Link
                href={`/shows/${loggedLocalId}`}
                className="inline-block bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                View in history
              </Link>
            ) : (
              <button
                onClick={logShow}
                disabled={logging}
                className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {logging ? 'Logging...' : 'Log this show'}
              </button>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Setlist</div>
            {setOrder.length > 0 ? (
              setOrder.map(setName => (
                <div key={setName} className="mb-5">
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{setName}</div>
                  {sets[setName].map((song, i) => (
                    <div key={i} className="flex items-baseline gap-2 py-1 border-b border-gray-50 last:border-0">
                      <span className="text-xs text-gray-400 min-w-4">{song.position}</span>
                      <span className="text-sm text-gray-900">{song.name}</span>
                      {song.with && <span className="text-xs text-indigo-400">›</span>}
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-400">No setlist data available for this show</div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Show stats</div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total songs</span>
                  <span className="font-medium text-gray-900">{songs.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Sets</span>
                  <span className="font-medium text-gray-900">{setOrder.filter(s => s !== 'Encore').length}</span>
                </div>
                {setOrder.includes('Encore') && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Encore</span>
                    <span className="font-medium text-gray-900">
                      {sets['Encore'].length} song{sets['Encore'].length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Source</div>
              <div className="text-xs text-gray-400">Setlist data from Setlist.fm</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
