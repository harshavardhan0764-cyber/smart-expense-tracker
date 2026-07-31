import csv
from datetime import datetime
import hashlib
import io
import json
import os
from pathlib import Path
import threading
from typing import List, Optional, Dict
import uuid

from src.models import (
    ExpenseCreate,
    ExpenseResponse,
    ExpenseSummaryResponse,
    MonthlySummaryResponse,
    UserRegister,
    UserResponse
)

# Password hashing helper using salted PBKDF2
def hash_password(password: str, salt: bytes = None) -> str:
    if salt is None:
        salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return f"{salt.hex()}:{key.hex()}"

def verify_password(stored_password: str, provided_password: str) -> bool:
    try:
        salt_hex, key_hex = stored_password.split(":")
        salt = bytes.fromhex(salt_hex)
        expected_key = bytes.fromhex(key_hex)
        key = hashlib.pbkdf2_hmac("sha256", provided_password.encode("utf-8"), salt, 100000)
        return key == expected_key
    except Exception:
        return False


class JSONUserStorage:
    """Handles JSON persistence and authentication for users."""

    def __init__(self, file_path: str = "data/users.json"):
        self.file_path = Path(file_path)
        self._lock = threading.Lock()
        self._ensure_file_exists()

    def _ensure_file_exists(self) -> None:
        with self._lock:
            if not self.file_path.parent.exists():
                self.file_path.parent.mkdir(parents=True, exist_ok=True)
            if not self.file_path.exists():
                with open(self.file_path, "w", encoding="utf-8") as f:
                    json.dump([], f, indent=2)

    def _read_data_unlocked(self) -> List[dict]:
        if not self.file_path.exists():
            return []
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return []

    def _write_data_unlocked(self, data: List[dict]) -> None:
        temp_file = self.file_path.with_suffix(".tmp")
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        temp_file.replace(self.file_path)

    def register(self, user_in: UserRegister) -> UserResponse:
        with self._lock:
            users = self._read_data_unlocked()
            
            # Check unique username and email
            if any(u["username"].lower() == user_in.username.lower() for u in users):
                raise ValueError("Username is already taken.")
            if any(u["email"].lower() == user_in.email.lower() for u in users):
                raise ValueError("Email is already registered.")

            user_id = f"u-{str(uuid.uuid4())[:8]}"
            hashed_pwd = hash_password(user_in.password)
            now_iso = datetime.now().isoformat()

            new_user = {
                "id": user_id,
                "username": user_in.username,
                "email": user_in.email.lower(),
                "password": hashed_pwd,
                "created_at": now_iso
            }

            users.append(new_user)
            self._write_data_unlocked(users)

            return UserResponse(
                id=new_user["id"],
                username=new_user["username"],
                email=new_user["email"],
                created_at=new_user["created_at"]
            )

    def authenticate(self, email_or_username: str, password: str) -> Optional[UserResponse]:
        with self._lock:
            users = self._read_data_unlocked()

        target = email_or_username.strip().lower()
        for u in users:
            if u["email"] == target or u["username"].lower() == target:
                if verify_password(u["password"], password):
                    return UserResponse(
                        id=u["id"],
                        username=u["username"],
                        email=u["email"],
                        created_at=u["created_at"]
                    )
        return None

    def get_by_id(self, user_id: str) -> Optional[UserResponse]:
        with self._lock:
            users = self._read_data_unlocked()
        for u in users:
            if u["id"] == user_id:
                return UserResponse(
                    id=u["id"],
                    username=u["username"],
                    email=u["email"],
                    created_at=u["created_at"]
                )
        return None

    def clear_all(self) -> None:
        with self._lock:
            self._write_data_unlocked([])


