import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import SimpleMidiTestComponent from '../studio/components/SimpleMidiTestComponent'

// Simple MIDI Test route - this will render at the path '/simple-midi-test'
export const Route = createFileRoute('/simple-midi-test')({
  component: SimpleMidiTestPage,
})

function SimpleMidiTestPage() {
  return (
    <div style={{ backgroundColor: '#121212', minHeight: '100vh', color: 'white' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px' 
        }}>
          <h1>Simple SoundfontMidiPlayer Test</h1>
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
        
        <SimpleMidiTestComponent />
      </div>
    </div>
  )
}