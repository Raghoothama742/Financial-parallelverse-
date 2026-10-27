export interface UserAccount {
  id: number;
  name: string;
  email: string | null;
  is_guest: boolean;
}

export interface HealthBreakdown {
  savings_rate_score: number;
  emergency_fund_score: number;
  runway_score: number;
  dti_score: number;
}

export interface FinancialProfile {
  id: number;
  user_id?: number;
  full_name: string;
  monthly_income: number;
  current_savings: number;
  essential_expenses: number;
  discretionary_expenses: number;
  existing_debt_emi: number;
  emergency_fund_target: number;
  income_growth_pct: number;
  investment_return_pct: number;
  credit_score: number;
  planned_purchase_name: string;
  planned_purchase_amount: number;
  planned_purchase_month: number;
  onboarded: number;
  free_cash_flow: number;
  total_monthly_outflows: number;
  savings_rate_pct: number;
  debt_to_income_pct: number;
  months_of_runway: number;
  emergency_coverage_pct: number;
  is_cash_flow_positive: boolean;
  health_score: number;
  health_label: string;
  health_breakdown: HealthBreakdown;
  updated_at?: string;
}

export interface CreditImpact {
  has_new_loan: boolean;
  current_score: number;
  score_at_purchase: number;
  score_after_loan: number;
  score_if_emi_missed: number;
  dti_before_pct: number;
  dti_after_pct: number;
  band_now: string;
  band_at_purchase: string;
  headline: string;
}

export interface ScenarioMonthItem {
  month: number;
  opening_savings: number;
  income_received: number;
  essential_expenses: number;
  discretionary_expenses: number;
  existing_emi: number;
  purchase_payment: number;
  unexpected_expense: number;
  total_outflows: number;
  interest_earned: number;
  net_cash_flow: number;
  closing_savings: number;
  emergency_shortfall: number;
  is_negative_cash: boolean;
  is_under_emergency_target: boolean;
}

export interface ScenarioResult {
  scenario_id: string;
  scenario_name: string;
  description: string;
  assumptions: string[];
  lowest_savings: number;
  lowest_savings_month: number;
  negative_cash_months: number;
  emergency_shortfall_months: number;
  breaking_point_detected: boolean;
  breaking_point_month?: number | null;
  breaking_point_reason?: string;
  resilience_score: number;
  risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  final_savings: number;
  total_income: number;
  total_outflows: number;
  total_interest_earned: number;
  timeline: ScenarioMonthItem[];
}

export interface ScenarioSimulationRequest {
  duration_months?: number;
  monthly_income?: number;
  current_savings?: number;
  essential_expenses?: number;
  discretionary_expenses?: number;
  existing_debt_emi?: number;
  emergency_fund_target?: number;
  purchase_name?: string;
  purchase_amount?: number;
  purchase_month?: number;
  purchase_mode?: 'CASH' | 'EMI' | 'NONE';
  emi_down_payment?: number;
  emi_interest_rate?: number;
  emi_tenure_months?: number;
  unexpected_expense_amount?: number;
  unexpected_expense_month?: number;
  salary_delay_months?: number;
  salary_delay_start_month?: number;
  expense_increase_pct?: number;
  income_growth_pct?: number;
  investment_return_pct?: number;
  credit_score?: number;
}

export interface ScenarioSimulationResponse {
  scenarios: Record<string, ScenarioResult>;
  comparison_summary: {
    lowest_overall_savings: number;
    has_cash_deficit_risk: boolean;
    safest_scenario: string;
    most_vulnerable_scenario: string;
    horizon_months: number;
    cash_paid_in_horizon: number;
    true_cost_of_purchase: number;
    opportunity_cost: number;
    interest_earned_baseline: number;
    job_loss_runway_before_months: number;
    job_loss_runway_after_months: number;
    credit_impact: CreditImpact;
    dti_after_purchase_pct: number;
  };
  recommendation: string;
}

export interface PurchaseOptionResult {
  option_id: string;
  option_title: string;
  upfront_cash_required: number;
  monthly_obligation: number;
  total_cost: number;
  remaining_savings_immediately: number;
  emergency_buffer_preserved_pct: number;
  safe_to_proceed: boolean;
  risk_rating: 'SAFE' | 'CAUTION' | 'HIGH_RISK';
  pros: string[];
  cons: string[];
  key_tradeoff: string;
}

export interface PurchaseEvaluationRequest {
  purchase_name?: string;
  purchase_amount?: number;
  cheaper_alternative_name?: string;
  cheaper_alternative_amount?: number;
  wait_months?: number;
  emi_down_payment?: number;
  emi_interest_rate?: number;
  emi_tenure_months?: number;
}

export interface PurchaseEvaluationResponse {
  purchase_name: string;
  purchase_amount: number;
  baseline_free_cash_flow: number;
  emergency_fund_target: number;
  current_savings: number;
  options: PurchaseOptionResult[];
  recommended_option_id: string;
  verdict_explanation: string;
}

export interface EMIScheduleItem {
  month: number;
  payment_amount: number;
  principal_paid: number;
  interest_paid: number;
  remaining_balance: number;
  cumulative_interest: number;
}

export interface EMICalculationRequest {
  purchase_price: number;
  down_payment?: number;
  annual_interest_rate?: number;
  tenure_months?: number;
  extra_monthly_payment?: number;
}

export interface EMICalculationResponse {
  purchase_price: number;
  down_payment: number;
  principal_financed: number;
  annual_interest_rate: number;
  tenure_months: number;
  monthly_emi: number;
  total_interest: number;
  total_repayment: number;
  schedule: EMIScheduleItem[];
}

export interface InstallmentPayment {
  id: number;
  installment_number: number;
  due_date: string;
  emi_amount: number;
  principal_portion: number;
  interest_portion: number;
  remaining_balance: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  paid_at?: string | null;
  notes?: string;
}

export interface InstallmentPlan {
  id: number;
  purchase_name: string;
  category: string;
  total_amount: number;
  down_payment: number;
  principal_financed: number;
  annual_interest_rate: number;
  tenure_months: number;
  monthly_emi: number;
  total_repayment: number;
  total_interest: number;
  start_date: string;
  due_day: number;
  status: string;
  notes?: string;
  paid_installments_count: number;
  remaining_installments_count: number;
  total_paid_amount: number;
  outstanding_balance: number;
  next_due_date?: string | null;
  is_overdue: boolean;
  payments: InstallmentPayment[];
}

export interface InstallmentPlanCreate {
  purchase_name: string;
  category: string;
  total_amount: number;
  down_payment: number;
  annual_interest_rate: number;
  tenure_months: number;
  due_day: number;
  start_date?: string;
  notes?: string;
}

export interface LiveStats {
  visits: number;
  members: number;
  online: number;
  simulations: number;
  analysed_amount: number;
  feed: Array<{ text: string; when: string }>;
  streak: {
    current: number;
    best: number;
    days_used: number;
  };
}
