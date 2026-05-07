'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ShowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
    const router = useRouter()
  const [show, setShow] = useState<any>(null)
  const [songs, setSongs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) { 
        router.push('/login')
        return 
      }

      const { data: showData, error } = await supabase
        .from('shows')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !showData) { 
        console.log('Show fetch error:', error)
        console.log('Show ID:', id)
        router.push('/shows')
        return 
      }
      
      setShow(showData)

      const { data: songsData } = await supabase
        .from('setlist_songs')
        .select('*')
        .eq('show_id', id)
        .order('position', { ascending: true })

      setSongs(songsData ?? [])
      setLoading(false)
    }

    init()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading...</div>
      </div>
    )
  }

  const date = new Date(show.show_date + 'T00:00:00')
  const formattedDate = date.toLocaleDateString('default', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const sets = songs.reduce((acc: Record<string, any[]>, song) => {
    if (!acc[song.set_number]) acc[song.set_number] = []
    acc[song.set_number].push(song)
    return acc
  }, {})

  const setOrder = Object.keys(sets).sort((a, b) => {
    if (a === 'Encore') return 1
    if (b === 'Encore') return -1
    return a.localeCompare(b)
  })

  const setlistfmUrl = show.setlistfm_id
    ? 'https://www.setlist.fm/setlist/' + show.setlistfm_id
    : null

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

      <div className="max-w-3xl mx-auto px-6 py-6">
        <Link href="/shows" className="text-sm text-indigo-500">My shows</Link>

        <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4 mb-4">
          <h1 className="text-2xl font-medium text-gray-900">{show.artist}</h1>
          <div className="text-sm text-gray-500 mt-1">{formattedDate}</div>
          <div className="text-sm text-gray-500">{show.venue} — {show.city}</div>
          {show.notes && (
            <div className="mt-3 bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600 italic">
              {show.notes}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Setlist</div>
            {setOrder.length > 0 ? (
              setOrder.map(setName => (
                <div key={setName} className="mb-5">
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{setName}</div>
                  {sets[setName].map((song, i) => (
                    <div key={song.id} className="flex items-baseline gap-2 py-1 border-b border-gray-50 last:border-0">
                      <span className="text-xs text-gray-400 min-w-4">{i + 1}</span>
                      <Link
                        href={"/songs/" + encodeURIComponent(show.artist) + "/" + encodeURIComponent(song.song_name)}
                        className="text-sm text-gray-900 hover:text-indigo-500 transition-colors"
                      >
                        {song.song_name}
                      </Link>
                      {song.segue && <span className="text-xs text-indigo-400">›</span>}
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-400">No setlist available for this show</div>
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
                    <span className="font-medium text-gray-900">{sets['Encore'].length} song{sets['Encore'].length > 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Source</div>
              <div className="text-xs text-gray-400">
                Setlist data from Setlist.fm
                <div className="text-xs text-gray-400">
                Setlist data from Setlist.fm
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}