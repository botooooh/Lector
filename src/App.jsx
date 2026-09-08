import { useState, useRef, useEffect } from 'react';
import { Home, Library, Search, Play, SkipBack, SkipForward, Volume2, Maximize2, PictureInPicture2, Pause, PlusCircle, MonitorUp, PlayCircle, Music } from 'lucide-react';
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
    playlist, currentTrackIndex, isPlaying, volume, progress, duration,
    setAudioRef, setYtPlayer, addYouTubeTrack, addLocalFiles, playTrack,
    togglePlay, nextTrack, prevTrack, setVolume, seekTo,
    updateProgress, updateDuration, updateTrackMetadata
  } = useStore();

  const [ytInput, setYtInput] = useState('');
  const audioRef = useRef(null);

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
    // YT.PlayerState.PLAYING = 1
    // YT.PlayerState.ENDED = 0
    if (event.data === 0) {
      nextTrack();
    } else if (event.data === 1) {
      updateDuration(event.target.getDuration());
      
      // Update metadata if it's still generic
      const track = playlist[currentTrackIndex];
      if (track && track.title.startsWith('YouTube Video')) {
        const videoData = event.target.getVideoData();
        updateTrackMetadata(currentTrackIndex, {
          title: videoData.title,
          artist: videoData.author
        });
      }
    }
  };

  // Sync YouTube progress manually since it doesn't fire timeupdate events
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        const track = playlist[currentTrackIndex];
        if (track?.type === 'youtube') {
          const { ytPlayer } = useStore.getState();
          if (ytPlayer && ytPlayer.getCurrentTime) {
            updateProgress(ytPlayer.getCurrentTime());
          }
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentTrackIndex, playlist, updateProgress]);

  const handleAddYt = () => {
    if (ytInput.trim()) {
      addYouTubeTrack(ytInput.trim());
      setYtInput('');
    }
  };

  const currentTrack = currentTrackIndex >= 0 ? playlist[currentTrackIndex] : null;

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

      // Simple HTML template for PiP
      pipWindow.document.body.innerHTML = `
        <style>
          body { 
            margin: 0; background: #121212; color: white; font-family: sans-serif;
            display: flex; flex-direction: column; height: 100vh; justify-content: center; align-items: center;
          }
          .title { font-weight: bold; font-size: 14px; margin-bottom: 4px; text-align: center; width: 90%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .artist { font-size: 12px; color: #a7a7a7; margin-bottom: 16px; text-align: center; width: 90%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .controls { display: flex; gap: 20px; align-items: center; }
          button { background: none; border: none; color: white; cursor: pointer; padding: 8px; }
          button:hover { color: #1ed760; }
        </style>
        <div class="title" id="pip-title">Lector</div>
        <div class="artist" id="pip-artist">En attente...</div>
        <div class="controls">
          <button id="pip-prev"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2"></line></svg></button>
          <button id="pip-play"><svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></button>
          <button id="pip-next"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"></line></svg></button>
        </div>
      `;

      // Update func
      const updatePiP = () => {
        const state = useStore.getState();
        const track = state.playlist[state.currentTrackIndex];
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

      // Bind buttons
      pipWindow.document.getElementById('pip-play').onclick = () => { togglePlay(); updatePiP(); };
      pipWindow.document.getElementById('pip-prev').onclick = () => { prevTrack(); updatePiP(); };
      pipWindow.document.getElementById('pip-next').onclick = () => { nextTrack(); updatePiP(); };

      // Subscribe to store changes to update PiP UI
      const unsubscribe = useStore.subscribe((state, prevState) => {
        if (state.isPlaying !== prevState.isPlaying || state.currentTrackIndex !== prevState.currentTrackIndex) {
          updatePiP();
        }
      });

      pipWindow.addEventListener("pagehide", () => {
        unsubscribe();
      });

    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="app-container">
      {/* Hidden Audio Players */}
      <audio 
        ref={audioRef}
        onTimeUpdate={handleAudioTimeUpdate}
        onLoadedMetadata={handleAudioLoadedMetadata}
        onEnded={handleAudioEnded}
      />
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', visibility: 'hidden' }}>
        <YouTube 
          videoId="" // initialized empty, loaded via API
          opts={{ height: '0', width: '0', playerVars: { autoplay: 0, controls: 0 } }}
          onReady={onYtReady}
          onStateChange={onYtStateChange}
        />
      </div>

      <aside className="sidebar">
        <div className="nav-section">
          <button className="nav-item active">
            <Home size={24} />
            <span>Accueil</span>
          </button>
          <button className="nav-item">
            <Search size={24} />
            <span>Rechercher</span>
          </button>
        </div>
        <div className="nav-section" style={{ flex: 1, overflowY: 'auto' }}>
          <div className="nav-item" style={{ marginBottom: '16px' }}>
            <Library size={24} />
            <span>Bibliothèque ({playlist.length})</span>
          </div>
          
          <div className="track-list" style={{ gap: '4px' }}>
            {playlist.map((track, i) => (
              <div 
                key={track.id} 
                className={`track-row ${i === currentTrackIndex ? 'playing' : ''}`}
                onClick={() => playTrack(i)}
                style={{ gridTemplateColumns: '32px 1fr', padding: '8px', paddingRight: 0 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {track.type === 'youtube' ? <PlayCircle size={16} /> : <Music size={16} />}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div className="track-row-title" style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="main-view">
        <div className="top-bar">
          <h2 className="header-title" style={{ margin: 0 }}>Bonjour</h2>
        </div>
        
        <div className="main-content">
          <div style={{ marginTop: '24px', marginBottom: '32px' }}>
            <h3 className="header-title" style={{ fontSize: '20px' }}>Ajouter une musique</h3>
            <div style={{ display: 'flex', gap: '16px', maxWidth: '600px' }}>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Coller un lien YouTube..." 
                style={{ flex: 1 }}
                value={ytInput}
                onChange={e => setYtInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddYt()}
              />
              <button className="btn-primary" onClick={handleAddYt}>Ajouter</button>
            </div>
            <div style={{ marginTop: '16px' }}>
              <label className="btn-primary" style={{ cursor: 'pointer', display: 'inline-block', backgroundColor: 'transparent', border: '1px solid #fff', color: '#fff' }}>
                Choisir des fichiers locaux
                <input 
                  type="file" 
                  accept="audio/*" 
                  multiple 
                  style={{ display: 'none' }} 
                  onChange={e => addLocalFiles(e.target.files)}
                />
              </label>
            </div>
          </div>

          <h3 className="header-title" style={{ fontSize: '20px' }}>Playlist Actuelle</h3>
          {playlist.length === 0 ? (
            <div style={{ color: 'var(--text-subdued)' }}>Votre playlist est vide. Ajoutez des musiques ci-dessus !</div>
          ) : (
            <div className="track-list">
              {playlist.map((track, i) => (
                <div 
                  key={track.id} 
                  className={`track-row ${i === currentTrackIndex ? 'playing' : ''}`}
                  onClick={() => playTrack(i)}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {i === currentTrackIndex && isPlaying ? <Pause size={16} fill="currentColor" /> : (i === currentTrackIndex ? <Play size={16} fill="currentColor" /> : i + 1)}
                  </div>
                  <div style={{ overflow: 'hidden', paddingRight: '16px' }}>
                    <div className="track-row-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.artist}</div>
                  </div>
                  <div>{track.type === 'youtube' ? 'YouTube' : 'Fichier Local'}</div>
                  <div style={{ textAlign: 'right' }}>{track.duration ? formatTime(track.duration) : '--:--'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="player-bar">
        <div className="player-left">
          <div className="track-art">
            {currentTrack ? (currentTrack.type === 'youtube' ? <PlayCircle size={24} /> : <Music size={24} />) : <MonitorUp size={24} />}
          </div>
          <div className="track-info">
            <span className="track-title">{currentTrack ? currentTrack.title : 'Aucune piste'}</span>
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
            <div 
              className="progress-bar" 
              onClick={(e) => {
                if (!currentTrack || !duration) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                seekTo(pos * duration);
              }}
            >
              <div className="progress-fill" style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }}></div>
            </div>
            <span className="time-text total">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="player-right">
          <button className="control-btn" title="Mini Player (Toujours au-dessus)" onClick={startPiP} disabled={!currentTrack}>
            <PictureInPicture2 size={20} />
          </button>
          <div className="volume-container">
            <Volume2 size={20} className="control-btn" />
            <div 
              className="progress-bar"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                setVolume(pos * 100);
              }}
            >
              <div className="progress-fill" style={{ width: `${volume}%` }}></div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
