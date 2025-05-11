import { createFileRoute } from '@tanstack/react-router';
import SettingsPage from '../platform/pages/SettingsPage';

export const Route = createFileRoute('/settings')({
  component: SettingsComponent,
});

function SettingsComponent() {
  return <SettingsPage />;
} 