import * as React from "react"

export interface FormPersistenceOptions {
  key: string
  debounceMs?: number
  autoSave?: boolean
  clearOnSubmit?: boolean
}

export function useFormPersistence<T extends Record<string, any>>(
  initialData: T,
  options: FormPersistenceOptions
) {
  const { key, debounceMs = 1000, autoSave = true, clearOnSubmit = true } = options
  
  const [data, setData] = React.useState<T>(() => {
    if (typeof window === 'undefined') return initialData
    
    try {
      const saved = localStorage.getItem(`form_${key}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Merge with initial data to handle new fields
        return { ...initialData, ...parsed }
      }
    } catch (error) {
      console.warn('Failed to load saved form data:', error)
    }
    
    return initialData
  })

  const [isDirty, setIsDirty] = React.useState(false)
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null)
  const saveTimeoutRef = React.useRef<NodeJS.Timeout>()

  // Save to localStorage
  const saveToStorage = React.useCallback((formData: T) => {
    try {
      localStorage.setItem(`form_${key}`, JSON.stringify(formData))
      setLastSaved(new Date())
      setIsDirty(false)
    } catch (error) {
      console.warn('Failed to save form data:', error)
    }
  }, [key])

  // Debounced save function
  const debouncedSave = React.useCallback((formData: T) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveToStorage(formData)
    }, debounceMs)
  }, [saveToStorage, debounceMs])

  // Update form data
  const updateData = React.useCallback((updates: Partial<T> | ((prev: T) => T)) => {
    setData(prev => {
      const newData = typeof updates === 'function' ? updates(prev) : { ...prev, ...updates }
      
      setIsDirty(true)
      
      if (autoSave) {
        debouncedSave(newData)
      }
      
      return newData
    })
  }, [autoSave, debouncedSave])

  // Manual save function
  const save = React.useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveToStorage(data)
  }, [data, saveToStorage])

  // Clear saved data
  const clear = React.useCallback(() => {
    try {
      localStorage.removeItem(`form_${key}`)
      setData(initialData)
      setIsDirty(false)
      setLastSaved(null)
    } catch (error) {
      console.warn('Failed to clear form data:', error)
    }
  }, [key, initialData])

  // Reset to initial data without clearing storage
  const reset = React.useCallback(() => {
    setData(initialData)
    setIsDirty(false)
  }, [initialData])

  // Handle form submission
  const handleSubmit = React.useCallback(() => {
    if (clearOnSubmit) {
      clear()
    } else {
      save()
    }
  }, [clearOnSubmit, clear, save])

  // Handle browser navigation (back button)
  React.useEffect(() => {
    const handleBeforeUnload = (_e: BeforeUnloadEvent) => {
      if (isDirty && autoSave) {
        // Save immediately before page unload
        saveToStorage(data)
      }
    }

    const handlePopState = () => {
      // Save when user navigates back
      if (isDirty && autoSave) {
        saveToStorage(data)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState)
      
      // Clear timeout on cleanup
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [isDirty, autoSave, data, saveToStorage])

  // Handle page visibility change (mobile app switching)
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isDirty && autoSave) {
        // Save when page becomes hidden (user switches apps)
        saveToStorage(data)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isDirty, autoSave, data, saveToStorage])

  return {
    data,
    updateData,
    save,
    clear,
    reset,
    handleSubmit,
    isDirty,
    lastSaved,
    hasSavedData: lastSaved !== null
  }
}