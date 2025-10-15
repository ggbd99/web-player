'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Play, Star, Clock, Bookmark, BookmarkCheck, ArrowLeft, TrendingUp, Film, Tv, Info, X } from 'lucide-react'

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
    
    // CRITICAL: Reset all state when switching to new media
    setSelectedMedia({ ...media, media_type: type })
    setCurrentSeason(season)
    setCurrentEpisode(episode)
    setSeasons([])
    setEpisodes([])
    setPlayerEvents([])
    setLastPlayerState(null)
    setPlayerKey(prev => prev + 1)
    
    // Load fresh data for new media
    if (type === 'tv') {
      loadMediaDetails(media).then(() => {
        loadSeasonEpisodes(media.id, season)
      })
    }
    
    setView('watch')
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

  function removeFromHistory(itemToRemove) {
    setWatchHistory(prev => prev.filter(item => {
      if (item.type === 'tv') {
        return !(item.id === itemToRemove.id && item.season === itemToRemove.season && item.episode === itemToRemove.episode)
      }
      return item.id !== itemToRemove.id
    }))
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) {
      return '00:00';
    }
    const date = new Date(seconds * 1000);
    const hh = date.getUTCHours();
    const mm = date.getUTCMinutes();
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    if (hh) {
      return `${hh}:${mm.toString().padStart(2, '0')}:${ss}`;
    }
    return `${mm}:${ss}`;
  }

  function formatRuntime(minutes) {
    if (isNaN(minutes) || minutes < 0) {
      return '';
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }

  function getPlayerUrl() {
    if (!selectedMedia) return ''
    const type = selectedMedia.media_type
    const id = selectedMedia.id

    if (type === 'tv') {
      return `https://www.vidking.net/embed/tv/${id}/${currentSeason}/${currentEpisode}`
    }
    return `https://www.vidking.net/embed/movie/${id}`
  }

  function MediaCard({ media, onClick }) {
    const isBookmarked = bookmarks.some(b => b.id === media.id)
    
    // Check if this media is in watch history
    const historyItem = watchHistory.find(item => {
      if (media.media_type === 'tv' || media.first_air_date) {
        return item.id === media.id && item.type === 'tv'
      }
      return item.id === media.id && item.type === 'movie'
    })
    
    const hasProgress = historyItem && historyItem.progress && historyItem.duration
    const progressPercent = hasProgress ? (historyItem.progress / historyItem.duration) * 100 : 0
    
    return (
      <Card className="group cursor-pointer hover:scale-105 transition-all duration-300 overflow-hidden border-0 bg-card/50 backdrop-blur">
        <div className="relative aspect-[2/3]" onClick={() => {
          // Resume from history if available
          if (historyItem) {
            onClick(media, historyItem.season || 1, historyItem.episode || 1)
          } else {
            onClick(media)
          }
        }}>
          {media.poster_path ? (
            <img
              src={`https://image.tmdb.org/t/p/w500${media.poster_path}`}
              alt={media.title || media.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Film className="w-12 h-12 text-primary/50" />
            </div>
          )}
          
          {/* Progress bar at bottom of poster if watched */}
          {hasProgress && (
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60">
              <div 
                className="h-full bg-gradient-to-r from-red-600 to-pink-600" 
                style={{ width: `${progressPercent}%` }} 
              />
            </div>
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <div className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 ml-1" fill="white" />
              </div>
              <p className="text-xs text-white/90 font-medium">
                {historyItem ? 'Resume' : 'Watch Now'}
              </p>
            </div>
          </div>
          
          <Button
            size="icon"
            variant="secondary"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/60 hover:bg-black/80 border-0 backdrop-blur"
            onClick={(e) => { e.stopPropagation(); toggleBookmark(media) }}
          >
            {isBookmarked ? <BookmarkCheck className="w-4 h-4 text-red-500" /> : <Bookmark className="w-4 h-4" />}
          </Button>
          
          {/* Resume badge if in watch history */}
          {historyItem && (
            <div className="absolute top-2 left-2 opacity-100">
              <Badge className="bg-gradient-to-r from-red-600 to-pink-600 text-white text-xs font-bold border-0 shadow-lg">
                Resume
              </Badge>
            </div>
          )}
          
          {/* Media type badge */}
          <div className={`absolute ${historyItem ? 'bottom-4' : 'bottom-2'} left-2 opacity-100`}>
            <Badge className="bg-blue-600 text-white text-xs">
              {media.media_type || (media.first_air_date ? 'TV' : 'Movie')}
            </Badge>
          </div>
        </div>
        <CardContent className="p-3 bg-gradient-to-b from-card to-card/80">
          <h3 className="font-semibold truncate text-sm mb-1">{media.title || media.name}</h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span className="text-xs font-medium text-yellow-400">{media.vote_average?.toFixed(1)}</span>
            </div>
            {media.release_date && (
              <span className="text-xs text-muted-foreground">{media.release_date.split('-')[0]}</span>
            )}
            {media.first_air_date && (
              <span className="text-xs text-muted-foreground">{media.first_air_date.split('-')[0]}</span>
            )}
          </div>
          {/* Show watch progress info */}
          {historyItem && hasProgress && (
            <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
              {historyItem.type === 'tv' && (
                <div className="font-medium text-red-400">
                  S{historyItem.season} E{historyItem.episode}
                </div>
              )}
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span className="font-medium">
                  {formatTime(historyItem.progress)} / {formatTime(historyItem.duration)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // WATCH VIEW - Player with episode controls
  if (view === 'watch' && selectedMedia) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-foreground">
        {/* Header with Back Button */}
        <header className="sticky top-0 z-50 bg-black/40 backdrop-blur-xl border-b border-white/10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setView('browse')}
                className="hover:bg-white/10 rounded-xl"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1">
                <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  {selectedMedia.title || selectedMedia.name}
                </h1>
                {selectedMedia.media_type === 'tv' && (
                  <p className="text-sm text-muted-foreground">
                    <span className="text-red-400 font-semibold">Season {currentSeason}</span>
                    {' · '}
                    <span className="text-pink-400 font-semibold">Episode {currentEpisode}</span>
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto hover:bg-white/10 rounded-xl"
                onClick={() => toggleBookmark(selectedMedia)}
              >
                {bookmarks.some(b => b.id === selectedMedia.id) ? (
                  <BookmarkCheck className="w-5 h-5 text-red-500" />
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
                        <div className="lg:col-span-2 space-y-4">
                          <div className="aspect-video bg-black rounded-lg overflow-hidden">
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
            
                          {/* Media Info Cards */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/20">
                              <CardContent className="p-4 text-center">
                                <Star className="w-6 h-6 fill-yellow-500 text-yellow-500 mx-auto mb-2" />
                                <p className="text-2xl font-bold">{selectedMedia.vote_average?.toFixed(1)}</p>
                                <p className="text-xs text-muted-foreground">Rating</p>
                              </CardContent>
                            </Card>
                            
                            {selectedMedia.media_type === 'movie' && selectedMedia.runtime && (
                              <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
                                <CardContent className="p-4 text-center">
                                  <Clock className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                                  <p className="text-2xl font-bold">{formatRuntime(selectedMedia.runtime)}</p>
                                  <p className="text-xs text-muted-foreground">Runtime</p>
                                </CardContent>
                              </Card>
                            )}
                            
                            {selectedMedia.media_type === 'tv' && selectedMedia.number_of_seasons && (
                              <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
                                <CardContent className="p-4 text-center">
                                  <Tv className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                                  <p className="text-2xl font-bold">{selectedMedia.number_of_seasons}</p>
                                  <p className="text-xs text-muted-foreground">Seasons</p>
                                </CardContent>
                              </Card>
                            )}
                            
                            {selectedMedia.media_type === 'tv' && selectedMedia.number_of_episodes && (
                              <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
                                <CardContent className="p-4 text-center">
                                  <Film className="w-6 h-6 text-green-400 mx-auto mb-2" />
                                  <p className="text-2xl font-bold">{selectedMedia.number_of_episodes}</p>
                                  <p className="text-xs text-muted-foreground">Episodes</p>
                                </CardContent>
                              </Card>
                            )}
                            
                            {(selectedMedia.release_date || selectedMedia.first_air_date) && (
                              <Card className="bg-gradient-to-br from-red-500/10 to-pink-500/10 border-red-500/20">
                                <CardContent className="p-4 text-center">
                                  <Clock className="w-6 h-6 text-red-400 mx-auto mb-2" />
                                  <p className="text-2xl font-bold">
                                    {selectedMedia.release_date?.split('-')[0] || selectedMedia.first_air_date?.split('-')[0]}
                                  </p>
                                  <p className="text-xs text-muted-foreground">Year</p>
                                </CardContent>
                              </Card>
                            )}
                          </div>

                          {/* Tagline */}
                          {selectedMedia.tagline && (
                            <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                              <CardContent className="p-4">
                                <p className="text-lg italic text-center font-medium">"{selectedMedia.tagline}"</p>
                              </CardContent>
                            </Card>
                          )}
            
                          {/* Media Description */}
                          <Card className="bg-white/5 backdrop-blur-xl border-white/10">
                            <CardContent className="p-6">
                              <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
                                <Info className="w-6 h-6 text-primary" />
                                Overview
                              </h3>
                              <p className="text-muted-foreground leading-relaxed">
                                {selectedMedia.overview || 'No description available for this title.'}
                              </p>
                              
                              {/* Genres */}
                              {selectedMedia.genres && selectedMedia.genres.length > 0 && (
                                <div className="mt-6">
                                  <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Genres</h4>
                                  <div className="flex flex-wrap gap-2">
                                    {selectedMedia.genres.map(genre => (
                                      <Badge key={genre.id} variant="secondary" className="px-3 py-1">
                                        {genre.name}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Additional Info */}
                              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/10">
                                {selectedMedia.status && (
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                                    <p className="font-semibold">{selectedMedia.status}</p>
                                  </div>
                                )}
                                {selectedMedia.original_language && (
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Original Language</p>
                                    <p className="font-semibold uppercase">{selectedMedia.original_language}</p>
                                  </div>
                                )}
                                {selectedMedia.production_companies && selectedMedia.production_companies.length > 0 && (
                                  <div className="md:col-span-2">
                                    <p className="text-xs text-muted-foreground mb-2">Production Companies</p>
                                    <div className="flex flex-wrap gap-2">
                                      {selectedMedia.production_companies.slice(0, 5).map(company => (
                                        <Badge key={company.id} variant="outline" className="text-xs">
                                          {company.name}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </div>

            {/* Right: Episode List (TV only) */}
            {selectedMedia.media_type === 'tv' && (
              <div className="lg:col-span-1">
                <Card className="bg-white/5 backdrop-blur-xl border-white/10">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Tv className="w-4 h-4" />
                      </div>
                      <h3 className="text-lg font-bold">Episodes</h3>
                    </div>
                    
                    <Select value={String(currentSeason)} onValueChange={(val) => changeSeason(Number(val))}>
                      <SelectTrigger className="mb-4 bg-white/5 border-white/10 rounded-xl h-11">
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

                    <ScrollArea className="h-[600px] pr-4">
                      <div className="space-y-3">
                        {episodes.map(episode => (
                          <Card 
                            key={episode.episode_number}
                            className={`cursor-pointer hover:scale-[1.02] transition-all duration-200 ${
                              episode.episode_number === currentEpisode 
                                ? 'ring-2 ring-red-500 bg-gradient-to-br from-red-500/20 to-pink-500/10' 
                                : 'bg-white/5 hover:bg-white/10'
                            } border-white/10 backdrop-blur`}
                            onClick={() => changeEpisode(currentSeason, episode.episode_number)}
                          >
                            <CardContent className="p-3">
                              <div className="flex gap-3">
                                <div className="w-28 aspect-video bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg overflow-hidden flex-shrink-0 relative">
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
                                  {episode.episode_number === currentEpisode && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                                      <Play className="w-6 h-6 text-red-500" fill="currentColor" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start gap-2 mb-1">
                                    <span className="font-bold text-sm text-red-400 mt-0.5">{episode.episode_number}.</span>
                                    <div className="flex-1">
                                      <h4 className="font-semibold text-sm line-clamp-1">{episode.name}</h4>
                                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{episode.overview || 'No description available'}</p>
                                    </div>
                                  </div>
                                  {episode.episode_number === currentEpisode && (
                                    <Badge className="mt-2 bg-gradient-to-r from-red-600 to-pink-600 border-0 text-xs">
                                      Now Playing
                                    </Badge>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/40 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-pink-600 flex items-center justify-center shadow-lg shadow-red-500/50">
                <Play className="w-5 h-5" fill="white" />
              </div>
              <h1 className="text-2xl font-black bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 bg-clip-text text-transparent">
                VidKing
              </h1>
            </div>
            <div className="flex-1 max-w-2xl">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  placeholder="Search for movies, TV shows, anime..."
                  className="pl-12 h-12 bg-white/5 border-white/10 rounded-xl focus:bg-white/10 focus:border-primary/50 transition-all"
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
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-8 bg-white/5 border border-white/10 p-1 h-auto backdrop-blur-xl">
            <TabsTrigger value="home" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600 data-[state=active]:to-pink-600 data-[state=active]:text-white px-6 py-2.5 rounded-lg font-semibold">
              Home
            </TabsTrigger>
            <TabsTrigger value="movies" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600 data-[state=active]:to-pink-600 data-[state=active]:text-white px-6 py-2.5 rounded-lg font-semibold">
              Movies
            </TabsTrigger>
            <TabsTrigger value="tv" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600 data-[state=active]:to-pink-600 data-[state=active]:text-white px-6 py-2.5 rounded-lg font-semibold">
              TV Shows
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600 data-[state=active]:to-pink-600 data-[state=active]:text-white px-6 py-2.5 rounded-lg font-semibold">
              Continue Watching
            </TabsTrigger>
            <TabsTrigger value="bookmarks" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600 data-[state=active]:to-pink-600 data-[state=active]:text-white px-6 py-2.5 rounded-lg font-semibold">
              My List
            </TabsTrigger>
          </TabsList>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <Search className="w-5 h-5" />
                </div>
                <h2 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  Search Results
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {searchResults.slice(0, 12).map(media => (
                  <MediaCard key={media.id} media={media} onClick={startWatching} />
                ))}
              </div>
            </div>
          )}

          {/* Home Tab */}
          <TabsContent value="home" className="space-y-12">
            {/* Trending */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-red-500/50">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h2 className="text-3xl font-black bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                  Trending This Week
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {trending.slice(0, 12).map(media => (
                  <MediaCard key={media.id} media={media} onClick={startWatching} />
                ))}
              </div>
            </section>

            {/* Popular Movies */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/50">
                  <Film className="w-5 h-5" />
                </div>
                <h2 className="text-3xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Popular Movies
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {popularMovies.slice(0, 12).map(media => (
                  <MediaCard key={media.id} media={{ ...media, media_type: 'movie' }} onClick={startWatching} />
                ))}
              </div>
            </section>

            {/* Popular TV */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/50">
                  <Tv className="w-5 h-5" />
                </div>
                <h2 className="text-3xl font-black bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                  Popular TV Shows
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
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
                  <Card key={idx} className="group relative overflow-hidden">
                    <div 
                      className="cursor-pointer"
                      onClick={() => startWatching({ id: item.id, title: item.title, name: item.title, media_type: item.type, poster_path: item.poster }, item.season || 1, item.episode || 1)}
                    >
                      <div className="relative aspect-[2/3]">
                        {item.poster ? (
                          <img src={`https://image.tmdb.org/t/p/w500${item.poster}`} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center"><Film className="w-12 h-12 text-muted-foreground" /></div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60">
                          <div className="h-full bg-gradient-to-r from-red-600 to-pink-600" style={{ width: `${(item.progress / item.duration) * 100}%` }} />
                        </div>
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="text-center">
                            <div className="w-14 h-14 mx-auto rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-xl mb-2">
                              <Play className="w-6 h-6 ml-1" fill="white" />
                            </div>
                            <p className="text-xs text-white font-medium">Resume</p>
                          </div>
                        </div>
                        {/* Resume badge */}
                        <div className="absolute top-2 left-2">
                          <Badge className="bg-gradient-to-r from-red-600 to-pink-600 text-white text-xs font-bold border-0 shadow-lg">
                            Resume
                          </Badge>
                        </div>
                      </div>
                      <CardContent className="p-3 bg-gradient-to-b from-card to-card/80">
                        <h3 className="font-semibold truncate text-sm mb-1">{item.title}</h3>
                        {/* Watch info with timestamp */}
                        <div className="space-y-1">
                          {item.type === 'tv' && (
                            <div className="text-xs font-medium text-red-400">
                              S{item.season} E{item.episode}
                            </div>
                          )}
                          {/* Watched time progress */}
                          {item.progress && item.duration ? (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span className="font-medium">
                                {formatTime(item.progress)} / {formatTime(item.duration)}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </CardContent>
                    </div>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute top-2 right-2 w-6 h-6 opacity-100 transition-all duration-300 bg-black/60 hover:bg-black/80 border-0 backdrop-blur z-10"
                      onClick={(e) => { e.stopPropagation(); removeFromHistory(item) }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
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
