// ============================================
// CONFIG - Environment Configuration
// ============================================

// Detectar si estamos en producción
const isProduction = window.location.hostname !== 'localhost' && 
                     window.location.hostname !== '127.0.0.1';

// URLs del API
// IMPORTANTE: Cambiar esta URL cuando despliegues el backend a Railway
const PRODUCTION_API_URL = 'https://tu-app.railway.app'; // <-- Actualizar después del deploy

export const API_URL = isProduction 
  ? PRODUCTION_API_URL 
  : 'http://127.0.0.1:3000';

export const config = {
  apiUrl: API_URL,
  isProduction,
};
