import React, { useState, useEffect, useMemo } from 'react';
import {
  Home,
  ShoppingBag,
  Sparkles,
  CreditCard,
  UserCheck,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Download,
  Check,
  Sun,
  Moon,
  Flame,
  LogIn,
  LogOut,
  ChevronDown,
  ChevronUp,
  Sliders,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { api, getStoredToken, setStoredToken } from './lib/api';
import {
  UserAccount,
  FinancialProfile,
  ScenarioSimulationResponse,
  PurchaseEvaluationResponse,
  EMICalculationResponse,
  InstallmentPlan,
  LiveStats,
} from './types';

type TabId = 'home' | 'buy' | 'whatif' | 'emis' | 'me';
type ThemeId = 'daylight' | 'midnight' | 'emerald';

const PURCHASE_PRESETS = [
  { label: '📱 Phone ₹60k', name: 'Flagship Smartphone', amount: 60000 },
  { label: '💻 Laptop ₹85k', name: 'MacBook / Creator Laptop', amount: 85000 },
  { label: '🛵 Scooter ₹1.1L', name: 'Electric Commuter Scooter', amount: 110000 },
  { label: '✈️ Trip ₹45k', name: 'Vacation & Flights', amount: 45000 },
  { label: '🎓 Course ₹30k', name: 'Professional Certification', amount: 30000 },
];

const SCENARIO_META: Record<
  string,
  { short: string; color: string; badgeBg: string; description: string }
> = {
  baseline: {
    short: 'Normal Life',
    color: '#4F46E5',
    badgeBg: 'rgba(79, 70, 229, 0.12)',
    description: 'Steady income and bills with your planned purchase.',
  },
  unexpected_expense: {
    short: 'Surprise Bill',
    color: '#D97706',
    badgeBg: 'rgba(217, 119, 6, 0.12)',
    description: 'A sudden medical or repair bill hits mid-year.',
  },
  salary_delay: {
    short: 'Late Paycheck',
    color: '#0284C7',
    badgeBg: 'rgba(2, 132, 199, 0.12)',
    description: 'One month salary is delayed and credited the next month.',
  },
  expense_increase: {
    short: 'Prices Rise',
    color: '#7C3AED',
    badgeBg: 'rgba(124, 58, 237, 0.12)',
    description: 'Monthly living expenses climb across the entire year.',
  },
  combined_stress: {
    short: 'Worst Case',
    color: '#E11D48',
    badgeBg: 'rgba(225, 29, 72, 0.12)',
    description: 'Surprise bill, late paycheck, and inflation all hit together.',
  },
};

function formatINR(val: number): string {
  const rounded = Math.round(val);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}₹${Math.abs(rounded).toLocaleString('en-IN')}`;
}

function formatCompactINR(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}k`;
  return `${sign}₹${Math.round(abs)}`;
}

function getPasswordStrength(pw: string): {
  score: number;
  label: string;
  color: string;
} {
  if (!pw) return { score: 0, label: 'Enter a password', color: '#94A3B8' };
  let score = 0;
  if (pw.length >= 6) score += 1;
  if (pw.length >= 10) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score += 1;
  const clamped = Math.max(1, Math.min(4, score));
  if (pw.length < 6) {
    return { score: 1, label: 'Too short (min 6 chars)', color: '#E11D48' };
  }
  if (clamped === 2) return { score: 2, label: 'Fair password', color: '#D97706' };
  if (clamped === 3) return { score: 3, label: 'Good password', color: '#4F46E5' };
  return { score: 4, label: 'Strong password', color: '#059669' };
}

