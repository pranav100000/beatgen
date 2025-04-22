# Makefile for the beatgen project

.PHONY: install build run clean install-frontend run-frontend install-backend run-backend all help

# Default target
all: install build run

# Install dependencies for both frontend and backend
install: install-frontend install-backend

# Install frontend dependencies
install-frontend:
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

# Install backend dependencies (assuming Python/pip)
# Adjust if using a different backend setup
install-backend:
	@echo "Installing backend dependencies..."
	cd backend && pip install -r requirements.txt

# Build frontend (adjust if necessary)
build:
	@echo "Building frontend..."
	cd frontend && npm run build

# Run frontend development server
run-frontend:
	@echo "Running frontend development server..."
	cd frontend && npm run dev

# Run backend server (adjust if necessary)
# Assuming Flask/FastAPI common run command
run-backend:
	@echo "Running backend server..."
	cd backend && uv run uvicorn app2.main:app --reload

# Run both frontend and backend (can be run in separate terminals or managed with a tool like concurrently)
run:
	@echo "To run the full application:"
	@echo "1. Open a terminal and run 'make run-frontend'"
	@echo "2. Open another terminal and run 'make run-backend'"

# Clean up build artifacts and dependencies
clean:
	@echo "Cleaning up..."
	rm -rf frontend/node_modules frontend/dist frontend/build
	rm -rf backend/__pycache__ backend/.pytest_cache backend/venv  # Adjust as needed
	find . -name '*.pyc' -delete

# Help target to display available commands
help:
	@echo "Available commands:"
	@echo "  install          - Install frontend and backend dependencies"
	@echo "  install-frontend - Install frontend dependencies"
	@echo "  install-backend  - Install backend dependencies"
	@echo "  build            - Build the frontend application"
	@echo "  run              - Instructions to run frontend and backend servers"
	@echo "  run-frontend     - Run the frontend development server"
	@echo "  run-backend      - Run the backend server"
	@echo "  clean            - Remove build artifacts and dependencies"
	@echo "  help             - Show this help message" 