import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const apiKey = process.env.SETLISTFM_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not found' }, { status: 500 })

  try {
    const res = await fetch(
      `https://api.setlist.fm/rest/1.0/setlist/${id}`,
      { headers: { 'x-api-key': apiKey, 'Accept': 'application/json' } }
    )
    if (res.status === 429) {
      return NextResponse.json(
        { error: 'Setlist.fm rate limit reached — wait a moment and try again' },
        { status: 429 }
      )
    }
    if (!res.ok) return NextResponse.json({ error: `Setlist.fm error: ${res.status}` }, { status: res.status })
    return NextResponse.json(await res.json())
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to reach Setlist.fm: ${err.message}` }, { status: 500 })
  }
}
