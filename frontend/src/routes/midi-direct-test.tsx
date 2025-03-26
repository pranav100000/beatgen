import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import MidiPlayerDirectTestComponent from '../studio/components/MidiPlayerDirectTestComponent'

// MidiPlayer Direct Test route - this will render at the path '/midi-direct-test'
export const Route = createFileRoute('/midi-direct-test')({
  component: MidiDirectTestPage,
})

function MidiDirectTestPage() {
  return (
    <div style={{ backgroundColor: '#121212', minHeight: '100vh', color: 'white' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px' 
        }}>
          <h1>MidiPlayer Direct Test</h1>
          <a 
            href="/studio" 
            style={{
              padding: '8px 16px',
              backgroundColor: '#3f51b5',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px'
            }}
          >
            Back to Studio
          </a>
        </div>
        
        <MidiPlayerDirectTestComponent />
      </div>
    </div>
  )
}