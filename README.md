# 💳 Smart Expense Tracker — REST API & Web Dashboard

A production-ready, lightweight **Smart Expense Tracker REST API & Real-Time Web Dashboard** built with **Python**, **FastAPI**, **Pydantic v2**, and local **JSON persistence**. Features User Authentication, multi-tab real-time sync, INR (`₹`) currency formatting, dynamic budget tracking, Chart.js visualizations, UTF-8 BOM Excel-compatible CSV export, and 100% test coverage with `pytest`.

---

## 📸 Overview & Features

- 🔑 **User Authentication**: User registration (`POST /auth/register`), login (`POST /auth/login`), profile (`GET /auth/me`), and salted PBKDF2-HMAC-SHA256 password hashing.
- 💳 **Realistic Budget & Expenses**: Default target budget of **₹25,000.00** with pre-seeded sample expenses in Indian Rupee (`₹`).
- 📊 **Interactive Analytics**: Monthly spending bar chart & category distribution donut chart auto-updating on every transaction.
- ⚠️ **Non-Intrusive Budget Alerts**: Budget overrun warning displays only when total spending reaches or exceeds 100% of the target budget.
- 📥 **Excel-Compatible CSV Export**: Pre-appends UTF-8 BOM (`\ufeff`) header and outputs numeric amounts under `Amount (INR)` column so Microsoft Excel & Google Sheets parse encoding and formulas seamlessly (`GET /expenses/export/csv`).
- ⚡ **Multi-Tab Real-Time Sync**: Synchronize transaction changes instantly across all open browser windows via `BroadcastChannel`.
- 🌙 **Dark & Light Mode**: Theme toggle persisting in `localStorage`.
- 🎁 **Built-in OpenAPI Docs**: Served automatically at `/docs` (Swagger UI) and `/redoc`.

---

## 🛠️ Technology Stack

- **Backend**: Python 3.10+, FastAPI, Pydantic v2, Uvicorn (ASGI)
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3, Chart.js
- **Storage**: Thread-Safe JSON Storage (`threading.Lock` concurrency guard with atomic file replacement)
- **Testing**: `pytest` & `TestClient` (100% Endpoint Coverage)

---

## 📂 Project Structure

```
smart-expense-tracker/
├── .gitignore
├── README.md
├── requirements.txt
├── data/
│   ├── expenses.json
│   └── users.json
├── src/
│   ├── __init__.py
│   ├── main.py
│   ├── models.py
│   ├── storage.py
│   └── static/
│       ├── index.html
│       ├── style.css
│       └── app.js
└── tests/
    ├── __init__.py
    └── test_main.py
```

---

## 🚀 Quick Start Guide

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/YOUR_USERNAME/smart-expense-tracker.git
cd smart-expense-tracker
pip install -r requirements.txt
```

### 2. Run Development Server
```bash
uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

- **Web Dashboard**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive Swagger Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc API Documentation**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## 🧪 Running Automated Tests

Run the full test suite with `pytest`:

```bash
python -m pytest tests/
```

---

## 🌐 API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/auth/register` | Register new user account |
| `POST` | `/auth/login` | Authenticate credentials and return session token |
| `GET` | `/auth/me` | Fetch authenticated user profile |
| `POST` | `/expenses` | Create a new expense record |
| `GET` | `/expenses` | List expenses (supports `category`, `search`, `start_date`, `end_date` filters) |
| `GET` | `/expenses/summary` | Get total amount, count, and category breakdown |
| `GET` | `/expenses/summary/monthly` | Get monthly spending breakdown (`YYYY-MM`) |
| `GET` | `/expenses/export/csv` | Export expenses report as Excel-compatible `.csv` |
| `DELETE` | `/expenses/{expense_id}` | Delete expense record by ID |

---

## 📄 License
Distributed under the MIT License.
