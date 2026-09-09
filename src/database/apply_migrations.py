"""Simple SQL migration runner for this project.

It executes all `*.sql` files in `src/database/migrations/` in filename order and records
applied migrations in a small `schema_migrations` table to avoid re-applying them.

Usage:
    python -m src.database.apply_migrations
"""
from pathlib import Path
import sys
from sqlalchemy import text
from src.database.session import engine


MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def ensure_migrations_table(conn):
    conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                filename TEXT UNIQUE NOT NULL,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            );
            """
        )
    )


def get_applied(conn):
    res = conn.execute(text("SELECT filename FROM schema_migrations")).fetchall()
    return {r[0] for r in res}


def apply_sql_file(conn, path: Path):
    sql = path.read_text()
    conn.execute(text(sql))
    conn.execute(text("INSERT INTO schema_migrations (filename) VALUES (:fn) ON CONFLICT DO NOTHING"), {"fn": path.name})


def main():
    if not MIGRATIONS_DIR.exists():
        print(f"No migrations dir: {MIGRATIONS_DIR}")
        return 0

    sql_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not sql_files:
        print("No SQL migration files found.")
        return 0

    with engine.begin() as conn:
        ensure_migrations_table(conn)
        applied = get_applied(conn)
        to_apply = [p for p in sql_files if p.name not in applied]
        if not to_apply:
            print("No new migrations to apply.")
            return 0
        for p in to_apply:
            print(f"Applying {p.name}...")
            apply_sql_file(conn, p)
            print(f"Applied {p.name}")

    print("Migrations complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
