import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mbid = searchParams.get('mbid')
  const artist = searchParams.get('artist')
  const page = searchParams.get('page') ?? '1'

  if (!mbid && !artist) {
    return NextResponse.json({ error: 'mbid or artist is required' }, { status: 400 })
  }

  const apiKey = process.env.SETLISTFM_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not found' }, { status: 500 })
  }

  const url = mbid
    ? `https://api.setlist.fm/rest/1.0/artist/${mbid}/setlists?p=${page}`
    : `https://api.setlist.fm/rest/1.0/search/setlists?artistName=${encodeURIComponent(artist!)}&p=${page}`

  try {
    const res = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        'Accept': 'application/json'
      }
    })

    const text = await res.text()

    if (!res.ok) {
      const message = res.status === 429
        ? 'Setlist.fm rate limit reached — wait a moment and try again'
        : `Setlist.fm error: ${res.status}`
      return NextResponse.json({ error: message }, { status: res.status })
    }

    return NextResponse.json(JSON.parse(text))

  } catch (err: any) {
    return NextResponse.json({
      error: `Failed to reach Setlist.fm: ${err.message}`
    }, { status: 500 })
  }
}