# Authentication System

This directory contains the authentication system for the BeatGen application.

## Components

- `auth-context.tsx`: Authentication context provider and hook for accessing auth state
- `auth-utils.tsx`: Utility functions for route protection and authentication checks

## Route Protection

The authentication system provides two main utilities for protecting routes:

```tsx
import { requireAuth, AuthErrorComponent } from '../platform/auth/auth-utils.tsx'

// For protected routes (requires authentication)
export const Route = createFileRoute('/dashboard')({
  ...requireAuth('/login'),
  component: Dashboard,
  errorComponent: AuthErrorComponent,
})

// For public routes (redirects if already authenticated)
import { publicRoute } from '../platform/auth/auth-utils.tsx'

export const Route = createFileRoute('/login')({
  component: LoginPage,
  ...publicRoute('/home'),
})
```

## Accessing Auth Data

To access authentication state and methods in your components:

```tsx
import { useAuth } from '../platform/auth/auth-context'

function Profile() {
  const { user, profile, signOut } = useAuth()
  
  if (!user) return <p>Loading...</p>
  
  return (
    <div>
      <h1>Welcome, {profile?.display_name || user.email}</h1>
      <button onClick={signOut}>Sign Out</button>
    </div>
  )
}
```

## Implementation Details

- **Auth Context**: Manages authentication state, login/logout, profile data
- **Auth Utils**: Provides route guards and error handling for protected routes
- **State Storage**: Currently uses localStorage for token storage

## Security Notes

For production environments:

1. Replace localStorage with HTTP-only cookies for better security
2. Implement CSRF protection
3. Add token refresh logic
4. Consider adding session timeout and inactivity detection