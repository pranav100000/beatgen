from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import traceback

from app2.core.config import settings
from app2.core.logging import get_logger
from app2.core.exceptions import AppException
from app2.api.routes import auth, users, projects, sounds, soundfonts
from app2.infrastructure.database.sqlmodel_client import create_db_and_tables
from app2.api.routes import assistant_streaming
from app2.api.routes import drum_samples

# Configure logging
logger = get_logger("beatgen.main")

# Create FastAPI app
app = FastAPI(
    title=settings.app.PROJECT_NAME,
    description="Backend API for BeatGen DAW",
    version="0.2.0",
)

# Disable automatic redirection of trailing slashes
app.router.redirect_slashes = False

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors.ORIGINS,
    allow_credentials=settings.cors.ALLOW_CREDENTIALS,
    allow_methods=settings.cors.ALLOW_METHODS,
    allow_headers=settings.cors.ALLOW_HEADERS,
)


# Initialize SQLModel tables on startup
@app.on_event("startup")
async def init_db():
    """Initialize the database and create tables"""
    logger.info("Initializing database and creating tables...")
    try:
        await create_db_and_tables()
        logger.info("Database initialization complete")
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}")
        logger.error(traceback.format_exc())
        # Continue running even if database initialization fails
        # This allows the app to start and potentially use other features


# Global exception handler for AppExceptions
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    logger.error(f"AppException: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "path": request.url.path,
        },
    )


# Global exception handler for unhandled exceptions
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_detail = str(exc)
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR

    # Log the full exception with traceback
    logger.error(f"Unhandled exception: {error_detail}")
    logger.error(f"Request path: {request.url.path}")
    logger.error(traceback.format_exc())

    return JSONResponse(
        status_code=status_code,
        content={
            "detail": "An internal server error occurred",
            "error": error_detail,
            "path": request.url.path,
        },
    )


# Include routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(
    users.router, prefix="/users", tags=["users"]
)
app.include_router(
    projects.router, prefix="/projects", tags=["projects"]
)
app.include_router(
    sounds.router, prefix="/sounds", tags=["sounds"]
)
app.include_router(
    soundfonts.router,
    prefix="/soundfonts",
    tags=["soundfonts"],
)
app.include_router(
    drum_samples.router,
    prefix="/drum-samples",
    tags=["drum_samples"],
)
app.include_router(
    assistant_streaming.router,
    prefix="/assistant",
    tags=["assistant"],
)


# Root endpoint
@app.get("/")
async def root():
    return {"message": "Welcome to BeatGen API v2"}


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "version": "2.0.0"}
