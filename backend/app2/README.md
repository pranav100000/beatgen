# BeatGen API v2

This is the updated backend architecture for BeatGen, designed with maintainability and scalability in mind.

## Architecture Overview

The new architecture follows a layered approach:

```
app2/
├── api/              # API Layer - HTTP concerns
│   ├── routes/       # Route handlers 
│   └── dependencies.py # Dependency injection
├── services/         # Service Layer - Business logic
├── repositories/     # Data Access Layer - Database operations
├── infrastructure/   # External integrations
│   ├── database/     # Database clients
│   └── storage/      # Storage clients
├── core/             # Cross-cutting concerns
│   ├── config.py     # Configuration
│   ├── logging.py    # Logging
│   └── exceptions.py # Exception handling
└── schemas/          # Data models
```

## Key Features

1. **Separation of Concerns**
   - API layer focuses on handling HTTP requests/responses
   - Service layer contains business logic
   - Repository layer handles data access
   - Infrastructure layer manages external dependencies

2. **Dependency Injection**
   - Services and repositories are injected where needed
   - Makes testing and mocking easier

3. **Consistent Error Handling**
   - Centralized exception hierarchy
   - Consistent error responses

4. **Improved Logging**
   - Centralized logging configuration
   - Service-specific loggers

5. **Configuration Management**
   - Structured configuration objects
   - Better environment separation

## Running the Application

To run the v2 architecture:

```bash
# From the backend directory
uvicorn app2.main:app --reload
```

## Development Guidelines

When adding new features to the API:

1. Define schemas in the `schemas` directory
2. Create repositories in the `repositories` directory
3. Implement business logic in the `services` directory
4. Create API endpoints in the `api/routes` directory
5. Register new routers in `main.py`

## Comparison with Legacy Architecture

Benefits over the previous architecture:

- Reduced code duplication
- Better error handling
- Clearer separation of concerns
- Easier to test and maintain
- More consistent logging patterns
- Simplified dependency management