import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const artist = searchParams.get('artist')
  const date = searchParams.get('date')

  if (!artist || !date) {
    return NextResponse.json({ error: 'Artist and date are required' }, { status: 400 })
  }

  const apiKey = process.env.SETLISTFM_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not found' }, { status: 500 })
  }

  const [year, month, day] = date.split('-')
  const formattedDate = `${day}-${month}-${year}`
  const url = `https://api.setlist.fm/rest/1.0/search/setlists?artistName=${encodeURIComponent(artist)}&date=${formattedDate}`

  try {
    const res = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        'Accept': 'application/json'
      }
    })

    const text = await res.text()

    if (!res.ok) {
      return NextResponse.json({ 
        error: `Setlist.fm error: ${res.status} — ${text}` 
      }, { status: res.status })
    }

    const data = JSON.parse(text)
    return NextResponse.json(data)

  } catch (err: any) {
    return NextResponse.json({ 
      error: `Failed to reach Setlist.fm: ${err.message}` 
    }, { status: 500 })
  }
}