import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../lib/api'

const SemesterContext = createContext(null)

export function SemesterProvider({ children }) {
  const [semesters, setSemesters] = useState([])
  const [activeSemesterId, setActiveSemesterIdState] = useState(
    () => localStorage.getItem('gos_active_semester') || null
  )
  const [loading, setLoading] = useState(false)

  const fetchSemesters = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/semesters')
      setSemesters(data)
      // If saved semester no longer exists, clear it
      if (activeSemesterId && !data.find(s => s._id === activeSemesterId)) {
        setActiveSemesterIdState(null)
        localStorage.removeItem('gos_active_semester')
      }
    } catch (e) {
      // not logged in yet, silently skip
    } finally {
      setLoading(false)
    }
  }, [activeSemesterId])

  useEffect(() => { fetchSemesters() }, [])

  const setActiveSemester = (id) => {
    setActiveSemesterIdState(id)
    if (id) localStorage.setItem('gos_active_semester', id)
    else localStorage.removeItem('gos_active_semester')
  }

  const createSemester = async (name, label) => {
    const { data } = await api.post('/semesters', { name, label })
    setSemesters(prev => [...prev, data])
    return data
  }

  return (
    <SemesterContext.Provider value={{ semesters, activeSemesterId, setActiveSemester, createSemester, fetchSemesters, loading }}>
      {children}
    </SemesterContext.Provider>
  )
}

export function useSemester() {
  const ctx = useContext(SemesterContext)
  if (!ctx) throw new Error('useSemester must be used inside SemesterProvider')
  return ctx
}
