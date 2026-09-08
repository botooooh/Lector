import { create } from 'zustand';

// Generate a random ID
const generateId = () => Math.random().toString(36).substr(2, 9);

export const useStore = create((set, get) => ({
  playlist: JSON.parse(localStorage.getItem('lector_playlist')) || [],
  currentTrackIndex: -1,
  isPlaying: false,
  volume: 100,
  progress: 0,
  duration: 0,
  
  // Player instances (ref to HTMLAudioElement or YouTube player)
  audioRef: null,
  ytPlayer: null,

  setAudioRef: (ref) => set({ audioRef: ref }),
  setYtPlayer: (player) => set({ ytPlayer: player }),

  addYouTubeTrack: (url) => {
    // Extract video ID
    let videoId = '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      videoId = match[2];
    } else {
      alert("Lien YouTube invalide");
      return;
    }

    const newTrack = {
      id: generateId(),
      type: 'youtube',
      url: videoId,
      title: `YouTube Video (${videoId})`, // Will be updated when loaded
      artist: 'YouTube',
      duration: 0
    };

    const newPlaylist = [...get().playlist, newTrack];
    set({ playlist: newPlaylist });
    localStorage.setItem('lector_playlist', JSON.stringify(newPlaylist.filter(t => t.type === 'youtube')));
    
    // Play immediately if it's the first track
    if (get().currentTrackIndex === -1) {
      get().playTrack(newPlaylist.length - 1);
    }
  },

  addLocalFiles: (files) => {
    const newTracks = Array.from(files).map(file => ({
      id: generateId(),
      type: 'local',
      url: URL.createObjectURL(file),
      title: file.name.replace(/\.[^/.]+$/, ""),
      artist: 'Fichier Local',
      duration: 0,
      file: file
    }));

    const newPlaylist = [...get().playlist, ...newTracks];
    set({ playlist: newPlaylist });
    
    if (get().currentTrackIndex === -1) {
      get().playTrack(newPlaylist.length - newTracks.length);
    }
  },

  playTrack: (index) => {
    const { playlist, audioRef, ytPlayer } = get();
    if (index < 0 || index >= playlist.length) return;

    // Stop current playbacks
    if (audioRef) audioRef.pause();
    if (ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();

    set({ 
      currentTrackIndex: index, 
      isPlaying: true,
      progress: 0,
      duration: playlist[index].duration || 0
    });

    const track = playlist[index];
    if (track.type === 'local' && audioRef) {
      audioRef.src = track.url;
      audioRef.play().catch(e => console.error("Error playing local file:", e));
    } else if (track.type === 'youtube' && ytPlayer) {
      ytPlayer.loadVideoById(track.url);
      ytPlayer.playVideo();
    }
  },

  togglePlay: () => {
    const { isPlaying, currentTrackIndex, playlist, audioRef, ytPlayer } = get();
    if (currentTrackIndex === -1 && playlist.length > 0) {
      get().playTrack(0);
      return;
    }

    if (currentTrackIndex === -1) return;

    const track = playlist[currentTrackIndex];
    
    if (isPlaying) {
      if (track.type === 'local' && audioRef) audioRef.pause();
      if (track.type === 'youtube' && ytPlayer) ytPlayer.pauseVideo();
    } else {
      if (track.type === 'local' && audioRef) audioRef.play();
      if (track.type === 'youtube' && ytPlayer) ytPlayer.playVideo();
    }
    
    set({ isPlaying: !isPlaying });
  },

  nextTrack: () => {
    const { currentTrackIndex, playlist } = get();
    if (currentTrackIndex < playlist.length - 1) {
      get().playTrack(currentTrackIndex + 1);
    } else if (playlist.length > 0) {
      get().playTrack(0); // loop back
    }
  },

  prevTrack: () => {
    const { currentTrackIndex, playlist, progress } = get();
    // If played more than 3 seconds, restart current track
    if (progress > 3) {
      get().seekTo(0);
    } else if (currentTrackIndex > 0) {
      get().playTrack(currentTrackIndex - 1);
    }
  },

  setVolume: (val) => {
    set({ volume: val });
    const { audioRef, ytPlayer } = get();
    if (audioRef) audioRef.volume = val / 100;
    if (ytPlayer && ytPlayer.setVolume) ytPlayer.setVolume(val);
  },

  seekTo: (seconds) => {
    const { currentTrackIndex, playlist, audioRef, ytPlayer } = get();
    if (currentTrackIndex === -1) return;
    
    const track = playlist[currentTrackIndex];
    if (track.type === 'local' && audioRef) {
      audioRef.currentTime = seconds;
    } else if (track.type === 'youtube' && ytPlayer) {
      ytPlayer.seekTo(seconds, true);
    }
    set({ progress: seconds });
  },

  updateProgress: (seconds) => set({ progress: seconds }),
  updateDuration: (seconds) => set({ duration: seconds }),
  
  updateTrackMetadata: (index, metadata) => {
    const newPlaylist = [...get().playlist];
    newPlaylist[index] = { ...newPlaylist[index], ...metadata };
    set({ playlist: newPlaylist });
    localStorage.setItem('lector_playlist', JSON.stringify(newPlaylist.filter(t => t.type === 'youtube')));
  }
}));
