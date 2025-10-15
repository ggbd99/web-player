'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Play, Star, Clock, Bookmark, BookmarkCheck, ArrowLeft, Film, Tv, Info, ChevronLeft, ChevronRight } from 'lucide-react'

export default function App() {
  const [view, setView] = useState('browse')
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
  const [heroIndex, setHeroIndex] = useState(0)
  const [heroDetails, setHeroDetails] = useState([])
  const iframeRef = useRef(null)

  // --- START: MODIFIED HERO SLIDER LOGIC ---
  const [heroTransition, setHeroTransition] = useState(true)
  const HERO_SLIDE_COUNT = 5

  // Auto-rotate hero
  useEffect(() => {
    if (trending.length <= HERO_SLIDE_COUNT) return;

    const interval = setInterval(() => {
      setHeroIndex(prevIndex => prevIndex + 1);
    }, 7000);

    return () => clearInterval(interval);
  }, [trending.length]);

  // Handle the infinite loop transition
  useEffect(() => {
    if (heroIndex === HERO_SLIDE_COUNT) {
      const timer = setTimeout(() => {
        setHeroTransition(false);
        setHeroIndex(0);
      }, 700);
      return () => clearTimeout(timer);
    }

    if (heroIndex === 0 && !heroTransition) {
      const timer = setTimeout(() => {
        setHeroTransition(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [heroIndex, heroTransition]);
  // --- END: MODIFIED HERO SLIDER LOGIC ---

  // Player event listener
  useEffect(() => {
    function handlePlayerMessage(event) {
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'PLAYER_EVENT') {
          const eventData = message.data
          
          setPlayerEvents(prev => [{
            ...eventData,
            time: new Date().toLocaleTimeString()
          }, ...prev.slice(0, 9)])

          if (lastPlayerState && selectedMedia?.media_type === 'tv') {
            const seasonChanged = eventData.season && eventData.season !== lastPlayerState.season
            const episodeChanged = eventData.episode && eventData.episode !== lastPlayerState.episode
            
            if (seasonChanged || episodeChanged) {
              setCurrentSeason(eventData.season)
              setCurrentEpisode(eventData.episode)
              
              if (seasonChanged) {
                loadSeasonEpisodes(selectedMedia.id, eventData.season)
              }
            }
          }

          setLastPlayerState(eventData)

          if (eventData.event === 'timeupdate' && eventData.currentTime % 30 < 2) {
            saveToHistory(eventData)
          }

          if (eventData.event === 'pause' || eventData.event === 'ended') {
            saveToHistory(eventData)
          }
        }
      } catch (e) {
        // Not a JSON message
      }
    }

    window.addEventListener('message', handlePlayerMessage)
    return () => window.removeEventListener('message', handlePlayerMessage)
  }, [selectedMedia, lastPlayerState, watchHistory])

  function saveToHistory(eventData) {
    if (!selectedMedia) return

    const historyItem = {
      id: selectedMedia.id,
      title: selectedMedia.title || selectedMedia.name,
      poster: selectedMedia.poster_path,
      backdrop: selectedMedia.backdrop_path,
      media_type: selectedMedia.media_type,
      progress: eventData.currentTime || 0,
      duration: eventData.duration || 0,
      timestamp: Date.now(),
      season: eventData.season || currentSeason,
      episode: eventData.episode || currentEpisode,
      vote_average: selectedMedia.vote_average,
      release_date: selectedMedia.release_date || selectedMedia.first_air_date
    }

    setWatchHistory(prev => {
      const filtered = prev.filter(item => {
        if (item.media_type === 'tv') {
          return !(item.id === historyItem.id && 
                   item.season === historyItem.season && 
                   item.episode === historyItem.episode)
        }
        return item.id !== historyItem.id
      })
      return [historyItem, ...filtered].slice(0, 50)
    })
  }

  // Fetch data
  useEffect(() => {
    if (activeTab === 'home' && trending.length === 0) {
      fetch('/api/tmdb/trending?type=all&time=week')
        .then(res => res.json())
        .then(data => {
          const results = data.results || []
          setTrending(results)
          
          const heroPromises = results.slice(0, 5).map(item => 
            fetch(`/api/tmdb/${item.media_type}/${item.id}?append_to_response=images&include_image_language=en,null`)
              .then(res => res.json())
              .catch(() => item)
          )
          
          Promise.all(heroPromises).then(detailedItems => {
            setHeroDetails(detailedItems)
          })
        })
      
      fetch('/api/tmdb/popular/movies')
        .then(res => res.json())
        .then(data => setPopularMovies(data.results || []))
      
      fetch('/api/tmdb/popular/tv')
        .then(res => res.json())
        .then(data => setPopularTV(data.results || []))
    } else if (activeTab === 'movies' && popularMovies.length === 0) {
      fetch('/api/tmdb/popular/movies')
        .then(res => res.json())
        .then(data => setPopularMovies(data.results || []))
    } else if (activeTab === 'tv' && popularTV.length === 0) {
      fetch('/api/tmdb/popular/tv')
        .then(res => res.json())
        .then(data => setPopularTV(data.results || []))
    }
  }, [activeTab, trending.length, popularMovies.length, popularTV.length])

  async function handleSearch(query) {
    if (query.trim().length < 2) {
      setSearchResults([])
      return
    }
    
    const res = await fetch(`/api/tmdb/search?query=${encodeURIComponent(query)}`)
    const data = await res.json()
    setSearchResults(data.results || [])
  }

  async function startWatching(media) {
    const type = media.media_type || (media.first_air_date ? 'tv' : 'movie')
    const res = await fetch(`/api/tmdb/${type}/${media.id}?append_to_response=credits,similar,images&include_image_language=en,null`)
    const fullDetails = await res.json()
    
    fullDetails.media_type = type
    setSelectedMedia(fullDetails)
    
    if (type === 'tv') {
      setSeasons(fullDetails.seasons || [])
      
      const historyItem = watchHistory.find(h => h.id === media.id && h.media_type === 'tv')
      if (historyItem) {
        setCurrentSeason(historyItem.season)
        setCurrentEpisode(historyItem.episode)
        await loadSeasonEpisodes(media.id, historyItem.season)
      } else {
        setCurrentSeason(1)
        setCurrentEpisode(1)
        await loadSeasonEpisodes(media.id, 1)
      }
    }
    
    setView('watch')
    setPlayerKey(prev => prev + 1)
  }

  async function loadSeasonEpisodes(tvId, seasonNumber) {
    const res = await fetch(`/api/tmdb/tv/${tvId}/season/${seasonNumber}`)
    const data = await res.json()
    setEpisodes(data.episodes || [])
  }

  async function changeSeason(seasonNumber) {
    setCurrentSeason(seasonNumber)
    setCurrentEpisode(1)
    await loadSeasonEpisodes(selectedMedia.id, seasonNumber)
    setPlayerKey(prev => prev + 1)
  }

  function changeEpisode(episodeNumber) {
    setCurrentEpisode(episodeNumber)
    setPlayerKey(prev => prev + 1)
  }

  function toggleBookmark(media) {
    const isBookmarked = bookmarks.some(b => b.id === media.id)
    if (isBookmarked) {
      setBookmarks(bookmarks.filter(b => b.id !== media.id))
    } else {
      setBookmarks([{
        id: media.id,
        title: media.title || media.name,
        poster: media.poster_path,
        media_type: media.media_type || (media.first_air_date ? 'tv' : 'movie'),
        vote_average: media.vote_average,
        release_date: media.release_date || media.first_air_date
      }, ...bookmarks])
    }
  }

  function getPlayerUrl() {
    if (!selectedMedia) return ''
    const type = selectedMedia.media_type
    const id = selectedMedia.id

    if (type === 'tv') {
      const baseUrl = `https://www.vidking.net/embed/tv/${id}/${currentSeason}/${currentEpisode}`
      const params = new URLSearchParams({
        episodeSelector: 'true',
        nextEpisode: 'true',
        color: '6366f1'
      })
      
      const historyItem = watchHistory.find(item => 
        item.id === id && item.media_type === 'tv' && 
        item.season === currentSeason && item.episode === currentEpisode
      )
      if (historyItem && historyItem.progress) {
        params.append('progress', Math.floor(historyItem.progress))
      }
      
      return `${baseUrl}?${params.toString()}`
    }
    
    const baseUrl = `https://www.vidking.net/embed/movie/${id}`
    const params = new URLSearchParams({
      color: '6366f1'
    })
    
    const historyItem = watchHistory.find(item => 
      item.id === id && item.media_type === 'movie'
    )
    if (historyItem && historyItem.progress) {
      params.append('progress', Math.floor(historyItem.progress))
    }
    
    return `${baseUrl}?${params.toString()}`
  }

  function MediaCard({ media, onClick }) {
    const isBookmarked = bookmarks.some(b => b.id === media.id)
    const isTopTen = media.topTenNumber !== undefined
    
    const historyItem = watchHistory.find(item => {
      if (media.media_type === 'tv' || media.first_air_date) {
        return item.id === media.id && item.media_type === 'tv'
      }
      return item.id === media.id && item.media_type === 'movie'
    })

    const hasProgress = historyItem && historyItem.progress && historyItem.duration && 
                       (historyItem.progress / historyItem.duration) < 0.95

    const progressPercent = hasProgress ? (historyItem.progress / historyItem.duration) * 100 : 0

    return (
      <div 
        className={`cursor-pointer group flex-shrink-0 ${isTopTen ? 'w-[180px] sm:w-[220px] md:w-[240px]' : 'w-[150px] sm:w-[180px] md:w-[200px]'}`}
        onClick={() => onClick(media)}
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded bg-zinc-900 mb-2">
          {isTopTen && (
            <div className="absolute bottom-0 left-0 z-20 text-[140px] sm:text-[160px] font-black leading-none text-white/10 select-none pointer-events-none" style={{
              WebkitTextStroke: '3px rgba(255,255,255,0.4)',
              textShadow: '0 0 30px rgba(0,0,0,0.9)',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
              {media.topTenNumber}
            </div>
          )}
          
          {media.poster_path ? (
            <img 
              src={`https://image.tmdb.org/t/p/w500${media.poster_path}`}
              alt={media.title || media.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
              <Film className="w-12 h-12 text-zinc-600" />
            </div>
          )}

          {isTopTen && (
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent z-10" />
          )}

          {hasProgress && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800 z-30">
              <div 
                className="h-full bg-indigo-600"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>
        
        <div className="space-y-0.5">
          <h3 className={`font-medium text-white truncate ${isTopTen ? 'text-base' : 'text-sm'}`}>
            {media.title || media.name}
          </h3>
          <div className={`flex items-center gap-2 text-zinc-500 ${isTopTen ? 'text-sm' : 'text-xs'}`}>
            <span>{media.vote_average?.toFixed(1)}/10</span>
            {(media.release_date || media.first_air_date) && (
              <span>{(media.release_date || media.first_air_date).split('-')[0]}</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  function ScrollableRow({ title, items, onItemClick, isTopTen = false }) {
    const scrollContainerRef = useRef(null)

    const scroll = (direction) => {
      if (scrollContainerRef.current) {
        const scrollAmount = direction === 'left' ? -900 : 900
        scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
      }
    }

    return (
      <div className="space-y-5 py-4">
        <h2 className={`font-bold px-8 ${isTopTen ? 'text-3xl tracking-tight' : 'text-2xl'}`}>
          <span className="text-indigo-500 font-black">|</span> {title}
        </h2>
        <div className="relative group/row">
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-20 bg-gradient-to-r from-black via-black/95 to-transparent hover:from-black hover:via-black w-16 flex items-center justify-start pl-2 opacity-0 group-hover/row:opacity-100 transition-all duration-300"
            aria-label="Scroll left"
          >
            <div className="bg-black/60 hover:bg-black/90 border border-zinc-700 hover:border-indigo-500 p-2 rounded-full transition-all hover:scale-110">
              <ChevronLeft className="w-8 h-8" />
            </div>
          </button>

          <div 
            ref={scrollContainerRef}
            className={`flex overflow-x-auto scrollbar-hide px-8 pb-4 ${isTopTen ? 'gap-6' : 'gap-5'}`}
          >
            {items.map(item => (
              <MediaCard key={item.id} media={item} onClick={onItemClick} />
            ))}
          </div>

          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-20 bg-gradient-to-l from-black via-black/95 to-transparent hover:from-black hover:via-black w-16 flex items-center justify-end pr-2 opacity-0 group-hover/row:opacity-100 transition-all duration-300"
            aria-label="Scroll right"
          >
            <div className="bg-black/60 hover:bg-black/90 border border-zinc-700 hover:border-indigo-500 p-2 rounded-full transition-all hover:scale-110">
              <ChevronRight className="w-8 h-8" />
            </div>
          </button>
        </div>
      </div>
    )
  }

  // WATCH VIEW
  if (view === 'watch' && selectedMedia) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/90 to-transparent">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setView('browse')}
                className="hover:bg-white/10"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1">
                <h1 className="text-xl font-semibold">{selectedMedia.title || selectedMedia.name}</h1>
                {selectedMedia.media_type === 'tv' && (
                  <p className="text-sm text-zinc-400">
                    Season {currentSeason} · Episode {currentEpisode}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toggleBookmark(selectedMedia)}
                className="hover:bg-white/10"
              >
                {bookmarks.some(b => b.id === selectedMedia.id) ? (
                  <BookmarkCheck className="w-5 h-5 text-white fill-white" />
                ) : (
                  <Bookmark className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>
        </header>

        <div className="pt-16">
          <div className="aspect-video bg-black">
            <iframe
              key={playerKey}
              ref={iframeRef}
              src={getPlayerUrl()}
              className="w-full h-full"
              frameBorder="0"
              allowFullScreen={true}
              style={{ border: 'none' }}
            />
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4 text-center">
                    <Star className="w-6 h-6 fill-yellow-500 text-yellow-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{selectedMedia.vote_average?.toFixed(1)}</p>
                    <p className="text-xs text-zinc-500">Rating</p>
                  </CardContent>
                </Card>
                
                {selectedMedia.media_type === 'movie' && selectedMedia.runtime && (
                  <Card className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-4 text-center">
                      <Clock className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold">{Math.floor(selectedMedia.runtime / 60)}h {selectedMedia.runtime % 60}m</p>
                      <p className="text-xs text-zinc-500">Runtime</p>
                    </CardContent>
                  </Card>
                )}
                
                {selectedMedia.media_type === 'tv' && selectedMedia.number_of_seasons && (
                  <Card className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-4 text-center">
                      <Tv className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold">{selectedMedia.number_of_seasons}</p>
                      <p className="text-xs text-zinc-500">Seasons</p>
                    </CardContent>
                  </Card>
                )}
                
                {selectedMedia.media_type === 'tv' && selectedMedia.number_of_episodes && (
                  <Card className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-4 text-center">
                      <Film className="w-6 h-6 text-green-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold">{selectedMedia.number_of_episodes}</p>
                      <p className="text-xs text-zinc-500">Episodes</p>
                    </CardContent>
                  </Card>
                )}
                
                {(selectedMedia.release_date || selectedMedia.first_air_date) && (
                  <Card className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-4 text-center">
                      <Clock className="w-6 h-6 text-indigo-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold">
                        {selectedMedia.release_date?.split('-')[0] || selectedMedia.first_air_date?.split('-')[0]}
                      </p>
                      <p className="text-xs text-zinc-500">Year</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {selectedMedia.tagline && (
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4">
                    <p className="text-lg italic text-center">"{selectedMedia.tagline}"</p>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-6 space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                      <Info className="w-5 h-5 text-indigo-500" />
                      Overview
                    </h3>
                    <p className="text-zinc-300 leading-relaxed">
                      {selectedMedia.overview || 'No description available for this title.'}
                    </p>
                  </div>
                  
                  {selectedMedia.genres && selectedMedia.genres.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3 text-zinc-400">Genres</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedMedia.genres.map(genre => (
                          <Badge key={genre.id} variant="outline" className="border-zinc-700 text-zinc-300">
                            {genre.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {selectedMedia.credits && selectedMedia.credits.cast && selectedMedia.credits.cast.length > 0 && (
                    <div className="pt-6 border-t border-zinc-800">
                      <h4 className="text-lg font-semibold mb-4">Top Cast</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {selectedMedia.credits.cast.slice(0, 8).map(actor => (
                          <div key={actor.id} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800/50">
                            {actor.profile_path ? (
                              <img 
                                src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                                alt={actor.name}
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                                <span className="text-xs font-bold text-zinc-500">{actor.name.charAt(0)}</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">{actor.name}</p>
                              <p className="text-xs text-zinc-500 truncate">{actor.character}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {selectedMedia.similar && selectedMedia.similar.results && selectedMedia.similar.results.length > 0 && (
                    <div className="pt-6 border-t border-zinc-800">
                      <h4 className="text-lg font-semibold mb-4">Similar Titles</h4>
                      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {selectedMedia.similar.results.slice(0, 6).map(similar => (
                          <div 
                            key={similar.id} 
                            className="cursor-pointer group"
                            onClick={() => {
                              setView('browse')
                              setTimeout(() => startWatching(similar), 100)
                            }}
                          >
                            <div className="aspect-[2/3] rounded-md overflow-hidden bg-zinc-800 relative">
                              {similar.poster_path ? (
                                <img 
                                  src={`https://image.tmdb.org/t/p/w342${similar.poster_path}`}
                                  alt={similar.title || similar.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              ) : (
                                <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                                  <Film className="w-8 h-8 text-zinc-600" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Play className="w-8 h-8 text-white" />
                              </div>
                            </div>
                            <p className="text-xs mt-2 truncate text-zinc-400">{similar.title || similar.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {selectedMedia.media_type === 'tv' && (
              <div className="lg:col-span-1 order-1 lg:order-2">
                <Card className="bg-zinc-900 border-zinc-800 sticky top-24">
                  <CardContent className="p-4 space-y-4">
                    <div>
                      <h3 className="font-semibold mb-3">Episodes</h3>
                      
                      {seasons.length > 0 && (
                        <Select value={currentSeason.toString()} onValueChange={(v) => changeSeason(parseInt(v))}>
                          <SelectTrigger className="bg-zinc-800 border-zinc-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {seasons.filter(s => s.season_number > 0).map(season => (
                              <SelectItem key={season.id} value={season.season_number.toString()}>
                                Season {season.season_number}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <ScrollArea className="h-[600px]">
                      <div className="space-y-2">
                        {episodes.map(episode => (
                          <div
                            key={episode.id}
                            onClick={() => changeEpisode(episode.episode_number)}
                            className={`p-3 rounded-lg cursor-pointer transition-colors ${
                              episode.episode_number === currentEpisode 
                                ? 'bg-indigo-600/20 border border-indigo-600/50' 
                                : 'hover:bg-zinc-800'
                            }`}
                          >
                            <div className="flex gap-3">
                              {episode.still_path && (
                                <div className="w-24 aspect-video bg-zinc-800 rounded overflow-hidden flex-shrink-0 relative">
                                  <img 
                                    src={`https://image.tmdb.org/t/p/w300${episode.still_path}`}
                                    alt={episode.name}
                                    className="w-full h-full object-cover"
                                  />
                                  {episode.episode_number === currentEpisode && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                                      <Play className="w-5 h-5 text-indigo-500" fill="currentColor" />
                                    </div>
                                  )}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start gap-2 mb-1">
                                  <span className="font-bold text-sm text-indigo-500">{episode.episode_number}.</span>
                                  <div className="flex-1">
                                    <h4 className="font-medium text-sm line-clamp-1">{episode.name}</h4>
                                    <p className="text-xs text-zinc-500 line-clamp-2 mt-1">{episode.overview || 'No description'}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
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

  // Prepare hero slides for infinite loop
  const heroSlides = trending.slice(0, HERO_SLIDE_COUNT);
  const heroDetailsForSlides = heroDetails.slice(0, HERO_SLIDE_COUNT);
  const canCreateLoop = heroSlides.length === HERO_SLIDE_COUNT && heroDetailsForSlides.length === HERO_SLIDE_COUNT;
  const heroItemsToRender = canCreateLoop ? [...heroSlides, heroSlides[0]] : heroSlides;
  const heroDetailsToRender = canCreateLoop ? [...heroDetailsForSlides, heroDetailsForSlides[0]] : heroDetailsForSlides;

  // BROWSE VIEW
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Hero Section */}
      {activeTab === 'home' && trending.length > 0 && (
        <div className="absolute top-0 left-0 h-screen w-full overflow-hidden z-10">
          <div
            className="flex h-full"
            style={{
              transform: `translateX(-${heroIndex * 100}%)`,
              transition: heroTransition ? 'transform 700ms ease-in-out' : 'none'
            }}
          >
            {heroItemsToRender.map((item, index) => {
              const detailedItem = heroDetailsToRender[index] || item
              const logoPath = detailedItem.images?.logos?.[0]?.file_path || 
                             detailedItem.belongs_to_collection?.logo_path
              
              return (
                <div key={`hero-${item.id}-${index}`} className="relative h-full w-full flex-shrink-0">
                  <div className="absolute inset-0">
                    {item.backdrop_path ? (
                      <>
                        <img 
                          src={`https://image.tmdb.org/t/p/original${item.backdrop_path}`}
                          alt={item.title || item.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
                      </>
                    ) : (
                      <div className="w-full h-full bg-zinc-900" />
                    )}
                  </div>

                  <div className="relative container mx-auto px-8 h-full flex items-end pb-32">
                    <div className="max-w-3xl space-y-6">
                      {logoPath ? (
                        <img 
                          src={`https://image.tmdb.org/t/p/original${logoPath}`}
                          alt={item.title || item.name}
                          className="max-h-[80px] md:max-h-[100px] w-auto object-contain"
                          style={{ filter: 'drop-shadow(0 4px 30px rgba(0,0,0,0.9))' }}
                        />
                      ) : (
                        <div className="h-[80px] md:h-[100px] w-auto bg-zinc-800/50 rounded-md flex items-center justify-center">
                          <span className="text-zinc-500 text-sm font-semibold">No logo available</span>
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-base">
                        <div className="flex items-center gap-2 bg-indigo-600 px-3 py-1.5 rounded-md shadow-lg">
                          <Star className="w-5 h-5 fill-white text-white" />
                          <span className="text-white font-bold">{item.vote_average?.toFixed(1)}</span>
                        </div>
                        <span className="text-white font-semibold drop-shadow-lg">
                          {(item.release_date || item.first_air_date)?.split('-')[0]}
                        </span>
                        <span className="px-3 py-1.5 bg-black/70 backdrop-blur-sm text-white text-sm font-bold rounded-md border border-zinc-600 shadow-lg">
                          {item.media_type === 'tv' ? 'TV SERIES' : 'MOVIE'}
                        </span>
                      </div>

                      <p className="text-white text-lg line-clamp-4 leading-relaxed max-w-2xl drop-shadow-lg">
                        {item.overview}
                      </p>

                      {detailedItem.genres && detailedItem.genres.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {detailedItem.genres.slice(0, 4).map(genre => (
                            <span key={genre.id} className="px-3 py-1 bg-black/60 backdrop-blur-sm text-white text-sm rounded-full border border-zinc-700 shadow-md">
                              {genre.name}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-4 pt-4">
                        <Button 
                          size="lg" 
                          className="bg-white text-black hover:bg-zinc-200 font-bold px-10 py-6 text-lg rounded-md shadow-2xl transition-all hover:scale-105"
                          onClick={() => startWatching(item)}
                        >
                          <Play className="w-6 h-6 mr-2" fill="currentColor" />
                          Play Now
                        </Button>
                        <Button 
                          size="lg" 
                          variant="outline" 
                          className="border-2 border-zinc-400 bg-black/60 backdrop-blur-sm hover:bg-black/80 hover:border-zinc-300 text-white font-bold px-10 py-6 text-lg rounded-md shadow-2xl transition-all hover:scale-105"
                          onClick={() => startWatching(item)}
                        >
                          <Info className="w-6 h-6 mr-2" />
                          More Info
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <header className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-b from-black/70 to-transparent">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold text-indigo-500">VidKing</h1>
            <div className="flex-1 max-w-2xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <Input
                  placeholder="Search movies, TV shows..."
                  className="pl-10 bg-zinc-900/80 border-zinc-800 focus:border-zinc-700 rounded-md"
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

      <main className={`relative ${activeTab === 'home' ? 'pt-[100vh]' : 'pt-24'}`}>
        <div className="bg-zinc-950">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="container mx-auto">
              <TabsList className="bg-transparent border-b border-zinc-800 rounded-none p-0 h-auto w-full">
                <TabsTrigger value="home" className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-6 py-3">Home</TabsTrigger>
                <TabsTrigger value="movies" className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-6 py-3">Movies</TabsTrigger>
                <TabsTrigger value="tv" className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-6 py-3">TV Shows</TabsTrigger>
                <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-6 py-3">Continue Watching</TabsTrigger>
                <TabsTrigger value="bookmarks" className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-6 py-3">My List</TabsTrigger>
              </TabsList>
            </div>

            {searchResults.length > 0 && (
              <div className="container mx-auto py-6 space-y-4">
                <h2 className="text-2xl font-bold px-4"><span className="text-indigo-500">|</span> Search Results</h2>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 px-4">
                  {searchResults.map(media => <MediaCard key={media.id} media={media} onClick={startWatching} />)}
                </div>
              </div>
            )}

            <TabsContent value="home" className="space-y-0 mt-0">
              <div className="py-12 space-y-12">
                {trending.length > 0 && <ScrollableRow title="TOP 10 CONTENT TODAY" items={trending.slice(0, 10).map((media, index) => ({ ...media, topTenNumber: index + 1 }))} onItemClick={startWatching} isTopTen={true} />}
                {trending.length > 10 && <ScrollableRow title="Trending Now" items={trending.slice(10, 30)} onItemClick={startWatching} />}
                {popularMovies.length > 0 && <ScrollableRow title="Popular Movies" items={popularMovies} onItemClick={startWatching} />}
                {popularTV.length > 0 && <ScrollableRow title="Popular TV Shows" items={popularTV} onItemClick={startWatching} />}
              </div>
            </TabsContent>

            <TabsContent value="movies" className="mt-0">
              <div className="container mx-auto py-12 space-y-8">
                {popularMovies.length > 0 ? <ScrollableRow title="Popular Movies" items={popularMovies} onItemClick={startWatching} /> : <div className="text-center py-20"><p>Loading...</p></div>}
              </div>
            </TabsContent>

            <TabsContent value="tv" className="mt-0">
              <div className="container mx-auto py-12 space-y-8">
                {popularTV.length > 0 ? <ScrollableRow title="Popular TV Shows" items={popularTV} onItemClick={startWatching} /> : <div className="text-center py-20"><p>Loading...</p></div>}
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              <div className="container mx-auto py-12 space-y-8">
                {watchHistory.length === 0 ? (
                  <div className="text-center py-20">
                    <Clock className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                    <p className="text-zinc-400 text-lg">No watch history yet</p>
                  </div>
                ) : (
                  <ScrollableRow 
                    title="Continue Watching" 
                    items={watchHistory.map(item => ({
                      id: item.id,
                      title: item.title,
                      name: item.title,
                      poster_path: item.poster,
                      media_type: item.media_type,
                      vote_average: item.vote_average,
                      release_date: item.release_date,
                      first_air_date: item.release_date
                    }))} 
                    onItemClick={(media) => {
                      const item = watchHistory.find(h => h.id === media.id)
                      if (item) {
                        startWatching({
                          ...media,
                          media_type: item.media_type
                        })
                      }
                    }} 
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="bookmarks" className="mt-0">
              <div className="container mx-auto py-12 space-y-8">
                {bookmarks.length === 0 ? (
                  <div className="text-center py-20">
                    <Bookmark className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                    <p className="text-zinc-400 text-lg">Your list is empty</p>
                  </div>
                ) : (
                  <ScrollableRow 
                    title="My List" 
                    items={bookmarks.map(item => ({
                      id: item.id,
                      title: item.title,
                      name: item.title,
                      poster_path: item.poster,
                      media_type: item.media_type,
                      vote_average: item.vote_average,
                      release_date: item.release_date,
                      first_air_date: item.release_date
                    }))} 
                    onItemClick={(media) => {
                      const item = bookmarks.find(b => b.id === media.id)
                      if (item) {
                        startWatching({
                          ...media,
                          media_type: item.media_type
                        })
                      }
                    }} 
                  />
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}