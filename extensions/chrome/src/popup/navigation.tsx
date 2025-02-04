import { MessageSquare, Workflow, ArrowUpCircle } from "lucide-react"
import { useState, useEffect } from 'react'

export function Navigation() {
  const [currentView, setCurrentView] = useState(window.location.hash.slice(1) || 'workflow-view')

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentView(window.location.hash.slice(1) || 'workflow-view')
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])
  console.debug(currentView)
  return (
    <nav className="flex items-center justify-around p-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <button 
        className={`nav-button flex flex-col items-center w-24 ${currentView === 'workflow-view' ? 'active' : ''}`}
        onClick={() => window.location.hash = '#workflow-view'}
      >
        <Workflow className="h-5 w-5 mb-1" />
        <span>Workflow</span>
      </button>
      <button 
        className={`nav-button flex flex-col items-center w-24 ${currentView === 'chat-view' ? 'active' : ''}`}
        onClick={() => window.location.hash = '#chat-view'}
      >
        <MessageSquare className="h-5 w-5 mb-1" />
        <span>Chat</span>
      </button>
      <button 
        className={`nav-button flex flex-col items-center w-24`}
        onClick={() => window.open('https://browseragent.dev/upgrade', '_blank')}
      >
        <ArrowUpCircle className="h-5 w-5 mb-1" />
        <span>Upgrade</span>
      </button>
    </nav>
  )
}

