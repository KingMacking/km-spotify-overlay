// ============================================
// OVERLAY - Main JavaScript
// ============================================

// Detectar entorno
const isProduction = window.location.hostname !== 'localhost' && 
                     window.location.hostname !== '127.0.0.1';
const API_URL = isProduction 
  ? 'https://km-spotify-overlay.onrender.com' 
  : 'http://127.0.0.1:3000';
const POLL_INTERVAL = 3000;
const PROGRESS_UPDATE_INTERVAL = 100;

// Leer query params
const params = new URLSearchParams(window.location.search);
const userId = params.get('userId');

const CONFIG = {
  simplified: params.get('simplified') === '1',
  customLabel: params.get('label') || '',
  showAlbum: params.get('album') !== '0',
  showProgress: params.get('progress') !== '0',
  showArtist: params.get('artist') !== '0',
  showLogo: params.get('logo') !== '0',
  showIndicator: params.get('indicator') !== '0',
  position: params.get('position') || 'bottom-left',
  size: params.get('size') || 'medium',
};

// Elementos
const app = document.getElementById('app');
const overlay = document.getElementById('overlay');
const errorState = document.getElementById('error-state');
const albumImg = document.getElementById('album-img');
const trackNameEl = document.getElementById('track-name');
const artistNameEl = document.getElementById('artist-name');
const progressBar = document.getElementById('progress-bar');
const customLabel = document.getElementById('custom-label');

// Estado
let state = {
  currentTrackId: null,
  isPlaying: false,
  progress: 0,
  duration: 0,
  lastUpdate: Date.now(),
};

let progressInterval = null;

// ============================================
// CONFIG FUNCTIONS
// ============================================

function applyConfig() {
  // Modo simplificado
  if (CONFIG.simplified) {
    overlay.classList.add('simplified');
    app.className = 'position-bottom-left';
    return;
  }

  // Posición
  app.className = `position-${CONFIG.position}`;

  // Tamaño
  if (CONFIG.size !== 'medium') {
    overlay.classList.add(`size-${CONFIG.size}`);
  }

  // Visibilidad
  if (!CONFIG.showAlbum) overlay.classList.add('hide-album');
  if (!CONFIG.showProgress) overlay.classList.add('hide-progress');
  if (!CONFIG.showArtist) overlay.classList.add('hide-artist');
  if (!CONFIG.showLogo) overlay.classList.add('hide-logo');
  if (!CONFIG.showIndicator) overlay.classList.add('hide-indicator');
  
  // Custom label
  customLabel.textContent = CONFIG.customLabel;
}

// Verificar y aplicar marquee si el texto excede 280px
function checkMarquee() {
  if (!CONFIG.simplified) return;
  
  const container = document.querySelector('.simplified-content');
  if (!container) return;
  
  const textWidth = container.scrollWidth;
  if (textWidth > 280) {
    container.classList.add('marquee');
    // Duplicar contenido para efecto continuo
    const text = container.innerHTML;
    container.innerHTML = `<span>${text}</span><span>${text}</span>`;
  }
}

// ============================================
// PROGRESS BAR
// ============================================

function updateProgressBar() {
  if (state.duration > 0 && state.isPlaying) {
    const elapsed = Date.now() - state.lastUpdate;
    const currentProgress = Math.min(state.progress + elapsed, state.duration);
    const percent = (currentProgress / state.duration) * 100;
    progressBar.style.width = `${percent}%`;
  }
}

// ============================================
// DISPLAY FUNCTIONS
// ============================================

function showError(message) {
  overlay.classList.add('hidden');
  errorState.classList.remove('hidden');
  errorState.innerHTML = message;
}

function showOverlay(track, isPlaying) {
  errorState.classList.add('hidden');
  overlay.classList.remove('hidden');
  overlay.classList.toggle('paused', !isPlaying);

  if (track.id !== state.currentTrackId) {
    state.currentTrackId = track.id;
    
    if (CONFIG.simplified) {
      // Modo simplificado: texto en línea con marquee
      const simplifiedContent = document.querySelector('.simplified-content');
      if (simplifiedContent) {
        const displayText = `${track.name} • ${track.artists.join(', ')}`;
        simplifiedContent.innerHTML = displayText;
        simplifiedContent.classList.remove('marquee');
        
        // Verificar si necesita marquee
        requestAnimationFrame(() => {
          const textWidth = simplifiedContent.scrollWidth;
          if (textWidth > 280) {
            simplifiedContent.classList.add('marquee');
            simplifiedContent.innerHTML = `<span>${displayText}</span><span>${displayText}</span>`;
          }
        });
      }
    } else {
      albumImg.src = track.albumArt || '';
      trackNameEl.textContent = track.name;
      artistNameEl.textContent = track.artists.join(', ');
    }

    overlay.classList.remove('fade-in');
    void overlay.offsetWidth;
    overlay.classList.add('fade-in');
  }

  state.isPlaying = isPlaying;
  state.progress = track.progress;
  state.duration = track.duration;
  state.lastUpdate = Date.now();

  const percent = (state.progress / state.duration) * 100;
  progressBar.style.width = `${percent}%`;
}

function hideOverlay() {
  overlay.classList.add('hidden');
  errorState.classList.add('hidden');
  state.currentTrackId = null;
  state.isPlaying = false;
}

// ============================================
// API FUNCTIONS
// ============================================

async function fetchNowPlaying() {
  if (!userId) {
    showError('userId no especificado');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/now-playing/${userId}`);
    const data = await res.json();

    if (data.error) {
      if (res.status === 404) {
        showError('Usuario no encontrado. <a href="/">Configura tu overlay</a>');
      } else if (res.status === 401) {
        showError('Sesión expirada. <a href="/">Reconectar</a>');
      } else {
        showError(data.error);
      }
      return;
    }

    if (!data.track) {
      hideOverlay();
      return;
    }

    showOverlay(data.track, data.isPlaying);

  } catch (err) {
    console.error('Error:', err);
    showError('Error de conexión');
  }
}

// ============================================
// INIT
// ============================================

function init() {
  applyConfig();
  fetchNowPlaying();
  setInterval(fetchNowPlaying, POLL_INTERVAL);
  progressInterval = setInterval(updateProgressBar, PROGRESS_UPDATE_INTERVAL);
}

init();
