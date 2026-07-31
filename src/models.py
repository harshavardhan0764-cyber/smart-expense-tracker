from datetime import date as DateType, datetime
from typing import Dict, List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field, field_validator


# ============================================================================
# User Authentication Schemas
# ============================================================================
class UserRegister(BaseModel):
    """Schema for user registration."""
    username: str = Field(..., min_length=3, max_length=30, description="Unique username")
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=6, description="Password (min 6 characters)")

    @field_validator("username", "email")
    @classmethod
    def strip_and_lower(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Field cannot be empty or whitespace")
        return stripped


class UserLogin(BaseModel):
    """Schema for user login."""
    email_or_username: str = Field(..., description="Email address or username")
    password: str = Field(..., description="User password")


class UserResponse(BaseModel):
    """Schema for returning user details."""
    id: str
    username: str
    email: str
    created_at: str

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "u-410a-47df-9db2",
                "username": "harsh",
                "email": "harsh@example.com",
                "created_at": "2026-07-31T18:47:00"
            }
        }
    )


class TokenResponse(BaseModel):
    """Schema for auth token response."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ============================================================================
# Expense Schemas
# ============================================================================
class ExpenseCreate(BaseModel):
    """Schema for creating a new expense."""
    id: Optional[str] = Field(
        default=None,
        description="Optional unique ID for expense. If omitted, a UUID will be generated."
    )
    user_id: Optional[str] = Field(
        default="default_user",
        description="ID of the user owning this expense."
    )
    title: str = Field(..., description="Title or description of the expense", min_length=1)
    amount: float = Field(..., description="Expense amount in INR (must be positive)", gt=0)
    category: str = Field(..., description="Expense category (e.g. Food, Transport, Utilities)", min_length=1)
    date: DateType = Field(..., description="Date of expense in YYYY-MM-DD format")

    @field_validator("title", "category")
    @classmethod
    def strip_and_validate(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Field cannot be empty or whitespace only")
        return stripped


class ExpenseResponse(BaseModel):
    """Schema for expense output response."""
    id: str
    user_id: str = "default_user"
    title: str
    amount: float
    category: str
    date: str  # Output as string YYYY-MM-DD for JSON cleanliness

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "e4b52c08-410a-47df-9db2-8cb23e449df2",
                "user_id": "u-410a-47df-9db2",
                "title": "Grocery Shopping",
                "amount": 3200.00,
                "category": "Food",
                "date": "2026-07-31"
            }
        }
    )


class ExpenseSummaryResponse(BaseModel):
    """Schema for total expenses summary overall and by category."""
    total_amount: float = Field(..., description="Sum of all expenses in matched scope (INR)")
    total_count: int = Field(..., description="Total count of expenses")
    by_category: Dict[str, float] = Field(..., description="Total amounts grouped by category")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "total_amount": 11450.00,
                "total_count": 5,
                "by_category": {
                    "Food": 3200.00,
                    "Utilities": 1850.00,
                    "Shopping": 3000.00,
                    "Transport": 2000.00,
                    "Entertainment": 1400.00
                }
            }
        }
    )


class MonthlySummaryResponse(BaseModel):
    """Schema for monthly expense breakdown."""
    by_month: Dict[str, Dict[str, float]] = Field(
        ...,
        description="Monthly totals grouped by YYYY-MM and category"
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "by_month": {
                    "2026-07": {
                        "Food": 3200.00,
                        "Shopping": 3000.00
                    }
                }
            }
        }
    )
