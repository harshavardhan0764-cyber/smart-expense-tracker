// API Endpoints Base (Auto-detects localhost if opened directly via file://)
const API_BASE = (window.location.protocol === "file:") ? "http://127.0.0.1:8000" : "";

// State
let currentCategory = "ALL";
let searchQuery = "";
let startDate = "";
let endDate = "";

let expensesData = [];
let summaryData = { total_amount: 0, total_count: 0, by_category: {} };
let monthlyData = {};

let savedBudget = localStorage.getItem("budgetTarget");
if (!savedBudget || savedBudget === "0" || savedBudget === "10000") {
  localStorage.setItem("budgetTarget", "25000");
  savedBudget = "25000";
}
let budgetTarget = parseFloat(savedBudget) || 25000.00;
let currentUser = JSON.parse(localStorage.getItem("currentUser")) || null;
let authToken = localStorage.getItem("authToken") || null;

let barChartInstance = null;
let donutChartInstance = null;

// Multi-Tab Real-Time Sync Channel
const syncChannel = "BroadcastChannel" in window ? new BroadcastChannel("expense_tracker_sync") : null;

// Category Emoji Icons
const CATEGORY_ICONS = {
  "Food & Drinks": "🍔",
  Food: "🍔",
  Transport: "🚌",
  Shopping: "👟",
  Utilities: "💡",
  Entertainment: "🎬",
  Healthcare: "🏥",
  Housing: "🏠",
  Other: "📦"
};

