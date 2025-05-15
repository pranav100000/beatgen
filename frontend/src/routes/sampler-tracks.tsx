import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import Sidebar from '../platform/components/Sidebar'
import SamplerLibrary from '../platform/components/SamplerLibrary'
import { requireAuth } from '../platform/auth/auth-utils'

export const Route = createFileRoute('/sampler-tracks')({
  component: SamplerTracksPage,
  // Use requireAuth to protect this route
  ...requireAuth('/login'),
})

function SamplerTracksPage() {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Sampler Tracks</h1>
        <p className="text-muted-foreground mb-6">
          Browse and manage your sampler tracks. Create new instruments from audio samples or use existing ones in your projects.
        </p>
        
        {/* Sampler Library Component */}
        <div className="bg-card rounded-lg p-4 shadow-md">
          <SamplerLibrary />
        </div>
      </div>
    </div>
  )
}
