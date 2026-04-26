#![cfg(test)]

use crate::{AjoCircle, AjoError};

// ── calculate_yield ───────────────────────────────────────────────────────────
//
// Formula: interest = P * (1 + r/12)^months - P
// Fixed-point SCALE = 10^12; annual_rate_bps in basis points (500 = 5.00 %).
// Expected values computed with the same integer algorithm (see test comments).

#[test]
fn yield_5pct_12_months() {
    // 5 % annual, 12 months: ~5.116 % effective annual → 51_161
    assert_eq!(AjoCircle::calculate_yield(1_000_000, 500, 12), Ok(51_161));
}

#[test]
fn yield_5pct_24_months() {
    // 5 % annual, 24 months: compounded over 2 years → 104_941
    assert_eq!(AjoCircle::calculate_yield(1_000_000, 500, 24), Ok(104_941));
}

#[test]
fn yield_10pct_12_months() {
    // 10 % annual, 12 months → 104_713
    assert_eq!(AjoCircle::calculate_yield(1_000_000, 1000, 12), Ok(104_713));
}

#[test]
fn yield_10pct_24_months() {
    // 10 % annual, 24 months → 220_390
    assert_eq!(AjoCircle::calculate_yield(1_000_000, 1000, 24), Ok(220_390));
}

#[test]
fn yield_zero_rate_returns_zero() {
    // 0 % rate → no interest regardless of duration
    assert_eq!(AjoCircle::calculate_yield(1_000_000, 0, 12), Ok(0));
}

#[test]
fn yield_scales_linearly_with_principal() {
    // 5x principal → 5x interest (same rate/duration)
    assert_eq!(AjoCircle::calculate_yield(5_000_000, 500, 12), Ok(255_809));
}

// ── error paths ───────────────────────────────────────────────────────────────

#[test]
fn yield_rejects_zero_principal() {
    assert_eq!(AjoCircle::calculate_yield(0, 500, 12), Err(AjoError::InvalidInput));
}

#[test]
fn yield_rejects_negative_principal() {
    assert_eq!(AjoCircle::calculate_yield(-1, 500, 12), Err(AjoError::InvalidInput));
}

#[test]
fn yield_rejects_zero_months() {
    assert_eq!(AjoCircle::calculate_yield(1_000_000, 500, 0), Err(AjoError::InvalidInput));
}

#[test]
fn yield_rejects_rate_above_cap() {
    // cap is 100_000 bps (1000 %)
    assert_eq!(AjoCircle::calculate_yield(1_000_000, 100_001, 12), Err(AjoError::InvalidInput));
}
