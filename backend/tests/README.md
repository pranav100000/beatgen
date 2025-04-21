# BeatGen Backend Tests

This directory contains unit tests for the BeatGen backend.

## Test Structure

Tests are organized by layers of the application architecture:

- `repositories/`: Tests for the data access layer
- `services/`: Tests for business logic layer
- `api/`: Tests for API endpoints

## Test Database

Tests use SQLite in-memory database for fast testing without affecting real data.

## Running Tests

From the backend directory, run:

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/repositories/test_user_repository.py

# Run specific test
pytest tests/repositories/test_user_repository.py::TestUserRepository::test_create_profile

# Run with output
pytest -v
```

## Test Environment

The test environment is set up in `conftest.py` with fixtures for:

- Database and session setup
- Common test objects (users, projects, tracks, etc.)
- Mocked dependencies

## Writing New Tests

Follow these patterns when writing new tests:

1. Create a new test file in the appropriate directory
2. Use existing fixtures from `conftest.py` where possible
3. Include tests for happy path and error cases
4. Use clear test function names describing the behavior being tested
5. Mark async tests with `@pytest.mark.asyncio`