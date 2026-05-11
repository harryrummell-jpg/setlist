import { NextResponse } from 'next/server'

// How many pages of an artist's setlists to scan per request.
// Each page is 20 shows, so 5 pages = 100 shows scanned per call.
const PAGES_PER_REQUEST = 5
const TARGET_RESULTS = 20

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mbid = searchParams.get('mbid')
  const artist = searchParams.get('artist') // name-based fallback
  const song = searchParams.get('song')
  const startPage = parseInt(searchParams.get('startPage') ?? '1')

  if (!song || (!mbid && !artist)) {
    return NextResponse.json(
      { error: 'Song and either mbid or artist are required' },
      { status: 400 }
    )
  }

  const songLower = song.toLowerCase()
  const matchingShows: any[] = []
  let currentPage = startPage
  let pagesScanned = 0
  let hasMorePages = true
  let totalArtistShows = 0

  try {
    while (
      matchingShows.length < TARGET_RESULTS &&
      pagesScanned < PAGES_PER_REQUEST &&
      hasMorePages
    ) {
      // Use MBID-based endpoint when available to avoid tribute band results
      const endpoint = mbid
        ? `https://api.setlist.fm/rest/1.0/artist/${encodeURIComponent(mbid)}/setlists?p=${currentPage}`
        : `https://api.setlist.fm/rest/1.0/search/setlists?artistName=${encodeURIComponent(artist!)}&p=${currentPage}`

      const res = await fetch(endpoint, {
        headers: {
          'x-api-key': process.env.SETLISTFM_API_KEY!,
          'Accept': 'application/json',
        },
      })

      if (res.status === 429) {
        // Return whatever we've collected so far rather than failing completely
        return NextResponse.json({
          setlist: matchingShows,
          nextStartPage: currentPage,
          hasMore: hasMorePages,
          totalArtistShows,
          rateLimited: true,
        })
      }

      if (res.status === 404) break
      if (!res.ok) break

      const data = await res.json()
      totalArtistShows = data.total ?? 0
      const itemsPerPage = data.itemsPerPage ?? 20
      const shows: any[] = data.setlist ?? []

      // Client-side exact match — this is why songName on the search endpoint
      // doesn't work: Setlist.fm silently ignores it. We filter ourselves.
      const filtered = shows.filter(show =>
        show.sets?.set?.some((set: any) =>
          set.song?.some((s: any) => s.name?.toLowerCase() === songLower)
        )
      )

      matchingShows.push(...filtered)
      hasMorePages = currentPage * itemsPerPage < totalArtistShows
      currentPage++
      pagesScanned++
    }

    return NextResponse.json({
      setlist: matchingShows,
      nextStartPage: currentPage,
      hasMore: hasMorePages,
      totalArtistShows,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to reach Setlist.fm' },
      { status: 500 }
    )
  }
}
