import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import Sidebar from '../platform/components/Sidebar'
import DrumLibrary from '../platform/components/DrumLibrary'
import { requireAuth } from '../platform/auth/auth-utils'
import { Container } from '@mui/material'

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
      <div className="flex-1 overflow-auto p-8">
        <Container maxWidth="lg" sx={{ pt: 0, mt: 0 }}>
          <h1 className="text-3xl font-bold mb-6">Drum Tracks</h1>
          <p className="text-muted-foreground mb-6">
            Manage your drum tracks and kits. Create new drum patterns or use existing drum kits.
          </p>
          
          {/* Drum Library Component */}
          <div className="bg-card rounded-lg p-4 shadow-md">
            <DrumLibrary />
          </div>
        </Container>
      </div>
    </div>
  )
}
