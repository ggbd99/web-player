import { NextResponse } from 'next/server'

// TMDB API Configuration
const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

// In-memory cache for TMDB responses
const cache = new Map()
const CACHE_TTL = 1000 * 60 * 15 // 15 minutes

// Helper function to handle CORS
function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

// Cache helper
function getCached(key) {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  return null
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() })
}

// TMDB API helper
async function fetchTMDB(endpoint) {
  const cacheKey = endpoint
  const cached = getCached(cacheKey)
  if (cached) return cached

  const url = `${TMDB_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${TMDB_API_KEY}`
  
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }
    const data = await response.json()
    setCache(cacheKey, data)
    return data
  } catch (error) {
    console.error('TMDB fetch error:', error)
    throw error
  }
}

// Route handler function
async function handleRoute(request, { params }) {
  const { path = [] } = params
  const route = `/${path.join('/')}`
  const method = request.method
  const { searchParams } = new URL(request.url)

  try {
    // Health check
    if (route === '/' && method === 'GET') {
      return handleCORS(NextResponse.json({ message: "VidKing Media API" }))
    }

    // TMDB Proxy Routes
    
    // Search multi (movies, TV shows, people)
    if (route === '/tmdb/search' && method === 'GET') {
      const query = searchParams.get('q')
      if (!query) {
        return handleCORS(NextResponse.json({ error: 'Query parameter required' }, { status: 400 }))
      }
      const data = await fetchTMDB(`/search/multi?query=${encodeURIComponent(query)}&include_adult=false`)
      return handleCORS(NextResponse.json(data))
    }

    // Get movie details
    if (route.startsWith('/tmdb/movie/') && method === 'GET') {
      const id = path[2]
      // Support custom append_to_response and include_image_language from query params
      const appendToResponse = searchParams.get('append_to_response') || 'credits,videos,similar'
      const includeImageLanguage = searchParams.get('include_image_language')
      
      let endpoint = `/movie/${id}?append_to_response=${appendToResponse}`
      if (includeImageLanguage) {
        endpoint += `&include_image_language=${includeImageLanguage}`
      }
      
      const data = await fetchTMDB(endpoint)
      return handleCORS(NextResponse.json(data))
    }

    // Get TV show details
    if (route.startsWith('/tmdb/tv/') && !route.includes('/season/') && method === 'GET') {
      const id = path[2]
      // Support custom append_to_response and include_image_language from query params
      const appendToResponse = searchParams.get('append_to_response') || 'credits,videos,similar'
      const includeImageLanguage = searchParams.get('include_image_language')
      
      let endpoint = `/tv/${id}?append_to_response=${appendToResponse}`
      if (includeImageLanguage) {
        endpoint += `&include_image_language=${includeImageLanguage}`
      }
      
      const data = await fetchTMDB(endpoint)
      return handleCORS(NextResponse.json(data))
    }

    // Get TV season details
    if (route.includes('/season/') && method === 'GET') {
      const tvId = path[2]
      const seasonNum = path[4]
      const data = await fetchTMDB(`/tv/${tvId}/season/${seasonNum}`)
      return handleCORS(NextResponse.json(data))
    }

    // Trending
    if (route === '/tmdb/trending' && method === 'GET') {
      const mediaType = searchParams.get('type') || 'all'
      const timeWindow = searchParams.get('time') || 'week'
      const data = await fetchTMDB(`/trending/${mediaType}/${timeWindow}`)
      return handleCORS(NextResponse.json(data))
    }

    // Popular movies
    if (route === '/tmdb/popular/movies' && method === 'GET') {
      const page = searchParams.get('page') || '1'
      const data = await fetchTMDB(`/movie/popular?page=${page}`)
      return handleCORS(NextResponse.json(data))
    }

    // Popular TV shows
    if (route === '/tmdb/popular/tv' && method === 'GET') {
      const page = searchParams.get('page') || '1'
      const data = await fetchTMDB(`/tv/popular?page=${page}`)
      return handleCORS(NextResponse.json(data))
    }

    // Top rated movies
    if (route === '/tmdb/top-rated/movies' && method === 'GET') {
      const page = searchParams.get('page') || '1'
      const data = await fetchTMDB(`/movie/top_rated?page=${page}`)
      return handleCORS(NextResponse.json(data))
    }

    // Top rated TV
    if (route === '/tmdb/top-rated/tv' && method === 'GET') {
      const page = searchParams.get('page') || '1'
      const data = await fetchTMDB(`/tv/top_rated?page=${page}`)
      return handleCORS(NextResponse.json(data))
    }

    // Now playing movies
    if (route === '/tmdb/now-playing' && method === 'GET') {
      const page = searchParams.get('page') || '1'
      const data = await fetchTMDB(`/movie/now_playing?page=${page}`)
      return handleCORS(NextResponse.json(data))
    }

    // Upcoming movies
    if (route === '/tmdb/upcoming' && method === 'GET') {
      const page = searchParams.get('page') || '1'
      const data = await fetchTMDB(`/movie/upcoming?page=${page}`)
      return handleCORS(NextResponse.json(data))
    }

    // Discover with filters
    if (route === '/tmdb/discover' && method === 'GET') {
      const type = searchParams.get('type') || 'movie'
      const genre = searchParams.get('genre') || ''
      const year = searchParams.get('year') || ''
      const sortBy = searchParams.get('sort_by') || 'popularity.desc'
      const page = searchParams.get('page') || '1'
      
      let endpoint = `/${type === 'tv' ? 'tv' : 'movie'}/popular?page=${page}&sort_by=${sortBy}`
      if (genre) endpoint += `&with_genres=${genre}`
      if (year) endpoint += `&primary_release_year=${year}`
      
      const data = await fetchTMDB(endpoint)
      return handleCORS(NextResponse.json(data))
    }

    // Route not found
    return handleCORS(NextResponse.json(
      { error: `Route ${route} not found` }, 
      { status: 404 }
    ))

  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(NextResponse.json(
      { error: error.message || "Internal server error" }, 
      { status: 500 }
    ))
  }
}

// Export all HTTP methods
export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute