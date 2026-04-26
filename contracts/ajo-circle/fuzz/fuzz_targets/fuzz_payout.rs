#![no_main]
use libfuzzer_sys::fuzz_target;
use soroban_sdk::{
    testutils::{Address as _, Ledger}, token::{StellarAssetClient}, Address, Env,
};
use ajo_circle::{AjoCircle, AjoError, MIN_CONTRIBUTION_AMOUNT, MAX_CONTRIBUTION_AMOUNT, MIN_FREQUENCY_DAYS, MAX_FREQUENCY_DAYS, MIN_ROUNDS, MAX_ROUNDS};

/// Fuzz input structure for payout operations
#[derive(Debug, arbitrary::Arbitrary)]
struct PayoutInput {
    contribution_amount: i128,
    frequency_days: u32,
    max_rounds: u32,
    fuzz_cycle: u32,
    fuzz_seed: u64,
}

fuzz_target!(|input: PayoutInput| {
    let env = Env::default();
    env.mock_all_auths();

    let organizer = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = StellarAssetClient::new(&env, &token_admin);
    let token_address = token.address();

    // Set ledger info
    env.ledger().set_timestamp(1000000);

    // Initialize with small member count for easier testing
    let init_result = AjoCircle::initialize_circle(
        env.clone(),
        organizer.clone(),
        token_address.clone(),
        input.contribution_amount,
        input.frequency_days,
        input.max_rounds,
        5, // Small max_members for testing
    );

    if init_result.is_err() {
        return;
    }

    // Generate random member
    let member = Address::generate(&env);
    token.mint(&member, &(input.contribution_amount * 100));

    // Add member
    let _ = AjoCircle::add_member(env.clone(), organizer.clone(), member.clone());

    // Test partial_withdraw with various states
    let withdraw_result = AjoCircle::partial_withdraw(env.clone(), member.clone());
    match withdraw_result {
        Ok(amount) => {
            assert!(amount >= 0, "Withdrawal amount should not be negative");
        }
        Err(AjoError::InsufficientFunds) => {
            // Expected when member has no contributed funds
        }
        Err(_) => {
            // Other errors acceptable
        }
    }

    // Test claim_payout with fuzzed cycle
    let payout_result = AjoCircle::claim_payout(env.clone(), member.clone(), input.fuzz_cycle);
    match payout_result {
        Ok(amount) => {
            assert!(amount > 0, "Payout should be positive");
            // Verify cycle was in valid range
            assert!(input.fuzz_cycle > 0, "Valid payout requires cycle > 0");
        }
        Err(AjoError::InvalidInput) => {
            // Expected for cycle == 0 or cycle > max_rounds
        }
        Err(AjoError::Disqualified) => {
            // Member not active
        }
        Err(AjoError::AlreadyPaid) => {
            // Already received payout
        }
        Err(AjoError::Unauthorized) => {
            // Not member's turn in rotation
        }
        Err(AjoError::InsufficientFunds) => {
            // Pool doesn't have enough funds
        }
        Err(_) => {
            // Other errors acceptable
        }
    }

    // Test emergency_refund (requires paused state)
    if input.fuzz_seed % 100 == 0 {
        // Try emergency refund - should fail if not paused
        let emergency_result = AjoCircle::emergency_refund(env.clone(), member.clone());
        match emergency_result {
            Err(AjoError::CircleNotActive) => {
                // Expected when contract is not paused
            }
            Err(AjoError::InsufficientFunds) => {
                // Expected when no funds to refund
            }
            Ok(_) | Err(_) => {
                // Other results acceptable
            }
        }
    }

    // Test dissolve_and_refund (requires dissolved state)
    let dissolve_result = AjoCircle::dissolve_and_refund(env.clone(), member.clone());
    match dissolve_result {
        Err(AjoError::CircleNotActive) => {
            // Expected when circle is not dissolved
        }
        Err(AjoError::InsufficientFunds) => {
            // No funds to refund
        }
        Ok(_) | Err(_) => {
            // Other results acceptable
        }
    }
});
