"""
Regression tests for the connection pool.

Covers the production failure:
    psycopg2.OperationalError: SSL connection has been closed unexpectedly
raised from the first execute() of a request, when the pooled connection was
dropped by the server while it sat idle.
"""

import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2  # noqa: E402

import database  # noqa: E402


class FakeCursor:
    def __init__(self, conn):
        self._conn = conn

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=None):
        self._conn.queries.append(sql)
        if self._conn.dead:
            # This is exactly what main.py:924 hits on a stale connection.
            raise psycopg2.OperationalError(
                "SSL connection has been closed unexpectedly"
            )

    def fetchone(self):
        return {"count": 0}

    def fetchall(self):
        return []


class FakeConn:
    """A pooled connection whose socket the server closed while it sat idle.

    `closed` stays 0 because psycopg2 has not read the TLS FIN yet. That is
    precisely why checking `conn.closed` at checkout never catches this.
    """

    def __init__(self, dead=False, tag="", autocommit=True):
        self.dead = dead
        self.closed = 0
        self.autocommit = autocommit
        self.queries = []
        self.tag = tag
        self.rollbacks = 0
        self.commits = 0
        self.set_session_calls = []
        self.readonly = False
        self.deferrable = False
        self.isolation_level = None
        self._status = database._ext.TRANSACTION_STATUS_IDLE
        self._txn_open = False

    # mirrors psycopg2.connection.info.transaction_status
    @property
    def info(self):
        conn = self

        class _Info:
            @property
            def transaction_status(self):
                if conn.dead:
                    return database._ext.TRANSACTION_STATUS_UNKNOWN
                if conn._txn_open:
                    return database._ext.TRANSACTION_STATUS_INTRANS
                return database._ext.TRANSACTION_STATUS_IDLE

        return _Info()

    def set_session(
        self, isolation_level=None, readonly=None, autocommit=None, deferrable=None
    ):
        # The server rejects this inside a transaction.
        if self._txn_open:
            raise psycopg2.ProgrammingError(
                "set_session cannot be used inside a transaction"
            )
        self.set_session_calls.append(
            (isolation_level, readonly, autocommit, deferrable)
        )
        if isolation_level is not None:
            self.isolation_level = isolation_level
        if readonly is not None:
            self.readonly = readonly
        if deferrable is not None:
            self.deferrable = deferrable
        if autocommit is not None:
            self.autocommit = autocommit
            self._txn_open = not autocommit

    def cursor(self, cursor_factory=None):
        if not self.autocommit:
            self._txn_open = True
        return FakeCursor(self)

    def commit(self):
        self.commits += 1
        self._txn_open = False

    def rollback(self):
        self.rollbacks += 1
        self._txn_open = False

    def close(self):
        self.closed = 1


class FakePool:
    """Mimics psycopg2's ThreadedConnectionPool LIFO free-list semantics."""

    def __init__(self, conns):
        self._free = list(conns)
        self.created = []
        self.closed_conns = []

    def getconn(self):
        if self._free:
            return self._free.pop()
        conn = FakeConn(tag=f"fresh{len(self.created)}")
        self.created.append(conn)
        return conn

    def putconn(self, conn, close=False):
        if close:
            conn.close()
            self.closed_conns.append(conn)
        else:
            self._free.append(conn)


class CheckoutTests(unittest.TestCase):
    def test_stale_connection_is_discarded_and_replaced(self):
        stale = FakeConn(dead=True, tag="stale")
        pool = FakePool([stale])

        with mock.patch.object(database, "get_pool", return_value=pool):
            with database.get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT COUNT(*) FROM spatial_conflicts")
                    cur.fetchone()

        self.assertIsNot(conn, stale, "must not hand out the dead connection")
        self.assertFalse(conn.dead)
        self.assertEqual(stale.closed, 1, "stale connection must be closed")
        self.assertIn(stale, pool.closed_conns)

    def test_healthy_connection_is_reused(self):
        healthy = FakeConn(tag="healthy")
        pool = FakePool([healthy])

        with mock.patch.object(database, "get_pool", return_value=pool):
            with database.get_db() as conn:
                pass

        self.assertIs(conn, healthy)
        self.assertEqual(healthy.closed, 0)
        self.assertEqual(pool.closed_conns, [])
        self.assertEqual(pool.created, [], "must not open a needless connection")

    def test_exhausted_dead_connections_raise_clear_error(self):
        pool = FakePool([FakeConn(dead=True) for _ in range(10)])

        with mock.patch.object(database, "get_pool", return_value=pool):
            with self.assertRaises(database.DatabaseUnavailable):
                with database.get_db() as conn:
                    conn.cursor().execute("SELECT 1")

    def test_connection_dying_during_request_is_not_returned_to_pool(self):
        """Connection is healthy at checkout, then the server drops it mid-query."""
        doomed = FakeConn(tag="doomed")

        class DyingCursor(FakeCursor):
            def execute(self, sql, params=None):
                self._conn.queries.append(sql)
                if len(self._conn.queries) > 1:  # allow the liveness probe
                    self._conn.closed = 1  # psycopg2 marks it bad on failure
                    raise psycopg2.OperationalError("server closed the connection")

        doomed.cursor = lambda cursor_factory=None: DyingCursor(doomed)
        pool = FakePool([doomed])

        with mock.patch.object(database, "get_pool", return_value=pool):
            with self.assertRaises(psycopg2.OperationalError):
                with database.get_db() as conn:
                    conn.cursor().execute("SELECT COUNT(*) FROM spatial_conflicts")

        self.assertIn(doomed, pool.closed_conns)
        self.assertEqual(pool._free, [], "dead connection must not be pooled")


