import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import SettingsPage from '../platform/pages/SettingsPage';
import { requireAuth } from '../platform/auth/auth-utils'

export const Route = createFileRoute('/settings')({
  component: SettingsComponent,

  ...requireAuth('/login'),
});

function SettingsComponent() {
  return <SettingsPage />;
} 