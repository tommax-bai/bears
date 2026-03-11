import json
import threading
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from http.server import ThreadingHTTPServer

from app.main import AppHandler, DB_PATH, init_db


def request(method: str, path: str, body: dict | None = None):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"http://127.0.0.1:18000{path}",
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as resp:
            payload = resp.read().decode("utf-8")
            return resp.status, json.loads(payload) if payload else None
    except urllib.error.HTTPError as e:
        payload = e.read().decode("utf-8")
        return e.code, json.loads(payload) if payload else None


def test_meal_record_crud_flow():
    if Path(DB_PATH).exists():
        Path(DB_PATH).unlink()
    init_db()

    server = ThreadingHTTPServer(("127.0.0.1", 18000), AppHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    status, user = request("POST", "/users", {"name": "Alice", "age": 28, "gender": "female"})
    assert status == 201

    status, food = request(
        "POST",
        "/foods",
        {"name": f"鸡胸肉-{uuid4()}", "category": "蛋白质", "calories_per_100g": 165},
    )
    assert status == 201

    status, created = request(
        "POST",
        "/meal-records",
        {
            "user_id": user["id"],
            "food_id": food["id"],
            "quantity_grams": 200,
            "eaten_at": datetime.utcnow().isoformat(),
            "note": "午餐",
        },
    )
    assert status == 201
    assert created["total_calories"] == 330

    status, listed = request("GET", "/meal-records")
    assert status == 200
    assert len(listed) == 1

    status, updated = request(
        "PUT",
        f"/meal-records/{created['id']}",
        {"quantity_grams": 100, "food_id": food["id"]},
    )
    assert status == 200
    assert updated["total_calories"] == 165

    status, _ = request("DELETE", f"/meal-records/{created['id']}")
    assert status == 204

    server.shutdown()
    server.server_close()