// Helper: Format Indian Rupee (INR ₹)
function formatINR(amount) {
  const num = Math.abs(amount) || 0;
  return "₹" + num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// DOM Elements
const htmlEl = document.documentElement;
const themeToggleBtn = document.getElementById("themeToggleBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const searchInputEl = document.getElementById("searchInput");
const startDateInput = document.getElementById("startDateInput");
const endDateInput = document.getElementById("endDateInput");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");

const totalBalanceAmountEl = document.getElementById("totalBalanceAmount");
const budgetTargetDisplayEl = document.getElementById("budgetTargetDisplay");
const spentPercentageTextEl = document.getElementById("spentPercentageText");
const budgetAlertBar = document.getElementById("budgetAlertBar");
const budgetAlertMsg = document.getElementById("budgetAlertMsg");
const editBudgetBtn = document.getElementById("editBudgetBtn");

const statTotalExpenseEl = document.getElementById("statTotalExpense");
const statTotalCountSubEl = document.getElementById("statTotalCountSub");
const statDailyAvgEl = document.getElementById("statDailyAvg");
const statHighestCategoryEl = document.getElementById("statHighestCategory");
const statHighestCategorySubEl = document.getElementById("statHighestCategorySub");
const txCountBadge = document.getElementById("txCountBadge");

const authModalBtn = document.getElementById("authModalBtn");
const userAvatarBtn = document.getElementById("userAvatarBtn");
const profileDropdown = document.getElementById("profileDropdown");
const dropdownUsername = document.getElementById("dropdownUsername");
const dropdownUserEmail = document.getElementById("dropdownUserEmail");
const dropdownProfileBtn = document.getElementById("dropdownProfileBtn");
const dropdownSettingsBtn = document.getElementById("dropdownSettingsBtn");
const dropdownLogoutBtn = document.getElementById("dropdownLogoutBtn");

const profileModal = document.getElementById("profileModal");
const closeProfileModalBtn = document.getElementById("closeProfileModalBtn");
const closeProfileBtn2 = document.getElementById("closeProfileBtn2");
const profUsername = document.getElementById("profUsername");
const profEmail = document.getElementById("profEmail");

const transactionsListEl = document.getElementById("transactionsList");
const categoryPillsEl = document.getElementById("categoryPills");
const categoryProgressContainer = document.getElementById("categoryProgressContainer");

// Modals & Auth Elements
const addModal = document.getElementById("addModal");
const openAddModalBtn = document.getElementById("openAddModalBtn");
const fabBtn = document.getElementById("fabBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const addExpenseForm = document.getElementById("addExpenseForm");
const expenseDateInput = document.getElementById("expenseDate");

const authModal = document.getElementById("authModal");
const closeAuthModalBtn = document.getElementById("closeAuthModalBtn");
const loginTabBtn = document.getElementById("loginTabBtn");
const registerTabBtn = document.getElementById("registerTabBtn");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authSuccessAlert = document.getElementById("authSuccessAlert");
const authErrorAlert = document.getElementById("authErrorAlert");
const authErrorAlertMsg = document.getElementById("authErrorAlertMsg");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");

// Register Form Input Elements for Real-Time Validation
const regUsernameInput = document.getElementById("regUsername");
const regEmailInput = document.getElementById("regEmail");
const regPasswordInput = document.getElementById("regPassword");
const regConfirmPasswordInput = document.getElementById("regConfirmPassword");
const registerSubmitBtn = document.getElementById("registerSubmitBtn");
const pwdStrengthBar = document.getElementById("pwdStrengthBar");
const pwdStrengthText = document.getElementById("pwdStrengthText");
const confirmMatchText = document.getElementById("confirmMatchText");

const budgetModal = document.getElementById("budgetModal");
const closeBudgetModalBtn = document.getElementById("closeBudgetModalBtn");
const cancelBudgetModalBtn = document.getElementById("cancelBudgetModalBtn");
const budgetForm = document.getElementById("budgetForm");
const budgetTargetInput = document.getElementById("budgetTargetInput");

const deleteModal = document.getElementById("deleteModal");
const closeDeleteModalBtn = document.getElementById("closeDeleteModalBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

let pendingDeleteExpenseId = null;

const toastEl = document.getElementById("toast");

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme") || "light";
  setTheme(savedTheme);

  // Set default date picker to today
  expenseDateInput.value = new Date().toISOString().split("T")[0];

  updateUserUI();
  setupEventListeners();
  setupRealTimeSync();
  loadAllData();

  // Polling fallback every 4 seconds
  setInterval(() => {
    loadAllData(false);
  }, 4000);
});

// Setup Real-Time Sync across tabs
function setupRealTimeSync() {
  if (syncChannel) {
    syncChannel.onmessage = (event) => {
      if (event.data && event.data.type === "EXPENSE_UPDATED") {
        loadAllData(false);
      }
    };
  }
}

function broadcastUpdate() {
  if (syncChannel) {
    syncChannel.postMessage({ type: "EXPENSE_UPDATED", timestamp: Date.now() });
  }
}

// User Profile UI State
function updateUserUI() {
  if (currentUser) {
    dropdownUsername.textContent = currentUser.username;
    dropdownUserEmail.textContent = currentUser.email || `${currentUser.username}@expensetracker.in`;
    profUsername.textContent = currentUser.username;
    profEmail.textContent = currentUser.email || `${currentUser.username}@expensetracker.in`;
    
    // Hide Login/Sign Up button completely when logged in
    authModalBtn.classList.add("hidden");
  } else {
    dropdownUsername.textContent = "Demo User";
    dropdownUserEmail.textContent = "demo@expensetracker.in";
    profUsername.textContent = "Demo User";
    profEmail.textContent = "demo@expensetracker.in";
    
    // Show Login/Sign Up button when not logged in
    authModalBtn.classList.remove("hidden");
  }
}

// Event Listeners
function setupEventListeners() {
  // Theme Toggle
  themeToggleBtn.addEventListener("click", () => {
    const nextTheme = htmlEl.getAttribute("data-theme") === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  });

  // Export CSV
  exportCsvBtn.addEventListener("click", handleExportCsv);

  // Add Modal Toggles
  openAddModalBtn.addEventListener("click", () => addModal.classList.add("active"));
  fabBtn.addEventListener("click", () => addModal.classList.add("active"));
  closeModalBtn.addEventListener("click", () => addModal.classList.remove("active"));
  cancelModalBtn.addEventListener("click", () => addModal.classList.remove("active"));
  addModal.addEventListener("click", (e) => { if (e.target === addModal) addModal.classList.remove("active"); });

  // Avatar Click -> Toggle Profile Dropdown
  userAvatarBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    profileDropdown.classList.toggle("hidden");
  });

  // Close profile dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!profileDropdown.classList.contains("hidden") && !profileDropdown.contains(e.target) && e.target !== userAvatarBtn) {
      profileDropdown.classList.add("hidden");
    }
  });

  dropdownProfileBtn.addEventListener("click", () => {
    profileDropdown.classList.add("hidden");
    profileModal.classList.add("active");
  });

  dropdownSettingsBtn.addEventListener("click", () => {
    profileDropdown.classList.add("hidden");
    budgetTargetInput.value = budgetTarget;
    budgetModal.classList.add("active");
  });

  dropdownLogoutBtn.addEventListener("click", () => {
    profileDropdown.classList.add("hidden");
    handleLogout();
  });

  closeProfileModalBtn.addEventListener("click", () => profileModal.classList.remove("active"));
  closeProfileBtn2.addEventListener("click", () => profileModal.classList.remove("active"));

  // Auth Modal Toggles
  authModalBtn.addEventListener("click", () => {
    clearAllFieldErrors();
    authSuccessAlert.classList.add("hidden");
    authErrorAlert.classList.add("hidden");
    authModal.classList.add("active");
  });
  
  closeAuthModalBtn.addEventListener("click", () => authModal.classList.remove("active"));
  authModal.addEventListener("click", (e) => { if (e.target === authModal) authModal.classList.remove("active"); });

  loginTabBtn.addEventListener("click", () => {
    loginTabBtn.classList.add("active");
    registerTabBtn.classList.remove("active");
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    authErrorAlert.classList.add("hidden");
    clearAllFieldErrors();
  });

  registerTabBtn.addEventListener("click", () => {
    registerTabBtn.classList.add("active");
    loginTabBtn.classList.remove("active");
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
    authSuccessAlert.classList.add("hidden");
    authErrorAlert.classList.add("hidden");
    clearAllFieldErrors();
    validateRegisterForm();
  });

  // Password Eye Toggle (Show / Hide)
  document.querySelectorAll(".toggle-pwd-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const targetInput = document.getElementById(targetId);
      if (targetInput) {
        const isPwd = targetInput.type === "password";
        targetInput.type = isPwd ? "text" : "password";
        btn.textContent = isPwd ? "🙈" : "👁️";
      }
    });
  });

  // Forgot Password Listener
  forgotPasswordBtn.addEventListener("click", () => {
    showToast("🔑 Password reset instructions sent to your email!");
  });

  // Real-Time Register Validation Listeners
  regUsernameInput.addEventListener("input", validateRegisterForm);
  regEmailInput.addEventListener("input", validateRegisterForm);
  regPasswordInput.addEventListener("input", () => {
    evaluatePasswordStrength(regPasswordInput.value);
    validateRegisterForm();
  });
  regConfirmPasswordInput.addEventListener("input", validateRegisterForm);

  loginForm.addEventListener("submit", handleLogin);
  registerForm.addEventListener("submit", handleRegister);

  // Budget Modal Toggles
  editBudgetBtn.addEventListener("click", () => {
    budgetTargetInput.value = budgetTarget;
    budgetModal.classList.add("active");
  });
  closeBudgetModalBtn.addEventListener("click", () => budgetModal.classList.remove("active"));
  cancelBudgetModalBtn.addEventListener("click", () => budgetModal.classList.remove("active"));
  budgetModal.addEventListener("click", (e) => { if (e.target === budgetModal) budgetModal.classList.remove("active"); });

  // Delete Confirmation Modal Toggles
  closeDeleteModalBtn.addEventListener("click", hideDeleteModal);
  cancelDeleteBtn.addEventListener("click", hideDeleteModal);
  deleteModal.addEventListener("click", (e) => { if (e.target === deleteModal) hideDeleteModal(); });
  confirmDeleteBtn.addEventListener("click", handleConfirmDelete);

  // Form Submissions
  addExpenseForm.addEventListener("submit", handleAddExpense);
  budgetForm.addEventListener("submit", handleSaveBudget);

  // Category Filter Pills
  categoryPillsEl.addEventListener("click", (e) => {
    if (e.target.classList.contains("pill")) {
      document.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
      e.target.classList.add("active");
      currentCategory = e.target.getAttribute("data-category");
      fetchExpenses();
    }
  });

  // Search & Date Filters
  let searchTimer;
  searchInputEl.addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = e.target.value;
      fetchExpenses();
    }, 300);
  });

  startDateInput.addEventListener("change", (e) => {
    startDate = e.target.value;
    fetchExpenses();
  });

  endDateInput.addEventListener("change", (e) => {
    endDate = e.target.value;
    fetchExpenses();
  });

  clearFiltersBtn.addEventListener("click", () => {
    searchInputEl.value = "";
    startDateInput.value = "";
    endDateInput.value = "";
    searchQuery = "";
    startDate = "";
    endDate = "";
    fetchExpenses();
  });
}

