from pg_cli import PGClient

_pg_client = None


def get_pg() -> PGClient:
    global _pg_client
    if _pg_client is None:
        _pg_client = PGClient()
    return _pg_client
