'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AddShowPage() {
  const router = useRouter()
  const [artist, setArtist] = useState('')
  const [date, setDate] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedShow, setSelectedShow] = useState<any>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchShows = async () => {
    if (!artist || !date) return
    setLoading(true)
    setError(null)
    setSearchResults([])
    setSelectedShow(null)

    try {
      const res = await fetch(`/api/setlistfm/search?artist=${encodeURIComponent(artist)}&date=${date}`)
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else if (!data.setlist || data.setlist.length === 0) {
        setError('No shows found for that artist and date. Try adjusting your search.')
      } else {
        setSearchResults(data.setlist)
      }
    } catch (err) {
      setError('Failed to search — please try again')
    }

    setLoading(false)
  }

  const saveShow = async () => {
    if (!selectedShow) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const venue = selectedShow.venue?.name ?? 'Unknown Venue'
    const city = [selectedShow.venue?.city?.name, selectedShow.venue?.city?.country?.code]
      .filter(Boolean).join(', ')

    const { data: show, error: showError } = await supabase
      .from('shows')
      .insert({
        user_id: user.id,
        artist: selectedShow.artist?.name,
        venue,
        city,
        show_date: selectedShow.eventDate.split('-').reverse().join('-'),
        setlistfm_id: selectedShow.id,
        notes
      })
      .select()
      .single()

    if (showError || !show) {
      setError('Failed to save show: ' + showError?.message)
      setSaving(false)
      return
    }

    // Save songs
    const songs: any[] = []
    selectedShow.sets?.set?.forEach((set: any, setIndex: number) => {
      const setName = setIndex === (selectedShow.sets.set.length - 1) && set.encore
        ? 'Encore'
        : `Set ${setIndex + 1}`
      set.song?.forEach((song: any, songIndex: number) => {
        songs.push({
          show_id: show.id,
          song_name: song.name,
          set_number: setName,
          position: songIndex + 1,
          segue: song.with ? '>' : null
        })
      })
    })

    if (songs.length > 0) {
      await supabase.from('setlist_songs').insert(songs)
    }

    router.push('/shows')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 h-13 flex items-center justify-between">
        <div className="text-lg font-medium text-gray-900">
          show<span className="text-indigo-500">book</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/shows" className="text-sm text-gray-500 hover:text-gray-900">My shows</Link>
          <Link href="/friends" className="text-sm text-gray-500 hover:text-gray-900">Friends</Link>
          <Link href="/profile" className="text-sm text-gray-500 hover:text-gray-900">Profile</Link>
        </div>
        <div />
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-6">
        <div className="mb-5">
          <Link href="/shows" className="text-sm text-indigo-500">‹ My shows</Link>
          <h1 className="text-xl font-medium text-gray-900 mt-2">Log a show</h1>
          <p className="text-sm text-gray-500 mt-0.5">Search for a show and we'll pull the setlist automatically</p>
        </div>

        {/* Search */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Artist</label>
              <input
                type="text"
                value={artist}
                onChange={e => setArtist(e.target.value)}
                placeholder="e.g. Phish"
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-400"
              />
            </div>
            <button
              onClick={searchShows}
              disabled={loading || !artist || !date}
              className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {loading ? 'Searching...' : 'Search Setlist.fm'}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

        {/* Results */}
        {searchResults.length > 0 && !selectedShow && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Select your show</div>
            <div className="flex flex-col gap-2">
              {searchResults.map((show: any) => (
                <div
                  key={show.id}
                  onClick={() => setSelectedShow(show)}
                  className="border border-gray-200 rounded-lg px-4 py-3 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                >
                  <div className="text-sm font-medium text-gray-900">{show.artist?.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {show.venue?.name} — {show.venue?.city?.name}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{show.eventDate}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected show */}
        {selectedShow && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-sm font-medium text-gray-900">{selectedShow.artist?.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {selectedShow.venue?.name} — {selectedShow.venue?.city?.name}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{selectedShow.eventDate}</div>
              </div>
              <button
                onClick={() => setSelectedShow(null)}
                className="text-xs text-indigo-500 hover:underline"
              >
                Change
              </button>
            </div>

            {/* Setlist preview */}
            {selectedShow.sets?.set?.length > 0 ? (
              <div className="mb-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Setlist</div>
                {selectedShow.sets.set.map((set: any, setIndex: number) => {
                  const setName = setIndex === (selectedShow.sets.set.length - 1) && set.encore
                    ? 'Encore'
                    : `Set ${setIndex + 1}`
                  return (
                    <div key={setIndex} className="mb-3">
                      <div className="text-xs font-medium text-gray-400 mb-1">{setName}</div>
                      {set.song?.map((song: any, i: number) => (
                        <div key={i} className="text-sm text-gray-700 py-0.5">
                          {song.name}{song.with ? ' ›' : ''}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-xs text-gray-400 mb-4">No setlist available for this show yet</div>
            )}

            {/* Notes */}
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any memories or highlights from the show..."
                rows={3}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-400 resize-none"
              />
            </div>

            <button
              onClick={saveShow}
              disabled={saving}
              className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save show'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}