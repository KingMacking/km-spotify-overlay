// ============================================
// DASHBOARD - Main JavaScript
// ============================================

// Detectar entorno
const isProduction = window.location.hostname !== 'localhost' && 
                     window.location.hostname !== '127.0.0.1';
const API_URL = isProduction 
  ? 'https://km-spotify-overlay.onrender.com' 
  : 'http://127.0.0.1:3000';

// Obtener userId de la URL
const params = new URLSearchParams(window.location.search);
const userId = params.get('userId');

// Elementos
const loadingState = document.getElementById('loadingState');
const dashboardContent = document.getElementById('dashboardContent');
const toast = document.getElementById('toast');

// Si no hay userId, redirigir al login
if (!userId) {
  window.location.href = '/';
}

// Opciones
const options = {
  simplified: document.getElementById('simplified'),
  customLabel: document.getElementById('customLabel'),
  showAlbum: document.getElementById('showAlbum'),
  showProgress: document.getElementById('showProgress'),
  showArtist: document.getElementById('showArtist'),
  showLogo: document.getElementById('showLogo'),
  showIndicator: document.getElementById('showIndicator'),
  position: document.getElementById('position'),
  size: document.getElementById('size'),
};

const elementsGroup = document.getElementById('elementsGroup');

// ============================================
// URL GENERATION
// ============================================

function generateOverlayUrl() {
  const base = `${window.location.origin}/overlay.html?userId=${userId}`;
  const params = new URLSearchParams();
  
  if (options.simplified.checked) {
    params.set('simplified', '1');
  } else {
    if (options.customLabel.value.trim()) params.set('label', options.customLabel.value.trim());
    if (!options.showAlbum.checked) params.set('album', '0');
    if (!options.showProgress.checked) params.set('progress', '0');
    if (!options.showArtist.checked) params.set('artist', '0');
    if (!options.showLogo.checked) params.set('logo', '0');
    if (!options.showIndicator.checked) params.set('indicator', '0');
    if (options.position.value !== 'bottom-left') params.set('position', options.position.value);
    if (options.size.value !== 'medium') params.set('size', options.size.value);
  }

  const queryString = params.toString();
  return queryString ? `${base}&${queryString}` : base;
}

// Manejar toggle de modo simplificado
function handleSimplifiedToggle() {
  const isSimplified = options.simplified.checked;
  elementsGroup.classList.toggle('disabled-group', isSimplified);
  
  // Deshabilitar/habilitar controles
  const inputs = elementsGroup.querySelectorAll('input, select');
  inputs.forEach(input => input.disabled = isSimplified);
}

function updateUrl() {
  document.getElementById('overlayUrl').value = generateOverlayUrl();
}

// ============================================
// PREVIEW FUNCTIONS
// ============================================

function updatePreview() {
  const container = document.getElementById('nowPlayingPreview');
  const overlay = container.querySelector('.preview-overlay');
  
  // Actualizar posición del contenedor
  container.className = 'now-playing-preview';
  container.classList.add(`pos-${options.position.value}`);
  
  // Si hay un overlay visible, actualizar sus clases
  if (overlay) {
    // Modo simplificado
    overlay.classList.toggle('simplified', options.simplified.checked);
    
    if (options.simplified.checked) {
      overlay.classList.add('hide-album', 'hide-progress', 'hide-logo', 'hide-indicator');
      overlay.classList.remove('hide-artist');
    } else {
      // Reset size classes
      overlay.classList.remove('size-small', 'size-medium', 'size-large');
      overlay.classList.add(`size-${options.size.value}`);
      
      // Toggle visibility classes
      overlay.classList.toggle('hide-album', !options.showAlbum.checked);
      overlay.classList.toggle('hide-progress', !options.showProgress.checked);
      overlay.classList.toggle('hide-artist', !options.showArtist.checked);
      overlay.classList.toggle('hide-logo', !options.showLogo.checked);
      overlay.classList.toggle('hide-indicator', !options.showIndicator.checked);
    }
    
    // Custom label
    const labelEl = overlay.querySelector('.preview-label');
    if (labelEl) {
      labelEl.textContent = options.simplified.checked ? '' : options.customLabel.value.trim();
    }
  }
  
  // Actualizar estado del grupo de elementos
  handleSimplifiedToggle();
}

// ============================================
// NOW PLAYING
// ============================================

async function loadNowPlaying() {
  try {
    const res = await fetch(`${API_URL}/api/now-playing/${userId}`);
    const data = await res.json();
    
    const container = document.getElementById('nowPlayingPreview');
    
    if (!data.track) {
      container.innerHTML = '<p class="not-playing-msg">No hay música reproduciéndose</p>';
      updatePreview();
      return;
    }

    const track = data.track;
    const progress = (track.progress / track.duration) * 100;
    const simplifiedText = `${track.name} • ${track.artists.join(', ')}`;
    
    container.innerHTML = `
      <div class="preview-overlay" data-simplified-text="${simplifiedText}">
        <div class="preview-album">
          <img src="${track.albumArt}" alt="Album">
          ${data.isPlaying ? `
            <div class="preview-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          ` : ''}
        </div>
        <div class="preview-info">
          <div class="preview-label"></div>
          <div class="preview-track">${track.name}</div>
          <div class="preview-artist">${track.artists.join(', ')}</div>
          <div class="preview-progress">
            <div class="preview-progress-bar" style="width: ${progress}%"></div>
          </div>
        </div>
        <svg class="preview-logo" viewBox="0 0 24 24" fill="#1DB954">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
      </div>
    `;
    
    // Aplicar configuración actual a la preview
    updatePreview();
  } catch (err) {
    console.error('Error loading now playing:', err);
  }
}

// ============================================
// USER FUNCTIONS
// ============================================

async function loadUser() {
  try {
    const res = await fetch(`${API_URL}/api/user/${userId}`);
    if (!res.ok) throw new Error('Usuario no encontrado');
    
    const user = await res.json();
    
    // Mostrar info del usuario
    document.getElementById('userName').textContent = user.displayName;
    document.getElementById('welcomeName').textContent = user.displayName.split(' ')[0];
    
    const avatarEl = document.getElementById('userAvatar');
    if (user.avatar) {
      avatarEl.innerHTML = `<img src="${user.avatar}" alt="Avatar">`;
    } else {
      avatarEl.textContent = user.displayName.charAt(0).toUpperCase();
    }

    // Mostrar dashboard
    loadingState.classList.add('hidden');
    dashboardContent.classList.remove('hidden');
    
    // Generar URL inicial
    updateUrl();
    
    // Cargar now playing
    loadNowPlaying();
    setInterval(loadNowPlaying, 5000);
    
  } catch (err) {
    console.error(err);
    window.location.href = '/?error=session_expired';
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

// Event listeners para opciones
Object.values(options).forEach(el => {
  if (el) {
    el.addEventListener('change', () => {
      updateUrl();
      updatePreview();
    });
  }
});

// Event listener adicional para input de texto (actualiza mientras escribe)
options.customLabel.addEventListener('input', () => {
  updateUrl();
  updatePreview();
});

// Copiar URL
document.getElementById('copyBtn').addEventListener('click', async () => {
  const url = document.getElementById('overlayUrl').value;
  await navigator.clipboard.writeText(url);
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
});

// Preview
document.getElementById('previewBtn').addEventListener('click', () => {
  window.open(generateOverlayUrl(), '_blank', 'width=450,height=200');
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch(`${API_URL}/api/user/${userId}`, { method: 'DELETE' });
  window.location.href = '/';
});

// ============================================
// INIT
// ============================================

loadUser();
