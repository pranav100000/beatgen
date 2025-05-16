"""
SQLModel database client for the application
"""

from sqlmodel import SQLModel
from app2.core.config import settings
from app2.core.logging import get_logger
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from urllib.parse import urlparse, parse_qs, urlunparse, urlencode
import traceback

# Import all models to ensure they're registered with SQLModel metadata
# This is necessary for create_all to create all tables

logger = get_logger("beatgen.database.sqlmodel")

# Create SQLModel engine
from sqlalchemy import pool

# Get the database URL
DATABASE_URL = settings.db.URL

# --- Start of DATABASE_URL processing ---
parsed_url = urlparse(DATABASE_URL)
query_params = parse_qs(parsed_url.query)

# Remove 'sslmode' if it exists
if 'sslmode' in query_params:
    logger.info(f"Removing 'sslmode={query_params['sslmode'][0]}' from DATABASE_URL for asyncpg compatibility.")
    del query_params['sslmode']

# Remove 'application_name' if it exists
if 'application_name' in query_params:
    logger.info(f"Removing 'application_name={query_params['application_name'][0]}' from DATABASE_URL for asyncpg compatibility.")
    del query_params['application_name']

# Reconstruct the query string
new_query_string = urlencode(query_params, doseq=True)

# Determine the correct scheme for asyncpg
scheme = parsed_url.scheme
if scheme == "postgresql" or scheme == "postgres":
    scheme = "postgresql+asyncpg"

# Reconstruct the URL
DATABASE_URL = urlunparse((
    scheme,
    parsed_url.netloc,
    parsed_url.path,
    parsed_url.params,
    new_query_string,
    parsed_url.fragment
))
logger.info(f"Processed DATABASE_URL for asyncpg: {DATABASE_URL.split('@')[-1]}") # Log URL without credentials for safety
# --- End of DATABASE_URL processing ---

# No longer using asyncpg_init for this, relying on connect_args
# async def init_pgbouncer_settings_for_conn(conn):
#     logger.debug(f"Running asyncpg_init for PgBouncer on connection {conn}: setting statement_cache_size=0 and prepare_threshold=0.")
#     await conn.set_statement_cache_size(0)
#     await conn.set_prepare_threshold(0)

# Check if we're using pgbouncer
# This check should happen *after* processing DATABASE_URL for asyncpg scheme and query params
using_pgbouncer = "pgbouncer=true" in DATABASE_URL # Check against the modified DATABASE_URL

pgbouncer_connect_args = {}
if using_pgbouncer:
    logger.info("Detected pgbouncer mode - applying focused asyncpg connect_args to disable statement caching and auto-preparation.")
    pgbouncer_connect_args = {
        "statement_cache_size": 0,          # Primary setting to disable client-side statement cache
        "prepare_threshold": None,          # Do not automatically prepare statements on server after N uses
        "max_cached_statement_lifetime": 0, # No lifetime for cached statements (redundant if cache size is 0, but for safety)
        "max_cacheable_statement_size": 0,  # No size limit for cachable statements (redundant if cache size is 0)
    }

if using_pgbouncer:
    engine = create_async_engine(
        DATABASE_URL,
        echo=settings.app.DEBUG,
        poolclass=pool.NullPool, # Essential for PgBouncer in transaction/statement mode
        connect_args=pgbouncer_connect_args,
        # asyncpg_init=None # Explicitly not using asyncpg_init for these settings
    )
else:
    # Standard connection setup without pgbouncer
    engine = create_async_engine(
        DATABASE_URL,
        echo=settings.app.DEBUG,
        # Pool settings to maintain connections
        pool_pre_ping=True,
        pool_recycle=300,  # Recycle connections after 5 minutes
        pool_size=5,  # Default connection pool size
        max_overflow=10,  # Allow up to 10 additional connections
        # No special connect_args needed here normally
    )

async_session_maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def create_db_and_tables():
    """Create database tables from SQLModel models"""
    try:
        logger.info("Creating database tables...")
        async with engine.begin() as conn:
            # await conn.run_sync(SQLModel.metadata.drop_all) # Optional: drop tables first
            await conn.run_sync(SQLModel.metadata.create_all)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {str(e)}")
        logger.error(traceback.format_exc()) # Log full traceback for pgbouncer issues
        raise


async def get_session() -> AsyncSession:
    """Get an async database session - use as a dependency in FastAPI routes"""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            logger.error(f"Session error: {str(e)}")
            await session.rollback()
            raise
        finally:
            await session.close()
