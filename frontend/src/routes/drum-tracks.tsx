import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import Sidebar from '../platform/components/Sidebar'
import DrumLibrary from '../platform/components/DrumLibrary'
import { requireAuth } from '../platform/auth/auth-utils'

export const Route = createFileRoute('/drum-tracks')({
  component: DrumTracksPage,
  // Use requireAuth to protect this route
  ...requireAuth('/login'),
})

function DrumTracksPage() {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Drum Tracks</h1>
        <p className="text-muted-foreground mb-6">
          Browse and manage your drum tracks, kits, and patterns. Create rhythms or use existing drum tracks in your projects.
        </p>
        
        {/* Drum Library Component */}
        <div className="bg-card rounded-lg p-4 shadow-md">
          <DrumLibrary />
        </div>
      </div>
    </div>
  )
}
