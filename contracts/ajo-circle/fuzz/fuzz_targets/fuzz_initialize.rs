#![no_main]
use libfuzzer_sys::fuzz_target;
use soroban_sdk::{
    testutils::{Address as _, Ledger}, Address, Env,
};
use ajo_circle::{AjoCircle, AjoError, MAX_MEMBERS, HARD_CAP, MIN_CONTRIBUTION_AMOUNT, MAX_CONTRIBUTION_AMOUNT, MIN_FREQUENCY_DAYS, MAX_FREQUENCY_DAYS, MIN_ROUNDS, MAX_ROUNDS};

/// Fuzz input structure for initialize_circle
#[derive(Debug, arbitrary::Arbitrary)]
struct FuzzInput {
    contribution_amount: i128,
    frequency_days: u32,
    max_rounds: u32,
    max_members: u32,
}

fuzz_target!(|input: FuzzInput| {
    let env = Env::default();
    let organizer = Address::generate(&env);
    let token = Address::generate(&env);

    // Set ledger info for realistic timestamp testing
    env.ledger().set_timestamp(1000000);
    env.ledger().set_sequence_number(1);

    let result = AjoCircle::initialize_circle(
        env.clone(),
        organizer.clone(),
        token.clone(),
        input.contribution_amount,
        input.frequency_days,
        input.max_rounds,
        input.max_members,
    );

    match result {
        Ok(()) => {
            // Verify contract was initialized with valid bounds
            assert!(input.contribution_amount >= MIN_CONTRIBUTION_AMOUNT as i128);
            assert!(input.contribution_amount <= MAX_CONTRIBUTION_AMOUNT as i128);
            assert!(input.frequency_days >= MIN_FREQUENCY_DAYS);
            assert!(input.frequency_days <= MAX_FREQUENCY_DAYS);
            assert!(input.max_rounds >= MIN_ROUNDS);
            assert!(input.max_rounds <= MAX_ROUNDS);
            let configured_max = if input.max_members == 0 { MAX_MEMBERS } else { input.max_members };
            assert!(configured_max > 0);
            assert!(configured_max <= HARD_CAP);
        }
        Err(AjoError::InvalidInput) => {
            // Expected error for out-of-bounds inputs
            assert!(
                input.contribution_amount < MIN_CONTRIBUTION_AMOUNT as i128
                || input.contribution_amount > MAX_CONTRIBUTION_AMOUNT as i128
                || input.frequency_days < MIN_FREQUENCY_DAYS
                || input.frequency_days > MAX_FREQUENCY_DAYS
                || input.max_rounds < MIN_ROUNDS
                || input.max_rounds > MAX_ROUNDS
                || (input.max_members != 0 && input.max_members > HARD_CAP)
                || (if input.max_members == 0 { MAX_MEMBERS } else { input.max_members }) == 0
            );
        }
        Err(_) => {
            // No other errors should occur during initialization
            panic!("Unexpected error during initialization");
        }
    }
});