function setTheme(theme) {
  htmlEl.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  themeToggleBtn.textContent = theme === "dark" ? "☀️" : "🌙";
  if (monthlyData) renderBarChart(monthlyData);
  if (summaryData.by_category) renderDonutChart(summaryData.by_category);
}

// Password Strength Evaluator
function evaluatePasswordStrength(password) {
  pwdStrengthBar.className = "pwd-strength-bar";
  pwdStrengthText.className = "pwd-strength-text";

  if (!password) {
    pwdStrengthBar.style.width = "0%";
    pwdStrengthText.textContent = "";
    return;
  }

  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) {
    pwdStrengthBar.classList.add("strength-weak");
    pwdStrengthText.classList.add("weak");
    pwdStrengthText.textContent = "🔴 Weak password";
  } else if (score <= 4) {
    pwdStrengthBar.classList.add("strength-medium");
    pwdStrengthText.classList.add("medium");
    pwdStrengthText.textContent = "🟡 Medium strength";
  } else {
    pwdStrengthBar.classList.add("strength-strong");
    pwdStrengthText.classList.add("strong");
    pwdStrengthText.textContent = "🟢 Strong password";
  }
}

// Real-Time Register Form Validation
function validateRegisterForm() {
  const username = regUsernameInput.value.trim();
  const email = regEmailInput.value.trim();
  const password = regPasswordInput.value;
  const confirmPwd = regConfirmPasswordInput.value;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isUsernameValid = username.length >= 3;
  const isEmailValid = emailRegex.test(email);
  const isPasswordValid = password.length >= 6;
  const isConfirmValid = confirmPwd.length > 0 && password === confirmPwd;

  if (confirmPwd.length > 0) {
    if (isConfirmValid) {
      confirmMatchText.textContent = "✅ Passwords match";
      confirmMatchText.className = "confirm-match-text valid";
    } else {
      confirmMatchText.textContent = "❌ Passwords do not match";
      confirmMatchText.className = "confirm-match-text invalid";
    }
  } else {
    confirmMatchText.textContent = "";
  }

  if (isUsernameValid && isEmailValid && isPasswordValid && isConfirmValid) {
    registerSubmitBtn.disabled = false;
  } else {
    registerSubmitBtn.disabled = true;
  }
}

