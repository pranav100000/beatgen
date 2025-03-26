import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import MidiPlayerTestPage from '../studio/pages/MidiPlayerTest'

// MIDI Player Test route - this will render at the path '/midi-test'
export const Route = createFileRoute('/midi-test')({
  component: MidiTestPage,
})

function MidiTestPage() {
  return <MidiPlayerTestPage />
}