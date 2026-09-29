"""
GeoSync — Database Connection Pool
Uses psycopg2 with a simple connection pool.
PostGIS extension must be enabled on the target database.
"""

import psycopg2
from psycopg2 import extensions as _ext
from psycopg2 import pool as pg_pool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from typing import Generator
import logging
from config import settings

logger = logging.getLogger(__name__)

# Thread-safe connection pool
_pool: pg_pool.ThreadedConnectionPool | None = None

# Managed Postgres and the load balancers in front of it routinely drop idle
# sessions after 5-15 minutes. TCP keepalives default to 2 hours, so without
# these the pool silently hands back connections whose socket the server has
# already closed. Probing after 30s idle stays well inside every such timeout.
_KEEPALIVES = {
    "connect_timeout": 10,
    "keepalives": 1,
    "keepalives_idle": 30,
    "keepalives_interval": 10,
    "keepalives_count": 3,
}

MAX_CHECKOUT_ATTEMPTS = 3


class DatabaseUnavailable(RuntimeError):
    """No pooled connection could be brought up."""


def get_pool() -> pg_pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        _pool = pg_pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            dsn=settings.database_url,
            **_KEEPALIVES,
        )
        logger.info("Database connection pool created")
    return _pool


def _is_alive(conn) -> bool:
    """Round-trip a trivial query to confirm the socket is still usable.

    Checking `conn.closed` is not sufficient: it only flips once psycopg2 has
    *read* a failure, so a session the server dropped while it sat idle in the
    pool still reports 0. Issuing a real query forces libpq to read the EOF and
    mark the connection bad, which is what makes it safe to reuse.
    """
    if conn.closed:
        return False
    probe_opened_txn = False
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
        probe_opened_txn = True
        return True
    except (psycopg2.OperationalError, psycopg2.InterfaceError):
        return False
    finally:
        # SELECT 1 opens a transaction when autocommit is off. Closing it here
        # returns the connection to a clean IDLE state so the caller starts from
        # a known-good baseline instead of inheriting the probe's transaction.
        if probe_opened_txn:
            try:
                conn.rollback()
            except Exception:
                pass


@contextmanager
def get_db() -> Generator:
    """Context manager that yields a psycopg2 connection from the pool."""
    pool = get_pool()
    conn = None
    for attempt in range(1, MAX_CHECKOUT_ATTEMPTS + 1):
        candidate = pool.getconn()
        if _is_alive(candidate):
            conn = candidate
            break
        logger.warning(
            "Discarding stale database connection (attempt %d/%d)",
            attempt,
            MAX_CHECKOUT_ATTEMPTS,
        )
        pool.putconn(candidate, close=True)

    if conn is None:
        raise DatabaseUnavailable(
            f"No usable database connection after {MAX_CHECKOUT_ATTEMPTS} attempts"
        )

    try:
        # Only touch session characteristics when they actually need to
        # change, and never while a transaction is open. Changing autocommit
        # makes psycopg2 emit `SET SESSION CHARACTERISTICS AS TRANSACTION ...`,
        # which the server rejects inside a transaction with
        # "set_session cannot be used inside a transaction". The pool can hand
        # back a connection left in autocommit mode by an endpoint that used
        # cur.execute(...), so this is a genuine state change to defend
        # against -- but it must be made from an idle connection.
        if (
            conn.autocommit
            or conn.isolation_level is not None
            or conn.readonly
            or conn.deferrable
        ):
            if conn.info.transaction_status != _ext.TRANSACTION_STATUS_IDLE:
                conn.rollback()
            conn.set_session(
                isolation_level=None, readonly=False, autocommit=False
            )
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
