import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mbid = searchParams.get('mbid')
  const artist = searchParams.get('artist')
  const song = searchParams.get('song')
  const page = searchParams.get('page') ?? '1'

  if (!song || (!mbid && !artist)) {
    return NextResponse.json({ error: 'Song and either mbid or artist are required' }, { status: 400 })
  }

  // Prefer MBID over artist name — avoids tribute band results
  const artistParam = mbid
    ? `artistMbid=${encodeURIComponent(mbid)}`
    : `artistName=${encodeURIComponent(artist!)}`

  try {
    const url = `https://api.setlist.fm/rest/1.0/search/setlists?${artistParam}&songName=${encodeURIComponent(song)}&p=${page}`

    const res = await fetch(url, {
      headers: {
        'x-api-key': process.env.SETLISTFM_API_KEY!,
        'Accept': 'application/json',
      },
    })

    if (res.status === 404) {
      return NextResponse.json({ setlist: [], total: 0, itemsPerPage: 20 })
    }

    if (res.status === 429) {
      return NextResponse.json(
        { error: 'Too many requests — please wait a moment and try again' },
        { status: 429 }
      )
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: `Setlist.fm error: ${res.status}` },
        { status: res.status }
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to reach Setlist.fm' },
      { status: 500 }
    )
  }
}