// Field Validation & Alert Helpers
function showFieldError(inputId, errorId, message) {
  const input = document.getElementById(inputId);
  const errSpan = document.getElementById(errorId);
  if (input) input.classList.add("input-error");
  if (errSpan) errSpan.textContent = message;
}

function showAuthAlertError(message) {
  authErrorAlertMsg.textContent = message;
  authErrorAlert.classList.remove("hidden");
}

function clearAllFieldErrors() {
  document.querySelectorAll(".input-error").forEach(el => el.classList.remove("input-error"));
  document.querySelectorAll(".field-error-msg").forEach(el => el.textContent = "");
  authErrorAlert.classList.add("hidden");
}

function setButtonLoading(buttonId, isLoading, defaultText) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  if (isLoading) {
    btn.disabled = true;
    btn.innerHTML = `<span class="btn-text">⏳ Processing...</span>`;
  } else {
    btn.disabled = false;
    btn.innerHTML = `<span class="btn-text">${defaultText}</span>`;
  }
}

// Fetch All Data
async function loadAllData(showSpinner = true) {
  await Promise.all([
    fetchExpenses(showSpinner),
    fetchSummary(),
    fetchMonthlySummary()
  ]);
}

// Fetch Expenses List
async function fetchExpenses(showSpinner = true) {
  try {
    if (showSpinner && transactionsListEl.children.length === 0) {
      transactionsListEl.innerHTML = `<div class="loading-spinner">Loading expenses...</div>`;
    }

    let url = `${API_BASE}/expenses?`;
    if (currentUser) url += `user_id=${encodeURIComponent(currentUser.id)}&`;
    if (currentCategory !== "ALL") url += `category=${encodeURIComponent(currentCategory)}&`;
    if (searchQuery.trim()) url += `search=${encodeURIComponent(searchQuery.trim())}&`;
    if (startDate) url += `start_date=${encodeURIComponent(startDate)}&`;
    if (endDate) url += `end_date=${encodeURIComponent(endDate)}&`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load expenses");
    expensesData = await res.json();
    
    txCountBadge.textContent = `${expensesData.length} Items`;
    renderTransactions(expensesData);
    calculateMetrics(expensesData);
  } catch (err) {
    console.error(err);
    transactionsListEl.innerHTML = `<div class="error-msg">Error loading transactions.</div>`;
  }
}

