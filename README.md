# 🌌 Financial Parallelverse

> **Tagline:** Explore your financial futures before making a decision.  
> **Hackathon Track:** The Vampire's Ledger (FinTech) — Hack-o-Ween 2nd Edition (PES University)  
> **Team:** Dark_Knights (Ratnala Aneesh, Raghoothama T R, Vatsal Soni)

---

## 💡 Overview & Problem Statement

People frequently make major commitments—purchasing a ₹70,000 laptop, leasing a smartphone, or financing high-end gadgets—based solely on whether their current monthly paycheck can theoretically handle the initial EMI installment. 

However, conventional calculators fail to answer:
- *What happens to my emergency runway if my salary is delayed for a month?*
- *What if an unexpected medical or appliance emergency occurs in Month 3?*
- *Will I breach my minimum emergency buffer or enter a negative cash balance?*

**Financial Parallelverse** evaluates financial decisions by simulating **5 concurrent parallel financial futures**, detecting breaking points before they occur, comparing purchase strategies (Cash vs. Save & Wait vs. Cheaper Alternative vs. EMI), and generating downloadable **iCalendar (.ics)** reminder schedules.

---

## 🚀 Key Features

1. **🔮 Parallel Futures Engine**:
   - Simultaneously calculates 5 distinct financial timelines:
     1. *Baseline Reality*: Standard income and expense flows.
     2. *Emergency Shock*: Configurable sudden out-of-pocket medical or repair bill.
     3. *Delayed Salary Flow*: Paycheck timing shift with eventual catch-up.
     4. *Cost of Living Inflation*: Multiplier applied across all living expenses.
     5. *Parallel Nightmare*: Combined adverse stress test.
   - Interactive Plotly savings trajectories with safety target indicators.
   - Breaking-point detection alerting when savings breach zero or target thresholds.

2. **⚖️ Purchase Affordability Decision Matrix**:
   - 4-way comparative analysis for any contemplated purchase (e.g., ₹70,000 laptop):
     - Buy Immediately with Cash
     - Save First & Buy in X Months
     - Buy a Cheaper Alternative Model
     - Finance through Reducing-Balance EMI
   - Safety scoring and trade-off analysis.

3. **🧮 Precision EMI & Amortization Calculator**:
   - Standard reducing-balance mathematical formula:
     $$\text{EMI} = P \times r \times \frac{(1+r)^n}{(1+r)^n - 1}$$
   - Zero-interest loan support ($r = 0$).
   - Full monthly amortization schedule with balance reconciliation to ₹0.00.
   - Interactive Principal vs. Interest breakdown chart.

4. **📅 Installment Tracker & One-Click Calendar (.ICS) Reminders**:
   - Active installment plans with repayment progress tracking.
   - Automatic overdue status detection based on real calendar dates.
   - Mark as Paid / Revert payment states with database persistence.
   - **One-click .ICS export**: Download and import reminders into Google Calendar, Apple Calendar, or Outlook.

5. **👤 Financial Profile Persistence**:
   - SQLite database storing income, savings, expense breakdowns, and emergency fund targets.

---

## 🛠️ Technology Stack

- **Backend:** Python 3.13, FastAPI, Uvicorn, Pydantic, SQLAlchemy 2.x
- **Frontend & Visualizations:** Streamlit, Plotly, Pandas
- **React Frontend Source:** React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Database:** SQLite with automated migrations & demo seeding
- **Testing:** Pytest (23 automated test suites)
- **Documentation & PDF Guide:** ReportLab automated PDF generator

---

## ⚡ Quick Start Guide (Execution Order)

### 1. Run Automated Test Suite
Verify that all 23 mathematical and API test cases pass:
```powershell
.\run_tests.bat
# Or manually:
python -m pytest backend/tests -v
```

### 2. Launch Everything with 1-Click
Double-click `run_all.bat` on Windows, or start individually:

**To run the FastAPI Backend:**
```powershell
.\run_backend.bat
# Backend OpenAPI documentation: http://localhost:8000/api/docs
```

**To run the Streamlit FinTech Application:**
```powershell
.\run_streamlit.bat
# App URL: http://localhost:8501
```

### 3. Reset or Seed Demo Data
To re-seed the SQLite database with realistic sample profile & installment plans:
```powershell
python scripts/seed_demo.py
```

---

## 📂 Project Structure

```
Financial_Parallelverse/
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI REST endpoints
│   │   ├── services/        # Deterministic simulation & financial engines
│   │   ├── config.py        # Settings & paths
│   │   ├── database.py      # SQLAlchemy session & SQLite connection
│   │   ├── models.py        # Database ORM models
│   │   ├── schemas.py       # Pydantic validation models
│   │   └── main.py          # FastAPI application factory
│   └── tests/               # 23 automated Pytest test cases
├── frontend_streamlit/
│   └── app.py               # Polished FinTech UI with Plotly & Dark theme
├── frontend_react/          # Complete React / TypeScript Vite frontend source
├── scripts/
│   ├── seed_demo.py         # Demo data population
│   └── dev.sh               # Bash development runner
├── data/                    # SQLite database storage
├── run_backend.bat          # 1-click backend launcher
├── run_streamlit.bat        # 1-click Streamlit launcher
├── run_tests.bat            # 1-click test runner
├── run_all.bat              # Launch both backend & frontend
└── Financial_Parallelverse_Execution_Guide.pdf # Official execution manual
```

---

## 🏆 Hackathon Team
- **Team Name:** Dark_Knights
- **Track:** The Vampire's Ledger (FinTech) — Hack-o-Ween 2nd Edition
- **Members:** Ratnala Aneesh, Raghoothama T R, Vatsal Soni
