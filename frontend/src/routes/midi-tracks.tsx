import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import Sidebar from '../platform/components/Sidebar'
import MidiLibrary from '../platform/components/MidiLibrary'
import { requireAuth } from '../platform/auth/auth-utils'

export const Route = createFileRoute('/midi-tracks')({
  component: MidiTracksPage,
  // Use requireAuth to protect this route
  ...requireAuth('/login'),
})

function MidiTracksPage() {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        <h1 className="text-3xl font-bold mb-6">MIDI Tracks</h1>
        <p className="text-muted-foreground mb-6">
          Browse and manage your MIDI tracks. Create new compositions or use existing MIDI tracks in your projects.
        </p>
        
        {/* MIDI Library Component */}
        <div className="bg-card rounded-lg p-4 shadow-md">
          <MidiLibrary />
        </div>
      </div>
    </div>
  )
}
