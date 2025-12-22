# KM Spotify Overlay

## Descripción del Proyecto

Aplicación de overlay para streams que muestra en tiempo real la canción que se está reproduciendo en Spotify. Diseñado para integrarse con software de streaming como OBS. **Sistema multi-usuario** donde cada persona puede conectar su cuenta y obtener su URL personalizada.

## Stack Tecnológico

### Package Manager
- **pnpm** - Gestor de paquetes

### Frontend (`/client`)
- **Vite** - Build tool y dev server
- **JavaScript Vanilla** - Sin frameworks
- Puerto de desarrollo: `5173`

### Backend (`/server`)
- **Express.js** - Framework HTTP
- **cors** - Middleware para CORS
- **dotenv** - Variables de entorno
- Puerto: `3000`

## Estructura del Proyecto

```
km-spotify-overlay/
├── client/
│   ├── index.html        # Landing page (login)
│   ├── dashboard.html    # Panel de configuración (post-login)
│   ├── overlay.html      # Widget para OBS
│   ├── config.html       # Configurador standalone (legacy)
│   └── src/
│       ├── main.js       # Lógica del overlay (legacy)
│       └── style.css     # Estilos del overlay
├── server/
│   ├── index.js          # API y OAuth
│   ├── users.json        # Almacenamiento de usuarios (dev)
│   ├── .env              # Variables de entorno
│   └── .env.example      # Template de variables
└── agents.md
```

## Flujo de la Aplicación

```
Usuario → Landing (/) → Login Spotify → Callback → Dashboard (/dashboard.html?userId=xxx)
                                                          ↓
                                              Configura overlay
                                                          ↓
                                              Copia URL → OBS
                                                          ↓
                                    /overlay.html?userId=xxx&opciones
```

## Spotify API

### Configuración
1. Crear app en [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Seleccionar "Web API"
3. Agregar Redirect URI: `http://127.0.0.1:3000/callback` (dev) o tu URL de producción
4. Copiar Client ID y Client Secret

### Scopes requeridos
- `user-read-currently-playing`
- `user-read-playback-state`

## Variables de Entorno

Crear archivo `.env` en `/server`:
```env
SPOTIFY_CLIENT_ID=tu_client_id
SPOTIFY_CLIENT_SECRET=tu_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/callback
FRONTEND_URL=http://localhost:5173
PORT=3000
```

## Endpoints del Backend

```
GET  /health                    - Health check
GET  /auth/login                - Inicia OAuth de Spotify
GET  /callback                  - Callback OAuth (redirige a dashboard)
GET  /api/user/:userId          - Info del usuario
GET  /api/now-playing/:userId   - Canción actual del usuario
DELETE /api/user/:userId        - Eliminar usuario (logout)
```

## Query Params del Overlay

```
userId      - (requerido) ID del usuario
simplified  - 1 para modo simplificado (solo canción • artista)
album       - 0 para ocultar carátula
progress    - 0 para ocultar barra
artist      - 0 para ocultar artista
logo        - 0 para ocultar logo Spotify
indicator   - 0 para ocultar barras animadas
position    - bottom-left, bottom-right, top-left, top-right, center
size        - small, medium, large
```

**Ejemplo:**
```
/overlay.html?userId=abc123&progress=0&position=top-right&size=small
```

**Modo Simplificado:**
```
/overlay.html?userId=abc123&simplified=1
```
El modo simplificado muestra solo "Canción • Artista" en una línea con efecto marquee si supera 280px.

## Scripts

### Client
```bash
cd client
pnpm dev      # Desarrollo
pnpm build    # Build producción
pnpm preview  # Preview build
```

### Server
```bash
cd server
pnpm start    # Producción
pnpm dev      # Desarrollo (watch mode)
```

## Deploy

### Opción 1: Railway (Backend) + Vercel (Frontend)

**Backend (Railway):**
1. Conectar repo a Railway
2. Configurar variables de entorno
3. Deploy automático

**Frontend (Vercel):**
1. Conectar repo, seleccionar `/client` como root
2. Actualizar `API_URL` en los HTML al URL de Railway
3. Deploy

### Opción 2: Todo en Railway/Render
Servir frontend como estáticos desde Express.

## Notas

- El overlay tiene fondo transparente para OBS (Browser Source)
- Los tokens se refrescan automáticamente
- En producción usar Redis/PostgreSQL en vez de `users.json`
- Polling cada 3 segundos para la canción actual