// Fetch Summary (Fixes NaN% Spent bug & computes Highest Spending Category)
async function fetchSummary() {
  try {
    let url = `${API_BASE}/expenses/summary?`;
    if (currentUser) url += `user_id=${encodeURIComponent(currentUser.id)}&`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load summary");
    summaryData = await res.json();

    // UI Stats Updates in INR ₹
    statTotalExpenseEl.textContent = formatINR(summaryData.total_amount);
    statTotalCountSubEl.textContent = `${summaryData.total_count} items recorded`;

    // Compute Highest Spending Category
    let highestCat = null;
    let highestAmt = 0;
    if (summaryData.by_category && Object.keys(summaryData.by_category).length > 0) {
      for (const [cat, amt] of Object.entries(summaryData.by_category)) {
        if (amt > highestAmt) {
          highestAmt = amt;
          highestCat = cat;
        }
      }
    }
    if (highestCat && highestAmt > 0) {
      const icon = CATEGORY_ICONS[highestCat] || "📦";
      statHighestCategoryEl.textContent = `${icon} ${highestCat}`;
      statHighestCategorySubEl.textContent = `${formatINR(highestAmt)} spent`;
    } else {
      statHighestCategoryEl.textContent = "No expenses yet";
      statHighestCategorySubEl.textContent = "No category data";
    }
    
    // Remaining Budget & Percentage Spent Computation
    const remaining = Math.max(0, budgetTarget - summaryData.total_amount);
    totalBalanceAmountEl.textContent = formatINR(remaining);
    budgetTargetDisplayEl.textContent = formatINR(budgetTarget);

    let spentPctText = "0% Spent";
    if (!budgetTarget || budgetTarget <= 0) {
      spentPctText = "Budget Not Set";
    } else {
      const pctSpent = Math.min(100, Math.round((summaryData.total_amount / budgetTarget) * 100));
      spentPctText = `${pctSpent}% Spent`;
    }
    spentPercentageTextEl.textContent = spentPctText;

    // Non-intrusive Budget Alert Bar (Triggers ONLY when spend >= budget limit 100%)
    if (summaryData.total_amount >= budgetTarget && budgetTarget > 0) {
      budgetAlertMsg.textContent = `⚠️ Budget Exceeded! You have spent ${formatINR(summaryData.total_amount)} of your ${formatINR(budgetTarget)} limit.`;
      budgetAlertBar.classList.remove("hidden");
    } else {
      budgetAlertBar.classList.add("hidden");
    }

    renderDonutChart(summaryData.by_category);
    renderCategoryProgress(summaryData.by_category);
  } catch (err) {
    console.error(err);
  }
}

