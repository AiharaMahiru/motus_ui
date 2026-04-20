/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, type ReactNode } from 'react'


export type InspectorTabId = 'session' | 'tracing' | 'runtime' | 'meta'

type LayoutContextType = {
  headerTitle: string
  setHeaderTitle: (title: string) => void
  activeInspectorTab: InspectorTabId
  setActiveInspectorTab: (tab: InspectorTabId) => void
}


const LayoutContext = createContext<LayoutContextType | undefined>(undefined)


export function LayoutProvider({ children }: { children: ReactNode }) {
  const [headerTitle, setHeaderTitle] = useState('Session Monitor')
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTabId>('session')

  return (
    <LayoutContext.Provider value={{ headerTitle, setHeaderTitle, activeInspectorTab, setActiveInspectorTab }}>
      {children}
    </LayoutContext.Provider>
  )
}


export function useLayout() {
  const context = useContext(LayoutContext)
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider')
  }
  return context
}
