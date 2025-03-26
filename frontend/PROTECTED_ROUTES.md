# Protected Routes with TanStack Router

This document outlines the implementation of protected routes in our BeatGen application using TanStack Router.

## Implementation Approach

We use a simple, declarative approach to protected routes:

```tsx
import { requireAuth, AuthErrorComponent } from '../platform/auth/auth-utils.tsx'

export const Route = createFileRoute('/protected-path')({
  // Add authentication protection
  ...requireAuth('/login'),
  
  // Component to render when authenticated
  component: ProtectedComponent,
  
  // Error component for authentication failures
  errorComponent: AuthErrorComponent,
})
```

## Key Concepts

### Route Protection

- **requireAuth()**: Protects routes that require authentication
  - Checks for an auth token and redirects unauthenticated users
  - Used in route definition with the spread operator
  - Example: `...requireAuth('/login')`

### Public Routes with Redirection

- **publicRoute()**: For public routes that authenticated users should skip
  - Redirects authenticated users to a specified path (like home)
  - Example: `...publicRoute('/home')`

### Authentication Error Handling

- **AuthErrorComponent**: Consistent error UI for auth failures
  - Shows a friendly message with a login button
  - Uses `safeRedirect()` to work outside router context

## Using Authentication State

To access auth state in components:

```tsx
import { useAuth } from '../platform/auth/auth-context'

function ProfilePage() {
  const { user, profile, signOut } = useAuth()
  
  return (
    <div>
      <h1>Welcome, {profile?.display_name || user?.email}</h1>
      <button onClick={signOut}>Sign Out</button>
    </div>
  )
}
```

## Route Examples

### Protected Route

```tsx
// /src/routes/dashboard.tsx
export const Route = createFileRoute('/dashboard')({
  ...requireAuth('/login'),
  component: DashboardPage,
  errorComponent: AuthErrorComponent,
})
```

### Public Route with Redirection 

```tsx
// /src/routes/login.tsx
export const Route = createFileRoute('/login')({
  component: LoginPage,
  ...publicRoute('/home'),
})
```

### Protected Route with Params

```tsx
// /src/routes/project/$id.tsx
export const Route = createFileRoute('/project/$id')({
  ...requireAuth('/login'),
  loader: ({ params }) => {
    // Load project data using the ID
    return fetchProject(params.id)
  },
  component: ProjectPage,
  errorComponent: AuthErrorComponent,
})
```