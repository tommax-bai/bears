import json
import sqlite3
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

DB_PATH = Path(__file__).resolve().parent.parent / "nutrition.db"


def init_db() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            age INTEGER,
            gender TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS foods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            category TEXT,
            calories_per_100g REAL NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS meal_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            food_id INTEGER NOT NULL,
            quantity_grams REAL NOT NULL,
            total_calories REAL NOT NULL,
            eaten_at TEXT NOT NULL,
            note TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(food_id) REFERENCES foods(id)
        )
        """
    )
    conn.commit()
    conn.close()


def openapi_spec() -> dict:
    return {
        "openapi": "3.0.3",
        "info": {
            "title": "Nutrition OpenAPI Service",
            "version": "0.1.0",
            "description": "记录用户饮食内容的开放接口（用户、食物、热量、时间）",
        },
        "paths": {
            "/users": {"post": {"summary": "新增用户"}, "get": {"summary": "用户列表"}},
            "/foods": {"post": {"summary": "新增食物"}, "get": {"summary": "食物列表"}},
            "/meal-records": {"post": {"summary": "新增饮食记录"}, "get": {"summary": "记录列表"}},
            "/meal-records/{id}": {
                "get": {"summary": "记录详情"},
                "put": {"summary": "修改记录"},
                "delete": {"summary": "删除记录"},
            },
        },
    }


class AppHandler(BaseHTTPRequestHandler):
    def _send(self, code: int, payload=None):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        if payload is not None:
            self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))

    def _json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8"))

    def _db(self):
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/health":
            return self._send(200, {"status": "ok"})
        if path == "/openapi.json":
            return self._send(200, openapi_spec())

        conn = self._db()
        if path == "/users":
            rows = conn.execute("SELECT * FROM users ORDER BY id DESC").fetchall()
            conn.close()
            return self._send(200, [dict(r) for r in rows])

        if path == "/foods":
            rows = conn.execute("SELECT * FROM foods ORDER BY id DESC").fetchall()
            conn.close()
            return self._send(200, [dict(r) for r in rows])

        if path == "/meal-records":
            query = parse_qs(parsed.query)
            limit = int(query.get("limit", [100])[0])
            rows = conn.execute(
                "SELECT * FROM meal_records ORDER BY eaten_at DESC LIMIT ?", (limit,)
            ).fetchall()
            conn.close()
            return self._send(200, [dict(r) for r in rows])

        if path.startswith("/meal-records/"):
            record_id = path.split("/")[-1]
            row = conn.execute("SELECT * FROM meal_records WHERE id = ?", (record_id,)).fetchone()
            conn.close()
            if not row:
                return self._send(404, {"detail": "meal record not found"})
            return self._send(200, dict(row))

        conn.close()
        return self._send(404, {"detail": "not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        data = self._json_body()
        conn = self._db()

        if path == "/users":
            cur = conn.execute(
                "INSERT INTO users(name, age, gender) VALUES (?, ?, ?)",
                (data.get("name"), data.get("age"), data.get("gender")),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
            conn.close()
            return self._send(201, dict(row))

        if path == "/foods":
            try:
                cur = conn.execute(
                    "INSERT INTO foods(name, category, calories_per_100g) VALUES (?, ?, ?)",
                    (data.get("name"), data.get("category"), data.get("calories_per_100g")),
                )
                conn.commit()
            except sqlite3.IntegrityError:
                conn.close()
                return self._send(409, {"detail": "food already exists"})
            row = conn.execute("SELECT * FROM foods WHERE id = ?", (cur.lastrowid,)).fetchone()
            conn.close()
            return self._send(201, dict(row))

        if path == "/meal-records":
            user = conn.execute("SELECT id FROM users WHERE id = ?", (data.get("user_id"),)).fetchone()
            food = conn.execute(
                "SELECT id, calories_per_100g FROM foods WHERE id = ?", (data.get("food_id"),)
            ).fetchone()
            if not user:
                conn.close()
                return self._send(404, {"detail": "user not found"})
            if not food:
                conn.close()
                return self._send(404, {"detail": "food not found"})

            quantity = float(data.get("quantity_grams"))
            calories = data.get("total_calories") or round(food["calories_per_100g"] * quantity / 100, 2)
            now = datetime.utcnow().isoformat()
            cur = conn.execute(
                """
                INSERT INTO meal_records(user_id, food_id, quantity_grams, total_calories, eaten_at, note, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    data.get("user_id"),
                    data.get("food_id"),
                    quantity,
                    calories,
                    data.get("eaten_at"),
                    data.get("note"),
                    now,
                    now,
                ),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM meal_records WHERE id = ?", (cur.lastrowid,)).fetchone()
            conn.close()
            return self._send(201, dict(row))

        conn.close()
        return self._send(404, {"detail": "not found"})

    def do_PUT(self):
        path = urlparse(self.path).path
        if not path.startswith("/meal-records/"):
            return self._send(404, {"detail": "not found"})

        record_id = path.split("/")[-1]
        data = self._json_body()
        conn = self._db()
        row = conn.execute("SELECT * FROM meal_records WHERE id = ?", (record_id,)).fetchone()
        if not row:
            conn.close()
            return self._send(404, {"detail": "meal record not found"})

        user_id = data.get("user_id", row["user_id"])
        food_id = data.get("food_id", row["food_id"])
        quantity = float(data.get("quantity_grams", row["quantity_grams"]))
        eaten_at = data.get("eaten_at", row["eaten_at"])
        note = data.get("note", row["note"])

        food = conn.execute("SELECT calories_per_100g FROM foods WHERE id = ?", (food_id,)).fetchone()
        if not food:
            conn.close()
            return self._send(404, {"detail": "food not found"})

        total_calories = data.get("total_calories", round(food["calories_per_100g"] * quantity / 100, 2))
        now = datetime.utcnow().isoformat()

        conn.execute(
            """
            UPDATE meal_records
            SET user_id = ?, food_id = ?, quantity_grams = ?, total_calories = ?, eaten_at = ?, note = ?, updated_at = ?
            WHERE id = ?
            """,
            (user_id, food_id, quantity, total_calories, eaten_at, note, now, record_id),
        )
        conn.commit()
        updated = conn.execute("SELECT * FROM meal_records WHERE id = ?", (record_id,)).fetchone()
        conn.close()
        return self._send(200, dict(updated))

    def do_DELETE(self):
        path = urlparse(self.path).path
        if not path.startswith("/meal-records/"):
            return self._send(404, {"detail": "not found"})

        record_id = path.split("/")[-1]
        conn = self._db()
        row = conn.execute("SELECT id FROM meal_records WHERE id = ?", (record_id,)).fetchone()
        if not row:
            conn.close()
            return self._send(404, {"detail": "meal record not found"})

        conn.execute("DELETE FROM meal_records WHERE id = ?", (record_id,))
        conn.commit()
        conn.close()

        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()


def run(host: str = "0.0.0.0", port: int = 8000):
    init_db()
    server = ThreadingHTTPServer((host, port), AppHandler)
    print(f"Serving on http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
