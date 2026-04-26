#![no_main]
use libfuzzer_sys::fuzz_target;
use soroban_sdk::{
    testutils::{Address as _, Ledger}, token::{StellarAssetClient}, Address, Env,
};
use ajo_circle::{AjoCircle, AjoError, MIN_CONTRIBUTION_AMOUNT, MAX_CONTRIBUTION_AMOUNT, MIN_FREQUENCY_DAYS, MAX_FREQUENCY_DAYS, MIN_ROUNDS, MAX_ROUNDS};

/// Fuzz input structure for contribute
#[derive(Debug, arbitrary::Arbitrary)]
struct ContributeInput {
    contribution_amount: i128,
    frequency_days: u32,
    max_rounds: u32,
    max_members: u32,
    fuzz_amount: i128,
}

fuzz_target!(|input: ContributeInput| {
    let env = Env::default();
    env.mock_all_auths();

    let organizer = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = StellarAssetClient::new(&env, &token_admin);
    let token_address = token.address();

    // Set ledger info
    env.ledger().set_timestamp(1000000);

    // Initialize circle first with valid params
    let init_result = AjoCircle::initialize_circle(
        env.clone(),
        organizer.clone(),
        token_address.clone(),
        input.contribution_amount,
        input.frequency_days,
        input.max_rounds,
        input.max_members,
    );

    // Only test contribute if init succeeded
    if init_result.is_err() {
        return;
    }

    let member = Address::generate(&env);

    // Mint tokens to member
    token.mint(&member, &(input.contribution_amount * 10));

    // Add member first
    let _ = AjoCircle::add_member(env.clone(), organizer.clone(), member.clone());

    // Test contribute with fuzzed amount
    let result = AjoCircle::contribute(env.clone(), member.clone(), input.fuzz_amount);

    match result {
        Ok(()) => {
            // Successful contribution means amount > 0 and not paused/disqualified
            assert!(input.fuzz_amount > 0, "Contribution should require positive amount");
        }
        Err(AjoError::InvalidInput) => {
            // Expected for amount <= 0
            assert!(input.fuzz_amount <= 0, "InvalidInput should only occur for non-positive amounts");
        }
        Err(AjoError::Disqualified) => {
            // Member may become disqualified after multiple missed contributions
            // This is expected behavior
        }
        Err(AjoError::Paused) => {
            // Contract may be paused - expected behavior
        }
        Err(_) => {
            // Other errors are acceptable (NotFound, InsufficientFunds, etc.)
        }
    }

    // Test deposit function (fixed amount)
    if input.fuzz_amount % 2 == 0 {
        let deposit_result = AjoCircle::deposit(env.clone(), member.clone());
        match deposit_result {
            Ok(()) | Err(_) => {
                // Deposit uses fixed contribution_amount, should not panic
            }
        }
    }
});
