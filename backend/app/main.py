from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.api.routes import auth, users, projects, sounds, soundfonts, assistant, streaming_assistant, assistant_streaming
import logging
import traceback

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s",
)
logger = logging.getLogger("beatgen")

app = FastAPI(title="BeatGen API", description="Backend API for BeatGen DAW", version="0.1.0")

# Disable automatic redirect of trailing slashes to make endpoints work with or without them
app.router.redirect_slashes = False

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # React and Vite frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Type", "Content-Length"],  # Needed for SSE
)

# Global exception handler
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

# Validation error handler
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation error: {exc.errors()}")
    logger.error(f"Request body: {exc.body}")
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Validation error",
            "errors": exc.errors(),
            "path": request.url.path,
        },
    )

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(sounds.router, prefix="/api/sounds", tags=["sounds"])
app.include_router(soundfonts.router, prefix="/api/soundfonts", tags=["soundfonts"])
app.include_router(assistant.router, prefix="/api/assistant", tags=["assistant"])
app.include_router(assistant_streaming.router, prefix="/api/assistant/request", tags=["assistant"])
app.include_router(assistant_streaming.router, prefix="/api/assistant", tags=["assistant", "streaming"])


@app.get("/")
async def root():
    return {"message": "Welcome to BeatGen API"}

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}