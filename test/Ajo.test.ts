import { ethers } from "hardhat";
import { expect } from "chai";
import { Ajo } from "../typechain-types";

describe("Ajo - Member Management Edge Cases", function () {
  let ajo: Ajo;
  let owner: any;
  let addr1: any;
  let addr2: any;
  let addr3: any;

  const CONTRIBUTION_USD = 100000000; // 100 USD with 8 decimals
  const CYCLE_DURATION = 30 * 24 * 60 * 60; // 30 days
  const MAX_MEMBERS = 3;
  const PRICE_FEED = "0x694AA1769357215DE4FAC081bf1f309aDC325306"; // Sepolia ETH/USD

  beforeEach(async function () {
    const [ownerAccount, account1, account2, account3] = await ethers.getSigners();
    owner = ownerAccount;
    addr1 = account1;
    addr2 = account2;
    addr3 = account3;

    const AjoContract = await ethers.getContractFactory("Ajo");
    ajo = await AjoContract.deploy();
    await ajo.waitForDeployment();

    // Initialize the contract
    await ajo.initialize(CONTRIBUTION_USD, CYCLE_DURATION, MAX_MEMBERS, PRICE_FEED);
  });

  describe("Adding Members - Edge Cases", function () {
    it("Should revert when trying to add member with incorrect contribution amount", async function () {
      const wrongAmount = ethers.parseEther("0.5"); // Wrong amount
      await expect(
        ajo.connect(addr1).deposit({ value: wrongAmount })
      ).to.be.revertedWithCustomError(ajo, "InvalidContribution");
    });

    it("Should revert when trying to add member when Ajo is full", async function () {
      // Add members up to max
      const contributionAmount = await ajo.getContributionAmountEth();
      
      await ajo.connect(addr1).deposit({ value: contributionAmount });
      await ajo.connect(addr2).deposit({ value: contributionAmount });
      await ajo.connect(owner).deposit({ value: contributionAmount }); // owner is also a member

      // Now try to add one more
      await expect(
        ajo.connect(addr3).deposit({ value: contributionAmount })
      ).to.be.revertedWithCustomError(ajo, "AjoIsFull");
    });

    it("Should revert when trying to add member when contract is paused", async function () {
      await ajo.pause();
      const contributionAmount = await ajo.getContributionAmountEth();
      
      await expect(
        ajo.connect(addr1).deposit({ value: contributionAmount })
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should allow adding members after circle has started (after first deposit)", async function () {
      const contributionAmount = await ajo.getContributionAmountEth();
      
      // First member
      await ajo.connect(addr1).deposit({ value: contributionAmount });
      
      // Circle has "started", now add second member
      await expect(
        ajo.connect(addr2).deposit({ value: contributionAmount })
      ).to.not.be.reverted;
      
      expect(await ajo.memberCount()).to.equal(2);
    });

    it("Should maintain valid state after failed deposit attempts", async function () {
      const wrongAmount = ethers.parseEther("0.5");
      const contributionAmount = await ajo.getContributionAmountEth();
      
      // Failed deposit
      await expect(
        ajo.connect(addr1).deposit({ value: wrongAmount })
      ).to.be.revertedWithCustomError(ajo, "InvalidContribution");
      
      // State should be unchanged
      expect(await ajo.memberCount()).to.equal(0);
      expect(await ajo.totalPool()).to.equal(0);
      
      // Now successful deposit
      await ajo.connect(addr1).deposit({ value: contributionAmount });
      
      expect(await ajo.memberCount()).to.equal(1);
      expect(await ajo.totalPool()).to.equal(contributionAmount);
    });
  });

  describe("Member State Transitions", function () {
    it("Should allow multiple contributions from same member", async function () {
      const contributionAmount = await ajo.getContributionAmountEth();
      
      // First deposit
      await ajo.connect(addr1).deposit({ value: contributionAmount });
      expect(await ajo.balances(addr1.address)).to.equal(contributionAmount);
      
      // Second deposit
      await ajo.connect(addr1).deposit({ value: contributionAmount });
      expect(await ajo.balances(addr1.address)).to.equal(contributionAmount * 2n);
      
      // Member count should still be 1
      expect(await ajo.memberCount()).to.equal(1);
    });

    it("Should handle edge case of withdrawing all funds (simulating removing last member)", async function () {
      const contributionAmount = await ajo.getContributionAmountEth();
      
      // Add a member
      await ajo.connect(addr1).deposit({ value: contributionAmount });
      expect(await ajo.totalPool()).to.equal(contributionAmount);
      expect(await ajo.memberCount()).to.equal(1);
      
      // Admin withdraws all funds
      await ajo.withdraw(owner.address, contributionAmount);
      
      // Pool should be 0, but member still exists
      expect(await ajo.totalPool()).to.equal(0);
      expect(await ajo.memberCount()).to.equal(1);
      expect(await ajo.balances(addr1.address)).to.equal(contributionAmount); // Balance unchanged
      
      // Contract state remains valid: members array intact, balances tracked
      const members = await ajo.getMembers();
      expect(members.length).to.equal(1);
      expect(members[0]).to.equal(addr1.address);
    });

    it("Should prevent invalid withdrawal amounts", async function () {
      const contributionAmount = await ajo.getContributionAmountEth();
      
      // Add member
      await ajo.connect(addr1).deposit({ value: contributionAmount });
      
      // Try to withdraw more than pool
      await expect(
        ajo.withdraw(owner.address, contributionAmount + 1n)
      ).to.be.revertedWith("Insufficient pool balance");
      
      // State unchanged
      expect(await ajo.totalPool()).to.equal(contributionAmount);
    });
  });
});