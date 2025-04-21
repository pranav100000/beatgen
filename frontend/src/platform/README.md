# Frontend Type System

This directory contains the type system for the Beatgen frontend application. The type system is designed to provide a consistent way to define and use types across the application, particularly for API requests and responses.

## Structure

- `types/`: Generated types from the backend Pydantic models using `pydantic2ts`. These types match the backend models exactly.
  - `adapters.ts`: Functions for converting between API and internal types
  - `project.ts`: Project-related types (ProjectCreate, ProjectRead, ProjectUpdate, etc.)
  - `track.ts`: Track-related types (TrackCreate, TrackRead, TrackUpdate, etc.)
  - `user.ts`: User-related types
  - etc.

- `api/`: API client functions that use the types
  - Each file corresponds to a backend endpoint (projects.ts, sounds.ts, etc.)
  - Uses type aliases and interface extensions to maintain backward compatibility

## Type Conversion

API types need to be converted to/from internal types:

1. API → Internal: When loading data from the API, we convert it to the internal format used by the application
2. Internal → API: When saving data to the API, we convert it from the internal format to the API format

The `adapters.ts` file provides functions for these conversions.

## Usage Examples

### Loading a project:

```typescript
import { getProject } from '../api/projects';
import { apiProjectToInternal } from '../types/adapters';

// Load a project from the API
const apiProject = await getProject(projectId);

// Convert to internal format for use in the application
const internalProject = apiProjectToInternal(apiProject);
```

### Saving a project:

```typescript
import { updateProject } from '../api/projects';
import { internalProjectToApiUpdate } from '../types/adapters';

// Convert internal project to API format
const apiProject = internalProjectToApiUpdate(internalProject);

// Save to API
await updateProject(projectId, apiProject);
```

## Maintainability

When the backend models change:
1. Regenerate the TypeScript types using pydantic2ts
2. Update the adapter functions if necessary
3. The application code does not need to change as it uses the adapters