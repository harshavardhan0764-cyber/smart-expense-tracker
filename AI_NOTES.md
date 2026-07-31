# AI Notes & Engineering Transparency

This document details the usage of AI assistance during the development of the **Smart Expense Tracker REST API & Dashboard**, outlining what was generated, reviewed, modified, and rejected.

---

## 1. AI-Generated Parts

- **Auth Schemas & User Storage**: Initial model schemas for `UserRegister`, `UserLogin`, `UserResponse` in `src/models.py` and `JSONUserStorage` in `src/storage.py`.
- **INR Currency Formatting Helpers**: `formatINR(amount)` helper function utilizing `toLocaleString('en-IN')` in `src/static/app.js`.
- **Chart Auto-Update Handlers**: Triggering `renderBarChart()` and `renderDonutChart()` upon expense addition or deletion.
- **Pytest Expansion**: Test cases covering user registration, login authentication, invalid credentials, and CSV export in `tests/test_main.py`.

---

## 2. What Was Reviewed, Modified, or Tested

- **Realistic Demo Data Calibration**:
  - *Reviewed*: Evaluated initial sample data values which showed unrealistic ₹50,000 expenses against a ₹10,000 budget.
  - *Modified*: Re-calibrated seed expenses to a realistic setup (Target Monthly Budget: **₹25,000.00**, Seed Expenses: **₹11,450.00** across Food ₹3,200, Shopping ₹3,000, Transport ₹2,000, Utilities ₹1,850, Entertainment ₹1,400).
- **Non-Intrusive Warning Banner Logic**:
  - *Reviewed*: Initial code displayed a bright red warning banner at 80% spend.
  - *Modified*: Shifted condition so the warning banner appears ONLY when total spend actually reaches or exceeds 100% of the target budget (`spend >= budgetTarget`).
- **Salted Password Hashing**:
  - *Reviewed*: Ensured user passwords are never stored in plain text in `data/users.json`.
  - *Modified*: Implemented PBKDF2/SHA256 with random 16-byte salt (`hashlib.pbkdf2_hmac`) to guarantee secure password storage without external C-extensions.
- **Auto Chart Re-Rendering**:
  - *Modified*: Ensured `Chart.js` instances are explicitly destroyed via `.destroy()` before re-creating datasets on add/delete actions to avoid memory leaks or visual glitches.

---

## 3. Rejected AI Suggestions & Rationale

1. **Rejected Persistent Banner at 80% Budget**:
   - *Suggestion*: AI suggested displaying a sticky red notification at 80% budget consumption.
   - *Reason for Rejection*: Reviewers noted prominent red banners before budget limits are hit distract from standard usage. Banner display was constrained strictly to actual budget overruns (>=100%).

2. **Rejected Third-Party OAuth / External Auth Services**:
   - *Suggestion*: AI suggested integrating Google OAuth or Auth0.
   - *Reason for Rejection*: External auth adds external network dependencies and secret key management overhead. Self-contained JSON-backed salted user authentication (`/auth/register`, `/auth/login`) ensures zero-config setup for reviewers.
