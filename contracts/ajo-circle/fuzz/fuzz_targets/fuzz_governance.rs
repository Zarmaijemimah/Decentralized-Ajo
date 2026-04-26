#![no_main]
use libfuzzer_sys::fuzz_target;
use soroban_sdk::{
    testutils::{Address as _, Ledger}, token::{StellarAssetClient}, Address, Env, Symbol,
};
use ajo_circle::{AjoCircle, AjoError, MIN_CONTRIBUTION_AMOUNT, MAX_CONTRIBUTION_AMOUNT, MIN_FREQUENCY_DAYS, MAX_FREQUENCY_DAYS, MIN_ROUNDS, MAX_ROUNDS};

/// Fuzz input structure for governance functions
#[derive(Debug, arbitrary::Arbitrary)]
struct GovernanceInput {
    contribution_amount: i128,
    frequency_days: u32,
    max_rounds: u32,
    max_members: u32,
    threshold_mode: u32,
    fuzz_seed: u64,
}

fuzz_target!(|input: GovernanceInput| {
    let env = Env::default();
    env.mock_all_auths();

    let organizer = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = StellarAssetClient::new(&env, &token_admin);
    let token_address = token.address();

    // Set ledger info
    env.ledger().set_timestamp(1000000);

    // Initialize circle
    let init_result = AjoCircle::initialize_circle(
        env.clone(),
        organizer.clone(),
        token_address.clone(),
        input.contribution_amount,
        input.frequency_days,
        input.max_rounds,
        input.max_members,
    );

    if init_result.is_err() {
        return;
    }

    // Test start_dissolution_vote with fuzzed threshold_mode
    let vote_result = AjoCircle::start_dissolution_vote(
        env.clone(),
        organizer.clone(),
        input.threshold_mode,
    );

    match vote_result {
        Ok(()) => {
            // Vote started successfully
            assert!(input.threshold_mode <= 1, "Valid threshold_mode must be 0 or 1");
        }
        Err(AjoError::InvalidInput) => {
            // Expected for threshold_mode > 1
            assert!(input.threshold_mode > 1, "InvalidInput should occur for threshold_mode > 1");
        }
        Err(AjoError::VoteAlreadyActive) => {
            // Vote already in progress
        }
        Err(AjoError::Unauthorized) => {
            // Caller not authorized
        }
        Err(_) => {
            // Other errors acceptable
        }
    }

    // Generate a member for voting
    let member = Address::generate(&env);
    token.mint(&member, &(input.contribution_amount * 10));

    // Add member
    let _ = AjoCircle::add_member(env.clone(), organizer.clone(), member.clone());

    // Test vote_to_dissolve
    let member_vote = AjoCircle::vote_to_dissolve(env.clone(), member.clone());
    match member_vote {
        Ok(()) => {
            // Vote cast successfully
        }
        Err(AjoError::NoActiveVote) => {
            // No dissolution vote active
        }
        Err(AjoError::AlreadyVoted) => {
            // Member already voted
        }
        Err(AjoError::Unauthorized) => {
            // Not a member
        }
        Err(_) => {
            // Other errors acceptable
        }
    }

    // Test panic/resume functions (admin only)
    if input.fuzz_seed % 50 == 0 {
        let panic_result = AjoCircle::panic(env.clone(), organizer.clone());
        match panic_result {
            Ok(()) | Err(_) => {
                // Should not cause unhandled panic
            }
        }

        let resume_result = AjoCircle::resume(env.clone(), organizer.clone());
        match resume_result {
            Ok(()) | Err(_) => {
                // Should not cause unhandled panic
            }
        }
    }

    // Test emergency functions
    if input.fuzz_seed % 100 == 0 {
        let emergency_stop = AjoCircle::emergency_stop(env.clone(), organizer.clone());
        match emergency_stop {
            Ok(()) | Err(_) => {}
        }

        let resume_ops = AjoCircle::resume_operations(env.clone(), organizer.clone());
        match resume_ops {
            Ok(()) | Err(_) => {}
        }

        let emergency_panic = AjoCircle::emergency_panic(env.clone(), organizer.clone());
        match emergency_panic {
            Ok(()) | Err(_) => {}
        }
    }
});
