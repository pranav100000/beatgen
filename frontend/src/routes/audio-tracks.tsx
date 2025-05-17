import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import Sidebar from '../platform/components/Sidebar'
import SoundLibrary from '../platform/components/SoundLibrary'
import { requireAuth } from '../platform/auth/auth-utils'
import { Container } from '@mui/material'
import { logoColors } from '../platform/components/Sidebar'

export const Route = createFileRoute('/audio-tracks')({
  component: AudioTracksPage,
  // Use requireAuth to protect this route
  ...requireAuth('/login'),
})

function AudioTracksPage() {
  const audioTracksColor = logoColors[2]

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main content */}
      <div className="flex-1 overflow-auto p-8">
        <Container maxWidth="lg" sx={{ pt: 0, mt: 0 }}>
          <h1 
            className="text-3xl font-bold mb-6"
            style={{ 
              color: audioTracksColor, 
            }}
          >
            Audio Tracks
          </h1>
          <p className="text-muted-foreground mb-6">
            Manage your audio tracks and samples. Upload new audio files or use existing tracks in your projects.
          </p>
          
          {/* Sound Library Component */}
          <div className="bg-card rounded-lg p-4 shadow-md">
            <SoundLibrary sectionColor={audioTracksColor} />
          </div>
        </Container>
      </div>
    </div>
  )
}
