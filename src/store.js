import { create } from 'zustand';
import localforage from 'localforage';

// Initialize localforage
localforage.config({
  name: 'LectorApp',
  storeName: 'music_data'
});

const generateId = () => Math.random().toString(36).substr(2, 9);

export const useStore = create((set, get) => ({
  // Playback queue (what's currently playing)
  queue: [],
  currentTrackIndex: -1,
  isPlaying: false,
  volume: 100,
  progress: 0,
  duration: 0,
  isShuffle: false,
  isRepeat: false,
  
  // Custom Playlists
  userPlaylists: [],
  isDataLoaded: false,

  // Player instances
  audioRef: null,
  ytPlayer: null,

  setAudioRef: (ref) => set({ audioRef: ref }),
  setYtPlayer: (player) => set({ ytPlayer: player }),

  // Load saved data on startup
  initData: async () => {
    try {
      const savedQueue = await localforage.getItem('lector_queue') || [];
      const savedPlaylists = await localforage.getItem('lector_playlists') || [];
      set({ queue: savedQueue, userPlaylists: savedPlaylists, isDataLoaded: true });
    } catch (e) {
      console.error("Error loading data", e);
      set({ isDataLoaded: true });
    }
  },

  // Save helpers
  saveQueue: (q) => {
    // Only save youtube tracks, local files get lost
    localforage.setItem('lector_queue', q.filter(t => t.type === 'youtube'));
  },
  savePlaylists: (p) => {
    // Don't save Local File references if we can't serialize Blob URLs permanently, 
    // but we can save the playlist structure. For now, we save everything. 
    // Local URLs will break on reload but that's expected for security.
    localforage.setItem('lector_playlists', p);
  },

  addYouTubeTrackToQueue: (url) => {
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
      title: `YouTube Video (${videoId})`,
      artist: 'YouTube',
      duration: 0
    };

    const newQueue = [...get().queue, newTrack];
    set({ queue: newQueue });
    get().saveQueue(newQueue);
    
    if (get().currentTrackIndex === -1) {
      get().playTrack(newQueue.length - 1);
    }
  },

  addLocalFilesToQueue: (files) => {
    const newTracks = Array.from(files).map(file => ({
      id: generateId(),
      type: 'local',
      url: URL.createObjectURL(file),
      title: file.name.replace(/\.[^/.]+$/, ""),
      artist: 'Fichier Local',
      duration: 0,
      file: file
    }));

    const newQueue = [...get().queue, ...newTracks];
    set({ queue: newQueue });
    
    if (get().currentTrackIndex === -1) {
      get().playTrack(newQueue.length - newTracks.length);
    }
  },

  // Playlists management
  createPlaylist: async (name, imageFile) => {
    let base64Image = null;
    if (imageFile) {
      base64Image = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(imageFile);
      });
    }

    const newPlaylist = {
      id: generateId(),
      name: name || 'Nouvelle Playlist',
      coverImage: base64Image,
      tracks: []
    };

    const updatedPlaylists = [...get().userPlaylists, newPlaylist];
    set({ userPlaylists: updatedPlaylists });
    get().savePlaylists(updatedPlaylists);
  },

  addTrackToPlaylist: (playlistId, track) => {
    const playlists = get().userPlaylists.map(p => {
      if (p.id === playlistId) {
        return { ...p, tracks: [...p.tracks, track] };
      }
      return p;
    });
    set({ userPlaylists: playlists });
    get().savePlaylists(playlists);
  },

  deletePlaylist: (playlistId) => {
    const playlists = get().userPlaylists.filter(p => p.id !== playlistId);
    set({ userPlaylists: playlists });
    get().savePlaylists(playlists);
  },

  renamePlaylist: (playlistId, newName) => {
    const playlists = get().userPlaylists.map(p => 
      p.id === playlistId ? { ...p, name: newName } : p
    );
    set({ userPlaylists: playlists });
    get().savePlaylists(playlists);
  },

  togglePinPlaylist: (playlistId) => {
    const playlists = get().userPlaylists.map(p => 
      p.id === playlistId ? { ...p, pinned: !p.pinned } : p
    );
    // Sort pinned playlists first
    playlists.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    set({ userPlaylists: playlists });
    get().savePlaylists(playlists);
  },

  playQueue: (tracks, startIndex = 0) => {
    set({ queue: tracks });
    get().saveQueue(tracks);
    get().playTrack(startIndex);
  },

  playTrack: (index) => {
    const { queue, audioRef, ytPlayer } = get();
    if (index < 0 || index >= queue.length) return;

    if (audioRef) audioRef.pause();
    if (ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();

    set({ 
      currentTrackIndex: index, 
      isPlaying: true,
      progress: 0,
      duration: queue[index].duration || 0
    });

    const track = queue[index];
    if (track.type === 'local' && audioRef) {
      audioRef.src = track.url;
      audioRef.play().catch(e => console.error("Error playing local file:", e));
    } else if (track.type === 'youtube' && ytPlayer) {
      ytPlayer.loadVideoById(track.url);
      ytPlayer.playVideo();
    }
  },

  togglePlay: () => {
    const { isPlaying, currentTrackIndex, queue, audioRef, ytPlayer } = get();
    if (currentTrackIndex === -1 && queue.length > 0) {
      get().playTrack(0);
      return;
    }
    if (currentTrackIndex === -1) return;

    const track = queue[currentTrackIndex];
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
    const { currentTrackIndex, queue, isShuffle, isRepeat } = get();
    if (queue.length === 0) return;

    if (isShuffle) {
      const nextIndex = Math.floor(Math.random() * queue.length);
      get().playTrack(nextIndex);
    } else if (currentTrackIndex < queue.length - 1) {
      get().playTrack(currentTrackIndex + 1);
    } else if (isRepeat) {
      get().playTrack(0);
    }
  },

  prevTrack: () => {
    const { currentTrackIndex, queue, progress, isShuffle } = get();
    if (queue.length === 0) return;

    if (progress > 3) {
      get().seekTo(0);
    } else if (isShuffle) {
      const prevIndex = Math.floor(Math.random() * queue.length);
      get().playTrack(prevIndex);
    } else if (currentTrackIndex > 0) {
      get().playTrack(currentTrackIndex - 1);
    }
  },

  toggleShuffle: () => set({ isShuffle: !get().isShuffle }),
  toggleRepeat: () => set({ isRepeat: !get().isRepeat }),

  setVolume: (val) => {
    set({ volume: val });
    const { audioRef, ytPlayer } = get();
    if (audioRef) audioRef.volume = val / 100;
    if (ytPlayer && ytPlayer.setVolume) ytPlayer.setVolume(val);
  },

  seekTo: (seconds) => {
    const { currentTrackIndex, queue, audioRef, ytPlayer } = get();
    if (currentTrackIndex === -1) return;
    const track = queue[currentTrackIndex];
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
    const newQueue = [...get().queue];
    newQueue[index] = { ...newQueue[index], ...metadata };
    set({ queue: newQueue });
    get().saveQueue(newQueue);
  }
}));
