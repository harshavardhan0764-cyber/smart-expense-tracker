import os
import pytest
from fastapi.testclient import TestClient

from src.main import app, expense_storage, user_storage

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_storage():
    """Fixture to ensure a clean state before each test."""
    expense_storage.clear_all()
    user_storage.clear_all()
    yield
    expense_storage.clear_all()
    user_storage.clear_all()


def test_read_root_dashboard():
    response = client.get("/")
    assert response.status_code == 200
    assert "Smart Expense Tracker" in response.text


def test_user_registration_and_login():
    reg_payload = {
        "username": "harsh",
        "email": "harsh@example.com",
        "password": "securepassword123"
    }
    # Register user
    res_reg = client.post("/auth/register", json=reg_payload)
    assert res_reg.status_code == 201
    user_data = res_reg.json()
    assert user_data["username"] == "harsh"
    assert user_data["email"] == "harsh@example.com"
    assert "id" in user_data

    # Duplicate registration (400)
    res_dup = client.post("/auth/register", json=reg_payload)
    assert res_dup.status_code == 400
    assert "taken" in res_dup.json()["detail"] or "registered" in res_dup.json()["detail"]

    # Login user
    login_payload = {
        "email_or_username": "harsh@example.com",
        "password": "securepassword123"
    }
    res_login = client.post("/auth/login", json=login_payload)
    assert res_login.status_code == 200
    token_data = res_login.json()
    assert "access_token" in token_data
    assert token_data["user"]["username"] == "harsh"

    # Wrong password (401)
    res_bad = client.post("/auth/login", json={
        "email_or_username": "harsh@example.com",
        "password": "wrongpassword"
    })
    assert res_bad.status_code == 401


def test_create_expense_auto_id():
    payload = {
        "title": "Supermarket Grocery",
        "amount": 3200.00,
        "category": "Food",
        "date": "2026-07-31"
    }
    response = client.post("/expenses", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert len(data["id"]) > 0
    assert data["title"] == "Supermarket Grocery"
    assert data["amount"] == 3200.00
    assert data["category"] == "Food"


def test_create_expense_custom_id():
    payload = {
        "id": "exp-101",
        "title": "Fuel & Transport",
        "amount": 2000.00,
        "category": "Transport",
        "date": "2026-07-01"
    }
    response = client.post("/expenses", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] == "exp-101"
    assert data["title"] == "Fuel & Transport"


def test_create_expense_duplicate_id():
    payload = {
        "id": "dup-1",
        "title": "Book",
        "amount": 450.00,
        "category": "Education",
        "date": "2026-07-15"
    }
    res1 = client.post("/expenses", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/expenses", json=payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]


def test_create_expense_validation_errors():
    # Negative amount
    res1 = client.post("/expenses", json={
        "title": "Invalid Amount",
        "amount": -10.0,
        "category": "Food",
        "date": "2026-07-31"
    })
    assert res1.status_code == 422

    # Zero amount
    res2 = client.post("/expenses", json={
        "title": "Zero Amount",
        "amount": 0.0,
        "category": "Food",
        "date": "2026-07-31"
    })
    assert res2.status_code == 422

    # Whitespace title
    res3 = client.post("/expenses", json={
        "title": "   ",
        "amount": 10.0,
        "category": "Food",
        "date": "2026-07-31"
    })
    assert res3.status_code == 422


def test_get_expenses_list_and_filters():
    client.post("/expenses", json={"title": "Coffee", "amount": 150.00, "category": "Food", "date": "2026-07-30"})
    client.post("/expenses", json={"title": "Metro Ticket", "amount": 50.00, "category": "Transport", "date": "2026-07-31"})
    client.post("/expenses", json={"title": "Dinner", "amount": 1200.00, "category": "Food", "date": "2026-07-31"})

    # Get all
    res_all = client.get("/expenses")
    assert res_all.status_code == 200
    assert len(res_all.json()) == 3

    # Filter by category
    res_food = client.get("/expenses?category=Food")
    assert res_food.status_code == 200
    assert len(res_food.json()) == 2

    # Search filter
    res_search = client.get("/expenses?search=coffee")
    assert res_search.status_code == 200
    assert len(res_search.json()) == 1


def test_export_expenses_csv():
    client.post("/expenses", json={"title": "Apparel Store", "amount": 3000.00, "category": "Shopping", "date": "2026-07-28"})
    response = client.get("/expenses/export/csv")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "Apparel Store" in response.text
    assert "3000.00" in response.text


def test_get_expense_summary():
    client.post("/expenses", json={"title": "Item 1", "amount": 1000.00, "category": "Food", "date": "2026-07-01"})
    client.post("/expenses", json={"title": "Item 2", "amount": 2000.00, "category": "Food", "date": "2026-07-02"})
    client.post("/expenses", json={"title": "Item 3", "amount": 1500.00, "category": "Utilities", "date": "2026-07-03"})

    res_summary = client.get("/expenses/summary")
    assert res_summary.status_code == 200
    data = res_summary.json()
    assert data["total_amount"] == 4500.00
    assert data["total_count"] == 3
    assert data["by_category"]["Food"] == 3000.00
    assert data["by_category"]["Utilities"] == 1500.00


def test_delete_expense():
    res_create = client.post("/expenses", json={
        "id": "del-123",
        "title": "Movie Ticket",
        "amount": 350.00,
        "category": "Entertainment",
        "date": "2026-07-28"
    })
    assert res_create.status_code == 201

    res_del = client.delete("/expenses/del-123")
    assert res_del.status_code == 200
    assert "deleted successfully" in res_del.json()["message"]

    res_get = client.get("/expenses")
    assert len(res_get.json()) == 0
