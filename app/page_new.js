'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Play, Star, Clock, Bookmark, BookmarkCheck, ArrowLeft, TrendingUp, Film, Tv, Info } from 'lucide-react'

export default function App() {
  const [view, setView] = useState('browse') // 'browse' or 'watch'
  const [activeTab, setActiveTab] = useState('home')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [trending, setTrending] = useState([])
  const [popularMovies, setPopularMovies] = useState([])
  const [popularTV, setPopularTV] = useState([])
  const [selectedMedia, setSelectedMedia] = useState(null)
  const [currentSeason, setCurrentSeason] = useState(1)
  const [currentEpisode, setCurrentEpisode] = useState(1)
  const [seasons, setSeasons] = useState([])
  const [episodes, setEpisodes] = useState([])
  const [playerEvents, setPlayerEvents] = useState([])
  const [watchHistory, setWatchHistory] = useState([])
  const [bookmarks, setBookmarks] = useState([])
  const [lastPlayerState, setLastPlayerState] = useState(null)
  const [playerKey, setPlayerKey] = useState(0)
  const iframeRef = useRef(null)

  // Load from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('watchHistory')
    const savedBookmarks = localStorage.getItem('bookmarks')
    if (savedHistory) setWatchHistory(JSON.parse(savedHistory))
    if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks))
  }, [])

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('watchHistory', JSON.stringify(watchHistory))
  }, [watchHistory])

  useEffect(() => {
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks))
  }, [bookmarks])

  // Player event listener - CRITICAL FOR SYNC
  useEffect(() => {
    function handlePlayerMessage(event) {
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'PLAYER_EVENT') {
          const eventData = message.data
          
          // Add to event log
          setPlayerEvents(prev => [{
            ...eventData,
            time: new Date().toLocaleTimeString()
          }, ...prev.slice(0, 9)])

          // Detect episode/season change from PLAYER
          if (lastPlayerState && selectedMedia?.media_type === 'tv') {
            const seasonChanged = eventData.season && eventData.season !== lastPlayerState.season
            const episodeChanged = eventData.episode && eventData.episode !== lastPlayerState.episode
            
            if (seasonChanged || episodeChanged) {
              console.log('🔄 Episode/Season changed in PLAYER!', {
                from: `S${lastPlayerState.season}E${lastPlayerState.episode}`,
                to: `S${eventData.season}E${eventData.episode}`
              })
              
              // Update app state to match player
              setCurrentSeason(eventData.season)
              setCurrentEpisode(eventData.episode)
              
              // Load new season episodes if season changed
              if (seasonChanged) {
                loadSeasonEpisodes(selectedMedia.id, eventData.season)
              }
            }
          }

          // Update last state
          setLastPlayerState(eventData)

          // Save to history on timeupdate (every 30s)
          if (eventData.event === 'timeupdate' && eventData.currentTime % 30 < 2) {
            saveToHistory(eventData)
          }

          // Save on pause/ended
          if (eventData.event === 'pause' || eventData.event === 'ended') {
            saveToHistory(eventData)
          }
        }
      } catch (e) {
        // Not a JSON message, ignore
      }
    }

    window.addEventListener('message', handlePlayerMessage)
    return () => window.removeEventListener('message', handlePlayerMessage)
  }, [lastPlayerState, selectedMedia])

  function saveToHistory(eventData) {
    if (!selectedMedia) return

    const historyItem = {
      id: selectedMedia.id,
      title: selectedMedia.title || selectedMedia.name,
      type: selectedMedia.media_type || (selectedMedia.first_air_date ? 'tv' : 'movie'),
      poster: selectedMedia.poster_path,
      season: eventData.season,
      episode: eventData.episode,
      progress: eventData.currentTime,
      duration: eventData.duration,
      updatedAt: Date.now()
    }

    setWatchHistory(prev => {
      const filtered = prev.filter(item => {
        if (item.type === 'tv') {
          return !(item.id === historyItem.id && item.season === historyItem.season && item.episode === historyItem.episode)
        }
        return item.id !== historyItem.id
      })
      return [historyItem, ...filtered].slice(0, 50)
    })
  }

  // Fetch trending on mount
  useEffect(() => {
    fetchTrending()
    fetchPopularMovies()
    fetchPopularTV()
  }, [])

  async function fetchTrending() {
    try {
      const res = await fetch('/api/tmdb/trending?type=all&time=week')
      const data = await res.json()
      setTrending(data.results || [])
    } catch (error) {
      console.error('Error fetching trending:', error)
    }
  }

  async function fetchPopularMovies() {
    try {
      const res = await fetch('/api/tmdb/popular/movies')
      const data = await res.json()
      setPopularMovies(data.results || [])
    } catch (error) {
      console.error('Error fetching popular movies:', error)
    }
  }

  async function fetchPopularTV() {
    try {
      const res = await fetch('/api/tmdb/popular/tv')
      const data = await res.json()
      setPopularTV(data.results || [])
    } catch (error) {
      console.error('Error fetching popular TV:', error)
    }
  }

  async function handleSearch(query) {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    
    try {
      const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setSearchResults(data.results || [])
    } catch (error) {
      console.error('Error searching:', error)
    }
  }

  async function loadMediaDetails(media) {
    const type = media.media_type || (media.first_air_date ? 'tv' : 'movie')
    
    try {
      const res = await fetch(`/api/tmdb/${type}/${media.id}`)
      const data = await res.json()
      setSelectedMedia({ ...data, media_type: type })
      
      if (type === 'tv' && data.seasons) {
        setSeasons(data.seasons.filter(s => s.season_number > 0))
        setCurrentSeason(1)
        setCurrentEpisode(1)
        loadSeasonEpisodes(media.id, 1)
      }
    } catch (error) {
      console.error('Error loading details:', error)
    }
  }

  async function loadSeasonEpisodes(tvId, seasonNum) {
    try {
      const res = await fetch(`/api/tmdb/tv/${tvId}/season/${seasonNum}`)
      const data = await res.json()
      setEpisodes(data.episodes || [])
    } catch (error) {
      console.error('Error loading episodes:', error)
    }
  }

  function startWatching(media, season = 1, episode = 1) {
    const type = media.media_type || (media.first_air_date ? 'tv' : 'movie')
    setSelectedMedia({ ...media, media_type: type })
    
    if (type === 'tv') {
      setCurrentSeason(season)
      setCurrentEpisode(episode)
      if (!episodes.length || season !== currentSeason) {
        loadSeasonEpisodes(media.id, season)
      }
      if (!seasons.length) {
        loadMediaDetails(media)
      }
    }
    
    setView('watch')
    setPlayerEvents([])
    setLastPlayerState(null)
    setPlayerKey(prev => prev + 1)
  }

  // Change episode from APP controls
  function changeEpisode(seasonNum, episodeNum) {
    setCurrentSeason(seasonNum)
    setCurrentEpisode(episodeNum)
    setPlayerKey(prev => prev + 1) // Force iframe reload
    setPlayerEvents([])
    setLastPlayerState(null)
    console.log('🎬 Episode changed from APP controls:', `S${seasonNum}E${episodeNum}`)
  }

  // Change season from APP controls
  function changeSeason(seasonNum) {
    setCurrentSeason(seasonNum)
    setCurrentEpisode(1)
    loadSeasonEpisodes(selectedMedia.id, seasonNum)
    setPlayerKey(prev => prev + 1)
    setPlayerEvents([])
    setLastPlayerState(null)
    console.log('🎬 Season changed from APP controls:', `S${seasonNum}`)
  }

  function toggleBookmark(media) {
    const isBookmarked = bookmarks.some(b => b.id === media.id)
    if (isBookmarked) {
      setBookmarks(prev => prev.filter(b => b.id !== media.id))
    } else {
      setBookmarks(prev => [{
        id: media.id,
        title: media.title || media.name,
        type: media.media_type || (media.first_air_date ? 'tv' : 'movie'),
        poster: media.poster_path
      }, ...prev])
    }
  }

  function getPlayerUrl() {
    if (!selectedMedia) return ''
    const type = selectedMedia.media_type
    const id = selectedMedia.id
    
    // Check for resume position
    const historyItem = watchHistory.find(h => {
      if (type === 'tv') {
        return h.id === id && h.season === currentSeason && h.episode === currentEpisode
      }
      return h.id === id
    })
    const progress = historyItem?.progress || 0

    if (type === 'tv') {
      return `https://www.vidking.net/embed/tv/${id}/${currentSeason}/${currentEpisode}?color=e50914&autoPlay=true&nextEpisode=true&episodeSelector=true&progress=${Math.floor(progress)}`
    }
    return `https://www.vidking.net/embed/movie/${id}?color=e50914&autoPlay=true&progress=${Math.floor(progress)}`
  }

  function MediaCard({ media, onClick }) {
    const isBookmarked = bookmarks.some(b => b.id === media.id)
    return (
      <Card className="group cursor-pointer hover:ring-2 hover:ring-primary transition-all overflow-hidden">
        <div className="relative aspect-[2/3]" onClick={() => onClick(media)}>
          {media.poster_path ? (
            <img
              src={`https://image.tmdb.org/t/p/w500${media.poster_path}`}
              alt={media.title || media.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <Film className="w-12 h-12 text-muted-foreground" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button size="icon" className="rounded-full">
              <Play className="w-6 h-6" />
            </Button>
          </div>
          <Button
            size="icon"
            variant="secondary"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); toggleBookmark(media) }}
          >
            {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          </Button>
        </div>
        <CardContent className="p-3">
          <h3 className="font-semibold truncate text-sm">{media.title || media.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
            <span className="text-xs text-muted-foreground">{media.vote_average?.toFixed(1)}</span>
            <Badge variant="secondary" className="text-xs ml-auto">
              {media.media_type || (media.first_air_date ? 'TV' : 'Movie')}
            </Badge>
          </div>
        </CardContent>
      </Card>
    )
  }

  // WATCH VIEW - Player with episode controls
  if (view === 'watch' && selectedMedia) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        {/* Header with Back Button */}
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setView('browse')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">{selectedMedia.title || selectedMedia.name}</h1>
                {selectedMedia.media_type === 'tv' && (
                  <p className="text-sm text-muted-foreground">Season {currentSeason} · Episode {currentEpisode}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                onClick={() => toggleBookmark(selectedMedia)}
              >
                {bookmarks.some(b => b.id === selectedMedia.id) ? (
                  <BookmarkCheck className="w-5 h-5" />
                ) : (
                  <Bookmark className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
        </header>

        {/* Player and Controls Layout */}
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Player */}
            <div className="lg:col-span-2">
              <div className="aspect-video bg-black rounded-lg overflow-hidden mb-4">
                <iframe
                  key={playerKey}
                  ref={iframeRef}
                  src={getPlayerUrl()}
                  className="w-full h-full"
                  frameBorder="0"
                  allowFullScreen
                  allow="autoplay; encrypted-media"
                />
              </div>

              {/* Player Events Debug */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    🎬 Player Events (Real-time Sync)
                    <Badge variant="outline">S{currentSeason}E{currentEpisode}</Badge>
                  </h3>
                  <ScrollArea className="h-24">
                    <div className="space-y-1 text-xs font-mono">
                      {playerEvents.length === 0 && (
                        <p className="text-muted-foreground">Waiting for player events...</p>
                      )}
                      {playerEvents.map((event, idx) => (
                        <div key={idx} className="p-2 bg-muted rounded">
                          <span className="text-muted-foreground">{event.time}</span>
                          {' '}
                          <span className="text-primary font-semibold">{event.event}</span>
                          {event.season && <span> | S{event.season}E{event.episode}</span>}
                          {event.currentTime && <span> | {Math.floor(event.currentTime)}s</span>}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Media Info */}
              <div className="mt-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
                    <span className="font-semibold">{selectedMedia.vote_average?.toFixed(1)}</span>
                  </div>
                  <Badge>{selectedMedia.media_type === 'tv' ? 'TV Series' : 'Movie'}</Badge>
                  {selectedMedia.release_date && (
                    <span className="text-sm text-muted-foreground">
                      {selectedMedia.release_date.split('-')[0]}
                    </span>
                  )}
                  {selectedMedia.first_air_date && (
                    <span className="text-sm text-muted-foreground">
                      {selectedMedia.first_air_date.split('-')[0]}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground">{selectedMedia.overview}</p>
                {selectedMedia.genres && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {selectedMedia.genres.map(genre => (
                      <Badge key={genre.id} variant="secondary">{genre.name}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Episode List (TV only) */}
            {selectedMedia.media_type === 'tv' && (
              <div className="lg:col-span-1">
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-lg font-bold mb-3">Episodes</h3>
                    
                    <Select value={String(currentSeason)} onValueChange={(val) => changeSeason(Number(val))}>
                      <SelectTrigger className="mb-4">
                        <SelectValue placeholder="Select season" />
                      </SelectTrigger>
                      <SelectContent>
                        {seasons.map(season => (
                          <SelectItem key={season.season_number} value={String(season.season_number)}>
                            Season {season.season_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <ScrollArea className="h-[600px]">
                      <div className="space-y-2">
                        {episodes.map(episode => (
                          <Card 
                            key={episode.episode_number}
                            className={`cursor-pointer hover:bg-accent transition-colors ${
                              episode.episode_number === currentEpisode ? 'ring-2 ring-primary' : ''
                            }`}
                            onClick={() => changeEpisode(currentSeason, episode.episode_number)}
                          >
                            <CardContent className="p-3">
                              <div className="flex gap-3">
                                <div className="w-24 aspect-video bg-muted rounded overflow-hidden flex-shrink-0">
                                  {episode.still_path ? (
                                    <img 
                                      src={`https://image.tmdb.org/t/p/w300${episode.still_path}`}
                                      alt={episode.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Tv className="w-6 h-6 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-sm">{episode.episode_number}.</span>
                                    <h4 className="font-semibold text-sm truncate">{episode.name}</h4>
                                  </div>
                                  <p className="text-xs text-muted-foreground line-clamp-2">{episode.overview}</p>
                                  {episode.episode_number === currentEpisode && (
                                    <Badge variant="default" className="mt-1 text-xs">Now Playing</Badge>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // BROWSE VIEW - Main app
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
              VidKing Stream
            </h1>
            <div className="flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search movies, TV shows, anime..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    handleSearch(e.target.value)
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="home">Home</TabsTrigger>
            <TabsTrigger value="movies">Movies</TabsTrigger>
            <TabsTrigger value="tv">TV Shows</TabsTrigger>
            <TabsTrigger value="history">Continue Watching</TabsTrigger>
            <TabsTrigger value="bookmarks">My List</TabsTrigger>
          </TabsList>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Search className="w-5 h-5" /> Search Results
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {searchResults.slice(0, 12).map(media => (
                  <MediaCard key={media.id} media={media} onClick={startWatching} />
                ))}
              </div>
            </div>
          )}

          {/* Home Tab */}
          <TabsContent value="home">
            {/* Trending */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-red-600" /> Trending This Week
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {trending.slice(0, 12).map(media => (
                  <MediaCard key={media.id} media={media} onClick={startWatching} />
                ))}
              </div>
            </section>

            {/* Popular Movies */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Film className="w-6 h-6" /> Popular Movies
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {popularMovies.slice(0, 12).map(media => (
                  <MediaCard key={media.id} media={{ ...media, media_type: 'movie' }} onClick={startWatching} />
                ))}
              </div>
            </section>

            {/* Popular TV */}
            <section>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Tv className="w-6 h-6" /> Popular TV Shows
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {popularTV.slice(0, 12).map(media => (
                  <MediaCard key={media.id} media={{ ...media, media_type: 'tv' }} onClick={startWatching} />
                ))}
              </div>
            </section>
          </TabsContent>

          {/* Movies Tab */}
          <TabsContent value="movies">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {popularMovies.map(media => (
                <MediaCard key={media.id} media={{ ...media, media_type: 'movie' }} onClick={startWatching} />
              ))}
            </div>
          </TabsContent>

          {/* TV Tab */}
          <TabsContent value="tv">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {popularTV.map(media => (
                <MediaCard key={media.id} media={{ ...media, media_type: 'tv' }} onClick={startWatching} />
              ))}
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            {watchHistory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No watch history yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {watchHistory.map((item, idx) => (
                  <Card key={idx} className="group cursor-pointer hover:ring-2 hover:ring-primary transition-all overflow-hidden"
                    onClick={() => startWatching({ id: item.id, title: item.title, name: item.title, media_type: item.type, poster_path: item.poster }, item.season || 1, item.episode || 1)}>
                    <div className="relative aspect-[2/3]">
                      {item.poster ? (
                        <img src={`https://image.tmdb.org/t/p/w500${item.poster}`} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center"><Film className="w-12 h-12 text-muted-foreground" /></div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
                        <div className="h-full bg-red-600" style={{ width: `${(item.progress / item.duration) * 100}%` }} />
                      </div>
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button size="icon" className="rounded-full"><Play className="w-6 h-6" /></Button>
                      </div>
                    </div>
                    <CardContent className="p-3">
                      <h3 className="font-semibold truncate text-sm">{item.title}</h3>
                      {item.type === 'tv' && (
                        <p className="text-xs text-muted-foreground">S{item.season} E{item.episode}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Bookmarks Tab */}
          <TabsContent value="bookmarks">
            {bookmarks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bookmark className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No bookmarks yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {bookmarks.map(item => (
                  <MediaCard key={item.id} media={item} onClick={startWatching} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
