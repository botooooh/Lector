import { useState, useRef, useEffect } from 'react';
import { Home, Library, Search, Play, SkipBack, SkipForward, Volume2, Maximize2, PictureInPicture2, Pause, PlusCircle, MonitorUp, PlayCircle, Music, MoreHorizontal } from 'lucide-react';
import YouTube from 'react-youtube';
import { useStore } from './store';
import './index.css';

const formatTime = (seconds) => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

function App() {
  const { 
    queue, currentTrackIndex, isPlaying, volume, progress, duration,
    userPlaylists, isDataLoaded, initData, createPlaylist, addTrackToPlaylist, playQueue,
    setAudioRef, setYtPlayer, addYouTubeTrackToQueue, addLocalFilesToQueue, playTrack,
    togglePlay, nextTrack, prevTrack, setVolume, seekTo,
    updateProgress, updateDuration, updateTrackMetadata
  } = useStore();

  const [ytInput, setYtInput] = useState('');
  const audioRef = useRef(null);
  const [currentView, setCurrentView] = useState({ type: 'home' }); // {type: 'home' | 'library' | 'playlist', id?: string}
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistImage, setNewPlaylistImage] = useState(null);

  useEffect(() => {
    initData();
  }, [initData]);

  useEffect(() => {
    setAudioRef(audioRef.current);
  }, [setAudioRef]);

  // Audio elements time update
  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      updateProgress(audioRef.current.currentTime);
    }
  };

  const handleAudioLoadedMetadata = () => {
    if (audioRef.current) {
      updateDuration(audioRef.current.duration);
    }
  };

  const handleAudioEnded = () => {
    nextTrack();
  };

  // YouTube events
  const onYtReady = (event) => {
    setYtPlayer(event.target);
    event.target.setVolume(volume);
  };

  const onYtStateChange = (event) => {
    if (event.data === 0) {
      nextTrack();
    } else if (event.data === 1) {
      updateDuration(event.target.getDuration());
      const track = queue[currentTrackIndex];
      if (track && track.title.startsWith('YouTube Video')) {
        const videoData = event.target.getVideoData();
        updateTrackMetadata(currentTrackIndex, {
          title: videoData.title,
          artist: videoData.author
        });
      }
    }
  };

  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        const track = queue[currentTrackIndex];
        if (track?.type === 'youtube') {
          const { ytPlayer } = useStore.getState();
          if (ytPlayer && ytPlayer.getCurrentTime) {
            updateProgress(ytPlayer.getCurrentTime());
          }
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentTrackIndex, queue, updateProgress]);

  const handleAddYtToQueue = () => {
    if (ytInput.trim()) {
      addYouTubeTrackToQueue(ytInput.trim());
      setYtInput('');
    }
  };

  const handleCreatePlaylist = async () => {
    await createPlaylist(newPlaylistName, newPlaylistImage);
    setShowPlaylistModal(false);
    setNewPlaylistName('');
    setNewPlaylistImage(null);
  };

  const currentTrack = currentTrackIndex >= 0 ? queue[currentTrackIndex] : null;

  // Handle PiP
  const startPiP = async () => {
    if (!('documentPictureInPicture' in window)) {
      alert("Votre navigateur ne supporte pas la fonctionnalité Document Picture-in-Picture.");
      return;
    }
    try {
      const pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 320,
        height: 120,
      });

      pipWindow.document.body.innerHTML = `
        <style>
          body { margin: 0; background: #1D1B20; color: #E6E1E5; font-family: 'Google Sans', sans-serif; display: flex; flex-direction: column; height: 100vh; justify-content: center; align-items: center; }
          .title { font-weight: 500; font-size: 16px; margin-bottom: 4px; text-align: center; width: 90%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .artist { font-size: 14px; color: #CAC4D0; margin-bottom: 16px; text-align: center; width: 90%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .controls { display: flex; gap: 24px; align-items: center; }
          button { background: none; border: none; color: #E6E1E5; cursor: pointer; padding: 8px; border-radius: 50%; transition: background 0.2s; }
          button:hover { background: rgba(230, 225, 229, 0.08); color: #D0BCFF; }
        </style>
        <div class="title" id="pip-title">Lector</div>
        <div class="artist" id="pip-artist">En attente...</div>
        <div class="controls">
          <button id="pip-prev"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2"></line></svg></button>
          <button id="pip-play"><svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></button>
          <button id="pip-next"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"></line></svg></button>
        </div>
      `;

      const updatePiP = () => {
        const state = useStore.getState();
        const track = state.queue[state.currentTrackIndex];
        pipWindow.document.getElementById('pip-title').innerText = track ? track.title : 'Lector';
        pipWindow.document.getElementById('pip-artist').innerText = track ? track.artist : 'En attente...';
        
        const playBtn = pipWindow.document.getElementById('pip-play');
        if (state.isPlaying) {
          playBtn.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
        } else {
          playBtn.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
        }
      };

      updatePiP();
      pipWindow.document.getElementById('pip-play').onclick = () => { togglePlay(); updatePiP(); };
      pipWindow.document.getElementById('pip-prev').onclick = () => { prevTrack(); updatePiP(); };
      pipWindow.document.getElementById('pip-next').onclick = () => { nextTrack(); updatePiP(); };

      const unsubscribe = useStore.subscribe((state, prevState) => {
        if (state.isPlaying !== prevState.isPlaying || state.currentTrackIndex !== prevState.currentTrackIndex) {
          updatePiP();
        }
      });
      pipWindow.addEventListener("pagehide", () => unsubscribe());
    } catch (err) { console.error(err); }
  };

  if (!isDataLoaded) return <div style={{ color: 'var(--md-sys-color-on-background)', padding: '24px' }}>Chargement...</div>;

  return (
    <div className="app-container">
      <audio ref={audioRef} onTimeUpdate={handleAudioTimeUpdate} onLoadedMetadata={handleAudioLoadedMetadata} onEnded={handleAudioEnded} />
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', visibility: 'hidden' }}>
        <YouTube videoId="" opts={{ height: '0', width: '0', playerVars: { autoplay: 0, controls: 0 } }} onReady={onYtReady} onStateChange={onYtStateChange} />
      </div>

      <aside className="sidebar">
        <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/Lector logo.png" alt="Lector Logo" style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
          <span style={{ fontSize: '20px', fontWeight: 'bold' }}>Lector</span>
        </div>
        <div className="nav-section">
          <button className={`nav-item ${currentView.type === 'home' ? 'active' : ''}`} onClick={() => setCurrentView({ type: 'home' })}>
            <Home size={24} /> <span>Accueil</span>
          </button>
          <button className="nav-item">
            <Search size={24} /> <span>Rechercher</span>
          </button>
        </div>
        <div className="nav-section" style={{ flex: 1, overflowY: 'auto' }}>
          <div className="nav-item" style={{ marginBottom: '8px' }}>
            <Library size={24} /> <span>Votre Bibliothèque</span>
          </div>
          <button className={`nav-item ${currentView.type === 'library' ? 'active' : ''}`} onClick={() => setCurrentView({ type: 'library' })}>
            <PlayCircle size={20} /> <span>File d'attente globale</span>
          </button>
          
          <div style={{ margin: '16px 0', borderTop: '1px solid var(--md-sys-color-outline-variant)' }}></div>
          
          {userPlaylists.map(pl => (
            <button 
              key={pl.id} 
              className={`nav-item ${currentView.id === pl.id ? 'active' : ''}`} 
              onClick={() => setCurrentView({ type: 'playlist', id: pl.id })}
              style={{ padding: '8px 16px', gap: '12px' }}
            >
              {pl.coverImage ? (
                <img src={pl.coverImage} className="playlist-cover-small" alt="cover" />
              ) : (
                <div className="playlist-cover-small" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Music size={16} />
                </div>
              )}
              <span style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pl.name}</span>
            </button>
          ))}

          <button className="nav-item" style={{ padding: '12px 16px', marginTop: '8px' }} onClick={() => setShowPlaylistModal(true)}>
            <PlusCircle size={20} /> <span>Créer une playlist</span>
          </button>
        </div>
      </aside>

      <main className="main-view">
        <div className="top-bar">
          <h2 className="header-title" style={{ margin: 0 }}>
            {currentView.type === 'home' && "Bonjour"}
            {currentView.type === 'library' && "File d'attente globale"}
            {currentView.type === 'playlist' && "Playlist"}
          </h2>
        </div>
        
        <div className="main-content">
          {currentView.type === 'home' && (
            <div style={{ marginTop: '24px' }}>
              <h2 style={{ fontSize: '32px', marginBottom: '40px', fontWeight: '500' }}>Bonjour</h2>
          
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '24px', color: 'var(--md-sys-color-on-surface-variant)' }}>Ajouter à la file globale</h3>
                <div style={{ display: 'flex', gap: '16px', maxWidth: '600px', alignItems: 'center' }}>
                  <input type="text" className="input-field" placeholder="Coller un lien YouTube..." value={ytInput} onChange={e => setYtInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddYtToQueue()} />
                  <button className="btn-primary" onClick={handleAddYtToQueue}>Ajouter</button>
                </div>
              </div>
              <label className="btn-secondary" style={{ cursor: 'pointer', display: 'inline-block' }}>
                Choisir des fichiers locaux
                <input type="file" accept="audio/*" multiple style={{ display: 'none' }} onChange={e => addLocalFilesToQueue(e.target.files)} />
              </label>
            </div>
          )}

          {currentView.type === 'library' && (
            <div style={{ marginTop: '24px' }}>
              {queue.length === 0 ? (
                <div style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Votre file d'attente est vide. Ajoutez des musiques depuis l'Accueil !</div>
              ) : (
                <div className="track-list">
                  {queue.map((track, i) => (
                    <div key={track.id} className={`track-row ${i === currentTrackIndex ? 'playing' : ''}`} onClick={() => playTrack(i)}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {i === currentTrackIndex && isPlaying ? <Pause size={16} fill="currentColor" /> : (
                          track.type === 'youtube' ? <img src={`https://img.youtube.com/vi/${track.url}/default.jpg`} style={{width: '32px', height: '24px', objectFit: 'cover', borderRadius: '4px'}} /> : <Music size={16} />
                        )}
                      </div>
                      <div style={{ overflow: 'hidden', paddingRight: '16px' }}>
                        <div className="track-row-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.artist}</div>
                      </div>
                      <div>{track.type === 'youtube' ? 'YouTube' : 'Local'}</div>
                      <div style={{ textAlign: 'right' }}>{track.duration ? formatTime(track.duration) : '--:--'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentView.type === 'playlist' && (() => {
            const pl = userPlaylists.find(p => p.id === currentView.id);
            if (!pl) return null;
            return (
              <div>
                <div className="playlist-header">
                  {pl.coverImage ? (
                    <img src={pl.coverImage} className="playlist-header-img" alt="cover" />
                  ) : (
                    <div className="playlist-header-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--md-sys-color-surface-container-highest)' }}>
                      <Music size={64} color="var(--md-sys-color-on-surface-variant)" />
                    </div>
                  )}
                  <div className="playlist-header-info">
                    <span className="playlist-type">Playlist Publique</span>
                    <h1 className="playlist-title">{pl.name}</h1>
                    <span className="playlist-stats">{pl.tracks.length} titres</span>
                  </div>
                </div>

                <div className="action-bar">
                  <button className="action-play-btn" onClick={() => {
                    if (pl.tracks.length > 0) playQueue(pl.tracks, 0);
                  }}>
                    <Play size={28} fill="currentColor" style={{ marginLeft: '4px' }} />
                  </button>
                  <MoreHorizontal size={32} color="var(--md-sys-color-on-surface-variant)" style={{ cursor: 'pointer' }} />
                </div>

                <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--md-sys-color-surface-container)', borderRadius: 'var(--md-sys-shape-corner-large)' }}>
                  <h4 style={{ marginBottom: '12px' }}>Ajouter un titre à {pl.name}</h4>
                  <div style={{ display: 'flex', gap: '16px', maxWidth: '600px' }}>
                    <input type="text" className="input-field" placeholder="Lien YouTube..." id={`yt-${pl.id}`} />
                    <button className="btn-secondary" onClick={() => {
                      const input = document.getElementById(`yt-${pl.id}`);
                      if (input.value) {
                        // Quick add implementation
                        let videoId = '';
                        const match = input.value.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
                        if (match && match[2].length === 11) videoId = match[2];
                        if (videoId) {
                          addTrackToPlaylist(pl.id, { id: generateId(), type: 'youtube', url: videoId, title: `YouTube (${videoId})`, artist: 'YouTube', duration: 0 });
                          input.value = '';
                        }
                      }
                    }}>Ajouter</button>
                  </div>
                </div>

                <div className="track-list">
                  {pl.tracks.map((track, i) => (
                    <div key={track.id} className="track-row" onClick={() => playQueue(pl.tracks, i)}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {track.type === 'youtube' ? <img src={`https://img.youtube.com/vi/${track.url}/default.jpg`} style={{width: '32px', height: '24px', objectFit: 'cover', borderRadius: '4px'}} /> : (i + 1)}
                      </div>
                      <div style={{ overflow: 'hidden', paddingRight: '16px' }}>
                        <div className="track-row-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.artist}</div>
                      </div>
                      <div>{track.type === 'youtube' ? 'YouTube' : 'Local'}</div>
                      <div style={{ textAlign: 'right' }}>{track.duration ? formatTime(track.duration) : '--:--'}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </main>

      <footer className="player-bar">
        <div className="player-left">
          <div className="track-art-wrapper">
            <div className="track-art">
              {currentTrack ? (
                currentTrack.type === 'youtube' ? (
                  <img src={`https://img.youtube.com/vi/${currentTrack.url}/hqdefault.jpg`} alt="thumbnail" />
                ) : (
                  <Music size={24} />
                )
              ) : (
                <MonitorUp size={24} />
              )}
            </div>
            {currentTrack?.type === 'youtube' && (
              <div className="source-icon-overlay"><img src="/li_youtube.svg" alt="yt" style={{width: '12px', height: '12px'}} /></div>
            )}
          </div>
          <div className="track-info">
            <div className="track-title-wrapper">
              <span className="track-title">{currentTrack ? currentTrack.title : 'Aucune piste'}</span>
              {currentTrack && <MoreHorizontal size={16} color="var(--md-sys-color-on-surface-variant)" style={{ cursor: 'pointer' }} />}
            </div>
            <span className="track-artist">{currentTrack ? currentTrack.artist : ''}</span>
          </div>
        </div>

        <div className="player-center">
          <div className="player-controls">
            <button className="control-btn" onClick={prevTrack} disabled={!currentTrack}><SkipBack size={20} fill="currentColor" /></button>
            <button className="control-btn play-btn" onClick={togglePlay} disabled={!currentTrack}>
              {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" style={{ marginLeft: '2px' }} />}
            </button>
            <button className="control-btn" onClick={nextTrack} disabled={!currentTrack}><SkipForward size={20} fill="currentColor" /></button>
          </div>
          <div className="progress-container">
            <span className="time-text">{formatTime(progress)}</span>
            <div className="progress-bar" onClick={(e) => {
                if (!currentTrack || !duration) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                seekTo(pos * duration);
              }}>
              <div className="progress-fill" style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }}></div>
            </div>
            <span className="time-text">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="player-right">
          <button className="control-btn" title="Mini Player (Toujours au-dessus)" onClick={startPiP} disabled={!currentTrack}>
            <PictureInPicture2 size={20} />
          </button>
          <div className="volume-container">
            <Volume2 size={20} className="control-btn" />
            <div className="progress-bar" onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                setVolume(pos * 100);
              }}>
              <div className="progress-fill" style={{ width: `${volume}%` }}></div>
            </div>
          </div>
        </div>
      </footer>

      {showPlaylistModal && (
        <div className="modal-overlay" onClick={() => setShowPlaylistModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="header-title" style={{ margin: 0 }}>Créer une Playlist</h3>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Nom de la playlist" 
              value={newPlaylistName} 
              onChange={e => setNewPlaylistName(e.target.value)} 
            />
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--md-sys-color-on-surface-variant)' }}>Image de couverture (optionnel)</label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={e => setNewPlaylistImage(e.target.files[0])} 
                style={{ color: 'var(--md-sys-color-on-surface)' }}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowPlaylistModal(false)}>Annuler</button>
              <button className="btn-primary" onClick={handleCreatePlaylist}>Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Generate ID function for quick add in playlist view
const generateId = () => Math.random().toString(36).substr(2, 9);

export default App;