// Fetch Monthly Summary
async function fetchMonthlySummary() {
  try {
    let url = `${API_BASE}/expenses/summary/monthly?`;
    if (currentUser) url += `user_id=${encodeURIComponent(currentUser.id)}&`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load monthly summary");
    const data = await res.json();
    monthlyData = data.by_month || {};
    renderBarChart(monthlyData);
  } catch (err) {
    console.error(err);
  }
}

// Calculate Metrics (Daily Average Spend)
function calculateMetrics(list) {
  if (!list || list.length === 0) {
    statDailyAvgEl.textContent = formatINR(0);
    return;
  }
  const uniqueDates = new Set(list.map(x => x.date)).size;
  const totalAmount = list.reduce((sum, item) => sum + item.amount, 0);
  const avg = uniqueDates > 0 ? (totalAmount / uniqueDates) : 0;
  statDailyAvgEl.textContent = `${formatINR(avg)} / day`;
}

// Render Transactions List (with helpful empty state)
function renderTransactions(list) {
  if (!list || list.length === 0) {
    transactionsListEl.innerHTML = `
      <div class="empty-state-box">
        <div class="empty-icon">📝</div>
        <div class="empty-title">No expenses found</div>
        <p class="empty-sub">No expenses yet. Click <strong>+ Add Expense</strong> to create your first expense.</p>
      </div>
    `;
    return;
  }

  transactionsListEl.innerHTML = list.map(item => {
    const icon = CATEGORY_ICONS[item.category] || "💸";
    return `
      <div class="transaction-item">
        <div class="item-left">
          <div class="item-icon-box">${icon}</div>
          <div>
            <div class="item-title">${escapeHtml(item.title)}</div>
            <div class="item-meta">${item.category} • ${item.date}</div>
          </div>
        </div>
        <div class="item-right">
          <div class="item-amount">−${formatINR(item.amount)}</div>
          <button class="item-delete-btn" onclick="promptDeleteExpense('${item.id}')" title="Delete Expense">🗑️</button>
        </div>
      </div>
    `;
  }).join("");
}

// Render Category Progress Bars
function renderCategoryProgress(byCategory) {
  if (!byCategory || Object.keys(byCategory).length === 0) {
    categoryProgressContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem;">No category spend recorded yet.</div>`;
    return;
  }

  const entries = Object.entries(byCategory);
  const maxCategorySpend = Math.max(...entries.map(([_, amt]) => amt), 1);

  categoryProgressContainer.innerHTML = entries.map(([cat, amt]) => {
    const percentage = Math.min(100, Math.round((amt / maxCategorySpend) * 100));
    return `
      <div class="progress-item-row">
        <div class="progress-info">
          <span class="progress-category-name">${cat}</span>
          <span class="progress-amount">${formatINR(amt)}</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${percentage}%;"></div>
        </div>
      </div>
    `;
  }).join("");
}

// Render Bar Chart
function renderBarChart(byMonth) {
  const emptyOverlay = document.getElementById("monthlyChartEmptyOverlay");
  const hasData = byMonth && Object.keys(byMonth).some(month => {
    const catMap = byMonth[month] || {};
    return Object.values(catMap).some(amt => amt > 0);
  });

  if (!hasData) {
    if (emptyOverlay) emptyOverlay.classList.remove("hidden");
    if (barChartInstance) barChartInstance.destroy();
    return;
  } else {
    if (emptyOverlay) emptyOverlay.classList.add("hidden");
  }

  const ctx = document.getElementById("monthlyBarChart").getContext("2d");
  const isDark = htmlEl.getAttribute("data-theme") === "dark";
  const gridColor = isDark ? "#334155" : "#F3F4F6";
  const textColor = isDark ? "#94A3B8" : "#64748B";

  const labels = Object.keys(byMonth).sort();
  const totals = labels.map(month => {
    const catMap = byMonth[month] || {};
    return Object.values(catMap).reduce((a, b) => a + b, 0);
  });

  const backgroundColors = totals.map((_, idx) => 
    idx === totals.length - 1 ? "#6C5CE7" : (isDark ? "#334155" : "#CBD5E1")
  );

  if (barChartInstance) barChartInstance.destroy();

  barChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Monthly Spend (₹)",
        data: totals,
        backgroundColor: backgroundColors,
        borderRadius: 8,
        barThickness: 24
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: textColor } },
        y: { grid: { color: gridColor }, ticks: { color: textColor }, beginAtZero: true }
      }
    }
  });
}

