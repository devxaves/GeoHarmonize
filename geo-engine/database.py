"""
GeoSync — Database Connection Pool
Uses psycopg2 with a simple connection pool.
PostGIS extension must be enabled on the target database.
"""

import psycopg2
from psycopg2 import pool as pg_pool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from typing import Generator
import logging
from config import settings

logger = logging.getLogger(__name__)

# Thread-safe connection pool
_pool: pg_pool.ThreadedConnectionPool | None = None


def get_pool() -> pg_pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        _pool = pg_pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            dsn=settings.database_url,
        )
        logger.info("Database connection pool created")
    return _pool


@contextmanager
def get_db() -> Generator:
    """Context manager that yields a psycopg2 connection from the pool."""
    pool = get_pool()
    conn = pool.getconn()
    if conn.closed != 0:
        pool.putconn(conn, close=True)
        conn = pool.getconn()
    try:
        conn.autocommit = False
        yield conn
        conn.commit()
    except Exception:
        if conn.closed == 0:
            try:
                conn.rollback()
            except Exception:
                pass
        raise
    finally:
        if conn.closed == 0:
            pool.putconn(conn)
        else:
            pool.putconn(conn, close=True)


@contextmanager
def get_cursor(conn):
    """Context manager that yields a RealDictCursor."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        yield cur


def close_pool():
    global _pool
    if _pool:
        _pool.closeall()
        _pool = None
        logger.info("Database connection pool closed")
