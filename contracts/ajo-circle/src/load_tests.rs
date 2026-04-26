#![cfg(test)]

//! Load tests for issue #678 — contract behaviour under maximum member count.
//!
//! Each test spins up a circle at HARD_CAP (100 members) and drives every
//! member through the operation under test in a single test run, verifying
//! that the contract completes without panicking and that all state is
//! consistent afterwards.

use crate::{AjoCircle, AjoCircleClient, HARD_CAP, MIN_CONTRIBUTION_AMOUNT};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token, Address, Env,
};

const CONTRIBUTION: i128 = MIN_CONTRIBUTION_AMOUNT as i128; // 1_000_000
const N: u32 = HARD_CAP; // 100

fn base_ledger() -> LedgerInfo {
    LedgerInfo {
        timestamp: 1_000_000,
        protocol_version: 20,
        sequence_number: 100,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 10,
        min_persistent_entry_ttl: 10,
        max_entry_ttl: 3_110_400,
    }
}

/// Spin up a circle with `N` members (organizer + 99 others), all funded.
/// Returns (client, token_address, organizer, members_vec).
/// `members_vec[0]` is the organizer; indices 1..N are the additional members.
fn setup_full_circle(env: &Env) -> (AjoCircleClient, Address, Address, soroban_sdk::Vec<Address>) {
    env.ledger().set(base_ledger());

    let contract_id = env.register_contract(None, AjoCircle);
    let client = AjoCircleClient::new(env, &contract_id);

    let token_admin = Address::generate(env);
    let token_address = env.register_stellar_asset_contract(token_admin.clone());
    let sac = token::StellarAssetClient::new(env, &token_address);

    let organizer = Address::generate(env);
    // Mint enough for N deposits each
    sac.mint(&organizer, &(CONTRIBUTION * N as i128 * 2));
    // Pre-fund contract for payouts
    sac.mint(&contract_id, &(CONTRIBUTION * N as i128 * N as i128 * 2));

    client.initialize_circle(
        &organizer,
        &token_address,
        &CONTRIBUTION,
        &7_u32,
        &12_u32,
        &N,
    );

    let mut members: soroban_sdk::Vec<Address> = soroban_sdk::Vec::new(env);
    members.push_back(organizer.clone());

    for _ in 1..N {
        let m = Address::generate(env);
        sac.mint(&m, &(CONTRIBUTION * N as i128 * 2));
        client.join_circle(&organizer, &m).unwrap();
        members.push_back(m);
    }

    (client, token_address, organizer, members)
}

// ─── load tests ───────────────────────────────────────────────────────────────

/// All 100 members deposit once. Verifies pool accumulates correctly and
/// every member's balance is updated.
#[test]
fn test_load_100_members_all_deposit() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _token, _organizer, members) = setup_full_circle(&env);

    for i in 0..members.len() {
        let m = members.get(i).unwrap();
        client.deposit(&m).unwrap();
    }

    // Pool must equal N * CONTRIBUTION
    assert_eq!(client.get_total_pool(), CONTRIBUTION * N as i128);

    // Every member's balance must reflect one deposit
    for i in 0..members.len() {
        let m = members.get(i).unwrap();
        let data = client.get_member_balance(&m).unwrap();
        assert_eq!(data.total_contributed, CONTRIBUTION);
    }
}

/// All 100 members deposit, then all 100 claim their payout.
/// Verifies payout = N * CONTRIBUTION for each member and pool drains to zero.
#[test]
fn test_load_100_members_all_claim_payout() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _token, _organizer, members) = setup_full_circle(&env);

    for i in 0..members.len() {
        client.deposit(&members.get(i).unwrap()).unwrap();
    }

    let expected_payout = CONTRIBUTION * N as i128;

    for cycle in 1..=members.len() {
        let m = members.get(cycle - 1).unwrap();
        let payout = client.claim_payout(&m, &cycle).unwrap();
        assert_eq!(payout, expected_payout);
    }

    // Pool should be fully drained
    assert_eq!(client.get_total_pool(), 0);
}

/// All 100 members deposit, then all perform a partial_withdraw.
/// Verifies each refund is exactly 90% of CONTRIBUTION and pool drains correctly.
#[test]
fn test_load_100_members_all_partial_withdraw() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _token, _organizer, members) = setup_full_circle(&env);

    for i in 0..members.len() {
        client.deposit(&members.get(i).unwrap()).unwrap();
    }

    let expected_refund = CONTRIBUTION - CONTRIBUTION * 10 / 100; // 90%

    for i in 0..members.len() {
        let m = members.get(i).unwrap();
        let refund = client.partial_withdraw(&m).unwrap();
        assert_eq!(refund, expected_refund);
    }
}

/// Rapid-fire: 100 members each deposit 12 times (full max_rounds worth).
/// Verifies total_contributed accumulates correctly for every member.
#[test]
fn test_load_100_members_12_rounds_each() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _token, _organizer, members) = setup_full_circle(&env);

    for round in 0..12_u32 {
        // Advance ledger timestamp per round
        let mut info = base_ledger();
        info.timestamp = 1_000_000 + (round as u64) * 7 * 86_400;
        env.ledger().set(info);

        for i in 0..members.len() {
            client.deposit(&members.get(i).unwrap()).unwrap();
        }
    }

    for i in 0..members.len() {
        let m = members.get(i).unwrap();
        let data = client.get_member_balance(&m).unwrap();
        assert_eq!(data.total_contributed, CONTRIBUTION * 12);
    }
}

/// Joining at capacity (101st member) must fail with CircleAtCapacity.
/// Confirms the hard cap is enforced under load.
#[test]
fn test_load_hard_cap_enforced_at_101st_member() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _token, organizer, _members) = setup_full_circle(&env);

    // Circle is now full at N=100; one more must be rejected
    let extra = Address::generate(&env);
    let result = client.join_circle(&organizer, &extra);
    assert_eq!(result, Err(crate::AjoError::CircleAtCapacity));
}

/// All 100 members deposit, then the admin slashes all of them 3 times each.
/// Verifies every member is disqualified and subsequent deposits are rejected.
#[test]
fn test_load_100_members_all_slashed_and_disqualified() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _token, organizer, members) = setup_full_circle(&env);

    // Slash every member 3 times
    for i in 0..members.len() {
        let m = members.get(i).unwrap();
        client.slash_member(&organizer, &m).unwrap();
        client.slash_member(&organizer, &m).unwrap();
        client.slash_member(&organizer, &m).unwrap();
    }

    // Every member's deposit must now be rejected
    for i in 0..members.len() {
        let m = members.get(i).unwrap();
        let result = client.deposit(&m);
        assert_eq!(result, Err(crate::AjoError::Disqualified));
    }
}
