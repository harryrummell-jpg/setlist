'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ShowsPage() {
  const router = useRouter()
  const [shows, setShows] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(profileData)

      const { data: showsData } = await supabase
        .from('shows')
        .select('*, setlist_songs(*)')
        .eq('user_id', user.id)
        .order('show_date', { ascending: false })

      setShows(showsData ?? [])
      setLoading(false)
    }

    init()
  }, [])

  const uniqueArtists = new Set(shows.map(s => s.artist)).size
  const thisYear = new Date().getFullYear()
  const showsThisYear = shows.filter(s => new Date(s.show_date).getFullYear() === thisYear).length
  const topArtist = shows.length > 0
    ? Object.entries(
        shows.reduce((acc: Record<string, number>, show) => {
          acc[show.artist] = (acc[show.artist] || 0) + 1
          return acc
        }, {})
      ).sort((a, b) => b[1] - a[1])[0][0]
    : '—'

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
          <Link href="/shows" className="text-sm text-indigo-500 font-medium border-b-2 border-indigo-500 pb-0.5">My shows</Link>
          <Link href="/friends" className="text-sm text-gray-500 hover:text-gray-900">Friends</Link>
          <Link href="/profile" className="text-sm text-gray-500 hover:text-gray-900">Profile</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/shows/add" className="bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
            + Log show
          </Link>
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-medium text-indigo-600">
            {profile?.display_name?.charAt(0).toUpperCase()}
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-medium text-gray-900">My shows</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your concert history</p>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total shows</div>
            <div className="text-2xl font-medium text-gray-900">{shows.length}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Artists</div>
            <div className="text-2xl font-medium text-gray-900">{uniqueArtists}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">This year</div>
            <div className="text-2xl font-medium text-gray-900">{showsThisYear}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Top artist</div>
            <div className="text-lg font-medium text-gray-900 truncate">{topArtist}</div>
          </div>
        </div>

        {shows.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Recent shows</div>
            {shows.map(show => {
              const date = new Date(show.show_date + 'T00:00:00')
              const month = date.toLocaleString('default', { month: 'short' })
              const day = date.getDate()
              const sets = [...new Set(show.setlist_songs?.map((s: any) => s.set_number))]

              return (
                <Link key={show.id} href={`/shows/${show.id}`}>
                  <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-4 hover:border-gray-300 transition-colors cursor-pointer">
                    <div className="text-center min-w-10">
                      <div className="text-xs text-gray-500 uppercase">{month}</div>
                      <div className="text-xl font-medium text-gray-900 leading-tight">{day}</div>
                    </div>
                    <div className="w-px bg-gray-100 self-stretch" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{show.artist}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{show.venue} — {show.city}</div>
                      {sets.length > 0 && (
                        <div className="flex gap-1.5 mt-1.5">
                          {sets.map(set => (
                            <span key={set} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{set}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-gray-400 text-lg">›</div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <div className="text-gray-400 text-sm mb-3">No shows logged yet</div>
            <Link href="/shows/add" className="bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors inline-block">
              Log your first show
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}