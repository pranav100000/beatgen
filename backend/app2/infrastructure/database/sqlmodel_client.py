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
        echo=settings.app.DEBUG,
        # Pool settings to maintain connections
        pool_pre_ping=True,
        pool_recycle=300,  # Recycle connections after 5 minutes
        pool_size=5,  # Default connection pool size
        max_overflow=10,  # Allow up to 10 additional connections
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