// Render Donut Chart
function renderDonutChart(byCategory) {
  const emptyOverlay = document.getElementById("donutChartEmptyOverlay");
  const hasData = byCategory && Object.keys(byCategory).some(cat => byCategory[cat] > 0);

  if (!hasData) {
    if (emptyOverlay) emptyOverlay.classList.remove("hidden");
    if (donutChartInstance) donutChartInstance.destroy();
    return;
  } else {
    if (emptyOverlay) emptyOverlay.classList.add("hidden");
  }

  const ctx = document.getElementById("categoryDonutChart").getContext("2d");
  const isDark = htmlEl.getAttribute("data-theme") === "dark";
  const textColor = isDark ? "#F8FAFC" : "#1E2229";

  const labels = Object.keys(byCategory);
  const dataValues = Object.values(byCategory);

  const chartColors = ["#6C5CE7", "#FF6B4A", "#10B981", "#F59E0B", "#3B82F6", "#EC4899", "#8B5CF6"];

  if (donutChartInstance) donutChartInstance.destroy();

  donutChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [{
        data: dataValues,
        backgroundColor: chartColors,
        borderWidth: 2,
        borderColor: isDark ? "#1E293B" : "#FFFFFF"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { boxWidth: 12, color: textColor, font: { family: "Outfit", size: 12 } }
        }
      },
      cutout: "70%"
    }
  });
}

// Auth Handlers
async function handleLogin(e) {
  e.preventDefault();
  clearAllFieldErrors();

  const identifier = document.getElementById("loginIdentifier").value.trim();
  const pwd = document.getElementById("loginPassword").value;

  let isValid = true;
  if (!identifier) {
    showFieldError("loginIdentifier", "loginIdentifierError", "Please enter your email or username");
    isValid = false;
  }
  if (!pwd) {
    showFieldError("loginPassword", "loginPasswordError", "Please enter your password");
    isValid = false;
  }
  if (!isValid) return;

  setButtonLoading("loginSubmitBtn", true, "Login");

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email_or_username: identifier, password: pwd })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || "Login failed");
    }

    const data = await res.json();
    currentUser = data.user;
    authToken = data.access_token;

    localStorage.setItem("currentUser", JSON.stringify(currentUser));
    localStorage.setItem("authToken", authToken);

    updateUserUI();
    authModal.classList.remove("active");
    loginForm.reset();
    showToast(`👋 Welcome back, ${currentUser.username}!`);
    loadAllData();
  } catch (err) {
    showAuthAlertError(`❌ ${err.message}`);
    showToast(`❌ Login Error: ${err.message}`);
  } finally {
    setButtonLoading("loginSubmitBtn", false, "Login");
  }
}

async function handleRegister(e) {
  e.preventDefault();
  clearAllFieldErrors();

  const username = regUsernameInput.value.trim();
  const email = regEmailInput.value.trim();
  const password = regPasswordInput.value;
  const confirmPassword = regConfirmPasswordInput.value;

  if (password !== confirmPassword) {
    showFieldError("regConfirmPassword", "regConfirmPasswordError", "Passwords do not match");
    return;
  }

  setButtonLoading("registerSubmitBtn", true, "Register Account");

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || "Registration failed");
    }

    authSuccessAlert.classList.remove("hidden");
    loginTabBtn.click();
    document.getElementById("loginIdentifier").value = username;
    registerForm.reset();
    pwdStrengthBar.style.width = "0%";
    pwdStrengthText.textContent = "";
    confirmMatchText.textContent = "";
    showToast("🎉 Account created successfully! Please log in.");
  } catch (err) {
    showAuthAlertError(`❌ ${err.message}`);
    showToast(`❌ Registration Error: ${err.message}`);
  } finally {
    setButtonLoading("registerSubmitBtn", false, "Register Account");
    validateRegisterForm();
  }
}