class JSONExpenseStorage:
    """Handles JSON persistence for expenses with user isolation and INR formatting."""

    def __init__(self, file_path: str = "data/expenses.json"):
        self.file_path = Path(file_path)
        self._lock = threading.Lock()
        self._ensure_file_exists()

    def _ensure_file_exists(self) -> None:
        with self._lock:
            if not self.file_path.parent.exists():
                self.file_path.parent.mkdir(parents=True, exist_ok=True)
            if not self.file_path.exists() or self.file_path.stat().st_size <= 2:
                sample_file = self.file_path.parent / "sample_expenses.json"
                if sample_file.exists() and sample_file.stat().st_size > 2:
                    try:
                        with open(sample_file, "r", encoding="utf-8") as sf:
                            sample_data = json.load(sf)
                        with open(self.file_path, "w", encoding="utf-8") as f:
                            json.dump(sample_data, f, indent=2)
                        return
                    except Exception:
                        pass
                with open(self.file_path, "w", encoding="utf-8") as f:
                    json.dump([], f, indent=2)

    def _read_data_unlocked(self) -> List[dict]:
        if not self.file_path.exists():
            return []
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return []

    def _write_data_unlocked(self, data: List[dict]) -> None:
        temp_file = self.file_path.with_suffix(".tmp")
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        try:
            temp_file.replace(self.file_path)
        except PermissionError:
            import time
            time.sleep(0.05)
            if temp_file.exists():
                with open(self.file_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                try:
                    temp_file.unlink()
                except Exception:
                    pass

    def get_all(
        self,
        user_id: Optional[str] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[ExpenseResponse]:
        with self._lock:
            raw_expenses = self._read_data_unlocked()

        results = []
        for item in raw_expenses:
            # User scope filter
            if user_id and item.get("user_id") not in [user_id, "default_user"]:
                continue

            # Category filter
            if category:
                cat_lower = category.strip().lower()
                item_cat = item.get("category", "").strip().lower()
                is_food_alias = cat_lower in ["food", "food & drinks"] and item_cat in ["food", "food & drinks"]
                if not is_food_alias and item_cat != cat_lower:
                    continue
            
            # Search query filter (title or category)
            if search:
                query = search.strip().lower()
                title_match = query in item["title"].lower()
                cat_match = query in item["category"].lower()
                if not (title_match or cat_match):
                    continue

            # Date range filter
            if start_date and item["date"] < start_date:
                continue
            if end_date and item["date"] > end_date:
                continue

            results.append(ExpenseResponse(**item))

        # Sort by date descending
        results.sort(key=lambda x: x.date, reverse=True)
        return results

    def add(self, expense_in: ExpenseCreate) -> ExpenseResponse:
        with self._lock:
            data = self._read_data_unlocked()
            
            # Generate UUID if missing
            expense_id = expense_in.id or str(uuid.uuid4())
            
            # Prevent duplicate ID
            if any(item["id"] == expense_id for item in data):
                raise ValueError(f"Expense with ID '{expense_id}' already exists.")

            new_item = {
                "id": expense_id,
                "user_id": expense_in.user_id or "default_user",
                "title": expense_in.title,
                "amount": round(expense_in.amount, 2),
                "category": expense_in.category,
                "date": expense_in.date.isoformat()
            }

            data.append(new_item)
            self._write_data_unlocked(data)
            return ExpenseResponse(**new_item)

    def delete(self, expense_id: str, user_id: Optional[str] = None) -> bool:
        with self._lock:
            data = self._read_data_unlocked()
            initial_count = len(data)
            
            if user_id:
                data = [item for item in data if not (item["id"] == expense_id and item.get("user_id") in [user_id, "default_user"])]
            else:
                data = [item for item in data if item["id"] != expense_id]

            if len(data) == initial_count:
                return False
            self._write_data_unlocked(data)
            return True

    def get_summary(
        self,
        user_id: Optional[str] = None,
        category: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> ExpenseSummaryResponse:
        expenses = self.get_all(user_id=user_id, category=category, start_date=start_date, end_date=end_date)
        
        total_amount = sum(item.amount for item in expenses)
        by_category: Dict[str, float] = {}
        for item in expenses:
            by_category[item.category] = round(by_category.get(item.category, 0.0) + item.amount, 2)

        return ExpenseSummaryResponse(
            total_amount=round(total_amount, 2),
            total_count=len(expenses),
            by_category=by_category
        )

    def get_monthly_summary(self, user_id: Optional[str] = None) -> MonthlySummaryResponse:
        expenses = self.get_all(user_id=user_id)
        by_month: Dict[str, Dict[str, float]] = {}

        for item in expenses:
            month_key = item.date[:7]  # YYYY-MM
            if month_key not in by_month:
                by_month[month_key] = {}
            current_cat_total = by_month[month_key].get(item.category, 0.0)
            by_month[month_key][item.category] = round(current_cat_total + item.amount, 2)

        return MonthlySummaryResponse(by_month=by_month)

    def export_to_csv(
        self,
        user_id: Optional[str] = None,
        category: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> str:
        expenses = self.get_all(user_id=user_id, category=category, start_date=start_date, end_date=end_date)
        # Ensure expenses are sorted by Date descending (newest first)
        expenses.sort(key=lambda x: x.date, reverse=True)

        output = io.StringIO()
        # Write UTF-8 Byte Order Mark (BOM) so Microsoft Excel opens file cleanly as UTF-8
        output.write('\ufeff')
        writer = csv.writer(output)
        writer.writerow(["ID", "User ID", "Title", "Amount (INR)", "Category", "Date"])
        for item in expenses:
            # Export Amount as plain numeric float (e.g. 3200.00) so Excel treats it as a number
            amount_val = f"{item.amount:.2f}"
            writer.writerow([item.id, item.user_id, item.title, amount_val, item.category, item.date])
        return output.getvalue()

    def clear_all(self) -> None:
        """Helper for test isolation."""
        with self._lock:
            self._write_data_unlocked([])
