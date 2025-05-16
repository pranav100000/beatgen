"""
SQLModel database client for the application
"""

from sqlmodel import SQLModel, create_engine, Session
from app2.core.config import settings
from app2.core.logging import get_logger

# Import all models to ensure they're registered with SQLModel metadata
# This is necessary for create_all to create all tables

logger = get_logger("beatgen.database.sqlmodel")

# Create SQLModel engine
from sqlalchemy import pool

# Get the database URL
DATABASE_URL = settings.db.URL

# Check if we're using pgbouncer
using_pgbouncer = "pgbouncer=true" in DATABASE_URL
if using_pgbouncer:
    logger.info("Detected pgbouncer mode - configuring appropriate connection settings")
    # When using pgbouncer, we need to disable SQLAlchemy's connection pooling
    # as recommended in https://pablomarti.dev/sqlalchemy-pgbouncer/
    engine = create_engine(
        DATABASE_URL,
        echo=settings.app.DEBUG,
        poolclass=pool.NullPool,  # Disable SQLAlchemy's connection pooling
    )
else:
    # Standard connection setup without pgbouncer
    logger.info(f"DATABASE_URL: {DATABASE_URL}")
    engine = create_engine(
        DATABASE_URL,
        echo=False,
        
        # More aggressive connection management
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=35,  # Increased further but still under your 50 connection limit
        max_overflow=10,
        pool_timeout=60,
        
        # Enhanced keepalive and reliability settings
        connect_args={
            # More aggressive keepalives
            "keepalives": 1,
            "keepalives_idle": 10,  # Check after just 10s of inactivity
            "keepalives_interval": 3,  # Try every 3s
            "keepalives_count": 10,  # Try 10 times
            
            # SSL and timeout settings
            "connect_timeout": 15,
            "sslmode": "require",  # Explicitly require SSL
            "application_name": "beatgen"
        }
    )


def create_db_and_tables():
    """Create database tables from SQLModel models"""
    try:
        logger.info("Creating database tables...")
        SQLModel.metadata.create_all(engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {str(e)}")
        raise


def get_session():
    """Get a database session - use as a dependency in FastAPI routes"""
    with Session(engine) as session:
        try:
            yield session
        except Exception as e:
            logger.error(f"Session error: {str(e)}")
            session.rollback()
            raise
        finally:
            session.close()