function handleLogout() {
  currentUser = null;
  authToken = null;
  localStorage.removeItem("currentUser");
  localStorage.removeItem("authToken");
  updateUserUI();
  showToast("Logged out successfully.");
  loadAllData();
}

// Add Expense Handler (Triggers auto chart update)
async function handleAddExpense(e) {
  e.preventDefault();
  clearAllFieldErrors();

  const title = document.getElementById("expenseTitle").value.trim();
  const amount = parseFloat(document.getElementById("expenseAmount").value);
  const category = document.getElementById("expenseCategory").value;
  const date = document.getElementById("expenseDate").value;
  const customId = document.getElementById("expenseCustomId").value.trim();

  let isValid = true;
  if (!title) {
    showFieldError("expenseTitle", "expenseTitleError", "Title is required");
    isValid = false;
  }
  if (isNaN(amount) || amount <= 0) {
    showFieldError("expenseAmount", "expenseAmountError", "Amount must be a positive number");
    isValid = false;
  }
  if (!date) {
    showFieldError("expenseDate", "expenseDateError", "Date is required");
    isValid = false;
  }
  if (!isValid) return;

  const payload = { title, amount, category, date };
  if (customId) payload.id = customId;
  if (currentUser) payload.user_id = currentUser.id;

  setButtonLoading("saveExpenseSubmitBtn", true, "Save Expense");

  try {
    const res = await fetch(`${API_BASE}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || "Failed to add expense");
    }

    showToast("✅ Expense added successfully!");
    addModal.classList.remove("active");
    addExpenseForm.reset();
    document.getElementById("expenseDate").value = new Date().toISOString().split("T")[0];

    broadcastUpdate();
    await loadAllData();
  } catch (err) {
    showToast(`❌ Error: ${err.message}`);
  } finally {
    setButtonLoading("saveExpenseSubmitBtn", false, "Save Expense");
  }
}

// Save Budget Target
function handleSaveBudget(e) {
  e.preventDefault();
  const val = parseFloat(budgetTargetInput.value);
  if (!isNaN(val) && val > 0) {
    budgetTarget = val;
    localStorage.setItem("budgetTarget", budgetTarget);
    budgetModal.classList.remove("active");
    showToast("🎯 Monthly budget updated!");
    fetchSummary();
  } else {
    showFieldError("budgetTargetInput", "budgetTargetError", "Please enter a valid budget amount");
  }
}

// Delete Expense Confirmation Flow
function promptDeleteExpense(id) {
  pendingDeleteExpenseId = id;
  deleteModal.classList.add("active");
}

function hideDeleteModal() {
  pendingDeleteExpenseId = null;
  deleteModal.classList.remove("active");
}

async function handleConfirmDelete() {
  if (!pendingDeleteExpenseId) return;
  const idToDelete = pendingDeleteExpenseId;
  hideDeleteModal();
  await executeDeleteExpense(idToDelete);
}

async function executeDeleteExpense(id) {
  try {
    let url = `${API_BASE}/expenses/${id}`;
    if (currentUser) url += `?user_id=${encodeURIComponent(currentUser.id)}`;

    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete expense");

    showToast("🗑️ Expense deleted!");
    broadcastUpdate();
    await loadAllData();
  } catch (err) {
    showToast(`❌ Error: ${err.message}`);
  }
}

// Backward compatibility alias
function deleteExpense(id) {
  promptDeleteExpense(id);
}

// Export CSV Handler
function handleExportCsv() {
  let url = `${API_BASE}/expenses/export/csv?`;
  if (currentUser) url += `user_id=${encodeURIComponent(currentUser.id)}&`;
  if (currentCategory !== "ALL") url += `category=${encodeURIComponent(currentCategory)}&`;
  if (startDate) url += `start_date=${encodeURIComponent(startDate)}&`;
  if (endDate) url += `end_date=${encodeURIComponent(endDate)}&`;

  window.open(url, "_blank");
  showToast("📥 Exporting expenses CSV...");
}

// Toast Helper
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("active");
  setTimeout(() => toastEl.classList.remove("active"), 3000);
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