export default function App() {
  const [theme, setTheme] = useState<ThemeId>('daylight');
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [loading, setLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<string | null>(null);

  // Core Data States
  const [user, setUser] = useState<UserAccount | null>(null);
  const [profile, setProfile] = useState<FinancialProfile | null>(null);
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const [simResults, setSimResults] = useState<ScenarioSimulationResponse | null>(null);
  const [purchaseResults, setPurchaseResults] = useState<PurchaseEvaluationResponse | null>(null);
  const [emiResult, setEmiResult] = useState<EMICalculationResponse | null>(null);
  const [emiNoExtraResult, setEmiNoExtraResult] = useState<EMICalculationResponse | null>(null);
  const [installments, setInstallments] = useState<InstallmentPlan[]>([]);

  // Login Page State (Full-page pretty experience)
  const [showLoginPage, setShowLoginPage] = useState<boolean>(() => !getStoredToken());
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [authSubmitting, setAuthSubmitting] = useState<boolean>(false);

  // Auth Form State
  const [loginEmail, setLoginEmail] = useState('aarav@parallelverse.demo');
  const [loginPassword, setLoginPassword] = useState('demo1234');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // "Can I buy?" Interactive State
  const [buyName, setBuyName] = useState('MacBook Pro M3 / Commuter EV');
  const [buyAmount, setBuyAmount] = useState(72000);
  const [buyDownPayment, setBuyDownPayment] = useState(12000);
  const [buyRate, setBuyRate] = useState(13.5);
  const [buyTenure, setBuyTenure] = useState(6);
  const [buyWaitMonths, setBuyWaitMonths] = useState(4);
  const [buyAltName] = useState('Smart Value Model');
  const [buyAltAmount, setBuyAltAmount] = useState(45000);
  const [showBuyAdvanced, setShowBuyAdvanced] = useState(false);
  const [evaluatingBuy, setEvaluatingBuy] = useState(false);

  // "What if?" Interactive State
  const [simHorizon, setSimHorizon] = useState(12);
  const [simMode, setSimMode] = useState<'CASH' | 'EMI' | 'NONE'>('CASH');
  const [simMonth, setSimMonth] = useState(2);
  const [simSurpriseBill, setSimSurpriseBill] = useState(25000);
  const [simSurpriseMonth] = useState(4);
  const [simDelayMonths] = useState(1);
  const [simInflationPct, setSimInflationPct] = useState(12);
  const [selectedScenarioKey, setSelectedScenarioKey] = useState<string>('combined_stress');
  const [hoverMonth, setHoverMonth] = useState<number | null>(null);
  const [runningSim, setRunningSim] = useState(false);

  // "My EMIs" Interactive State
  const [emiSubTab, setEmiSubTab] = useState<'tracker' | 'calculator'>('tracker');
  const [expandedPlanId, setExpandedPlanId] = useState<number | null>(1);
  const [showNewPlanForm, setShowNewPlanForm] = useState(false);
  const [newPlan, setNewPlan] = useState({
    purchase_name: '',
    category: 'Electronics',
    total_amount: 48000,
    down_payment: 6000,
    annual_interest_rate: 13.0,
    tenure_months: 6,
    due_day: 5,
    notes: '',
  });
  const [calcPrice, setCalcPrice] = useState(72000);
  const [calcDown, setCalcDown] = useState(12000);
  const [calcRate, setCalcRate] = useState(13.5);
  const [calcTenure, setCalcTenure] = useState(9);
  const [calcExtra, setCalcExtra] = useState(2000);

  // "Me" Profile Form State
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    monthly_income: 95000,
    current_savings: 240000,
    essential_expenses: 38000,
    discretionary_expenses: 16000,
    existing_debt_emi: 8500,
    emergency_fund_target: 180000,
    income_growth_pct: 8,
    investment_return_pct: 7,
    credit_score: 760,
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const showNotice = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3400);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [meRes, prof, stats, inst] = await Promise.all([
        api.getMe(),
        api.getProfile(),
        api.getLiveStats(),
        api.getInstallments(),
      ]);

      setUser(meRes.user);
      setProfile(prof);
      setLiveStats(stats);
      setInstallments(inst);

      setBuyName(prof.planned_purchase_name);
      setBuyAmount(prof.planned_purchase_amount);
      setBuyAltAmount(Math.round(prof.planned_purchase_amount * 0.62));
      setSimMonth(prof.planned_purchase_month || 2);

      setProfileForm({
        full_name: prof.full_name,
        monthly_income: prof.monthly_income,
        current_savings: prof.current_savings,
        essential_expenses: prof.essential_expenses,
        discretionary_expenses: prof.discretionary_expenses,
        existing_debt_emi: prof.existing_debt_emi,
        emergency_fund_target: prof.emergency_fund_target,
        income_growth_pct: prof.income_growth_pct ?? 8,
        investment_return_pct: prof.investment_return_pct ?? 7,
        credit_score: prof.credit_score ?? 760,
      });

      const [sim, purch, emiWithExtra, emiBase] = await Promise.all([
        api.simulateScenarios({
          duration_months: 12,
          purchase_name: prof.planned_purchase_name,
          purchase_amount: prof.planned_purchase_amount,
          purchase_month: prof.planned_purchase_month || 2,
          purchase_mode: 'CASH',
          emi_down_payment: 12000,
          emi_interest_rate: 13.5,
          emi_tenure_months: 6,
          unexpected_expense_amount: 25000,
          unexpected_expense_month: 4,
          salary_delay_months: 1,
          salary_delay_start_month: 3,
          expense_increase_pct: 12,
        }),
        api.evaluatePurchase({
          purchase_name: prof.planned_purchase_name,
          purchase_amount: prof.planned_purchase_amount,
          cheaper_alternative_name: 'Smart Value Model',
          cheaper_alternative_amount: Math.round(prof.planned_purchase_amount * 0.62),
          wait_months: 4,
          emi_down_payment: 12000,
          emi_interest_rate: 13.5,
          emi_tenure_months: 6,
        }),
        api.calculateEMI({
          purchase_price: 72000,
          down_payment: 12000,
          annual_interest_rate: 13.5,
          tenure_months: 9,
          extra_monthly_payment: 2000,
        }),
        api.calculateEMI({
          purchase_price: 72000,
          down_payment: 12000,
          annual_interest_rate: 13.5,
          tenure_months: 9,
          extra_monthly_payment: 0,
        }),
      ]);

      setSimResults(sim);
      setPurchaseResults(purch);
      setEmiResult(emiWithExtra);
      setEmiNoExtraResult(emiBase);
    } catch (e: any) {
      console.error(e);
      showNotice(e.message || 'Failed to load financial data');
    } finally {
      setLoading(false);
    }
  };

  // Run Purchase Check ("Can I buy?")
  const handleCheckPurchase = async (overrideName?: string, overrideAmount?: number) => {
    const targetName = overrideName ?? buyName;
    const targetAmount = overrideAmount ?? buyAmount;
    const targetAlt = Math.round(targetAmount * 0.62);
    try {
      setEvaluatingBuy(true);
      const [purch, sim, stats] = await Promise.all([
        api.evaluatePurchase({
          purchase_name: targetName,
          purchase_amount: targetAmount,
          cheaper_alternative_name: buyAltName || 'Smart Value Model',
          cheaper_alternative_amount: overrideAmount ? targetAlt : buyAltAmount,
          wait_months: buyWaitMonths,
          emi_down_payment: buyDownPayment,
          emi_interest_rate: buyRate,
          emi_tenure_months: buyTenure,
        }),
        api.simulateScenarios({
          duration_months: simHorizon,
          purchase_name: targetName,
          purchase_amount: targetAmount,
          purchase_month: simMonth,
          purchase_mode: simMode,
          emi_down_payment: buyDownPayment,
          emi_interest_rate: buyRate,
          emi_tenure_months: buyTenure,
          unexpected_expense_amount: simSurpriseBill,
          unexpected_expense_month: simSurpriseMonth,
          salary_delay_months: simDelayMonths,
          salary_delay_start_month: 3,
          expense_increase_pct: simInflationPct,
        }),
        api.getLiveStats(),
      ]);
      setPurchaseResults(purch);
      setSimResults(sim);
      setLiveStats(stats);
      showNotice(`Evaluated "${targetName}" (${formatINR(targetAmount)})`);
    } catch (e: any) {
      showNotice(e.message || 'Could not evaluate purchase');
    } finally {
      setEvaluatingBuy(false);
    }
  };

  // Run "What if?" Stress-Test
  const handleRunWhatIf = async (modeOverride?: 'CASH' | 'EMI' | 'NONE') => {
    const activeMode = modeOverride ?? simMode;
    try {
      setRunningSim(true);
      const [sim, stats] = await Promise.all([
        api.simulateScenarios({
          duration_months: simHorizon,
          purchase_name: buyName,
          purchase_amount: buyAmount,
          purchase_month: simMonth,
          purchase_mode: activeMode,
          emi_down_payment: buyDownPayment,
          emi_interest_rate: buyRate,
          emi_tenure_months: buyTenure,
          unexpected_expense_amount: simSurpriseBill,
          unexpected_expense_month: simSurpriseMonth,
          salary_delay_months: simDelayMonths,
          salary_delay_start_month: 3,
          expense_increase_pct: simInflationPct,
        }),
        api.getLiveStats(),
      ]);
      setSimResults(sim);
      setLiveStats(stats);
      showNotice('Updated 5 parallel futures');
    } catch (e: any) {
      showNotice(e.message || 'Simulation error');
    } finally {
      setRunningSim(false);
    }
  };

  // Run EMI Calculator
  const handleRunEmiCalc = async () => {
    try {
      const [withExtra, base] = await Promise.all([
        api.calculateEMI({
          purchase_price: calcPrice,
          down_payment: calcDown,
          annual_interest_rate: calcRate,
          tenure_months: calcTenure,
          extra_monthly_payment: calcExtra,
        }),
        api.calculateEMI({
          purchase_price: calcPrice,
          down_payment: calcDown,
          annual_interest_rate: calcRate,
          tenure_months: calcTenure,
          extra_monthly_payment: 0,
        }),
      ]);
      setEmiResult(withExtra);
      setEmiNoExtraResult(base);
      showNotice('Updated EMI schedule & prepayment savings');
    } catch (e: any) {
      showNotice(e.message || 'Calculation error');
    }
  };

  // Create Installment Plan
  const handleCreateInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlan.purchase_name.trim()) {
      showNotice('Please enter a name for the EMI purchase');
      return;
    }
    try {
      const created = await api.createInstallment(newPlan);
      setInstallments((prev) => [created, ...prev]);
      setExpandedPlanId(created.id);
      setShowNewPlanForm(false);
      setNewPlan({
        purchase_name: '',
        category: 'Electronics',
        total_amount: 48000,
        down_payment: 6000,
        annual_interest_rate: 13.0,
        tenure_months: 6,
        due_day: 5,
        notes: '',
      });
      showNotice(`Added "${created.purchase_name}" to EMI tracker`);
    } catch (e: any) {
      showNotice(e.message || 'Could not create EMI plan');
    }
  };

  const handleTogglePayment = async (
    planId: number,
    paymentId: number,
    currentStatus: string
  ) => {
    const nextStatus = currentStatus === 'PAID' ? 'PENDING' : 'PAID';
    try {
      await api.updatePaymentStatus(planId, paymentId, nextStatus);
      const [updated, stats] = await Promise.all([api.getInstallments(), api.getLiveStats()]);
      setInstallments(updated);
      setLiveStats(stats);
      showNotice(
        nextStatus === 'PAID' ? 'Installment marked as PAID' : 'Installment marked as PENDING'
      );
    } catch (e: any) {
      showNotice(e.message || 'Could not update installment');
    }
  };

  const handleDeletePlan = async (planId: number) => {
    try {
      await api.deleteInstallment(planId);
      setInstallments((prev) => prev.filter((p) => p.id !== planId));
      showNotice('Removed EMI plan');
    } catch (e: any) {
      showNotice(e.message || 'Could not remove plan');
    }
  };

  // Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      const updated = await api.updateProfile({
        ...profileForm,
        planned_purchase_name: buyName,
        planned_purchase_amount: buyAmount,
        planned_purchase_month: simMonth,
      });
      setProfile(updated);
      await handleCheckPurchase(buyName, buyAmount);
      showNotice('Saved your money numbers & refreshed all projections');
    } catch (e: any) {
      showNotice(e.message || 'Could not save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // Auth Actions
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      const res = await api.login(loginEmail, loginPassword);
      setStoredToken(res.token);
      setShowLoginPage(false);
      await loadAllData();
      showNotice(`Welcome back, ${res.user.name}!`);
    } catch (err: any) {
      setAuthError(err.message || 'Sign in failed');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      const res = await api.login('aarav@parallelverse.demo', 'demo1234');
      setStoredToken(res.token);
      setShowLoginPage(false);
      await loadAllData();
      showNotice(`Signed in as ${res.user.name}`);
    } catch (err: any) {
      setAuthError(err.message || 'Demo login failed');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      const res = await api.register(regName, regEmail, regPassword);
      setStoredToken(res.token);
      setShowLoginPage(false);
      await loadAllData();
      showNotice(`Account created! Welcome, ${res.user.name}`);
    } catch (err: any) {
      setAuthError(err.message || 'Could not create account');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleGuestMode = async () => {
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      const res = await api.guestLogin();
      setStoredToken(res.token);
      setShowLoginPage(false);
      await loadAllData();
      showNotice('Started a fresh Guest Explorer session');
    } catch (err: any) {
      setAuthError(err.message || 'Could not start guest session');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setStoredToken(null);
    setShowLoginPage(true);
    showNotice('Signed out');
  };

  // Theme tokens
  const palette = useMemo(() => {
    if (theme === 'daylight') {
      return {
        bg: 'bg-[#F8FAFC]',
        text: 'text-slate-900',
        subtext: 'text-slate-600',
        muted: 'text-slate-400',
        headerBg: 'bg-white/90 border-slate-200/80',
        card: 'bg-white border-slate-200/90 shadow-sm',
        cardSoft: 'bg-slate-50/90 border-slate-200/70',
        input: 'bg-white border-slate-300 text-slate-900 focus:border-indigo-600',
        primaryBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm',
        secondaryBtn: 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200',
        accentText: 'text-indigo-600',
        divider: 'border-slate-200',
        chartGrid: '#E2E8F0',
        isDark: false,
      };
    }
    if (theme === 'emerald') {
      return {
        bg: 'bg-[#061318]',
        text: 'text-slate-100',
        subtext: 'text-slate-300',
        muted: 'text-slate-500',
        headerBg: 'bg-[#071920]/90 border-emerald-500/15',
        card: 'bg-[#0B2129]/90 border-emerald-500/15 shadow-lg',
        cardSoft: 'bg-[#091A21] border-white/10',
        input: 'bg-[#061318] border-emerald-500/25 text-white focus:border-emerald-400',
        primaryBtn: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm',
        secondaryBtn: 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/10',
        accentText: 'text-emerald-400',
        divider: 'border-white/10',
        chartGrid: 'rgba(255,255,255,0.08)',
        isDark: true,
      };
    }
    return {
      bg: 'bg-[#0B1120]',
      text: 'text-slate-100',
      subtext: 'text-slate-300',
      muted: 'text-slate-500',
      headerBg: 'bg-[#0F172A]/90 border-white/10',
      card: 'bg-[#111827]/95 border-white/10 shadow-lg',
      cardSoft: 'bg-[#1E293B]/60 border-white/10',
      input: 'bg-[#0B1120] border-white/15 text-white focus:border-indigo-400',
      primaryBtn: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm',
      secondaryBtn: 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/10',
      accentText: 'text-indigo-400',
      divider: 'border-white/10',
      chartGrid: 'rgba(255,255,255,0.08)',
      isDark: true,
    };
  }, [theme]);

  // Easiest win tip for Money Health Score
  const easiestWinTip = useMemo(() => {
    if (!profile) return '';
    const b = profile.health_breakdown;
    const pillars = [
      {
        score: b.savings_rate_score,
        tip: 'Save at least 20% of your monthly income to earn all 25 savings points.',
      },
      {
        score: b.emergency_fund_score,
        tip: `Top up your bank savings toward ${formatINR(
          profile.emergency_fund_target
        )} to max out your safety-net points.`,
      },
      {
        score: b.runway_score,
        tip: 'Build 6 months of essential-bill buffer so a job change never stresses you.',
      },
      {
        score: b.dti_score,
        tip: 'Keep total monthly EMIs under 20% of your take-home pay.',
      },
    ];
    pillars.sort((a, c) => a.score - c.score);
    return pillars[0].score >= 23
      ? 'You are acing all 4 pillars — keep your money habits steady!'
      : pillars[0].tip;
  }, [profile]);

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white mb-4 animate-pulse shadow-md">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="text-lg font-bold tracking-tight">Loading Parallelverse v4...</div>
        <div className="text-sm text-slate-500 mt-1">
          Computing Money Health Score, 5 Parallel Futures & Credit Impact
        </div>
      </div>
    );
  }

  const pwStrength = getPasswordStrength(regPassword);

  // =========================================================================
  // PRETTY FULL-SCREEN LOGIN & ONBOARDING PAGE
  // =========================================================================
  if (showLoginPage) {
    return (
      <div
        className={`min-h-screen flex flex-col justify-between relative overflow-hidden transition-colors duration-300 ${
          palette.isDark
            ? 'bg-[#070B16] text-slate-100'
            : 'bg-gradient-to-br from-slate-50 via-indigo-50/40 to-emerald-50/30 text-slate-900'
        }`}
      >
        {/* Decorative Ambient Glows */}
        <div className="pointer-events-none fixed -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="pointer-events-none fixed top-1/3 -right-32 w-96 h-96 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="pointer-events-none fixed -bottom-32 left-1/3 w-96 h-96 rounded-full bg-violet-500/15 blur-3xl" />

        {/* Toast Notification */}
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold shadow-xl border border-white/10">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        {/* Top Utility Bar */}
        <header className="relative z-10 max-w-7xl w-full mx-auto px-6 pt-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-emerald-500 flex items-center justify-center text-white text-lg shadow-md shadow-indigo-500/20">
              🌌
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight">Parallelverse</span>
                <span className="text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  v4.0
                </span>
              </div>
              <p className={`text-xs ${palette.subtext}`}>Personal Finance Decision Simulator</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() =>
                setTheme((prev) =>
                  prev === 'daylight'
                    ? 'midnight'
                    : prev === 'midnight'
                    ? 'emerald'
                    : 'daylight'
                )
              }
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${palette.secondaryBtn}`}
            >
              {theme === 'daylight' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>Daylight</span>
                </>
              ) : theme === 'midnight' ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Midnight</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Emerald</span>
                </>
              )}
            </button>

            <button
              onClick={() => setShowLoginPage(false)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${palette.secondaryBtn}`}
            >
              <span>Continue to Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Center Split Grid: Left Editorial Value Showcase + Right Pretty Auth Card */}
        <div className="relative z-10 max-w-7xl w-full mx-auto px-6 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: Visual Showcase */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Test Every Big Purchase Before You Spend</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.12]">
              See your money across{' '}
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-500 bg-clip-text text-transparent">
                5 parallel futures.
              </span>
            </h1>

            <p className={`text-base sm:text-lg max-w-xl leading-relaxed ${palette.subtext}`}>
              Stop guessing if you can afford a new laptop, bike, or trip. Measure your{' '}
              <strong>Money Health Score</strong>, check your <strong>Job-Loss Survival Runway</strong>,
              and preview your <strong>Credit Score trajectory</strong> in seconds.
            </p>

            {/* Preview Feature Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div
                className={`p-5 rounded-2xl border backdrop-blur-md transition hover:-translate-y-0.5 ${palette.card}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    4-Pillar Diagnostic
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    {profile.health_score}/100 • {profile.health_label}
                  </span>
                </div>
                <div className="text-base font-extrabold mb-1">Money Health Score</div>
                <p className={`text-xs leading-relaxed ${palette.subtext}`}>
                  Evaluates your savings habit, emergency safety net, bill buffer, and EMI load on a
                  0–100 scale.
                </p>
              </div>

              <div
                className={`p-5 rounded-2xl border backdrop-blur-md transition hover:-translate-y-0.5 ${palette.card}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Stress-Test Engine
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-extrabold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                    5 Scenarios
                  </span>
                </div>
                <div className="text-base font-extrabold mb-1">
                  True Cost & Credit Impact
                </div>
                <p className={`text-xs leading-relaxed ${palette.subtext}`}>
                  Simulates surprise bills, late paychecks, inflation, and EMI credit score changes
                  before you buy.
                </p>
              </div>
            </div>

            {/* Trust & Live Pulse Strip */}
            <div className="flex flex-wrap items-center gap-6 pt-2 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className={palette.subtext}>No bank password required</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                <span className={palette.subtext}>Instant deterministic math</span>
              </div>
              {liveStats && (
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className={palette.subtext}>
                    <strong className="font-mono text-indigo-600 dark:text-indigo-400">
                      {liveStats.simulations.toLocaleString('en-IN')}
                    </strong>{' '}
                    decisions simulated
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Pretty Auth Card */}
          <div className="lg:col-span-5">
            <div
              className={`rounded-3xl border p-7 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6 ${
                palette.isDark
                  ? 'bg-[#111827]/95 border-white/10 shadow-black/50'
                  : 'bg-white/95 border-slate-200/90 shadow-indigo-950/5'
              }`}
            >
              {/* Card Header */}
              <div className="text-center space-y-1.5">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-emerald-500 text-white text-xl shadow-md mb-1">
                  ✨
                </div>
                <h2 className="text-2xl font-extrabold tracking-tight">
                  {authTab === 'login' ? 'Welcome back' : 'Create your space'}
                </h2>
                <p className={`text-xs sm:text-sm ${palette.subtext}`}>
                  {authTab === 'login'
                    ? 'Sign in to access your saved money profile & EMI plans'
                    : 'Set up a private profile in 10 seconds'}
                </p>
              </div>

              {/* Segmented Pill Toggle */}
              <div
                className={`grid grid-cols-2 p-1 rounded-2xl border ${
                  palette.isDark ? 'bg-slate-900/90 border-white/10' : 'bg-slate-100 border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('login');
                    setAuthError(null);
                  }}
                  className={`py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                    authTab === 'login'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : `${palette.subtext} hover:opacity-90`
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('register');
                    setAuthError(null);
                  }}
                  className={`py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                    authTab === 'register'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : `${palette.subtext} hover:opacity-90`
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Error Banner */}
              {authError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-300 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{authError}</span>
                </div>
              )}

              {authTab === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  {/* 1-Click Demo Fill Chip */}
                  <div
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${palette.cardSoft}`}
                  >
                    <div className="text-xs">
                      <span className="font-bold block">Demo Persona Ready</span>
                      <span className={`font-mono text-[11px] ${palette.subtext}`}>
                        Aarav Sharma • ₹95k/mo
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleQuickDemoLogin}
                      disabled={authSubmitting}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 text-xs font-extrabold transition cursor-pointer whitespace-nowrap shrink-0"
                    >
                      ⚡ 1-Click Demo Login
                    </button>
                  </div>

                  <div>
                    <label className={`block text-xs font-bold mb-1.5 ${palette.subtext}`}>
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail
                        className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${palette.muted}`}
                      />
                      <input
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm font-medium outline-none transition focus:ring-4 focus:ring-indigo-500/15 ${palette.input}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-bold mb-1.5 ${palette.subtext}`}>
                      Password
                    </label>
                    <div className="relative">
                      <Lock
                        className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${palette.muted}`}
                      />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className={`w-full pl-10 pr-10 py-3 rounded-xl border text-sm font-medium outline-none transition focus:ring-4 focus:ring-indigo-500/15 ${palette.input}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-slate-500/10 cursor-pointer ${palette.muted}`}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={authSubmitting}
                    className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-extrabold shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{authSubmitting ? 'Signing in...' : 'Sign In to Parallelverse'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label className={`block text-xs font-bold mb-1.5 ${palette.subtext}`}>
                      Full Name
                    </label>
                    <div className="relative">
                      <User
                        className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${palette.muted}`}
                      />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Priya Nair"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm font-medium outline-none transition focus:ring-4 focus:ring-indigo-500/15 ${palette.input}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-bold mb-1.5 ${palette.subtext}`}>
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail
                        className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${palette.muted}`}
                      />
                      <input
                        type="email"
                        required
                        placeholder="priya@example.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm font-medium outline-none transition focus:ring-4 focus:ring-indigo-500/15 ${palette.input}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-bold mb-1.5 ${palette.subtext}`}>
                      Create Password
                    </label>
                    <div className="relative">
                      <Lock
                        className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${palette.muted}`}
                      />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="At least 6 characters"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className={`w-full pl-10 pr-10 py-3 rounded-xl border text-sm font-medium outline-none transition focus:ring-4 focus:ring-indigo-500/15 ${palette.input}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-slate-500/10 cursor-pointer ${palette.muted}`}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* 4-Bar Password Strength Meter */}
                    <div className="mt-2 space-y-1">
                      <div className="grid grid-cols-4 gap-1.5">
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className="h-1.5 rounded-full transition-all duration-300"
                            style={{
                              backgroundColor:
                                pwStrength.score >= level
                                  ? pwStrength.color
                                  : palette.isDark
                                  ? 'rgba(255,255,255,0.1)'
                                  : '#E2E8F0',
                            }}
                          />
                        ))}
                      </div>
                      <div
                        className="text-[11px] font-bold"
                        style={{ color: pwStrength.color }}
                      >
                        {pwStrength.label}
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={authSubmitting}
                    className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-extrabold shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{authSubmitting ? 'Creating account...' : 'Create My Free Account'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* Divider */}
              <div className="relative flex py-1 items-center">
                <div className={`flex-grow border-t ${palette.divider}`} />
                <span className={`flex-shrink mx-3 text-[11px] font-bold uppercase tracking-wider ${palette.muted}`}>
                  Or try without signing up
                </span>
                <div className={`flex-grow border-t ${palette.divider}`} />
              </div>

              {/* 1-Click Guest Mode Button */}
              <button
                type="button"
                onClick={handleGuestMode}
                disabled={authSubmitting}
                className={`w-full py-3 px-4 rounded-xl border text-xs sm:text-sm font-extrabold transition flex items-center justify-center gap-2 cursor-pointer ${palette.secondaryBtn}`}
              >
                <span>👋 Continue in 1-Click Guest Mode</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className={`relative z-10 text-center py-4 text-xs ${palette.muted}`}>
          Financial Parallelverse v4 • Deterministic Personal Finance Engine
        </footer>
      </div>
    );
  }

  // Health Ring geometry
  const healthScore = profile.health_score ?? 78;
  const ringColor =
    healthScore >= 80
      ? '#059669'
      : healthScore >= 60
      ? '#4F46E5'
      : healthScore >= 40
      ? '#D97706'
      : '#E11D48';
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - healthScore / 100);

  // Verdict badge for "Can I buy?"
  const cashOption = purchaseResults?.options.find((o) => o.option_id === 'buy_now_cash');
  const emiOption = purchaseResults?.options.find((o) => o.option_id === 'buy_on_emi');
  const verdictTone = cashOption?.safe_to_proceed
    ? {
        badge: 'YES — YOU CAN AFFORD THIS',
        title: `You can safely buy ${purchaseResults?.purchase_name}`,
        bg: palette.isDark
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          : 'bg-emerald-50 border-emerald-200 text-emerald-900',
        pill: 'bg-emerald-600 text-white',
      }
    : emiOption?.safe_to_proceed
    ? {
        badge: 'BE CAREFUL — BETTER ON EMI OR ALTERNATIVE',
        title: `Full cash dips into your safety net for ${purchaseResults?.purchase_name}`,
        bg: palette.isDark
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
          : 'bg-amber-50 border-amber-200 text-amber-900',
        pill: 'bg-amber-600 text-white',
      }
    : {
        badge: 'HOLD OFF — WAIT & SAVE FIRST',
        title: `Buying ${purchaseResults?.purchase_name} right now stretches your safety buffer`,
        bg: palette.isDark
          ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
          : 'bg-rose-50 border-rose-200 text-rose-900',
        pill: 'bg-rose-600 text-white',
      };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${palette.bg} ${palette.text}`}>
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold shadow-xl border border-white/10">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className={`sticky top-0 z-30 backdrop-blur-md border-b ${palette.headerBg}`}>
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('home')}
              className="flex items-center gap-2.5 text-left group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-emerald-500 flex items-center justify-center text-white font-extrabold text-sm shadow-sm">
                🌌
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base tracking-tight">Parallelverse</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500 whitespace-nowrap shrink-0">
                    v4 Live
                  </span>
                </div>
                <p className={`text-xs ${palette.subtext} hidden sm:block`}>
                  Test your money decisions before you spend
                </p>
              </div>
            </button>
          </div>

          {/* 5 Plain-English Navigation Tabs */}
          <nav className="flex items-center gap-1 overflow-x-auto py-1">
            {[
              { id: 'home', label: 'Home', icon: Home },
              { id: 'buy', label: 'Can I buy?', icon: ShoppingBag },
              { id: 'whatif', label: 'What if?', icon: Sparkles },
              { id: 'emis', label: 'My EMIs', icon: CreditCard },
              { id: 'me', label: 'Me', icon: UserCheck },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as TabId)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : `${palette.subtext} hover:bg-slate-500/10`
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Action Controls: Streak + Theme + Account/Login Page */}
          <div className="flex items-center gap-2 shrink-0">
            {liveStats && (
              <div
                title={`Best streak: ${liveStats.streak.best}d • Total check-ins: ${liveStats.streak.days_used}d`}
                className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold whitespace-nowrap shrink-0 ${palette.cardSoft}`}
              >
                <Flame className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="font-mono">{liveStats.streak.current}d</span>
                <span className={palette.subtext}>streak</span>
              </div>
            )}

            {/* Theme Selector */}
            <button
              onClick={() =>
                setTheme((prev) =>
                  prev === 'daylight'
                    ? 'midnight'
                    : prev === 'midnight'
                    ? 'emerald'
                    : 'daylight'
                )
              }
              title="Switch color theme (Daylight / Midnight / Emerald)"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${palette.secondaryBtn}`}
            >
              {theme === 'daylight' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden md:inline">Daylight</span>
                </>
              ) : theme === 'midnight' ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden md:inline">Midnight</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden md:inline">Emerald</span>
                </>
              )}
            </button>

            {/* Account / Login Page Button */}
            <button
              onClick={() => setShowLoginPage(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${palette.secondaryBtn}`}
            >
              <LogIn className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>{user?.is_guest ? 'Guest • Sign In' : user?.name.split(' ')[0]}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1380px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ===================================================================
            TAB 1: HOME (Overview + Money Health Score + Quick Buy Check + Pulse)
           =================================================================== */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            {/* Hero Greeting + Quick Actions */}
            <div className={`rounded-2xl border p-6 ${palette.card}`}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    <span>👋 Hi, {profile.full_name.split(' ')[0]}</span>
                    <span>•</span>
                    <span>Personal Decision Simulator</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    See how today’s purchase plays out across 5 parallel futures.
                  </h1>
                  <p className={`text-sm sm:text-base ${palette.subtext}`}>
                    Check if you can afford something, measure its true 12-month cost, see your
                    job-loss survival runway, and track every EMI in plain English.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => setActiveTab('buy')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${palette.primaryBtn}`}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Can I buy this?</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('whatif')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${palette.secondaryBtn}`}
                  >
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    <span>Stress-test 5 futures</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Upcoming EMI Reminder Banner if any active plan has a due date */}
            {installments.some((p) => p.next_due_date) && (
              <div
                className={`rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${
                  palette.isDark
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-2.5 text-sm">
                  <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    <strong>Upcoming EMI:</strong> {installments[0].purchase_name} —{' '}
                    <span className="font-mono font-bold">
                      {formatINR(installments[0].monthly_emi)}
                    </span>{' '}
                    due on <strong>{installments[0].next_due_date}</strong>
                  </span>
                </div>
                <button
                  onClick={() => setActiveTab('emis')}
                  className="text-xs font-bold underline hover:opacity-80 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Manage EMIs & Calendar Reminders →
                </button>
              </div>
            )}

            {/* 4 Key Money KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`rounded-2xl border p-5 ${palette.card}`}>
                <div className={`text-xs font-bold uppercase tracking-wider ${palette.subtext}`}>
                  Left over / month
                </div>
                <div
                  className={`text-2xl sm:text-3xl font-extrabold font-mono mt-1.5 ${
                    profile.free_cash_flow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'
                  }`}
                >
                  {formatINR(profile.free_cash_flow)}
                </div>
                <div className={`text-xs mt-1.5 ${palette.subtext}`}>
                  You save <strong>{Math.round(profile.savings_rate_pct)}%</strong> of your{' '}
                  {formatINR(profile.monthly_income)} income
                </div>
              </div>

              <div className={`rounded-2xl border p-5 ${palette.card}`}>
                <div className={`text-xs font-bold uppercase tracking-wider ${palette.subtext}`}>
                  Money in bank
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono mt-1.5 text-indigo-600 dark:text-indigo-400">
                  {formatINR(profile.current_savings)}
                </div>
                <div className={`text-xs mt-1.5 ${palette.subtext}`}>
                  Covers <strong>{profile.months_of_runway.toFixed(1)} months</strong> of essential
                  bills
                </div>
              </div>

              <div className={`rounded-2xl border p-5 ${palette.card}`}>
                <div className={`text-xs font-bold uppercase tracking-wider ${palette.subtext}`}>
                  Safety net target
                </div>
                <div
                  className={`text-2xl sm:text-3xl font-extrabold font-mono mt-1.5 ${
                    profile.emergency_coverage_pct >= 100
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {Math.round(profile.emergency_coverage_pct)}%
                </div>
                <div className={`text-xs mt-1.5 ${palette.subtext}`}>
                  Target buffer: <strong>{formatINR(profile.emergency_fund_target)}</strong>
                </div>
              </div>

              <div className={`rounded-2xl border p-5 ${palette.card}`}>
                <div className={`text-xs font-bold uppercase tracking-wider ${palette.subtext}`}>
                  Monthly EMIs
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono mt-1.5">
                  {formatINR(profile.existing_debt_emi)}
                </div>
                <div className={`text-xs mt-1.5 ${palette.subtext}`}>
                  <strong>{Math.round(profile.debt_to_income_pct)}%</strong> of monthly income (safe
                  is &lt;30%)
                </div>
              </div>
            </div>

            {/* Money Health Score (0-100) + Instant "Can I Buy This?" Card */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Money Health Score Ring + 4 Pillars */}
              <div className={`lg:col-span-7 rounded-2xl border p-6 ${palette.card}`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      4-Pillar Diagnostic
                    </span>
                    <h2 className="text-lg font-extrabold">Your Money Health Score</h2>
                  </div>
                  <span
                    className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider"
                    style={{
                      backgroundColor: `${ringColor}18`,
                      color: ringColor,
                    }}
                  >
                    {profile.health_label} ({healthScore}/100)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
                  {/* Circular SVG Ring */}
                  <div className="sm:col-span-4 flex flex-col items-center justify-center">
                    <svg viewBox="0 0 120 120" className="w-36 h-36">
                      <circle
                        cx="60"
                        cy="60"
                        r={radius}
                        fill="none"
                        stroke={palette.isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'}
                        strokeWidth="10"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r={radius}
                        fill="none"
                        stroke={ringColor}
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        transform="rotate(-90 60 60)"
                      />
                      <text
                        x="60"
                        y="58"
                        textAnchor="middle"
                        fill={palette.isDark ? '#F8FAFC' : '#0F172A'}
                        fontSize="28"
                        fontWeight="800"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {healthScore}
                      </text>
                      <text
                        x="60"
                        y="76"
                        textAnchor="middle"
                        fill={ringColor}
                        fontSize="10"
                        fontWeight="700"
                      >
                        {profile.health_label.toUpperCase()}
                      </text>
                    </svg>
                  </div>

                  {/* 4 Pillar Breakdown Bars */}
                  <div className="sm:col-span-8 space-y-3">
                    {[
                      {
                        label: 'Savings habit (20%+ of pay)',
                        pts: profile.health_breakdown.savings_rate_score,
                      },
                      {
                        label: 'Safety net vs target',
                        pts: profile.health_breakdown.emergency_fund_score,
                      },
                      {
                        label: 'Months of bill buffer (6m goal)',
                        pts: profile.health_breakdown.runway_score,
                      },
                      {
                        label: 'Low EMI debt load (<20% pay)',
                        pts: profile.health_breakdown.dti_score,
                      },
                    ].map((pillar) => {
                      const pct = Math.round((pillar.pts / 25) * 100);
                      const barColor =
                        pillar.pts >= 20
                          ? '#059669'
                          : pillar.pts >= 12
                          ? '#4F46E5'
                          : '#D97706';
                      return (
                        <div key={pillar.label}>
                          <div className="flex justify-between text-xs font-semibold mb-1">
                            <span>{pillar.label}</span>
                            <span className="font-mono font-bold">{pillar.pts}/25 pts</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{ width: `${pct}%`, backgroundColor: barColor }}
                            />
                          </div>
                        </div>
                      );
                    })}

                    <div className={`mt-3 p-3 rounded-xl border text-xs ${palette.cardSoft}`}>
                      <strong className="text-indigo-600 dark:text-indigo-400">
                        💡 Easiest win:{' '}
                      </strong>
                      <span className={palette.subtext}>{easiestWinTip}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick "Can I Buy This?" Card */}
              <div className={`lg:col-span-5 rounded-2xl border p-6 flex flex-col justify-between ${palette.card}`}>
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Instant Affordability Check
                    </span>
                    <h2 className="text-lg font-extrabold">Thinking of buying something?</h2>
                  </div>

                  {/* Preset Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {PURCHASE_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => {
                          setBuyName(preset.name);
                          setBuyAmount(preset.amount);
                          handleCheckPurchase(preset.name, preset.amount);
                        }}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                          buyAmount === preset.amount
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : palette.secondaryBtn
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                        Item name
                      </label>
                      <input
                        type="text"
                        value={buyName}
                        onChange={(e) => setBuyName(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl border text-sm font-medium outline-none ${palette.input}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                        Price (₹)
                      </label>
                      <input
                        type="number"
                        step={1000}
                        value={buyAmount}
                        onChange={(e) => setBuyAmount(Number(e.target.value))}
                        className={`w-full px-3 py-2 rounded-xl border text-sm font-mono font-bold outline-none ${palette.input}`}
                      />
                    </div>
                  </div>

                  {/* Quick Verdict Preview */}
                  {purchaseResults && (
                    <div className={`p-3.5 rounded-xl border text-xs space-y-1 ${verdictTone.bg}`}>
                      <div className="font-extrabold uppercase tracking-wider">
                        {verdictTone.badge}
                      </div>
                      <p className="leading-relaxed">{purchaseResults.verdict_explanation}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2.5 pt-4 mt-4 border-t border-slate-200/60 dark:border-white/10">
                  <button
                    onClick={() => handleCheckPurchase()}
                    disabled={evaluatingBuy}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${palette.primaryBtn}`}
                  >
                    {evaluatingBuy ? 'Checking...' : 'Check Now'}
                  </button>
                  <button
                    onClick={() => setActiveTab('buy')}
                    className={`py-2.5 px-4 rounded-xl border text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${palette.secondaryBtn}`}
                  >
                    See all 4 options →
                  </button>
                </div>
              </div>
            </div>

            {/* Live Community Pulse & Activity Feed */}
            {liveStats && (
              <div className={`rounded-2xl border p-6 ${palette.card}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <h3 className="text-sm font-extrabold uppercase tracking-wider">
                      Live on Parallelverse
                    </h3>
                  </div>
                  <span className={`text-xs ${palette.subtext}`}>
                    Real-time anonymous community activity & streaks
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  <div className={`p-3.5 rounded-xl border ${palette.cardSoft}`}>
                    <div className={`text-xs font-semibold ${palette.subtext}`}>Online now</div>
                    <div className="text-xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {liveStats.online}
                    </div>
                  </div>
                  <div className={`p-3.5 rounded-xl border ${palette.cardSoft}`}>
                    <div className={`text-xs font-semibold ${palette.subtext}`}>Total visits</div>
                    <div className="text-xl font-extrabold font-mono mt-0.5">
                      {liveStats.visits.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className={`p-3.5 rounded-xl border ${palette.cardSoft}`}>
                    <div className={`text-xs font-semibold ${palette.subtext}`}>
                      Simulations run
                    </div>
                    <div className="text-xl font-extrabold font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                      {liveStats.simulations.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className={`p-3.5 rounded-xl border ${palette.cardSoft}`}>
                    <div className={`text-xs font-semibold ${palette.subtext}`}>
                      Purchases analysed
                    </div>
                    <div className="text-xl font-extrabold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                      {formatCompactINR(liveStats.analysed_amount)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {liveStats.feed.slice(0, 4).map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs ${palette.cardSoft}`}
                    >
                      <span className="font-medium truncate pr-2">{item.text}</span>
                      <span className={`font-mono shrink-0 ${palette.muted}`}>{item.when}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            TAB 2: CAN I BUY? (Verdict + True Cost + Job-Loss Runway + Credit + 4 Options)
           =================================================================== */}
        {activeTab === 'buy' && purchaseResults && simResults && (
          <div className="space-y-6">
            {/* Top Input Bar + Presets */}
            <div className={`rounded-2xl border p-6 space-y-4 ${palette.card}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Purchase Decision Advisor
                  </span>
                  <h1 className="text-2xl font-extrabold">Can I afford to buy this?</h1>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {PURCHASE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        setBuyName(preset.name);
                        setBuyAmount(preset.amount);
                        setBuyAltAmount(Math.round(preset.amount * 0.62));
                        handleCheckPurchase(preset.name, preset.amount);
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                        buyAmount === preset.amount
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : palette.secondaryBtn
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-5">
                  <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                    What do you want to buy?
                  </label>
                  <input
                    type="text"
                    value={buyName}
                    onChange={(e) => setBuyName(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-semibold outline-none ${palette.input}`}
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                    How much does it cost? (₹)
                  </label>
                  <input
                    type="number"
                    step={1000}
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(Number(e.target.value))}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono font-bold outline-none ${palette.input}`}
                  />
                </div>
                <div className="sm:col-span-3 flex gap-2">
                  <button
                    onClick={() => handleCheckPurchase()}
                    disabled={evaluatingBuy}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${palette.primaryBtn}`}
                  >
                    {evaluatingBuy ? 'Checking...' : 'Get My Answer'}
                  </button>
                  <button
                    onClick={() => setShowBuyAdvanced((prev) => !prev)}
                    title="Customize EMI & Wait options"
                    className={`p-2.5 rounded-xl border transition cursor-pointer ${palette.secondaryBtn}`}
                  >
                    <Sliders className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Optional EMI / Cheaper Alternative tuning */}
              {showBuyAdvanced && (
                <div className={`grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t ${palette.divider}`}>
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                      EMI Down Payment (₹)
                    </label>
                    <input
                      type="number"
                      value={buyDownPayment}
                      onChange={(e) => setBuyDownPayment(Number(e.target.value))}
                      className={`w-full px-3 py-2 rounded-lg border text-xs font-mono ${palette.input}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                      EMI Interest (% p.a.)
                    </label>
                    <input
                      type="number"
                      step={0.5}
                      value={buyRate}
                      onChange={(e) => setBuyRate(Number(e.target.value))}
                      className={`w-full px-3 py-2 rounded-lg border text-xs font-mono ${palette.input}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                      EMI Months
                    </label>
                    <input
                      type="number"
                      value={buyTenure}
                      onChange={(e) => setBuyTenure(Number(e.target.value))}
                      className={`w-full px-3 py-2 rounded-lg border text-xs font-mono ${palette.input}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                      Wait & Save Months
                    </label>
                    <input
                      type="number"
                      value={buyWaitMonths}
                      onChange={(e) => setBuyWaitMonths(Number(e.target.value))}
                      className={`w-full px-3 py-2 rounded-lg border text-xs font-mono ${palette.input}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                      Cheaper Alternative (₹)
                    </label>
                    <input
                      type="number"
                      value={buyAltAmount}
                      onChange={(e) => setBuyAltAmount(Number(e.target.value))}
                      className={`w-full px-3 py-2 rounded-lg border text-xs font-mono ${palette.input}`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Big Plain-English Verdict Banner */}
            <div className={`rounded-2xl border p-6 ${verdictTone.bg}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase ${verdictTone.pill}`}>
                  {verdictTone.badge}
                </span>
                <span className="text-xs font-mono font-semibold opacity-80">
                  Monthly surplus: {formatINR(purchaseResults.baseline_free_cash_flow)}/mo • Safety
                  target: {formatINR(purchaseResults.emergency_fund_target)}
                </span>
              </div>
              <h2 className="text-xl font-extrabold mb-1">{verdictTone.title}</h2>
              <p className="text-sm leading-relaxed">{purchaseResults.verdict_explanation}</p>
            </div>

            {/* 3 Deep-Impact Cards: True 12-Month Cost, Job-Loss Survival Runway, Credit Score Impact */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. True 12-Month Cost */}
              <div className={`rounded-2xl border p-5 ${palette.card}`}>
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  💸 True 12-Month Cost
                </div>
                <div className="text-2xl font-extrabold font-mono mt-1.5">
                  {formatINR(simResults.comparison_summary.true_cost_of_purchase)}
                </div>
                <p className={`text-xs mt-2 leading-relaxed ${palette.subtext}`}>
                  Sticker price is <strong>{formatINR(purchaseResults.purchase_amount)}</strong>,
                  plus{' '}
                  <strong className="text-amber-600 dark:text-amber-400">
                    {formatINR(simResults.comparison_summary.opportunity_cost)}
                  </strong>{' '}
                  in lost investment growth (at {profile.investment_return_pct}% p.a.).
                </p>
              </div>

              {/* 2. Job-Loss Survival Runway */}
              <div className={`rounded-2xl border p-5 ${palette.card}`}>
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  🛟 If Your Salary Stopped Tomorrow
                </div>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span className="text-2xl font-extrabold font-mono">
                    {simResults.comparison_summary.job_loss_runway_after_months.toFixed(1)} mo
                  </span>
                  <span className={`text-xs font-mono ${palette.subtext}`}>
                    (was {simResults.comparison_summary.job_loss_runway_before_months.toFixed(1)}{' '}
                    mo)
                  </span>
                </div>
                <p className={`text-xs mt-2 leading-relaxed ${palette.subtext}`}>
                  This purchase trims your zero-income survival buffer by{' '}
                  <strong className="text-rose-600 dark:text-rose-400">
                    {Math.max(
                      0,
                      simResults.comparison_summary.job_loss_runway_before_months -
                        simResults.comparison_summary.job_loss_runway_after_months
                    ).toFixed(1)}{' '}
                    months
                  </strong>
                  .
                </p>
              </div>

              {/* 3. Credit Score Impact */}
              <div className={`rounded-2xl border p-5 ${palette.card}`}>
                <div className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                  📈 Credit Score Impact (if on EMI)
                </div>
                {(() => {
                  const ci = simResults.comparison_summary.credit_impact;
                  return (
                    <>
                      <div className="flex items-baseline gap-2 mt-1.5 font-mono">
                        <span className="text-2xl font-extrabold">{ci.current_score}</span>
                        <span className="text-xs text-amber-500 font-bold">
                          → {ci.score_at_purchase} at signup
                        </span>
                        <span className="text-xs text-emerald-500 font-bold">
                          → {ci.score_after_loan} paid on time
                        </span>
                      </div>
                      <p className={`text-xs mt-2 leading-relaxed ${palette.subtext}`}>
                        {ci.headline} Missing 1 EMI drops score to{' '}
                        <strong className="text-rose-600 font-mono">
                          {ci.score_if_emi_missed}
                        </strong>
                        .
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* 4 Ways to Handle This Purchase */}
            <div>
              <h3 className="text-base font-extrabold mb-3">
                4 Ways to Handle This Purchase (Side-by-Side)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {purchaseResults.options.map((opt) => {
                  const isRec = opt.option_id === purchaseResults.recommended_option_id;
                  const riskBadge =
                    opt.risk_rating === 'SAFE'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : opt.risk_rating === 'CAUTION'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400';

                  return (
                    <div
                      key={opt.option_id}
                      className={`rounded-2xl border p-5 flex flex-col justify-between transition ${
                        isRec
                          ? 'ring-2 ring-indigo-600 border-indigo-600 ' + palette.card
                          : palette.card
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold ${riskBadge}`}>
                            {opt.risk_rating === 'SAFE'
                              ? 'SAFE'
                              : opt.risk_rating === 'CAUTION'
                              ? 'TIGHT'
                              : 'RISKY'}
                          </span>
                          {isRec && (
                            <span className="px-2.5 py-0.5 rounded-md bg-indigo-600 text-white text-[11px] font-extrabold">
                              ★ BEST CHOICE
                            </span>
                          )}
                        </div>

                        <h4 className="font-extrabold text-sm leading-snug">{opt.option_title}</h4>

                        <div className={`space-y-1.5 pt-2 border-t text-xs ${palette.divider}`}>
                          <div className="flex justify-between">
                            <span className={palette.subtext}>Pay today:</span>
                            <span className="font-mono font-bold">
                              {formatINR(opt.upfront_cash_required)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={palette.subtext}>Monthly payment:</span>
                            <span className="font-mono font-bold">
                              {opt.monthly_obligation > 0
                                ? `${formatINR(opt.monthly_obligation)}/mo`
                                : '₹0'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={palette.subtext}>Total cost:</span>
                            <span className="font-mono font-bold">{formatINR(opt.total_cost)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={palette.subtext}>Left in bank Day 1:</span>
                            <span
                              className={`font-mono font-bold ${
                                opt.remaining_savings_immediately < profile.emergency_fund_target
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {formatINR(opt.remaining_savings_immediately)}
                            </span>
                          </div>
                        </div>

                        <p className={`text-xs leading-relaxed pt-1 ${palette.subtext}`}>
                          {opt.key_tradeoff}
                        </p>
                      </div>

                      <div className="pt-4 mt-4 border-t border-slate-200/60 dark:border-white/10">
                        <div className="flex justify-between text-[11px] font-semibold mb-1">
                          <span className={palette.subtext}>Safety net kept</span>
                          <span className="font-mono">
                            {Math.round(opt.emergency_buffer_preserved_pct)}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-600"
                            style={{
                              width: `${Math.min(100, Math.max(0, opt.emergency_buffer_preserved_pct))}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 3: WHAT IF? (5 Parallel Futures Simulator & Interactive Chart)
           =================================================================== */}
        {activeTab === 'whatif' && simResults && (
          <div className="space-y-6">
            {/* Simulator Controls */}
            <div className={`rounded-2xl border p-6 space-y-4 ${palette.card}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Deterministic Stress-Testing Engine
                  </span>
                  <h1 className="text-2xl font-extrabold">
                    5 Parallel Futures for “{buyName}” ({formatINR(buyAmount)})
                  </h1>
                </div>

                {/* Payment Mode Segmented Buttons */}
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { id: 'CASH', label: 'Pay Full Cash' },
                      { id: 'EMI', label: 'Buy on EMI' },
                      { id: 'NONE', label: 'Skip Purchase' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSimMode(m.id);
                        handleRunWhatIf(m.id);
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                        simMode === m.id
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : palette.secondaryBtn
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                    Months ahead
                  </label>
                  <select
                    value={simHorizon}
                    onChange={(e) => setSimHorizon(Number(e.target.value))}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-bold ${palette.input}`}
                  >
                    <option value={6}>6 Months</option>
                    <option value={12}>12 Months (1 Year)</option>
                    <option value={18}>18 Months</option>
                    <option value={24}>24 Months (2 Years)</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                    Buy in Month #
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={simHorizon}
                    value={simMonth}
                    onChange={(e) => setSimMonth(Number(e.target.value))}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-mono font-bold ${palette.input}`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                    Surprise Bill (₹)
                  </label>
                  <input
                    type="number"
                    step={5000}
                    value={simSurpriseBill}
                    onChange={(e) => setSimSurpriseBill(Number(e.target.value))}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-mono font-bold ${palette.input}`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                    Inflation Surge (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={simInflationPct}
                    onChange={(e) => setSimInflationPct(Number(e.target.value))}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-mono font-bold ${palette.input}`}
                  />
                </div>

                <button
                  onClick={() => handleRunWhatIf()}
                  disabled={runningSim}
                  className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${palette.primaryBtn}`}
                >
                  {runningSim ? 'Simulating...' : 'Update 5 Futures'}
                </button>
              </div>
            </div>

            {/* Recommendation Banner */}
            <div
              className={`rounded-2xl border p-4 flex items-start gap-3 ${
                simResults.comparison_summary.has_cash_deficit_risk
                  ? palette.isDark
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                  : palette.isDark
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              {simResults.comparison_summary.has_cash_deficit_risk ? (
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              )}
              <div className="text-sm font-semibold leading-relaxed">
                {simResults.recommendation}
              </div>
            </div>

            {/* Interactive SVG Multi-Scenario Chart */}
            <div className={`rounded-2xl border p-6 ${palette.card}`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-extrabold">
                    Month-by-Month Bank Balance Across All 5 Futures
                  </h2>
                  <p className={`text-xs ${palette.subtext}`}>
                    Hover over any month to inspect exact balances • Dashed green line is your{' '}
                    {formatINR(profile.emergency_fund_target)} safety net target
                  </p>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-3">
                  {Object.entries(SCENARIO_META).map(([key, meta]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedScenarioKey(key)}
                      className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                        selectedScenarioKey === key
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span>{meta.short}</span>
                    </button>
                  ))}
                </div>
              </div>

              {(() => {
                const scenarioList = Object.values(simResults.scenarios);
                const monthsCount = scenarioList[0]?.timeline.length || 12;
                const allValues = scenarioList.flatMap((s) =>
                  s.timeline.map((t) => t.closing_savings)
                );
                const minVal = Math.min(0, ...allValues, profile.emergency_fund_target * 0.5);
                const maxVal = Math.max(
                  ...allValues,
                  profile.emergency_fund_target * 1.15,
                  100000
                );
                const span = Math.max(1, maxVal - minVal);

                const W = 900;
                const H = 300;
                const padL = 70;
                const padR = 24;
                const padT = 20;
                const padB = 34;
                const plotW = W - padL - padR;
                const plotH = H - padT - padB;

                const xForMonth = (m: number) =>
                  padL + ((m - 1) / Math.max(1, monthsCount - 1)) * plotW;
                const yForVal = (v: number) => padT + ((maxVal - v) / span) * plotH;

                const zeroY = yForVal(0);
                const emergY = yForVal(profile.emergency_fund_target);

                return (
                  <div className="relative">
                    <svg
                      viewBox={`0 0 ${W} ${H}`}
                      className="w-full h-72 overflow-visible select-none"
                      onMouseLeave={() => setHoverMonth(null)}
                    >
                      {/* Horizontal Grid Lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
                        const val = maxVal - f * span;
                        const y = padT + f * plotH;
                        return (
                          <g key={i}>
                            <line
                              x1={padL}
                              y1={y}
                              x2={W - padR}
                              y2={y}
                              stroke={palette.chartGrid}
                              strokeWidth="1"
                            />
                            <text
                              x={padL - 8}
                              y={y + 4}
                              textAnchor="end"
                              fontSize="10"
                              fontFamily="JetBrains Mono, monospace"
                              fill={palette.isDark ? '#94A3B8' : '#64748B'}
                            >
                              {formatCompactINR(val)}
                            </text>
                          </g>
                        );
                      })}

                      {/* Emergency Fund Target Dashed Line */}
                      {emergY >= padT && emergY <= H - padB && (
                        <g>
                          <line
                            x1={padL}
                            y1={emergY}
                            x2={W - padR}
                            y2={emergY}
                            stroke="#059669"
                            strokeWidth="1.5"
                            strokeDasharray="5 5"
                          />
                          <text
                            x={W - padR - 4}
                            y={emergY - 6}
                            textAnchor="end"
                            fontSize="10"
                            fontWeight="700"
                            fill="#059669"
                          >
                            Safety Net ({formatCompactINR(profile.emergency_fund_target)})
                          </text>
                        </g>
                      )}

                      {/* ₹0 Danger Line */}
                      {zeroY >= padT && zeroY <= H - padB && (
                        <line
                          x1={padL}
                          y1={zeroY}
                          x2={W - padR}
                          y2={zeroY}
                          stroke="#E11D48"
                          strokeWidth="1.5"
                        />
                      )}

                      {/* 5 Scenario Polylines */}
                      {Object.entries(simResults.scenarios).map(([key, sc]) => {
                        const meta = SCENARIO_META[key] || {
                          color: '#4F46E5',
                          short: sc.scenario_name,
                        };
                        const isSelected = selectedScenarioKey === key;
                        const pts = sc.timeline
                          .map((t) => `${xForMonth(t.month)},${yForVal(t.closing_savings)}`)
                          .join(' ');
                        return (
                          <g key={key}>
                            <polyline
                              fill="none"
                              stroke={meta.color}
                              strokeWidth={isSelected ? 3.5 : 2}
                              strokeOpacity={isSelected ? 1 : 0.65}
                              points={pts}
                            />
                            {sc.timeline.map((t) => (
                              <circle
                                key={t.month}
                                cx={xForMonth(t.month)}
                                cy={yForVal(t.closing_savings)}
                                r={isSelected || hoverMonth === t.month ? 4 : 2.5}
                                fill={meta.color}
                              />
                            ))}
                          </g>
                        );
                      })}

                      {/* X-Axis Labels & Hover Columns */}
                      {Array.from({ length: monthsCount }, (_, idx) => idx + 1).map((m) => {
                        const x = xForMonth(m);
                        return (
                          <g key={m}>
                            {hoverMonth === m && (
                              <line
                                x1={x}
                                y1={padT}
                                x2={x}
                                y2={H - padB}
                                stroke="#6366F1"
                                strokeWidth="1"
                                strokeDasharray="3 3"
                              />
                            )}
                            <text
                              x={x}
                              y={H - 10}
                              textAnchor="middle"
                              fontSize="10"
                              fontFamily="JetBrains Mono, monospace"
                              fill={palette.isDark ? '#94A3B8' : '#64748B'}
                            >
                              M{m}
                            </text>
                            <rect
                              x={x - plotW / monthsCount / 2}
                              y={padT}
                              width={plotW / monthsCount}
                              height={plotH}
                              fill="transparent"
                              onMouseEnter={() => setHoverMonth(m)}
                            />
                          </g>
                        );
                      })}
                    </svg>

                    {/* Hover Readout Bar */}
                    {hoverMonth && (
                      <div
                        className={`mt-3 p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${palette.cardSoft}`}
                      >
                        <span className="font-extrabold">Month {hoverMonth} Balances:</span>
                        <div className="flex flex-wrap items-center gap-4">
                          {Object.entries(simResults.scenarios).map(([key, sc]) => {
                            const meta = SCENARIO_META[key];
                            const item = sc.timeline[hoverMonth - 1];
                            if (!item) return null;
                            return (
                              <span key={key} className="flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: meta?.color }}
                                />
                                <span className={palette.subtext}>{meta?.short}:</span>
                                <strong className="font-mono">
                                  {formatINR(item.closing_savings)}
                                </strong>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* 5 Scenario Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {Object.entries(simResults.scenarios).map(([key, sc]) => {
                const meta = SCENARIO_META[key];
                const isSelected = selectedScenarioKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedScenarioKey(key)}
                    className={`text-left rounded-2xl border p-4 transition cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-indigo-600 border-indigo-600 ' + palette.card
                        : palette.card
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className="px-2 py-0.5 rounded-md text-[11px] font-extrabold"
                        style={{ backgroundColor: meta.badgeBg, color: meta.color }}
                      >
                        {meta.short}
                      </span>
                      <span className="font-mono text-xs font-bold">
                        {Math.round(sc.resilience_score)}/100
                      </span>
                    </div>

                    <div className={`text-xs ${palette.subtext}`}>Lowest bank balance</div>
                    <div
                      className={`text-lg font-extrabold font-mono mt-0.5 ${
                        sc.lowest_savings < 0
                          ? 'text-rose-600'
                          : sc.lowest_savings < profile.emergency_fund_target
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {formatINR(sc.lowest_savings)}
                    </div>
                    <div className={`text-[11px] mt-1 ${palette.subtext}`}>
                      in Month {sc.lowest_savings_month} • Ends at {formatCompactINR(sc.final_savings)}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Scenario Month-by-Month Ledger */}
            {simResults.scenarios[selectedScenarioKey] && (
              <div className={`rounded-2xl border p-6 ${palette.card}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div>
                    <h3 className="text-base font-extrabold">
                      Month-by-Month Cash Ledger:{' '}
                      {simResults.scenarios[selectedScenarioKey].scenario_name}
                    </h3>
                    <p className={`text-xs ${palette.subtext}`}>
                      {simResults.scenarios[selectedScenarioKey].breaking_point_reason}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b ${palette.divider} ${palette.subtext}`}>
                        <th className="py-2.5 px-3 font-bold">Month</th>
                        <th className="py-2.5 px-3 font-bold">Opening</th>
                        <th className="py-2.5 px-3 font-bold">Income</th>
                        <th className="py-2.5 px-3 font-bold">Living + EMI</th>
                        <th className="py-2.5 px-3 font-bold">Purchase</th>
                        <th className="py-2.5 px-3 font-bold">Surprise Bill</th>
                        <th className="py-2.5 px-3 font-bold">Interest Earned</th>
                        <th className="py-2.5 px-3 font-bold">Closing Bank</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {simResults.scenarios[selectedScenarioKey].timeline.map((row) => (
                        <tr
                          key={row.month}
                          className={`border-b ${palette.divider} ${
                            row.is_negative_cash ? 'bg-rose-500/10' : ''
                          }`}
                        >
                          <td className="py-2 px-3 font-bold">M{row.month}</td>
                          <td className="py-2 px-3">{formatINR(row.opening_savings)}</td>
                          <td className="py-2 px-3 text-emerald-600 dark:text-emerald-400">
                            +{formatINR(row.income_received)}
                          </td>
                          <td className="py-2 px-3">
                            {formatINR(
                              row.essential_expenses + row.discretionary_expenses + row.existing_emi
                            )}
                          </td>
                          <td className="py-2 px-3 font-bold text-indigo-600 dark:text-indigo-400">
                            {row.purchase_payment > 0 ? formatINR(row.purchase_payment) : '—'}
                          </td>
                          <td className="py-2 px-3 text-amber-600 dark:text-amber-400">
                            {row.unexpected_expense > 0 ? formatINR(row.unexpected_expense) : '—'}
                          </td>
                          <td className="py-2 px-3 text-emerald-600 dark:text-emerald-400">
                            +{formatINR(row.interest_earned)}
                          </td>
                          <td
                            className={`py-2 px-3 font-extrabold ${
                              row.closing_savings < 0
                                ? 'text-rose-600'
                                : row.is_under_emergency_target
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {formatINR(row.closing_savings)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            TAB 4: MY EMIS (Installment Tracker + .ics Calendar + Prepayment Calc)
           =================================================================== */}
        {activeTab === 'emis' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Obligations & Calendar Reminders
                </span>
                <h1 className="text-2xl font-extrabold">My EMIs & Loan Calculator</h1>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEmiSubTab('tracker')}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                    emiSubTab === 'tracker'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : palette.secondaryBtn
                  }`}
                >
                  📅 Active EMI Tracker ({installments.length})
                </button>
                <button
                  onClick={() => setEmiSubTab('calculator')}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                    emiSubTab === 'calculator'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : palette.secondaryBtn
                  }`}
                >
                  🧮 Prepayment EMI Calculator
                </button>
              </div>
            </div>

            {emiSubTab === 'tracker' ? (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowNewPlanForm((prev) => !prev)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${palette.primaryBtn}`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>{showNewPlanForm ? 'Close Form' : 'Add New EMI Plan'}</span>
                  </button>
                </div>

                {/* Add New EMI Form */}
                {showNewPlanForm && (
                  <form
                    onSubmit={handleCreateInstallment}
                    className={`rounded-2xl border p-6 space-y-4 ${palette.card}`}
                  >
                    <h3 className="text-base font-extrabold">Add an EMI Plan to Track</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                          Purchase Name
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. iPhone 16 / Sofa Set"
                          value={newPlan.purchase_name}
                          onChange={(e) =>
                            setNewPlan({ ...newPlan, purchase_name: e.target.value })
                          }
                          className={`w-full px-3 py-2 rounded-xl border text-sm ${palette.input}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                          Total Price (₹)
                        </label>
                        <input
                          type="number"
                          required
                          value={newPlan.total_amount}
                          onChange={(e) =>
                            setNewPlan({ ...newPlan, total_amount: Number(e.target.value) })
                          }
                          className={`w-full px-3 py-2 rounded-xl border text-sm font-mono ${palette.input}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                          Down Payment (₹)
                        </label>
                        <input
                          type="number"
                          value={newPlan.down_payment}
                          onChange={(e) =>
                            setNewPlan({ ...newPlan, down_payment: Number(e.target.value) })
                          }
                          className={`w-full px-3 py-2 rounded-xl border text-sm font-mono ${palette.input}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                          Interest Rate (% p.a.)
                        </label>
                        <input
                          type="number"
                          step={0.5}
                          value={newPlan.annual_interest_rate}
                          onChange={(e) =>
                            setNewPlan({
                              ...newPlan,
                              annual_interest_rate: Number(e.target.value),
                            })
                          }
                          className={`w-full px-3 py-2 rounded-xl border text-sm font-mono ${palette.input}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                          Tenure (Months)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={newPlan.tenure_months}
                          onChange={(e) =>
                            setNewPlan({ ...newPlan, tenure_months: Number(e.target.value) })
                          }
                          className={`w-full px-3 py-2 rounded-xl border text-sm font-mono ${palette.input}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                          Billing Day of Month (1-28)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={28}
                          value={newPlan.due_day}
                          onChange={(e) =>
                            setNewPlan({ ...newPlan, due_day: Number(e.target.value) })
                          }
                          className={`w-full px-3 py-2 rounded-xl border text-sm font-mono ${palette.input}`}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="submit"
                        className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold cursor-pointer ${palette.primaryBtn}`}
                      >
                        Save EMI Plan
                      </button>
                    </div>
                  </form>
                )}

                {/* Active Installment Plans */}
                {installments.map((plan) => {
                  const pct =
                    plan.tenure_months > 0
                      ? Math.round((plan.paid_installments_count / plan.tenure_months) * 100)
                      : 0;
                  const nextUnpaid = plan.payments.find((p) => p.status !== 'PAID');
                  const isExpanded = expandedPlanId === plan.id;

                  return (
                    <div key={plan.id} className={`rounded-2xl border p-6 space-y-4 ${palette.card}`}>
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-extrabold">{plan.purchase_name}</h3>
                            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-500/10 text-indigo-500">
                              {plan.paid_installments_count}/{plan.tenure_months} paid
                            </span>
                          </div>
                          <p className={`text-xs mt-0.5 ${palette.subtext}`}>
                            Monthly EMI:{' '}
                            <strong className="font-mono">{formatINR(plan.monthly_emi)}</strong> •
                            Remaining balance:{' '}
                            <strong className="font-mono">
                              {formatINR(plan.outstanding_balance)}
                            </strong>{' '}
                            • Next due: <strong>{plan.next_due_date || 'All paid 🎉'}</strong>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {nextUnpaid && (
                            <button
                              onClick={() =>
                                handleTogglePayment(plan.id, nextUnpaid.id, nextUnpaid.status)
                              }
                              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Mark EMI #{nextUnpaid.installment_number} Paid</span>
                            </button>
                          )}

                          <a
                            href={`/api/installments/${plan.id}/reminders.ics`}
                            download={`emi_reminders_${plan.id}.ics`}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition whitespace-nowrap shrink-0 ${palette.secondaryBtn}`}
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Add to Calendar (.ics)</span>
                          </a>

                          <button
                            onClick={() =>
                              setExpandedPlanId(isExpanded ? null : plan.id)
                            }
                            className={`p-2 rounded-xl border transition cursor-pointer ${palette.secondaryBtn}`}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            onClick={() => handleDeletePlan(plan.id)}
                            title="Delete EMI Plan"
                            className="p-2 rounded-xl border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {/* Expandable Installment Schedule */}
                      {isExpanded && (
                        <div className="overflow-x-auto pt-2">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className={`border-b ${palette.divider} ${palette.subtext}`}>
                                <th className="py-2 px-3">#</th>
                                <th className="py-2 px-3">Due Date</th>
                                <th className="py-2 px-3">EMI Amount</th>
                                <th className="py-2 px-3">Principal</th>
                                <th className="py-2 px-3">Interest</th>
                                <th className="py-2 px-3">Balance Left</th>
                                <th className="py-2 px-3">Status</th>
                                <th className="py-2 px-3 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="font-mono">
                              {plan.payments.map((p) => (
                                <tr key={p.id} className={`border-b ${palette.divider}`}>
                                  <td className="py-2 px-3 font-bold">#{p.installment_number}</td>
                                  <td className="py-2 px-3">{p.due_date}</td>
                                  <td className="py-2 px-3 font-bold">{formatINR(p.emi_amount)}</td>
                                  <td className="py-2 px-3">{formatINR(p.principal_portion)}</td>
                                  <td className="py-2 px-3 text-amber-600 dark:text-amber-400">
                                    {formatINR(p.interest_portion)}
                                  </td>
                                  <td className="py-2 px-3">{formatINR(p.remaining_balance)}</td>
                                  <td className="py-2 px-3">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                        p.status === 'PAID'
                                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                      }`}
                                    >
                                      {p.status}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    <button
                                      onClick={() =>
                                        handleTogglePayment(plan.id, p.id, p.status)
                                      }
                                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-sans font-bold cursor-pointer ${palette.secondaryBtn}`}
                                    >
                                      {p.status === 'PAID' ? 'Undo' : 'Mark Paid'}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Interactive EMI & Prepayment Calculator */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className={`lg:col-span-5 rounded-2xl border p-6 space-y-4 ${palette.card}`}>
                  <h3 className="text-base font-extrabold">
                    Reducing-Balance EMI & Extra Prepayment
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                        Purchase Price (₹)
                      </label>
                      <input
                        type="number"
                        value={calcPrice}
                        onChange={(e) => setCalcPrice(Number(e.target.value))}
                        className={`w-full px-3 py-2 rounded-xl border text-sm font-mono font-bold ${palette.input}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                        Down Payment (₹)
                      </label>
                      <input
                        type="number"
                        value={calcDown}
                        onChange={(e) => setCalcDown(Number(e.target.value))}
                        className={`w-full px-3 py-2 rounded-xl border text-sm font-mono font-bold ${palette.input}`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                          Interest Rate (% p.a.)
                        </label>
                        <input
                          type="number"
                          step={0.5}
                          value={calcRate}
                          onChange={(e) => setCalcRate(Number(e.target.value))}
                          className={`w-full px-3 py-2 rounded-xl border text-sm font-mono font-bold ${palette.input}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                          Tenure (Months)
                        </label>
                        <input
                          type="number"
                          value={calcTenure}
                          onChange={(e) => setCalcTenure(Number(e.target.value))}
                          className={`w-full px-3 py-2 rounded-xl border text-sm font-mono font-bold ${palette.input}`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                        Extra Prepayment Each Month (₹)
                      </label>
                      <input
                        type="number"
                        step={500}
                        value={calcExtra}
                        onChange={(e) => setCalcExtra(Number(e.target.value))}
                        className={`w-full px-3 py-2 rounded-xl border text-sm font-mono font-bold ${palette.input}`}
                      />
                    </div>
                    <button
                      onClick={handleRunEmiCalc}
                      className={`w-full py-2.5 px-4 rounded-xl text-sm font-bold cursor-pointer ${palette.primaryBtn}`}
                    >
                      Calculate EMI & Prepayment Savings
                    </button>
                  </div>
                </div>

                {emiResult && (
                  <div className={`lg:col-span-7 rounded-2xl border p-6 space-y-4 ${palette.card}`}>
                    <div className="grid grid-cols-3 gap-3">
                      <div className={`p-3.5 rounded-xl border ${palette.cardSoft}`}>
                        <div className={`text-xs font-semibold ${palette.subtext}`}>
                          Base Monthly EMI
                        </div>
                        <div className="text-xl font-extrabold font-mono mt-0.5">
                          {formatINR(emiResult.monthly_emi)}
                        </div>
                      </div>
                      <div className={`p-3.5 rounded-xl border ${palette.cardSoft}`}>
                        <div className={`text-xs font-semibold ${palette.subtext}`}>
                          Total Interest
                        </div>
                        <div className="text-xl font-extrabold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                          {formatINR(emiResult.total_interest)}
                        </div>
                      </div>
                      <div className={`p-3.5 rounded-xl border ${palette.cardSoft}`}>
                        <div className={`text-xs font-semibold ${palette.subtext}`}>
                          Payoff Time
                        </div>
                        <div className="text-xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {emiResult.tenure_months} mo
                        </div>
                      </div>
                    </div>

                    {emiNoExtraResult &&
                      emiNoExtraResult.total_interest > emiResult.total_interest && (
                        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                          🎉 Paying an extra{' '}
                          <strong className="font-mono">{formatINR(calcExtra)}/mo</strong> saves you{' '}
                          <strong className="font-mono">
                            {formatINR(emiNoExtraResult.total_interest - emiResult.total_interest)}
                          </strong>{' '}
                          in interest and finishes the loan{' '}
                          <strong>
                            {emiNoExtraResult.tenure_months - emiResult.tenure_months} month(s)
                          </strong>{' '}
                          early!
                        </div>
                      )}

                    <div className="overflow-x-auto max-h-72">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className={`border-b ${palette.divider} ${palette.subtext}`}>
                            <th className="py-2 px-3">Month</th>
                            <th className="py-2 px-3">Payment</th>
                            <th className="py-2 px-3">Principal</th>
                            <th className="py-2 px-3">Interest</th>
                            <th className="py-2 px-3">Remaining Balance</th>
                          </tr>
                        </thead>
                        <tbody className="font-mono">
                          {emiResult.schedule.map((row) => (
                            <tr key={row.month} className={`border-b ${palette.divider}`}>
                              <td className="py-2 px-3 font-bold">M{row.month}</td>
                              <td className="py-2 px-3">{formatINR(row.payment_amount)}</td>
                              <td className="py-2 px-3 text-emerald-600 dark:text-emerald-400">
                                {formatINR(row.principal_paid)}
                              </td>
                              <td className="py-2 px-3 text-amber-600 dark:text-amber-400">
                                {formatINR(row.interest_paid)}
                              </td>
                              <td className="py-2 px-3 font-bold">
                                {formatINR(row.remaining_balance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            TAB 5: ME (Money Profile Editor + Account / Guest Mode)
           =================================================================== */}
        {activeTab === 'me' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleSaveProfile}
              className={`lg:col-span-8 rounded-2xl border p-6 space-y-5 ${palette.card}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Personal Baseline
                  </span>
                  <h1 className="text-xl font-extrabold">Your Money Numbers</h1>
                </div>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold cursor-pointer ${palette.primaryBtn}`}
                >
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={profileForm.full_name}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, full_name: e.target.value })
                    }
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-semibold ${palette.input}`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                    Monthly Take-Home Pay (₹)
                  </label>
                  <input
                    type="number"
                    step={2000}
                    value={profileForm.monthly_income}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, monthly_income: Number(e.target.value) })
                    }
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono font-bold ${palette.input}`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                    Current Bank Savings (₹)
                  </label>
                  <input
                    type="number"
                    step={5000}
                    value={profileForm.current_savings}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, current_savings: Number(e.target.value) })
                    }
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono font-bold ${palette.input}`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                    Safety Net Target (₹)
                  </label>
                  <input
                    type="number"
                    step={5000}
                    value={profileForm.emergency_fund_target}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        emergency_fund_target: Number(e.target.value),
                      })
                    }
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono font-bold ${palette.input}`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                    Must-Pay Monthly Bills (Rent, Groceries, Utilities) (₹)
                  </label>
                  <input
                    type="number"
                    step={1000}
                    value={profileForm.essential_expenses}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        essential_expenses: Number(e.target.value),
                      })
                    }
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono font-bold ${palette.input}`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                    Fun & Lifestyle Spending (Dining, Shopping) (₹)
                  </label>
                  <input
                    type="number"
                    step={1000}
                    value={profileForm.discretionary_expenses}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        discretionary_expenses: Number(e.target.value),
                      })
                    }
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono font-bold ${palette.input}`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                    Existing Monthly Loan EMIs (₹)
                  </label>
                  <input
                    type="number"
                    step={500}
                    value={profileForm.existing_debt_emi}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        existing_debt_emi: Number(e.target.value),
                      })
                    }
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono font-bold ${palette.input}`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                    Credit Score (300 - 900)
                  </label>
                  <input
                    type="number"
                    min={300}
                    max={900}
                    value={profileForm.credit_score}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, credit_score: Number(e.target.value) })
                    }
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono font-bold ${palette.input}`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                    Expected Yearly Raise (% p.a.)
                  </label>
                  <input
                    type="number"
                    step={1}
                    value={profileForm.income_growth_pct}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        income_growth_pct: Number(e.target.value),
                      })
                    }
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono font-bold ${palette.input}`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${palette.subtext}`}>
                    Return on Savings / FD / Mutual Funds (% p.a.)
                  </label>
                  <input
                    type="number"
                    step={0.5}
                    value={profileForm.investment_return_pct}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        investment_return_pct: Number(e.target.value),
                      })
                    }
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono font-bold ${palette.input}`}
                  />
                </div>
              </div>
            </form>

            {/* Account & Session Panel */}
            <div className={`lg:col-span-4 rounded-2xl border p-6 space-y-4 ${palette.card}`}>
              <h2 className="text-lg font-extrabold">Account & Session</h2>
              <div className={`p-4 rounded-xl border space-y-1 ${palette.cardSoft}`}>
                <div className="text-xs font-bold uppercase text-indigo-500">
                  {user?.is_guest ? 'Guest Session' : 'Signed-In Account'}
                </div>
                <div className="text-base font-extrabold">{user?.name}</div>
                {user?.email && <div className={`text-xs ${palette.subtext}`}>{user.email}</div>}
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={() => setShowLoginPage(true)}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold cursor-pointer ${palette.primaryBtn}`}
                >
                  Open Login / Create Account Page
                </button>
                <button
                  onClick={handleGuestMode}
                  className={`w-full py-2.5 px-4 rounded-xl border text-xs sm:text-sm font-bold cursor-pointer ${palette.secondaryBtn}`}
                >
                  Start Fresh 1-Click Guest Session
                </button>
                <button
                  onClick={handleLogout}
                  className={`w-full py-2.5 px-4 rounded-xl border text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer ${palette.secondaryBtn}`}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
