import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

// ============================================================================
// Financial Engine (Deterministic Core v4)
// ============================================================================
function roundCurr(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

class FinancialEngine {
  static calculateFreeCashFlow(
    monthly_income: number,
    essential_expenses: number,
    discretionary_expenses: number,
    existing_debt_emi: number
  ): number {
    return roundCurr(
      monthly_income - (essential_expenses + discretionary_expenses + existing_debt_emi)
    );
  }

  static calculateTotalOutflows(
    essential_expenses: number,
    discretionary_expenses: number,
    existing_debt_emi: number
  ): number {
    return roundCurr(essential_expenses + discretionary_expenses + existing_debt_emi);
  }

  static calculateSavingsRate(monthly_income: number, free_cash_flow: number): number {
    if (monthly_income <= 0) return 0.0;
    return roundCurr((free_cash_flow / monthly_income) * 100.0);
  }

  static calculateDebtToIncome(monthly_income: number, total_emi: number): number {
    if (monthly_income <= 0) return total_emi <= 0 ? 0.0 : 100.0;
    return roundCurr((total_emi / monthly_income) * 100.0);
  }

  static calculateMonthsOfRunway(
    current_savings: number,
    essential_expenses: number,
    existing_debt_emi: number
  ): number {
    const core_burn = essential_expenses + existing_debt_emi;
    if (core_burn <= 0) return 99.9;
    return roundCurr(Math.max(0.0, current_savings / core_burn));
  }

  static calculateEmergencyCoverage(
    current_savings: number,
    emergency_fund_target: number
  ): number {
    if (emergency_fund_target <= 0) return 100.0;
    return roundCurr(Math.max(0.0, (current_savings / emergency_fund_target) * 100.0));
  }

  static calculateHealthScore(
    savings_rate_pct: number,
    emergency_coverage_pct: number,
    months_of_runway: number,
    debt_to_income_pct: number
  ) {
    const sr = Math.min(25, Math.max(0, Math.round((savings_rate_pct / 20.0) * 25)));
    const ef = Math.min(25, Math.max(0, Math.round((emergency_coverage_pct / 100.0) * 25)));
    const rw = Math.min(25, Math.max(0, Math.round((months_of_runway / 6.0) * 25)));

    let dti_pts = 0;
    if (debt_to_income_pct <= 20) {
      dti_pts = 25;
    } else if (debt_to_income_pct >= 50) {
      dti_pts = 0;
    } else {
      dti_pts = Math.round((25 * (50.0 - debt_to_income_pct)) / 30.0);
    }

    const total = Math.max(0, Math.min(100, sr + ef + rw + dti_pts));
    const label =
      total >= 80 ? 'Strong' : total >= 60 ? 'Good' : total >= 40 ? 'Fair' : 'Tight';

    return {
      score: total,
      label,
      breakdown: {
        savings_rate_score: sr,
        emergency_fund_score: ef,
        runway_score: rw,
        dti_score: dti_pts,
      },
    };
  }

  static calculateJobLossRunway(params: {
    current_savings: number;
    essential_expenses: number;
    existing_debt_emi: number;
    upfront_purchase_cost?: number;
    new_emi?: number;
    new_emi_months?: number;
    investment_return_pct?: number;
  }): number {
    const {
      current_savings,
      essential_expenses,
      existing_debt_emi,
      upfront_purchase_cost = 0,
      new_emi = 0,
      new_emi_months = 0,
      investment_return_pct = 0,
    } = params;

    let savings = current_savings - upfront_purchase_cost;
    if (savings <= 0) return 0.0;

    const base_burn = essential_expenses + existing_debt_emi;
    if (base_burn <= 0 && new_emi <= 0) return 99.9;

    const monthly_r = Math.max(0.0, investment_return_pct) / 100.0 / 12.0;

    for (let m = 1; m <= 120; m++) {
      const interest = savings > 0 ? savings * monthly_r : 0.0;
      const emi_this_month = m <= new_emi_months ? new_emi : 0.0;
      const burn = base_burn + emi_this_month;
      const new_savings = savings + interest - burn;
      if (new_savings <= 0) {
        const net_burn = Math.max(burn - interest, 1.0);
        const frac = Math.max(0.0, Math.min(1.0, savings / net_burn));
        return roundCurr(m - 1 + frac);
      }
      savings = new_savings;
    }
    return 99.9;
  }

  static computeProfileSummary(profile: any) {
    const fcf = this.calculateFreeCashFlow(
      profile.monthly_income,
      profile.essential_expenses,
      profile.discretionary_expenses,
      profile.existing_debt_emi
    );
    const total_outflows = this.calculateTotalOutflows(
      profile.essential_expenses,
      profile.discretionary_expenses,
      profile.existing_debt_emi
    );
    const savings_rate = this.calculateSavingsRate(profile.monthly_income, fcf);
    const dti = this.calculateDebtToIncome(profile.monthly_income, profile.existing_debt_emi);
    const runway = this.calculateMonthsOfRunway(
      profile.current_savings,
      profile.essential_expenses,
      profile.existing_debt_emi
    );
    const emergency_cov = this.calculateEmergencyCoverage(
      profile.current_savings,
      profile.emergency_fund_target
    );
    const health = this.calculateHealthScore(savings_rate, emergency_cov, runway, dti);

    return {
      free_cash_flow: fcf,
      total_monthly_outflows: total_outflows,
      savings_rate_pct: savings_rate,
      debt_to_income_pct: dti,
      months_of_runway: runway,
      emergency_coverage_pct: emergency_cov,
      is_cash_flow_positive: fcf >= 0,
      health_score: health.score,
      health_label: health.label,
      health_breakdown: health.breakdown,
    };
  }
}

// ============================================================================
// Credit Score Impact Estimator (v4)
// ============================================================================
class CreditImpactEstimator {
  static SCORE_MIN = 300;
  static SCORE_MAX = 900;
  static INQUIRY_HIT = 8;
  static MISSED_EMI_PENALTY = 80;
  static ON_TIME_BONUS_PER_MONTH = 1.0;
  static ON_TIME_BONUS_CAP = 20;

  static clamp(score: number): number {
    return Math.max(this.SCORE_MIN, Math.min(this.SCORE_MAX, Math.round(score)));
  }

  static dtiPenalty(dti_pct: number): number {
    if (dti_pct <= 20) return 0;
    if (dti_pct <= 35) return 10;
    if (dti_pct <= 50) return 25;
    return 45;
  }

  static scoreBand(score: number): string {
    if (score >= 750) return 'Excellent';
    if (score >= 700) return 'Good';
    if (score >= 650) return 'Fair';
    return 'Needs work';
  }

  static estimate(params: {
    current_score: number;
    monthly_income: number;
    existing_debt_emi: number;
    new_emi: number;
    tenure_months: number;
  }) {
    const base = this.clamp(params.current_score || 750);
    const income = Math.max(params.monthly_income, 0);
    const dti_before =
      income > 0 ? (params.existing_debt_emi / income) * 100 : params.existing_debt_emi > 0 ? 100 : 0;
    const dti_after =
      income > 0
        ? ((params.existing_debt_emi + params.new_emi) / income) * 100
        : params.existing_debt_emi + params.new_emi > 0
        ? 100
        : 0;

    if (params.new_emi <= 0 || params.tenure_months <= 0) {
      return {
        has_new_loan: false,
        current_score: base,
        score_at_purchase: base,
        score_after_loan: base,
        score_if_emi_missed: base,
        dti_before_pct: roundCurr(dti_before),
        dti_after_pct: roundCurr(dti_after),
        band_now: this.scoreBand(base),
        band_at_purchase: this.scoreBand(base),
        headline: 'Paying without a loan keeps your credit score untouched.',
      };
    }

    const extra_dti_penalty = Math.max(
      0,
      this.dtiPenalty(dti_after) - this.dtiPenalty(dti_before)
    );
    const at_purchase = this.clamp(base - this.INQUIRY_HIT - extra_dti_penalty);

    const on_time_bonus = Math.min(
      this.ON_TIME_BONUS_CAP,
      Math.round(params.tenure_months * this.ON_TIME_BONUS_PER_MONTH)
    );
    const after_loan = this.clamp(base - Math.floor(this.INQUIRY_HIT / 2) + on_time_bonus);
    const if_missed = this.clamp(at_purchase - this.MISSED_EMI_PENALTY);

    const dip = base - at_purchase;
    const gain = after_loan - base;
    let headline = '';
    if (dti_after > 40) {
      headline = `New EMI pushes debt-to-income to ${Math.round(
        dti_after
      )}% — expect a ~${dip}-pt dip until you pay it down.`;
    } else if (gain > 0) {
      headline = `Small ~${dip}-pt dip at signup, then +${gain} pts if every EMI is paid on time.`;
    } else {
      headline = `Minor ~${dip}-pt dip from the new loan check; steady on-time payments recover it.`;
    }

    return {
      has_new_loan: true,
      current_score: base,
      score_at_purchase: at_purchase,
      score_after_loan: after_loan,
      score_if_emi_missed: if_missed,
      dti_before_pct: roundCurr(dti_before),
      dti_after_pct: roundCurr(dti_after),
      band_now: this.scoreBand(base),
      band_at_purchase: this.scoreBand(at_purchase),
      headline,
    };
  }
}

// ============================================================================
// EMI Calculator (Reducing Balance + Prepayment)
// ============================================================================
class EMICalculator {
  static calculateMonthlyEmi(
    principal: number,
    annual_interest_rate: number,
    tenure_months: number
  ): number {
    if (principal <= 0 || tenure_months <= 0) return 0.0;
    if (annual_interest_rate <= 0) return roundCurr(principal / tenure_months);
    const r = annual_interest_rate / 100.0 / 12.0;
    const n = tenure_months;
    const factor = Math.pow(1.0 + r, n);
    const emi = (principal * r * factor) / (factor - 1.0);
    return roundCurr(emi);
  }

  static generateAmortizationSchedule(params: {
    purchase_price: number;
    down_payment?: number;
    annual_interest_rate?: number;
    tenure_months?: number;
    extra_monthly_payment?: number;
  }) {
    const purchase_price = params.purchase_price;
    const down_payment = Math.min(Math.max(params.down_payment ?? 0.0, 0.0), purchase_price);
    const annual_interest_rate = params.annual_interest_rate ?? 0.0;
    const tenure_months = params.tenure_months ?? 6;
    const extra_monthly_payment = params.extra_monthly_payment ?? 0.0;

    const principal = roundCurr(purchase_price - down_payment);
    if (principal <= 0) {
      return {
        purchase_price: roundCurr(purchase_price),
        down_payment: roundCurr(down_payment),
        principal_financed: 0.0,
        annual_interest_rate: roundCurr(annual_interest_rate),
        tenure_months,
        monthly_emi: 0.0,
        total_interest: 0.0,
        total_repayment: roundCurr(down_payment),
        schedule: [],
      };
    }

    const base_emi = this.calculateMonthlyEmi(principal, annual_interest_rate, tenure_months);
    const monthly_rate = annual_interest_rate > 0 ? annual_interest_rate / 100.0 / 12.0 : 0.0;

    let remaining_balance = principal;
    let cumulative_interest = 0.0;
    const schedule: any[] = [];

    for (let month = 1; month <= tenure_months; month++) {
      if (remaining_balance <= 0.005) break;

      const interest_for_month = roundCurr(remaining_balance * monthly_rate);
      let planned_payment = roundCurr(base_emi + extra_monthly_payment);

      let principal_portion = 0;
      let total_payment = 0;

      if (
        month === tenure_months ||
        remaining_balance + interest_for_month <= planned_payment
      ) {
        principal_portion = roundCurr(remaining_balance);
        total_payment = roundCurr(principal_portion + interest_for_month);
        remaining_balance = 0.0;
      } else {
        principal_portion = roundCurr(planned_payment - interest_for_month);
        if (principal_portion <= 0) principal_portion = 0.0;
        total_payment = roundCurr(principal_portion + interest_for_month);
        remaining_balance = roundCurr(remaining_balance - principal_portion);
      }

      cumulative_interest = roundCurr(cumulative_interest + interest_for_month);

      schedule.push({
        month,
        payment_amount: total_payment,
        principal_paid: principal_portion,
        interest_paid: interest_for_month,
        remaining_balance,
        cumulative_interest,
      });
    }

    const total_interest = cumulative_interest;
    const total_repayment = roundCurr(down_payment + principal + total_interest);

    return {
      purchase_price: roundCurr(purchase_price),
      down_payment: roundCurr(down_payment),
      principal_financed: principal,
      annual_interest_rate: roundCurr(annual_interest_rate),
      tenure_months: schedule.length > 0 ? schedule.length : tenure_months,
      monthly_emi: base_emi,
      total_interest,
      total_repayment,
      schedule,
    };
  }
}

// ============================================================================
// Scenario Engine (5 Parallel Futures + Opportunity Cost + Runway + Credit)
// ============================================================================
class ScenarioEngine {
  static simulateSingleScenario(params: {
    scenario_id: string;
    scenario_name: string;
    description: string;
    assumptions: string[];
    duration_months: number;
    monthly_income: number;
    current_savings: number;
    essential_expenses: number;
    discretionary_expenses: number;
    existing_debt_emi: number;
    emergency_fund_target: number;
    purchase_amount: number;
    purchase_month: number;
    purchase_mode: string;
    emi_down_payment: number;
    emi_interest_rate: number;
    emi_tenure_months: number;
    unexpected_expense_amount?: number;
    unexpected_expense_month?: number;
    salary_delay_months?: number;
    salary_delay_start_month?: number;
    expense_increase_pct?: number;
    income_growth_pct?: number;
    investment_return_pct?: number;
  }) {
    const {
      scenario_id,
      scenario_name,
      description,
      assumptions,
      duration_months,
      monthly_income,
      current_savings,
      essential_expenses,
      discretionary_expenses,
      existing_debt_emi,
      emergency_fund_target,
      purchase_amount,
      purchase_month,
      purchase_mode,
      emi_down_payment,
      emi_interest_rate,
      emi_tenure_months,
      unexpected_expense_amount = 0.0,
      unexpected_expense_month = 0,
      salary_delay_months = 0,
      salary_delay_start_month = 0,
      expense_increase_pct = 0.0,
      income_growth_pct = 0.0,
      investment_return_pct = 0.0,
    } = params;

    let emi_monthly = 0.0;
    const mode = (purchase_mode || 'CASH').toUpperCase();
    const down_payment = Math.min(Math.max(emi_down_payment, 0.0), purchase_amount);

    if (mode === 'EMI' && purchase_amount > 0) {
      const financed = Math.max(0.0, purchase_amount - down_payment);
      emi_monthly = EMICalculator.calculateMonthlyEmi(
        financed,
        emi_interest_rate,
        emi_tenure_months
      );
    }

    const timeline: any[] = [];
    let running_savings = roundCurr(current_savings);
    let deferred_salary_pool = 0.0;
    let lowest_savings = running_savings;
    let lowest_savings_month = 1;
    let negative_cash_months = 0;
    let emergency_shortfall_months = 0;
    let breaking_point_detected = false;
    let breaking_point_month: number | null = null;
    let breaking_point_reason = 'No breaking point reached within simulation window.';
    let total_income_acc = 0.0;
    let total_outflows_acc = 0.0;
    let total_interest_acc = 0.0;

    const expense_multiplier = 1.0 + expense_increase_pct / 100.0;
    const monthly_return_rate = Math.max(0.0, investment_return_pct) / 100.0 / 12.0;
    let current_monthly_income = monthly_income;

    for (let m = 1; m <= duration_months; m++) {
      const opening = running_savings;

      if (m > 1 && (m - 1) % 12 === 0 && income_growth_pct > 0) {
        current_monthly_income = roundCurr(
          current_monthly_income * (1.0 + income_growth_pct / 100.0)
        );
      }

      let income_received = current_monthly_income;
      if (salary_delay_months > 0 && salary_delay_start_month > 0) {
        const delay_end = salary_delay_start_month + salary_delay_months - 1;
        if (m >= salary_delay_start_month && m <= delay_end) {
          deferred_salary_pool = roundCurr(deferred_salary_pool + current_monthly_income);
          income_received = 0.0;
        } else if (m === delay_end + 1 && deferred_salary_pool > 0) {
          income_received = roundCurr(current_monthly_income + deferred_salary_pool);
          deferred_salary_pool = 0.0;
        }
      }

      const ess = roundCurr(essential_expenses * expense_multiplier);
      const disc = roundCurr(discretionary_expenses * expense_multiplier);
      const ex_emi = roundCurr(existing_debt_emi);

      let purchase_payment = 0.0;
      if (mode === 'CASH' && purchase_amount > 0 && m === purchase_month) {
        purchase_payment = roundCurr(purchase_amount);
      } else if (mode === 'EMI' && purchase_amount > 0) {
        if (m === purchase_month) {
          purchase_payment = roundCurr(down_payment + emi_monthly);
        } else if (
          m > purchase_month &&
          m < purchase_month + emi_tenure_months
        ) {
          purchase_payment = roundCurr(emi_monthly);
        }
      }

      const unexp =
        unexpected_expense_amount > 0 && m === unexpected_expense_month
          ? roundCurr(unexpected_expense_amount)
          : 0.0;

      const total_outflows = roundCurr(ess + disc + ex_emi + purchase_payment + unexp);
      const interest_earned =
        opening > 0 && monthly_return_rate > 0
          ? roundCurr(opening * monthly_return_rate)
          : 0.0;

      const net_flow = roundCurr(income_received + interest_earned - total_outflows);
      const closing = roundCurr(opening + net_flow);

      total_income_acc = roundCurr(total_income_acc + income_received);
      total_outflows_acc = roundCurr(total_outflows_acc + total_outflows);
      total_interest_acc = roundCurr(total_interest_acc + interest_earned);

      if (closing < lowest_savings) {
        lowest_savings = closing;
        lowest_savings_month = m;
      }

      const is_neg = closing < 0;
      const is_under_emerg = closing < emergency_fund_target;
      const emerg_shortfall = is_under_emerg
        ? roundCurr(Math.max(0.0, emergency_fund_target - closing))
        : 0.0;

      if (is_neg) negative_cash_months += 1;
      if (is_under_emerg) emergency_shortfall_months += 1;

      if (!breaking_point_detected) {
        if (is_neg) {
          breaking_point_detected = true;
          breaking_point_month = m;
          breaking_point_reason = `Month ${m}: Liquid savings exhausted (deficit of ₹${Math.abs(
            closing
          ).toLocaleString('en-IN')}).`;
        } else if (
          emergency_fund_target > 0 &&
          closing < emergency_fund_target * 0.5
        ) {
          breaking_point_detected = true;
          breaking_point_month = m;
          breaking_point_reason = `Month ${m}: Emergency buffer breached below 50% threshold (₹${closing.toLocaleString(
            'en-IN'
          )} remaining).`;
        }
      }

      timeline.push({
        month: m,
        opening_savings: opening,
        income_received,
        essential_expenses: ess,
        discretionary_expenses: disc,
        existing_emi: ex_emi,
        purchase_payment,
        unexpected_expense: unexp,
        total_outflows,
        interest_earned,
        net_cash_flow: net_flow,
        closing_savings: closing,
        emergency_shortfall: emerg_shortfall,
        is_negative_cash: is_neg,
        is_under_emergency_target: is_under_emerg,
      });

      running_savings = closing;
    }

    let score = 100.0;
    score -= negative_cash_months * 25.0;
    score -= emergency_shortfall_months * 5.0;
    if (lowest_savings < 0) {
      score -= 20.0;
    } else if (emergency_fund_target > 0 && lowest_savings < emergency_fund_target) {
      const ratio = lowest_savings / emergency_fund_target;
      score -= (1.0 - ratio) * 15.0;
    }
    const resilience_score = roundCurr(Math.max(0.0, Math.min(100.0, score)));

    let risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'CRITICAL';
    if (resilience_score >= 80 && negative_cash_months === 0) {
      risk_level = 'LOW';
    } else if (resilience_score >= 55 && negative_cash_months === 0) {
      risk_level = 'MODERATE';
    } else if (resilience_score >= 30) {
      risk_level = 'HIGH';
    }

    return {
      scenario_id,
      scenario_name,
      description,
      assumptions,
      lowest_savings,
      lowest_savings_month,
      negative_cash_months,
      emergency_shortfall_months,
      breaking_point_detected,
      breaking_point_month,
      breaking_point_reason,
      resilience_score,
      risk_level,
      final_savings: running_savings,
      total_income: total_income_acc,
      total_outflows: total_outflows_acc,
      total_interest_earned: total_interest_acc,
      timeline,
    };
  }

  static runAllParallelScenarios(params: {
    duration_months: number;
    monthly_income: number;
    current_savings: number;
    essential_expenses: number;
    discretionary_expenses: number;
    existing_debt_emi: number;
    emergency_fund_target: number;
    purchase_name: string;
    purchase_amount: number;
    purchase_month: number;
    purchase_mode: string;
    emi_down_payment: number;
    emi_interest_rate: number;
    emi_tenure_months: number;
    unexpected_expense_amount: number;
    unexpected_expense_month: number;
    salary_delay_months: number;
    salary_delay_start_month: number;
    expense_increase_pct: number;
    income_growth_pct: number;
    investment_return_pct: number;
    credit_score: number;
  }) {
    const base_kwargs = {
      duration_months: params.duration_months,
      monthly_income: params.monthly_income,
      current_savings: params.current_savings,
      essential_expenses: params.essential_expenses,
      discretionary_expenses: params.discretionary_expenses,
      existing_debt_emi: params.existing_debt_emi,
      emergency_fund_target: params.emergency_fund_target,
      purchase_amount: params.purchase_amount,
      purchase_month: params.purchase_month,
      purchase_mode: params.purchase_mode,
      emi_down_payment: params.emi_down_payment,
      emi_interest_rate: params.emi_interest_rate,
      emi_tenure_months: params.emi_tenure_months,
      income_growth_pct: params.income_growth_pct,
      investment_return_pct: params.investment_return_pct,
    };

    const p_label =
      params.purchase_amount > 0 && params.purchase_mode !== 'NONE'
        ? `${params.purchase_name} (₹${params.purchase_amount.toLocaleString('en-IN')} via ${params.purchase_mode})`
        : 'No major purchase';

    const baseline = this.simulateSingleScenario({
      ...base_kwargs,
      scenario_id: 'baseline',
      scenario_name: '1. Expected Path (Normal Life)',
      description: 'Steady income and expenses with your planned purchase.',
      assumptions: [
        `Monthly income steady at ₹${params.monthly_income.toLocaleString('en-IN')}` +
          (params.income_growth_pct > 0 ? ` (+${params.income_growth_pct}%/yr)` : ''),
        params.investment_return_pct > 0
          ? `Savings earn ${params.investment_return_pct}% p.a.`
          : 'Savings held in zero-interest cash',
        `Planned purchase: ${p_label} in Month ${params.purchase_month}`,
      ],
    });

    const baseline_no_purchase = this.simulateSingleScenario({
      ...base_kwargs,
      purchase_amount: 0.0,
      purchase_mode: 'NONE',
      scenario_id: 'no_purchase',
      scenario_name: 'No Purchase Reference',
      description: 'Internal reference without the purchase.',
      assumptions: [],
    });

    const unexpected_shock = this.simulateSingleScenario({
      ...base_kwargs,
      scenario_id: 'unexpected_expense',
      scenario_name: '2. Surprise Bill (Medical / Repair)',
      description: `An unexpected ₹${params.unexpected_expense_amount.toLocaleString(
        'en-IN'
      )} expense hits in Month ${params.unexpected_expense_month}.`,
      assumptions: [
        `Planned purchase: ${p_label} in Month ${params.purchase_month}`,
        `Sudden bill of ₹${params.unexpected_expense_amount.toLocaleString('en-IN')} in Month ${params.unexpected_expense_month}`,
      ],
      unexpected_expense_amount: params.unexpected_expense_amount,
      unexpected_expense_month: params.unexpected_expense_month,
    });

    const salary_delay = this.simulateSingleScenario({
      ...base_kwargs,
      scenario_id: 'salary_delay',
      scenario_name: '3. Late Paycheck',
      description: `Salary delayed for ${params.salary_delay_months} month(s) starting Month ${params.salary_delay_start_month}, paid as a lump sum later.`,
      assumptions: [
        `Planned purchase: ${p_label} in Month ${params.purchase_month}`,
        `Zero salary inflow during Month ${params.salary_delay_start_month}`,
        'Deferred salary credited in the following month',
      ],
      salary_delay_months: params.salary_delay_months,
      salary_delay_start_month: params.salary_delay_start_month,
    });

    const expense_surge = this.simulateSingleScenario({
      ...base_kwargs,
      scenario_id: 'expense_increase',
      scenario_name: '4. Prices Go Up (Inflation)',
      description: `Monthly living costs rise by ${params.expense_increase_pct}% across the entire period.`,
      assumptions: [
        `Planned purchase: ${p_label} in Month ${params.purchase_month}`,
        `Monthly living costs increase by +${params.expense_increase_pct}%`,
      ],
      expense_increase_pct: params.expense_increase_pct,
    });

    const combined_stress = this.simulateSingleScenario({
      ...base_kwargs,
      scenario_id: 'combined_stress',
      scenario_name: '5. Worst Case (Everything at Once)',
      description: 'Surprise bill, late paycheck, and rising prices all happen together.',
      assumptions: [
        `Planned purchase: ${p_label} in Month ${params.purchase_month}`,
        `Surprise bill of ₹${params.unexpected_expense_amount.toLocaleString('en-IN')} in Month ${params.unexpected_expense_month}`,
        `Salary delayed for ${params.salary_delay_months} month(s) in Month ${params.salary_delay_start_month}`,
        `Living costs inflated by +${params.expense_increase_pct}%`,
      ],
      unexpected_expense_amount: params.unexpected_expense_amount,
      unexpected_expense_month: params.unexpected_expense_month,
      salary_delay_months: params.salary_delay_months,
      salary_delay_start_month: params.salary_delay_start_month,
      expense_increase_pct: params.expense_increase_pct,
    });

    const scenarios: Record<string, any> = {
      baseline,
      unexpected_expense: unexpected_shock,
      salary_delay,
      expense_increase: expense_surge,
      combined_stress,
    };

    const all_List = Object.values(scenarios);
    const worst_scenario = all_List.reduce((prev, curr) =>
      curr.lowest_savings < prev.lowest_savings ? curr : prev
    );
    const safest_scenario = all_List.reduce((prev, curr) =>
      curr.resilience_score > prev.resilience_score ? curr : prev
    );

    const true_cost = roundCurr(baseline_no_purchase.final_savings - baseline.final_savings);
    const cash_paid_in_window = roundCurr(
      baseline.timeline.reduce((acc: number, m: any) => acc + m.purchase_payment, 0)
    );
    const opportunity_cost = roundCurr(Math.max(0.0, true_cost - cash_paid_in_window));

    const mode_upper = (params.purchase_mode || 'CASH').toUpperCase();
    const down_clamped = Math.min(
      Math.max(params.emi_down_payment, 0.0),
      params.purchase_amount
    );
    let new_emi_for_runway = 0.0;
    let upfront_for_runway = 0.0;
    let emi_months_for_runway = 0;

    if (params.purchase_amount > 0 && mode_upper === 'CASH') {
      upfront_for_runway = params.purchase_amount;
    } else if (params.purchase_amount > 0 && mode_upper === 'EMI') {
      upfront_for_runway = down_clamped;
      const financed = Math.max(0.0, params.purchase_amount - down_clamped);
      new_emi_for_runway = EMICalculator.calculateMonthlyEmi(
        financed,
        params.emi_interest_rate,
        params.emi_tenure_months
      );
      emi_months_for_runway = params.emi_tenure_months;
    }

    const runway_before = FinancialEngine.calculateJobLossRunway({
      current_savings: params.current_savings,
      essential_expenses: params.essential_expenses,
      existing_debt_emi: params.existing_debt_emi,
      investment_return_pct: params.investment_return_pct,
    });
    const runway_after = FinancialEngine.calculateJobLossRunway({
      current_savings: params.current_savings,
      essential_expenses: params.essential_expenses,
      existing_debt_emi: params.existing_debt_emi,
      upfront_purchase_cost: upfront_for_runway,
      new_emi: new_emi_for_runway,
      new_emi_months: emi_months_for_runway,
      investment_return_pct: params.investment_return_pct,
    });

    const credit_impact = CreditImpactEstimator.estimate({
      current_score: params.credit_score,
      monthly_income: params.monthly_income,
      existing_debt_emi: params.existing_debt_emi,
      new_emi: new_emi_for_runway,
      tenure_months: emi_months_for_runway,
    });

    let recommendation = '';
    if (baseline.negative_cash_months > 0) {
      recommendation =
        'CRITICAL ALERT: Even on the normal path, this purchase pushes your savings below ₹0. Wait, pick a cheaper option, or save up first.';
    } else if (combined_stress.negative_cash_months > 0) {
      recommendation = `CAUTION: Normal life looks fine, but if a couple of bad things happen at once you run out of cash in Month ${combined_stress.breaking_point_month}. Consider EMI with a smaller upfront hit or top up your safety net first.`;
    } else if (baseline.emergency_shortfall_months > 0) {
      recommendation = `MODERATE RISK: You never run out of money, but your savings dip below your ₹${params.emergency_fund_target.toLocaleString(
        'en-IN'
      )} safety net for ${baseline.emergency_shortfall_months} month(s).`;
    } else {
      recommendation =
        'SAFE TO PROCEED: Across all 5 futures—including the worst case—your savings stay positive and above your safety net.';
    }

    const comparison_summary = {
      lowest_overall_savings: worst_scenario.lowest_savings,
      has_cash_deficit_risk: all_List.some((s) => s.negative_cash_months > 0),
      safest_scenario: safest_scenario.scenario_name,
      most_vulnerable_scenario: worst_scenario.scenario_name,
      horizon_months: params.duration_months,
      cash_paid_in_horizon: cash_paid_in_window,
      true_cost_of_purchase: true_cost,
      opportunity_cost,
      interest_earned_baseline: baseline.total_interest_earned,
      job_loss_runway_before_months: runway_before,
      job_loss_runway_after_months: runway_after,
      credit_impact,
      dti_after_purchase_pct: credit_impact.dti_after_pct,
    };

    return {
      scenarios,
      comparison_summary,
      recommendation,
    };
  }
}

// ============================================================================
// Affordability Service (4-Way Purchase Matrix)
// ============================================================================
class AffordabilityService {
  static evaluatePurchaseOptions(params: {
    monthly_income: number;
    current_savings: number;
    essential_expenses: number;
    discretionary_expenses: number;
    existing_debt_emi: number;
    emergency_fund_target: number;
    purchase_name: string;
    purchase_amount: number;
    cheaper_alternative_name: string;
    cheaper_alternative_amount: number;
    wait_months: number;
    emi_down_payment: number;
    emi_interest_rate: number;
    emi_tenure_months: number;
  }) {
    const fcf = FinancialEngine.calculateFreeCashFlow(
      params.monthly_income,
      params.essential_expenses,
      params.discretionary_expenses,
      params.existing_debt_emi
    );

    const rem_cash_now = roundCurr(params.current_savings - params.purchase_amount);
    const cov_cash_now = FinancialEngine.calculateEmergencyCoverage(
      rem_cash_now,
      params.emergency_fund_target
    );
    const safe_cash_now = rem_cash_now >= params.emergency_fund_target && fcf >= 0;
    const risk_cash_now: 'SAFE' | 'CAUTION' | 'HIGH_RISK' =
      rem_cash_now < 0 ? 'HIGH_RISK' : !safe_cash_now ? 'CAUTION' : 'SAFE';

    const opt_buy_now = {
      option_id: 'buy_now_cash',
      option_title: `Buy ${params.purchase_name} Now (100% Cash)`,
      upfront_cash_required: roundCurr(params.purchase_amount),
      monthly_obligation: 0.0,
      total_cost: roundCurr(params.purchase_amount),
      remaining_savings_immediately: rem_cash_now,
      emergency_buffer_preserved_pct: cov_cash_now,
      safe_to_proceed: safe_cash_now,
      risk_rating: risk_cash_now,
      pros: [
        'Zero interest cost or finance charges',
        'No monthly EMI commitment reducing future cash flow',
        'Immediate ownership without debt overhang',
      ],
      cons: [
        `Immediate liquidity drop of ₹${params.purchase_amount.toLocaleString('en-IN')}`,
        rem_cash_now < params.emergency_fund_target
          ? `Leaves emergency reserve at ${cov_cash_now}% of target`
          : 'Reduces investable surplus immediately',
      ],
      key_tradeoff:
        'Saves 100% on interest charges at the cost of an immediate drop in liquid emergency reserves.',
    };

    const down = Math.min(Math.max(params.emi_down_payment, 0.0), params.purchase_amount);
    const emi_sched = EMICalculator.generateAmortizationSchedule({
      purchase_price: params.purchase_amount,
      down_payment: down,
      annual_interest_rate: params.emi_interest_rate,
      tenure_months: params.emi_tenure_months,
    });
    const monthly_emi = emi_sched.monthly_emi;
    const total_emi_cost = emi_sched.total_repayment;
    const interest_cost = emi_sched.total_interest;
    const rem_emi_now = roundCurr(params.current_savings - down);
    const cov_emi_now = FinancialEngine.calculateEmergencyCoverage(
      rem_emi_now,
      params.emergency_fund_target
    );
    const post_emi_fcf = roundCurr(fcf - monthly_emi);
    const new_dti = FinancialEngine.calculateDebtToIncome(
      params.monthly_income,
      params.existing_debt_emi + monthly_emi
    );

    const safe_emi =
      rem_emi_now >= params.emergency_fund_target * 0.85 &&
      post_emi_fcf >= params.monthly_income * 0.08 &&
      new_dti <= 40.0;
    const risk_emi: 'SAFE' | 'CAUTION' | 'HIGH_RISK' =
      post_emi_fcf < 0 || rem_emi_now < 0 ? 'HIGH_RISK' : !safe_emi ? 'CAUTION' : 'SAFE';

    const opt_emi = {
      option_id: 'buy_on_emi',
      option_title: `Finance via ${params.emi_tenure_months}-Month EMI (${params.emi_interest_rate}% APR)`,
      upfront_cash_required: roundCurr(down),
      monthly_obligation: monthly_emi,
      total_cost: total_emi_cost,
      remaining_savings_immediately: rem_emi_now,
      emergency_buffer_preserved_pct: cov_emi_now,
      safe_to_proceed: safe_emi,
      risk_rating: risk_emi,
      pros: [
        `Preserves ₹${roundCurr(params.purchase_amount - down).toLocaleString('en-IN')} in immediate liquid cash`,
        `Emergency buffer stays at ${cov_emi_now}% on Day 1`,
        `Spreads cash impact into ₹${monthly_emi.toLocaleString('en-IN')}/mo installments`,
      ],
      cons: [
        `Adds ₹${interest_cost.toLocaleString('en-IN')} in interest charges over ${params.emi_tenure_months} months`,
        `Reduces monthly free cash flow to ₹${post_emi_fcf.toLocaleString('en-IN')}/mo`,
        `Increases Debt-to-Income ratio to ${new_dti}%`,
      ],
      key_tradeoff: `Protects today's emergency fund by paying ₹${interest_cost.toLocaleString(
        'en-IN'
      )} extra in interest over ${params.emi_tenure_months} months.`,
    };

    const monthly_saving_needed =
      params.wait_months > 0
        ? roundCurr(params.purchase_amount / params.wait_months)
        : params.purchase_amount;
    const accumulated_during_wait = roundCurr(Math.max(0.0, fcf) * params.wait_months);
    const projected_savings_at_buy = roundCurr(
      params.current_savings + accumulated_during_wait - params.purchase_amount
    );
    const cov_wait = FinancialEngine.calculateEmergencyCoverage(
      projected_savings_at_buy,
      params.emergency_fund_target
    );
    const safe_wait = projected_savings_at_buy >= params.emergency_fund_target && fcf > 0;
    const risk_wait: 'SAFE' | 'CAUTION' | 'HIGH_RISK' =
      projected_savings_at_buy < 0 ? 'HIGH_RISK' : !safe_wait ? 'CAUTION' : 'SAFE';

    const opt_wait = {
      option_id: 'wait_and_save',
      option_title: `Wait ${params.wait_months} Months & Buy with Saved Surplus`,
      upfront_cash_required: 0.0,
      monthly_obligation: monthly_saving_needed,
      total_cost: roundCurr(params.purchase_amount),
      remaining_savings_immediately: roundCurr(params.current_savings),
      emergency_buffer_preserved_pct: cov_wait,
      safe_to_proceed: safe_wait,
      risk_rating: risk_wait,
      pros: [
        'Zero interest cost and zero debt obligation',
        `Accumulates ₹${accumulated_during_wait.toLocaleString('en-IN')} in fresh cash before purchase`,
        `Projected post-purchase reserve reaches ₹${projected_savings_at_buy.toLocaleString(
          'en-IN'
        )} (${cov_wait}% of target)`,
      ],
      cons: [
        `Delays acquisition by ${params.wait_months} months`,
        `Requires discipline to set aside ₹${monthly_saving_needed.toLocaleString('en-IN')}/mo`,
      ],
      key_tradeoff: `Trades ${params.wait_months} months of waiting for complete financial safety and ₹0 interest.`,
    };

    const alt_savings = roundCurr(params.purchase_amount - params.cheaper_alternative_amount);
    const rem_alt = roundCurr(params.current_savings - params.cheaper_alternative_amount);
    const cov_alt = FinancialEngine.calculateEmergencyCoverage(
      rem_alt,
      params.emergency_fund_target
    );
    const safe_alt = rem_alt >= params.emergency_fund_target && fcf >= 0;
    const risk_alt: 'SAFE' | 'CAUTION' | 'HIGH_RISK' =
      rem_alt < 0 ? 'HIGH_RISK' : !safe_alt ? 'CAUTION' : 'SAFE';

    const opt_cheaper = {
      option_id: 'cheaper_alternative',
      option_title: `Buy ${params.cheaper_alternative_name} Instead (Cash)`,
      upfront_cash_required: roundCurr(params.cheaper_alternative_amount),
      monthly_obligation: 0.0,
      total_cost: roundCurr(params.cheaper_alternative_amount),
      remaining_savings_immediately: rem_alt,
      emergency_buffer_preserved_pct: cov_alt,
      safe_to_proceed: safe_alt,
      risk_rating: risk_alt,
      pros: [
        `Saves ₹${alt_savings.toLocaleString('en-IN')} immediately compared to ${params.purchase_name}`,
        'Zero EMI or interest burden',
        `Preserves ${cov_alt}% of emergency fund target immediately`,
      ],
      cons: [
        'May involve compromise on specs, brand, or longevity',
        `Still requires ₹${params.cheaper_alternative_amount.toLocaleString('en-IN')} upfront cash`,
      ],
      key_tradeoff: `Captures immediate utility while keeping ₹${alt_savings.toLocaleString(
        'en-IN'
      )} extra in your emergency buffer.`,
    };

    const options = [opt_buy_now, opt_emi, opt_wait, opt_cheaper];

    let recommended_id = 'wait_and_save';
    let verdict = '';

    if (opt_buy_now.safe_to_proceed) {
      recommended_id = 'buy_now_cash';
      verdict =
        `You can comfortably afford ${params.purchase_name} in cash right now. ` +
        `Even after paying ₹${params.purchase_amount.toLocaleString('en-IN')} upfront, your remaining savings ` +
        `of ₹${rem_cash_now.toLocaleString('en-IN')} stay above your ₹${params.emergency_fund_target.toLocaleString(
          'en-IN'
        )} emergency target, saving you ₹${interest_cost.toLocaleString('en-IN')} in EMI interest.`;
    } else if (opt_cheaper.safe_to_proceed) {
      recommended_id = 'cheaper_alternative';
      verdict =
        `Buying the full-priced ${params.purchase_name} in cash dips into your emergency fund (` +
        `leaving ₹${rem_cash_now.toLocaleString('en-IN')}). Choosing the ${params.cheaper_alternative_name} ` +
        `at ₹${params.cheaper_alternative_amount.toLocaleString('en-IN')} keeps your safety buffer intact at ${cov_alt}% with zero debt.`;
    } else if (opt_emi.safe_to_proceed && params.emi_interest_rate <= 12.0) {
      recommended_id = 'buy_on_emi';
      verdict =
        `Paying full cash upfront breaches your emergency buffer, but your monthly free cash flow ` +
        `of ₹${fcf.toLocaleString('en-IN')} easily supports a ₹${monthly_emi.toLocaleString(
          'en-IN'
        )}/mo EMI while preserving ${cov_emi_now}% of your liquid safety net.`;
    } else {
      recommended_id = 'wait_and_save';
      verdict =
        `Waiting ${params.wait_months} months is the safest path. Your current monthly surplus of ₹${fcf.toLocaleString(
          'en-IN'
        )} will build ₹${accumulated_during_wait.toLocaleString(
          'en-IN'
        )} in fresh cash, letting you buy without touching your emergency reserve or paying ₹${interest_cost.toLocaleString(
          'en-IN'
        )} in interest.`;
    }

    return {
      purchase_name: params.purchase_name,
      purchase_amount: roundCurr(params.purchase_amount),
      baseline_free_cash_flow: fcf,
      emergency_fund_target: roundCurr(params.emergency_fund_target),
      current_savings: roundCurr(params.current_savings),
      options,
      recommended_option_id: recommended_id,
      verdict_explanation: verdict,
    };
  }
}

// ============================================================================
// Reminder Service (RFC 5545 iCalendar Generator)
// ============================================================================
class ReminderService {
  static escapeIcsText(text: string): string {
    return (text || '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  static generateIcsForPlan(plan: any, payments: any[]): string {
    const now_utc =
      new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Financial Parallelverse//Installment Reminder Engine//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:EMI Reminders - ${this.escapeIcsText(plan.purchase_name)}`,
      'X-WR-TIMEZONE:UTC',
    ];

    for (const payment of payments) {
      if (payment.status === 'PAID') continue;
      const dueStr = payment.due_date;
      const dtstart = dueStr.replace(/-/g, '');
      const d = new Date(dueStr + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + 1);
      const dtend = d.toISOString().slice(0, 10).replace(/-/g, '');

      const uid = `parallelverse-plan-${plan.id}-inst-${payment.installment_number}@parallelverse.local`;
      const summary = `EMI Due: ${plan.purchase_name} (#${payment.installment_number}/${plan.tenure_months}) - ₹${payment.emi_amount.toLocaleString(
        'en-IN'
      )}`;
      const description =
        `Installment #${payment.installment_number} of ${plan.tenure_months} for ${plan.purchase_name}.\\n` +
        `Amount Due: ₹${payment.emi_amount.toLocaleString('en-IN')}\\n` +
        `Principal Portion: ₹${payment.principal_portion.toLocaleString('en-IN')}\\n` +
        `Interest Portion: ₹${payment.interest_portion.toLocaleString('en-IN')}\\n` +
        `Remaining Balance After Payment: ₹${payment.remaining_balance.toLocaleString('en-IN')}`;

      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${now_utc}`,
        `DTSTART;VALUE=DATE:${dtstart}`,
        `DTEND;VALUE=DATE:${dtend}`,
        `SUMMARY:${this.escapeIcsText(summary)}`,
        `DESCRIPTION:${description}`,
        'STATUS:CONFIRMED',
        'TRANSP:TRANSPARENT',
        'BEGIN:VALARM',
        'TRIGGER:-P3D',
        'ACTION:DISPLAY',
        `DESCRIPTION:Upcoming EMI in 3 days: ${this.escapeIcsText(summary)}`,
        'END:VALARM',
        'BEGIN:VALARM',
        'TRIGGER:-PT9H',
        'ACTION:DISPLAY',
        `DESCRIPTION:EMI Due Today: ${this.escapeIcsText(summary)}`,
        'END:VALARM',
        'END:VEVENT'
      );
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }
}

// ============================================================================
// Persistent JSON Store (Users, Sessions, Profiles, Installments, Activity)
// ============================================================================
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'parallelverse_v4_db.json');

interface StoredUser {
  id: number;
  name: string;
  email: string | null;
  password_hash: string | null;
  is_guest: boolean;
  created_at: string;
}

interface StoredSession {
  token: string;
  user_id: number;
  expires_at: string;
}

interface StoredActivity {
  visits: number;
  simulations: number;
  analysed_amount: number;
  presence: Record<string, number>;
  events: Array<{ text: string; ts: number }>;
  streaks: Record<string, { current: number; best: number; last_day: string; days_used: number }>;
}

interface StoreData {
  users: StoredUser[];
  sessions: StoredSession[];
  profiles: Record<number, any>;
  installment_plans: any[];
  nextPlanId: number;
  nextPaymentId: number;
  nextUserId: number;
  activity: StoredActivity;
}

function hashPassword(password: string, salt?: string): string {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const dk = crypto.pbkdf2Sync(password, s, 100000, 32, 'sha256').toString('hex');
  return `${s}$${dk}`;
}

function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored || !stored.includes('$')) return false;
  const [salt] = stored.split('$', 2);
  return hashPassword(password, salt) === stored;
}

function addMonths(dateStr: string, months: number, dueDay: number): string {
  const [y, m] = dateStr.split('-').map(Number);
  const totalMonths = m - 1 + months;
  const targetYear = y + Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const maxDay = new Date(targetYear, targetMonth, 0).getDate();
  const day = Math.min(Math.max(dueDay, 1), maxDay);
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function createDefaultProfile(userId: number, fullName: string, isDemoComplete = true) {
  return {
    id: userId,
    user_id: userId,
    full_name: fullName,
    monthly_income: isDemoComplete ? 95000.0 : 85000.0,
    current_savings: isDemoComplete ? 240000.0 : 180000.0,
    essential_expenses: isDemoComplete ? 38000.0 : 35000.0,
    discretionary_expenses: isDemoComplete ? 16000.0 : 15000.0,
    existing_debt_emi: isDemoComplete ? 8500.0 : 8000.0,
    emergency_fund_target: isDemoComplete ? 180000.0 : 150000.0,
    income_growth_pct: 8.0,
    investment_return_pct: 7.0,
    credit_score: 760,
    planned_purchase_name: 'MacBook Pro M3 / Commuter EV',
    planned_purchase_amount: 72000.0,
    planned_purchase_month: 2,
    onboarded: 1,
    updated_at: new Date().toISOString(),
  };
}

function loadStore(): StoreData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DB_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    } catch (e) {
      console.error('Failed to parse DB file, initializing fresh seed:', e);
    }
  }

  // Create pre-seeded demo account (User #1)
  const demoUser: StoredUser = {
    id: 1,
    name: 'Aarav Sharma',
    email: 'aarav@parallelverse.demo',
    password_hash: hashPassword('demo1234'),
    is_guest: false,
    created_at: new Date().toISOString(),
  };

  const today = new Date();
  const startDate = addMonths(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`,
    -2,
    5
  );
  const sched = EMICalculator.generateAmortizationSchedule({
    purchase_price: 54000,
    down_payment: 9000,
    annual_interest_rate: 12.0,
    tenure_months: 6,
  });

  let nextPaymentId = 1;
  const payments = sched.schedule.map((item, idx) => {
    const due = addMonths(startDate, idx, 5);
    const isPaid = idx < 2;
    return {
      id: nextPaymentId++,
      installment_number: item.month,
      due_date: due,
      emi_amount: item.payment_amount,
      principal_portion: item.principal_paid,
      interest_portion: item.interest_paid,
      remaining_balance: item.remaining_balance,
      status: isPaid ? 'PAID' : 'PENDING',
      paid_at: isPaid ? new Date().toISOString() : null,
      notes: isPaid ? 'Auto-debited via NACH mandate' : '',
    };
  });

  const nowTs = Date.now() / 1000;
  const todayIso = today.toISOString().slice(0, 10);

  const initial: StoreData = {
    users: [demoUser],
    sessions: [],
    profiles: {
      1: createDefaultProfile(1, 'Aarav Sharma', true),
    },
    installment_plans: [
      {
        id: 1,
        user_id: 1,
        purchase_name: 'Sony Bravia 55" 4K OLED TV',
        category: 'Electronics',
        total_amount: 54000,
        down_payment: 9000,
        principal_financed: sched.principal_financed,
        annual_interest_rate: 12.0,
        tenure_months: sched.tenure_months,
        monthly_emi: sched.monthly_emi,
        total_repayment: sched.total_repayment,
        total_interest: sched.total_interest,
        start_date: startDate,
        due_day: 5,
        status: 'ACTIVE',
        notes: 'No-cost EMI festival offer adjusted with processing fee',
        payments,
      },
    ],
    nextPlanId: 2,
    nextPaymentId,
    nextUserId: 2,
    activity: {
      visits: 148,
      simulations: 312,
      analysed_amount: 18450000,
      presence: { 'seed-peer-1': nowTs, 'seed-peer-2': nowTs - 20 },
      events: [
        { text: '🛍️ Someone checked if they can afford a ₹72,000 purchase', ts: nowTs - 45 },
        { text: '🔮 Someone stress-tested their savings across 5 futures', ts: nowTs - 140 },
        { text: '✅ Someone marked an EMI installment as paid', ts: nowTs - 320 },
        { text: '🎉 A new member joined Parallelverse', ts: nowTs - 680 },
      ],
      streaks: {
        'user:1': { current: 5, best: 9, last_day: todayIso, days_used: 14 },
      },
    },
  };

  fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  return initial;
}

let store = loadStore();

function saveStore() {
  fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

function logEvent(text: string) {
  store.activity.events.push({ text, ts: Date.now() / 1000 });
  if (store.activity.events.length > 30) {
    store.activity.events = store.activity.events.slice(-30);
  }
}

function agoLabel(ts: number): string {
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (diff < 15) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function touchStreak(key: string) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);

  let s = store.activity.streaks[key];
  if (!s) {
    s = { current: 1, best: 1, last_day: today, days_used: 1 };
    store.activity.streaks[key] = s;
  } else if (s.last_day !== today) {
    const newCurrent = s.last_day === yesterday ? s.current + 1 : 1;
    s.current = newCurrent;
    s.best = Math.max(s.best, newCurrent);
    s.last_day = today;
    s.days_used += 1;
  }
  return { current: s.current, best: s.best, days_used: s.days_used };
}

function getAuthenticatedUser(req: express.Request): StoredUser {
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    const sess = store.sessions.find((s) => s.token === token);
    if (sess && new Date(sess.expires_at) > new Date()) {
      const u = store.users.find((user) => user.id === sess.user_id);
      if (u) return u;
    }
  }
  // Fallback to default Demo User #1 so unauthenticated visitors see immediate live data
  return store.users[0];
}

function issueSession(userId: number): string {
  const token = crypto.randomBytes(24).toString('base64url');
  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  store.sessions.push({ token, user_id: userId, expires_at: expires });
  saveStore();
  return token;
}

function serializePlan(plan: any) {
  const today = new Date().toISOString().slice(0, 10);
  let paid_count = 0;
  let remaining_count = 0;
  let total_paid = 0.0;
  let next_due: string | null = null;
  let is_overdue = false;

  const payments = [...plan.payments].sort(
    (a, b) => a.installment_number - b.installment_number
  );

  for (const p of payments) {
    if (p.status === 'PAID') {
      paid_count += 1;
      total_paid = roundCurr(total_paid + p.emi_amount);
    } else {
      remaining_count += 1;
      if (p.due_date < today) {
        is_overdue = true;
      }
      if (next_due === null || p.due_date < next_due) {
        next_due = p.due_date;
      }
    }
  }

  const outstanding = roundCurr(Math.max(0.0, plan.total_repayment - plan.down_payment - total_paid));
  const status = remaining_count === 0 ? 'COMPLETED' : plan.status;

  return {
    ...plan,
    status,
    paid_installments_count: paid_count,
    remaining_installments_count: remaining_count,
    total_paid_amount: total_paid,
    outstanding_balance: outstanding,
    next_due_date: next_due,
    is_overdue,
    payments,
  };
}

// ============================================================================
// Express Server Setup
// ============================================================================
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Sid');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json());

  // Health Check
  app.get(['/health', '/api/health'], (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'Financial Parallelverse',
      version: '4.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    });
  });

  // --------------------------------------------------------------------------
  // Auth & Account Endpoints (v4)
  // --------------------------------------------------------------------------
  app.get('/api/auth/me', (req, res) => {
    const user = getAuthenticatedUser(req);
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        is_guest: user.is_guest,
      },
    });
  });

  app.post('/api/auth/register', (req, res) => {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!name) {
      res.status(400).json({ detail: 'Please enter your name.' });
      return;
    }
    if (!email || !email.includes('@') || !email.includes('.')) {
      res.status(400).json({ detail: 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ detail: 'Password must be at least 6 characters.' });
      return;
    }
    if (store.users.some((u) => u.email === email)) {
      res.status(400).json({ detail: 'An account with this email already exists. Try signing in.' });
      return;
    }

    const newUser: StoredUser = {
      id: store.nextUserId++,
      name,
      email,
      password_hash: hashPassword(password),
      is_guest: false,
      created_at: new Date().toISOString(),
    };
    store.users.push(newUser);
    store.profiles[newUser.id] = createDefaultProfile(newUser.id, name, false);
    logEvent('🎉 A new member joined Parallelverse');
    const token = issueSession(newUser.id);

    res.json({
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        is_guest: newUser.is_guest,
      },
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    const user = store.users.find((u) => u.email === email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ detail: 'Incorrect email or password.' });
      return;
    }

    const token = issueSession(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        is_guest: user.is_guest,
      },
    });
  });

  app.post('/api/auth/guest', (_req, res) => {
    const newUser: StoredUser = {
      id: store.nextUserId++,
      name: 'Guest Explorer',
      email: null,
      password_hash: null,
      is_guest: true,
      created_at: new Date().toISOString(),
    };
    store.users.push(newUser);
    store.profiles[newUser.id] = createDefaultProfile(newUser.id, 'Guest Explorer', true);
    logEvent('👋 Someone started exploring in guest mode');
    const token = issueSession(newUser.id);

    res.json({
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        is_guest: newUser.is_guest,
      },
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const auth = req.headers.authorization || '';
    if (auth.toLowerCase().startsWith('bearer ')) {
      const token = auth.slice(7).trim();
      store.sessions = store.sessions.filter((s) => s.token !== token);
      saveStore();
    }
    res.json({ status: 'ok' });
  });

  app.post('/api/auth/change-password', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (user.is_guest) {
      res.status(400).json({ detail: 'Guest accounts do not have a password.' });
      return;
    }
    const current_password = String(req.body?.current_password || '');
    const new_password = String(req.body?.new_password || '');
    if (!verifyPassword(current_password, user.password_hash)) {
      res.status(400).json({ detail: 'Current password is incorrect.' });
      return;
    }
    if (new_password.length < 6) {
      res.status(400).json({ detail: 'New password must be at least 6 characters.' });
      return;
    }
    user.password_hash = hashPassword(new_password);
    saveStore();
    res.json({ status: 'ok' });
  });

  app.delete('/api/auth/account', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (user.id === 1) {
      // Reset Demo User #1 instead of deleting so demo never breaks
      store.profiles[1] = createDefaultProfile(1, 'Aarav Sharma', true);
      saveStore();
      res.json({ status: 'reset' });
      return;
    }
    store.users = store.users.filter((u) => u.id !== user.id);
    store.sessions = store.sessions.filter((s) => s.user_id !== user.id);
    delete store.profiles[user.id];
    store.installment_plans = store.installment_plans.filter((p) => p.user_id !== user.id);
    saveStore();
    res.json({ status: 'deleted' });
  });

  // --------------------------------------------------------------------------
  // Live Activity & Streaks Endpoint (v4)
  // --------------------------------------------------------------------------
  app.get('/api/activity/live', (req, res) => {
    const user = getAuthenticatedUser(req);
    const sid = String(req.headers['x-client-sid'] || `user-${user.id}`);
    const nowTs = Date.now() / 1000;

    if (!store.activity.presence[sid]) {
      store.activity.visits += 1;
    }
    store.activity.presence[sid] = nowTs;

    // Prune stale sessions (> 5 mins)
    const cutoff = nowTs - 300;
    for (const k of Object.keys(store.activity.presence)) {
      if (store.activity.presence[k] < cutoff) {
        delete store.activity.presence[k];
      }
    }

    const streak = touchStreak(`user:${user.id}`);
    saveStore();

    const feed = [...store.activity.events]
      .slice(-6)
      .reverse()
      .map((e) => ({ text: e.text, when: agoLabel(e.ts) }));

    res.json({
      visits: store.activity.visits,
      members: store.users.length,
      online: Math.max(1, Object.keys(store.activity.presence).length),
      simulations: store.activity.simulations,
      analysed_amount: store.activity.analysed_amount,
      feed,
      streak,
    });
  });

  // --------------------------------------------------------------------------
  // Financial Profile Endpoints
  // --------------------------------------------------------------------------
  app.get('/api/profile', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!store.profiles[user.id]) {
      store.profiles[user.id] = createDefaultProfile(user.id, user.name, false);
      saveStore();
    }
    const prof = store.profiles[user.id];
    const summary = FinancialEngine.computeProfileSummary(prof);
    res.json({ ...prof, ...summary });
  });

  app.put('/api/profile', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!store.profiles[user.id]) {
      store.profiles[user.id] = createDefaultProfile(user.id, user.name, false);
    }
    const updates = req.body || {};
    store.profiles[user.id] = {
      ...store.profiles[user.id],
      ...updates,
      id: user.id,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };
    if (updates.full_name && typeof updates.full_name === 'string') {
      user.name = updates.full_name;
    }
    saveStore();
    const prof = store.profiles[user.id];
    const summary = FinancialEngine.computeProfileSummary(prof);
    res.json({ ...prof, ...summary });
  });

  // --------------------------------------------------------------------------
  // Scenarios Simulation Endpoint (v4)
  // --------------------------------------------------------------------------
  app.post('/api/scenarios/simulate', (req, res) => {
    const user = getAuthenticatedUser(req);
    const p = store.profiles[user.id] || store.profiles[1];
    const b = req.body || {};

    const purchase_amount =
      b.purchase_amount ??
      (p.planned_purchase_amount !== undefined ? p.planned_purchase_amount : 72000);

    const result = ScenarioEngine.runAllParallelScenarios({
      duration_months: b.duration_months ?? 12,
      monthly_income: b.monthly_income ?? p.monthly_income,
      current_savings: b.current_savings ?? p.current_savings,
      essential_expenses: b.essential_expenses ?? p.essential_expenses,
      discretionary_expenses: b.discretionary_expenses ?? p.discretionary_expenses,
      existing_debt_emi: b.existing_debt_emi ?? p.existing_debt_emi,
      emergency_fund_target: b.emergency_fund_target ?? p.emergency_fund_target,
      purchase_name: b.purchase_name || p.planned_purchase_name,
      purchase_amount,
      purchase_month: b.purchase_month ?? p.planned_purchase_month,
      purchase_mode: b.purchase_mode || 'CASH',
      emi_down_payment: b.emi_down_payment ?? 0.0,
      emi_interest_rate: b.emi_interest_rate ?? 14.0,
      emi_tenure_months: b.emi_tenure_months ?? 6,
      unexpected_expense_amount: b.unexpected_expense_amount ?? 25000.0,
      unexpected_expense_month: b.unexpected_expense_month ?? 4,
      salary_delay_months: b.salary_delay_months ?? 1,
      salary_delay_start_month: b.salary_delay_start_month ?? 3,
      expense_increase_pct: b.expense_increase_pct ?? 15.0,
      income_growth_pct: b.income_growth_pct ?? p.income_growth_pct ?? 0.0,
      investment_return_pct: b.investment_return_pct ?? p.investment_return_pct ?? 0.0,
      credit_score: b.credit_score ?? p.credit_score ?? 750,
    });

    store.activity.simulations += 1;
    if (purchase_amount > 0) {
      store.activity.analysed_amount += Math.round(purchase_amount);
    }
    saveStore();

    res.json(result);
  });

  // --------------------------------------------------------------------------
  // Purchase Affordability Matrix Endpoint
  // --------------------------------------------------------------------------
  app.post('/api/purchases/evaluate', (req, res) => {
    const user = getAuthenticatedUser(req);
    const p = store.profiles[user.id] || store.profiles[1];
    const b = req.body || {};
    const p_name = b.purchase_name || p.planned_purchase_name;
    const p_amount =
      b.purchase_amount !== undefined && b.purchase_amount > 0
        ? b.purchase_amount
        : p.planned_purchase_amount;
    const alt_amount =
      b.cheaper_alternative_amount !== undefined && b.cheaper_alternative_amount > 0
        ? b.cheaper_alternative_amount
        : roundCurr(p_amount * 0.6);

    const result = AffordabilityService.evaluatePurchaseOptions({
      monthly_income: p.monthly_income,
      current_savings: p.current_savings,
      essential_expenses: p.essential_expenses,
      discretionary_expenses: p.discretionary_expenses,
      existing_debt_emi: p.existing_debt_emi,
      emergency_fund_target: p.emergency_fund_target,
      purchase_name: p_name,
      purchase_amount: p_amount,
      cheaper_alternative_name: b.cheaper_alternative_name || 'Smart Value Alternative',
      cheaper_alternative_amount: alt_amount,
      wait_months: b.wait_months ?? 4,
      emi_down_payment: b.emi_down_payment ?? 0.0,
      emi_interest_rate: b.emi_interest_rate ?? 14.0,
      emi_tenure_months: b.emi_tenure_months ?? 6,
    });

    store.activity.simulations += 1;
    store.activity.analysed_amount += Math.round(p_amount);
    logEvent(
      `🛍️ Someone checked if they can afford a ₹${Math.round(p_amount).toLocaleString('en-IN')} purchase`
    );
    saveStore();

    res.json(result);
  });

  // --------------------------------------------------------------------------
  // EMI Calculator Endpoint
  // --------------------------------------------------------------------------
  app.post('/api/emi/calculate', (req, res) => {
    const b = req.body || {};
    const result = EMICalculator.generateAmortizationSchedule({
      purchase_price: b.purchase_price ?? 60000,
      down_payment: b.down_payment ?? 10000,
      annual_interest_rate: b.annual_interest_rate ?? 14.0,
      tenure_months: b.tenure_months ?? 6,
      extra_monthly_payment: b.extra_monthly_payment ?? 0.0,
    });
    res.json(result);
  });

  // --------------------------------------------------------------------------
  // Installments & RFC 5545 Calendar Export Endpoints
  // --------------------------------------------------------------------------
  app.get('/api/installments', (req, res) => {
    const user = getAuthenticatedUser(req);
    const userPlans = store.installment_plans.filter(
      (p) => !p.user_id || p.user_id === user.id || user.id === 1
    );
    const plans = userPlans.map(serializePlan);
    res.json(plans);
  });

  app.post('/api/installments', (req, res) => {
    const user = getAuthenticatedUser(req);
    const b = req.body || {};
    const startDate = b.start_date || new Date().toISOString().slice(0, 10);
    const dueDay = b.due_day ?? 5;
    const sched = EMICalculator.generateAmortizationSchedule({
      purchase_price: b.total_amount,
      down_payment: b.down_payment ?? 0,
      annual_interest_rate: b.annual_interest_rate ?? 14.0,
      tenure_months: b.tenure_months ?? 6,
    });

    const payments = sched.schedule.map((item, idx) => ({
      id: store.nextPaymentId++,
      installment_number: item.month,
      due_date: addMonths(startDate, idx, dueDay),
      emi_amount: item.payment_amount,
      principal_portion: item.principal_paid,
      interest_portion: item.interest_paid,
      remaining_balance: item.remaining_balance,
      status: 'PENDING',
      paid_at: null,
      notes: '',
    }));

    const newPlan = {
      id: store.nextPlanId++,
      user_id: user.id,
      purchase_name: b.purchase_name || 'New Purchase EMI',
      category: b.category || 'Electronics',
      total_amount: b.total_amount,
      down_payment: b.down_payment ?? 0,
      principal_financed: sched.principal_financed,
      annual_interest_rate: b.annual_interest_rate ?? 14.0,
      tenure_months: sched.tenure_months,
      monthly_emi: sched.monthly_emi,
      total_repayment: sched.total_repayment,
      total_interest: sched.total_interest,
      start_date: startDate,
      due_day: dueDay,
      status: 'ACTIVE',
      notes: b.notes || '',
      payments,
    };

    store.installment_plans.unshift(newPlan);
    logEvent(`📅 Someone added a ₹${Math.round(sched.monthly_emi).toLocaleString('en-IN')}/mo EMI plan`);
    saveStore();
    res.status(201).json(serializePlan(newPlan));
  });

  app.patch('/api/installments/:planId/payments/:paymentId', (req, res) => {
    const planId = Number(req.params.planId);
    const paymentId = Number(req.params.paymentId);
    const plan = store.installment_plans.find((p) => p.id === planId);
    if (!plan) {
      res.status(404).json({ detail: 'Installment plan not found' });
      return;
    }
    const payment = plan.payments.find((p: any) => p.id === paymentId);
    if (!payment) {
      res.status(404).json({ detail: 'Installment payment not found' });
      return;
    }
    const newStatus = (req.body.status || 'PAID').toUpperCase();
    payment.status = newStatus;
    payment.paid_at = newStatus === 'PAID' ? new Date().toISOString() : null;
    if (req.body.notes !== undefined) {
      payment.notes = req.body.notes;
    }
    if (newStatus === 'PAID') {
      logEvent('✅ Someone marked an EMI installment as paid');
    }
    saveStore();
    res.json(payment);
  });

  app.delete('/api/installments/:planId', (req, res) => {
    const planId = Number(req.params.planId);
    const idx = store.installment_plans.findIndex((p) => p.id === planId);
    if (idx === -1) {
      res.status(404).json({ detail: 'Installment plan not found' });
      return;
    }
    store.installment_plans.splice(idx, 1);
    saveStore();
    res.json({ status: 'deleted', message: `Plan ${planId} deleted` });
  });

  app.get('/api/installments/:planId/reminders.ics', (req, res) => {
    const planId = Number(req.params.planId);
    const plan = store.installment_plans.find((p) => p.id === planId);
    if (!plan) {
      res.status(404).json({ detail: 'Installment plan not found' });
      return;
    }
    const ics = ReminderService.generateIcsForPlan(plan, plan.payments);
    const filename = `emi_reminders_${plan.id}.ics`;
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(ics);
  });

  // --------------------------------------------------------------------------
  // Vite Middleware (Development) or Static Bundle (Production)
  // --------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Financial Parallelverse v4 running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
