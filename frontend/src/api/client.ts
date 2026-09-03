import axios, { type AxiosRequestConfig } from 'axios'

const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

export const api = axios.create({
  baseURL: '/api',
})

// Instance dédiée à /auth/refresh : passer par `api` bouclerait sur son propre
// intercepteur de réponse (le refresh renverrait lui aussi un 401 en cas
// d'échec, ce qui redéclencherait un refresh — boucle infinie).
const refreshClient = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY)

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem('user_role')
  localStorage.removeItem('user_name')
  localStorage.removeItem('user_email')
  localStorage.removeItem('user_id')
}

function redirectToLogin() {
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

/**
 * Promesse de rafraîchissement en cours, partagée par tous les appels — si
 * plusieurs requêtes essuient un 401 en même temps, un seul appel
 * `/auth/refresh` part, et toutes attendent son résultat (sinon un
 * refresh_token à usage unique côté backend serait consommé par la première
 * requête et invaliderait les suivantes).
 */
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
  if (!refreshToken) return null

  try {
    const { data } = await refreshClient.post<{ access_token: string }>('/auth/refresh', {
      refresh_token: refreshToken,
    })
    localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token)
    return data.access_token
  } catch {
    return null
  }
}

function refreshAccessTokenSingleFlight(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined

    // Le refresh lui-même échoue en 401 quand le refresh_token est expiré —
    // pas de nouvelle tentative dans ce cas, ni sur /auth/login (identifiants
    // refusés, pas un jeton expiré).
    const isAuthEndpoint = config?.url === '/auth/refresh' || config?.url === '/auth/login'

    if (err.response?.status === 401 && config && !config._retry && !isAuthEndpoint) {
      config._retry = true

      const newToken = await refreshAccessTokenSingleFlight()
      if (newToken) {
        config.headers = { ...config.headers, Authorization: `Bearer ${newToken}` }
        return api(config)
      }

      // Refresh impossible (absent, expiré, révoqué) : la session est
      // terminée, on ne laisse pas l'utilisateur face à des écrans qui
      // échouent silencieusement un par un.
      clearSession()
      redirectToLogin()
    }

    return Promise.reject(err)
  },
)