class SessionStateTests(unittest.TestCase):
    """Regression: 'set_session cannot be used inside a transaction'."""

    def _checkout(self, conn):
        pool = FakePool([conn])
        with mock.patch.object(database, "get_pool", return_value=pool):
            with database.get_db() as c:
                with c.cursor() as cur:
                    cur.execute("SELECT 1")
                    cur.fetchone()
        return conn

    def test_probe_does_not_leave_a_transaction_open(self):
        """The liveness probe must not leak its transaction to the caller."""
        conn = self._checkout(FakeConn(autocommit=False))
        self.assertEqual(
            conn.rollbacks,
            1,
            "probe must roll back the transaction it opened",
        )
        self.assertEqual(
            conn.info.transaction_status,
            database._ext.TRANSACTION_STATUS_IDLE,
        )

    def test_probe_then_set_session_does_not_raise(self):
        """autocommit=True + non-idle connection is the 500 from production."""
        conn = FakeConn(autocommit=True)
        # Simulate the probe having opened a transaction on this connection.
        conn._txn_open = True
        self._checkout(conn)
        self.assertFalse(conn.autocommit, "must end up in manual-commit mode")
        self.assertEqual(conn.set_session_calls, [(None, False, False, None)])

    def test_set_session_is_not_called_when_state_already_correct(self):
        """Already manual-commit -> psycopg2 no-ops, so send no SET SESSION."""
        conn = self._checkout(FakeConn(autocommit=False))
        self.assertEqual(conn.set_session_calls, [])

    def test_connection_left_in_autocommit_by_an_endpoint_is_recovered(self):
        """Endpoints that do cur.execute(...) leave autocommit=True behind."""
        conn = FakeConn(autocommit=True)
        pool = FakePool([conn])
        with mock.patch.object(database, "get_pool", return_value=pool):
            with database.get_db() as c:
                pass
            # Endpoint switches the connection into autocommit.
            c2 = pool._free[0]
            c2.set_session(autocommit=True)
            with database.get_db() as c3:
                pass
        self.assertFalse(c3.autocommit)

    def test_connections_are_never_marked_readonly(self):
        """readonly would break every INSERT/UPDATE endpoint."""
        for autocommit in (True, False):
            conn = self._checkout(FakeConn(autocommit=autocommit))
            self.assertFalse(conn.readonly)
            self.assertFalse(conn.deferrable)
            self.assertIsNone(conn.isolation_level)


class PoolConfigTests(unittest.TestCase):
    def test_keepalives_prevent_idle_disconnects(self):
        ka = database._KEEPALIVES
        self.assertEqual(ka["keepalives"], 1)
        # Must probe well inside the typical 5-15 min managed-Postgres
        # idle_session_timeout, otherwise the socket dies first.
        self.assertLessEqual(ka["keepalives_idle"], 60)
        self.assertGreaterEqual(ka["keepalives_count"], 3)
        self.assertGreater(ka["connect_timeout"], 0)

    def test_pool_is_created_with_keepalives(self):
        captured = {}

        def fake_pool_factory(**kwargs):
            captured.update(kwargs)
            return mock.MagicMock()

        with mock.patch.object(database, "_pool", None):
            with mock.patch.object(
                database.pg_pool, "ThreadedConnectionPool", fake_pool_factory
            ):
                database.get_pool()

        for key, value in database._KEEPALIVES.items():
            self.assertEqual(captured.get(key), value, f"missing {key}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
