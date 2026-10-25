import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../api/axios.js'
import AuthContext from './AuthContext.jsx'

const TOKEN_KEY = 'hcm_token'

function getRequestErrorMessage(error) {
  return error.response?.data?.message || error.message || 'Unable to connect to the server.'
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => window.localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(null)
  const [setupComplete, setSetupComplete] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [bootstrapError, setBootstrapError] = useState('')

  const loadInitialState = useCallback(async () => {
    try {
      const { data: status } = await api.get('/api/setup/status')
      setSetupComplete(status.setupComplete)

      const savedToken = window.localStorage.getItem(TOKEN_KEY)
      setToken(savedToken)

      if (status.setupComplete && savedToken) {
        try {
          const { data } = await api.get('/api/auth/me')
          setUser(data.user)
        } catch (error) {
          if (error.response?.status !== 401) {
            throw error
          }
          window.localStorage.removeItem(TOKEN_KEY)
          setToken(null)
          setUser(null)
        }
      } else {
        if (!status.setupComplete && savedToken) {
          window.localStorage.removeItem(TOKEN_KEY)
          setToken(null)
        }
        setUser(null)
      }

      setBootstrapError('')
    } catch (error) {
      setBootstrapError(getRequestErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    Promise.resolve().then(() => {
      if (isMounted) {
        return loadInitialState()
      }
      return undefined
    })

    return () => {
      isMounted = false
    }
  }, [loadInitialState])

  const retryBootstrap = useCallback(() => {
    setIsLoading(true)
    setBootstrapError('')
    return loadInitialState()
  }, [loadInitialState])

  const login = useCallback(async (credentials) => {
    const { data } = await api.post('/api/auth/login', credentials)
    window.localStorage.setItem(TOKEN_KEY, data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const completeSetup = useCallback(async () => {
    const { data } = await api.get('/api/setup/status')
    setSetupComplete(data.setupComplete)
  }, [])

  const changePassword = useCallback(async (passwords) => {
    const { data } = await api.post('/api/auth/change-password', passwords)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      token,
      user,
      setupComplete,
      isLoading,
      bootstrapError,
      login,
      logout,
      changePassword,
      completeSetup,
      retryBootstrap,
    }),
    [
      token,
      user,
      setupComplete,
      isLoading,
      bootstrapError,
      login,
      logout,
      changePassword,
      completeSetup,
      retryBootstrap,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
