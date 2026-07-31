import os
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Header, Query, Response, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from src.models import (
    ExpenseCreate,
    ExpenseResponse,
    ExpenseSummaryResponse,
    MonthlySummaryResponse,
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse
)
from src.storage import JSONExpenseStorage, JSONUserStorage

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Smart Expense Tracker API",
    description="A lightweight REST API & Web Dashboard to track, filter, summarize, export, and manage expenses with User Authentication.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for all origins (local dev & file:// support)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize storage instances
user_storage = JSONUserStorage()
expense_storage = JSONExpenseStorage()

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")


# Helper to parse optional User-ID header or token
def get_user_id_from_header(x_user_id: Optional[str] = Header(None, alias="X-User-ID")) -> Optional[str]:
    return x_user_id or "default_user"


# ============================================================================
# Auth Routes
# ============================================================================
@app.post(
    "/auth/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Authentication"],
    summary="Register new user",
    description="Registers a new user account with unique username and email."
)
def register_user(user_in: UserRegister):
    try:
        user = user_storage.register(user_in)
        return user
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@app.post(
    "/auth/login",
    response_model=TokenResponse,
    tags=["Authentication"],
    summary="User login",
    description="Authenticates user credentials and returns session token."
)
def login_user(login_in: UserLogin):
    user = user_storage.authenticate(login_in.email_or_username, login_in.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email/username or password."
        )
    return TokenResponse(
        access_token=f"token-{user.id}",
        token_type="bearer",
        user=user
    )


@app.get(
    "/auth/me",
    response_model=UserResponse,
    tags=["Authentication"],
    summary="Get current user profile"
)
def get_current_user(user_id: Optional[str] = Query(None, description="Optional user ID")):
    target_id = user_id or "default_user"
    user = user_storage.get_by_id(target_id)
    if not user:
        return UserResponse(
            id="default_user",
            username="Demo User",
            email="demo@expensetracker.in",
            created_at="2026-07-31T00:00:00"
        )
    return user


# ============================================================================
# Expense Routes
# ============================================================================
@app.post(
    "/expenses",
    response_model=ExpenseResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Expenses"],
    summary="Add a new expense",
    description="Creates a new expense record in INR."
)
def create_expense(expense: ExpenseCreate):
    try:
        created = expense_storage.add(expense)
        return created
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@app.get(
    "/expenses",
    response_model=List[ExpenseResponse],
    tags=["Expenses"],
    summary="View all expenses",
    description="Retrieves expenses list with category filtering, search, and date range filtering."
)
def list_expenses(
    user_id: Optional[str] = Query(None, description="Optional user ID filter"),
    category: Optional[str] = Query(None, description="Filter expenses by category"),
    search: Optional[str] = Query(None, description="Optional search query in title or category"),
    start_date: Optional[str] = Query(None, description="Filter start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Filter end date YYYY-MM-DD")
):
    return expense_storage.get_all(
        user_id=user_id,
        category=category,
        search=search,
        start_date=start_date,
        end_date=end_date
    )


@app.get(
    "/expenses/export/csv",
    tags=["Export"],
    summary="Export expenses to CSV",
    description="Generates a downloadable CSV report of expenses matching optional filters."
)
def export_expenses_csv(
    user_id: Optional[str] = Query(None, description="Optional user ID filter"),
    category: Optional[str] = Query(None, description="Optional category filter"),
    start_date: Optional[str] = Query(None, description="Optional start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Optional end date YYYY-MM-DD")
):
    csv_content = expense_storage.export_to_csv(
        user_id=user_id,
        category=category,
        start_date=start_date,
        end_date=end_date
    )
    headers = {
        "Content-Disposition": "attachment; filename=expenses_export.csv"
    }
    return Response(content=csv_content, media_type="text/csv; charset=utf-8", headers=headers)


@app.get(
    "/expenses/summary",
    response_model=ExpenseSummaryResponse,
    tags=["Summary"],
    summary="Calculate total expenses",
    description="Calculates overall total expense amount, total count, and category breakdown in INR."
)
def get_expense_summary(
    user_id: Optional[str] = Query(None, description="Optional user ID filter"),
    category: Optional[str] = Query(None, description="Optional category filter"),
    start_date: Optional[str] = Query(None, description="Optional start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Optional end date YYYY-MM-DD")
):
    return expense_storage.get_summary(
        user_id=user_id,
        category=category,
        start_date=start_date,
        end_date=end_date
    )


@app.get(
    "/expenses/summary/monthly",
    response_model=MonthlySummaryResponse,
    tags=["Summary"],
    summary="Monthly expense summary",
    description="Returns expense breakdown grouped by month (YYYY-MM) and category."
)
def get_monthly_summary(user_id: Optional[str] = Query(None, description="Optional user ID filter")):
    return expense_storage.get_monthly_summary(user_id=user_id)


@app.delete(
    "/expenses/{expense_id}",
    tags=["Expenses"],
    summary="Delete an expense",
    description="Deletes an expense by its unique ID."
)
def delete_expense(expense_id: str, user_id: Optional[str] = Query(None, description="Optional user ID")):
    deleted = expense_storage.delete(expense_id, user_id=user_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense with ID '{expense_id}' not found."
        )
    return {"message": f"Expense '{expense_id}' deleted successfully."}


# Mount Static Files & Serve Dashboard on Root "/"
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    @app.get("/", tags=["Dashboard"], include_in_schema=False)
    def read_dashboard():
        """Serves the main Web Dashboard UI."""
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
