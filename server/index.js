import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Spotify credentials
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || `http://127.0.0.1:${PORT}/callback`;

// ============================================
// ALMACENAMIENTO DE USUARIOS
// En producción usar Redis o PostgreSQL
// ============================================
const DB_FILE = './users.json';

function loadUsers() {
  if (existsSync(DB_FILE)) {
    try {
      return JSON.parse(readFileSync(DB_FILE, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

function saveUsers(users) {
  writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

// { odersponses: [userId]: { odersponses, refreshToken, tokenExpiry, spotifyId, displayName } }
let users = loadUsers();

// Generar ID único para usuario
function generateUserId() {
  return crypto.randomBytes(8).toString('hex');
}

// ============================================
// MIDDLEWARE
// ============================================

// Configurar orígenes permitidos
const allowedOrigins = [
  FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

// En producción, agregar el dominio de Netlify
if (process.env.NODE_ENV === 'production') {
  // Permitir cualquier subdominio de netlify.app
  allowedOrigins.push(/\.netlify\.app$/);
}

app.use(cors({
  origin: function(origin, callback) {
    // Permitir requests sin origin (como mobile apps o curl)
    if (!origin) return callback(null, true);
    
    // Verificar si el origin está permitido
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return allowed === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(null, true); // En producción, ser permisivo por ahora
    }
  },
  credentials: true
}));
app.use(express.json());

// ============================================
// ENDPOINTS
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', users: Object.keys(users).length });
});

// Iniciar flujo OAuth
app.get('/auth/login', (req, res) => {
  const scopes = ['user-read-currently-playing', 'user-read-playback-state'];
  const state = crypto.randomBytes(16).toString('hex');
  
  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.append('client_id', CLIENT_ID);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.append('scope', scopes.join(' '));
  authUrl.searchParams.append('state', state);
  
  res.redirect(authUrl.toString());
});

// Callback de Spotify
app.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    return res.redirect(`${FRONTEND_URL}?error=${error}`);
  }
  
  try {
    // Obtener tokens
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      return res.redirect(`${FRONTEND_URL}?error=${tokenData.error}`);
    }
    
    // Obtener info del usuario de Spotify
    const userResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const userData = await userResponse.json();
    
    // Buscar si el usuario ya existe (por spotifyId)
    let userId = Object.keys(users).find(id => users[id].spotifyId === userData.id);
    
    // Si no existe, crear nuevo usuario
    if (!userId) {
      userId = generateUserId();
    }
    
    // Guardar/actualizar usuario
    users[userId] = {
      odersponses: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiry: Date.now() + (tokenData.expires_in * 1000),
      spotifyId: userData.id,
      displayName: userData.display_name,
      avatar: userData.images?.[0]?.url || null,
      createdAt: users[userId]?.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    
    saveUsers(users);
    
    // Redirigir al dashboard con el userId
    res.redirect(`${FRONTEND_URL}/dashboard.html?userId=${userId}`);
    
  } catch (err) {
    console.error('Error en callback:', err);
    res.redirect(`${FRONTEND_URL}?error=server_error`);
  }
});

// Obtener info del usuario
app.get('/api/user/:userId', (req, res) => {
  const { userId } = req.params;
  const user = users[userId];
  
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  
  res.json({
    userId,
    displayName: user.displayName,
    avatar: user.avatar,
    createdAt: user.createdAt
  });
});

// Refresh token para un usuario
async function refreshUserToken(userId) {
  const user = users[userId];
  if (!user?.refreshToken) return false;
  
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: user.refreshToken
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      console.error('Error refreshing token:', data);
      return false;
    }
    
    users[userId].odersponses = data.access_token;
    users[userId].tokenExpiry = Date.now() + (data.expires_in * 1000);
    
    if (data.refresh_token) {
      users[userId].refreshToken = data.refresh_token;
    }
    
    saveUsers(users);
    return true;
  } catch (err) {
    console.error('Error refreshing token:', err);
    return false;
  }
}

// Obtener canción actual de un usuario
app.get('/api/now-playing/:userId', async (req, res) => {
  const { userId } = req.params;
  const user = users[userId];
  
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  
  // Refresh token si está por expirar (5 min antes)
  if (user.tokenExpiry && Date.now() > user.tokenExpiry - 300000) {
    await refreshUserToken(userId);
  }
  
  try {
    const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: {
        'Authorization': `Bearer ${users[userId].odersponses}`
      }
    });
    
    // 204 = no hay reproducción activa
    if (response.status === 204) {
      return res.json({ isPlaying: false, track: null });
    }
    
    if (!response.ok) {
      if (response.status === 401) {
        const refreshed = await refreshUserToken(userId);
        if (!refreshed) {
          return res.status(401).json({ error: 'Token expirado, necesita re-autenticar' });
        }
        // Reintentar
        return res.redirect(`/api/now-playing/${userId}`);
      }
      throw new Error(`Spotify API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    res.json({
      isPlaying: data.is_playing,
      track: data.item ? {
        id: data.item.id,
        name: data.item.name,
        artists: data.item.artists.map(a => a.name),
        album: data.item.album.name,
        albumArt: data.item.album.images[0]?.url,
        duration: data.item.duration_ms,
        progress: data.progress_ms,
        url: data.item.external_urls.spotify
      } : null
    });
  } catch (err) {
    console.error('Error fetching now playing:', err);
    res.status(500).json({ error: 'Error al obtener canción actual' });
  }
});

// Logout - eliminar usuario
app.delete('/api/user/:userId', (req, res) => {
  const { userId } = req.params;
  
  if (users[userId]) {
    delete users[userId];
    saveUsers(users);
  }
  
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`🎵 Spotify Overlay Server corriendo en http://localhost:${PORT}`);
  console.log(`🌐 Frontend URL: ${FRONTEND_URL}`);
  console.log(`👥 Usuarios registrados: ${Object.keys(users).length}`);
});
