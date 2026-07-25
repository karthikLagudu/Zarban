"""Export Zarban's schema and canonical curriculum data as a D1 migration.

Student names, attempts, reports, and other local activity are deliberately
excluded so a hosted deployment starts with an empty learner history.
"""

from pathlib import Path
import sqlite3


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "prisma" / "dev.db"
OUTPUT = ROOT / "drizzle" / "0000_initial.sql"

SCHEMA_ORDER = [
    "skills",
    "questions",
    "knowledge_graph",
    "q_matrix",
    "answer_traps",
    "question_dimensions",
    "classrooms",
    "students",
    "sessions",
    "responses",
    "bkt_state",
    "dimension_scores",
    "traversal_events",
    "review_flags",
    "settings",
    "admin_users",
    "admin_audit_log",
]

SEED_ORDER = [
    "skills",
    "questions",
    "knowledge_graph",
    "q_matrix",
    "answer_traps",
    "question_dimensions",
    "settings",
    "admin_users",
]


def literal(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bytes):
        return f"X'{value.hex()}'"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def main() -> None:
    db = sqlite3.connect(SOURCE)
    db.row_factory = sqlite3.Row
    lines = [
        "-- Zarban schema and curriculum seed for Cloudflare D1.",
        "-- Learner and assessment history are intentionally not exported.",
        "",
    ]

    for table in SCHEMA_ORDER:
        row = db.execute(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
            (table,),
        ).fetchone()
        if row is None:
            raise RuntimeError(f"Missing expected table: {table}")
        lines.extend([row["sql"].rstrip(";") + ";", ""])

    for table in SEED_ORDER:
        columns = [r["name"] for r in db.execute(f'PRAGMA table_info("{table}")')]
        order = "question_id" if table == "questions" else columns[0]
        if table == "questions":
            query = (
                'SELECT * FROM "questions" '
                'ORDER BY equation_twin_id IS NOT NULL, question_id'
            )
        else:
            query = f'SELECT * FROM "{table}" ORDER BY "{order}"'
        quoted_columns = ", ".join(f'"{column}"' for column in columns)
        for row in db.execute(query):
            values = ", ".join(literal(row[column]) for column in columns)
            lines.append(
                f'INSERT INTO "{table}" ({quoted_columns}) VALUES ({values});'
            )
        lines.append("")

    indexes = db.execute(
        "SELECT sql FROM sqlite_master "
        "WHERE type = 'index' AND sql IS NOT NULL ORDER BY name"
    ).fetchall()
    for row in indexes:
        lines.append(row["sql"].rstrip(";") + ";")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(OUTPUT)


if __name__ == "__main__":
    main()
