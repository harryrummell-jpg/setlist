import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  if (!q) return NextResponse.json({ artists: [] })

  const apiKey = process.env.SETLISTFM_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not found' }, { status: 500 })

  try {
    const res = await fetch(
      `https://api.setlist.fm/rest/1.0/search/artists?artistName=${encodeURIComponent(q)}&sort=relevance`,
      { headers: { 'x-api-key': apiKey, 'Accept': 'application/json' } }
    )
    if (!res.ok) return NextResponse.json({ artists: [] })
    const data = await res.json()
    return NextResponse.json({ artists: data.artist ?? [] })
  } catch {
    return NextResponse.json({ artists: [] })
  }
}
