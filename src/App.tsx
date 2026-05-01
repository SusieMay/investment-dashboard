import React, { useState, useEffect } from 'react'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'

const SESSION_KEY = 'investment_dashboard_auth'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)

  useEffect(() => {
    const auth = sessionStorage.getItem(SESSION_KEY)
    if (auth === 'true') {
      setIsAuthenticated(true)
    }
  }, [])

  const handleAuth = () => {
    sessionStorage.setItem(SESSION_KEY, 'true')
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY)
    setIsAuthenticated(false)
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {isAuthenticated ? (
        <Dashboard onLogout={handleLogout} />
      ) : (
        <Auth onSuccess={handleAuth} />
      )}
    </div>
  )
}

export default App
