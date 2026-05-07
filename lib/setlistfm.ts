import axios from 'axios'

const BASE_URL = 'https://api.setlist.fm/rest/1.0'

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'x-api-key': process.env.SETLISTFM_API_KEY,
    'Accept': 'application/json'
  }
})

export async function searchShows(artistName: string, date: string) {
  const formattedDate = date.split('-').reverse().join('-')
  const response = await api.get('/search/setlists', {
    params: {
      artistName,
      date: formattedDate,
      p: 1
    }
  })
  return response.data
}

export async function getSetlist(setlistId: string) {
  const response = await api.get(`/setlist/${setlistId}`)
  return response.data
}

export async function searchArtist(artistName: string) {
  const response = await api.get('/search/artists', {
    params: {
      artistName,
      sort: 'relevance'
    }
  })
  return response.data
}

export async function getArtistSetlists(mbid: string, page: number = 1) {
  const response = await api.get(`/artist/${mbid}/setlists`, {
    params: { p: page }
  })
  return response.data
}