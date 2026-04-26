import { expect } from "chai";
import { ethers } from "hardhat";

describe("Cross-Chain Functionality", function () {
  let ajo: any;
  let mockBridge: any;
  let admin: any;
  let user: any;

  beforeEach(async function () {
    [admin, user] = await ethers.getSigners();

    // Deploy Mock Bridge
    const MockBridge = await ethers.getContractFactory("MockBridge");
    mockBridge = await MockBridge.deploy();
    await mockBridge.waitForDeployment();

    // Deploy Ajo
    const Ajo = await ethers.getContractFactory("Ajo");
    ajo = await Ajo.deploy();
    await ajo.waitForDeployment();

    // Initialize Ajo
    // _amountUSD = 100, _cycleDuration = 86400, _maxMembers = 10, _priceFeedAddress = address(0)
    await ajo.initialize(100, 86400, 10, ethers.ZeroAddress);

    // Grant DEFAULT_ADMIN_ROLE to MockBridge so it can process administrative cross-chain messages
    const DEFAULT_ADMIN_ROLE = await ajo.DEFAULT_ADMIN_ROLE();
    await ajo.grantRole(DEFAULT_ADMIN_ROLE, mockBridge.target);
  });

  it("should process a message from the mock bridge in a simulated environment", async function () {
    const newAmountUSD = 250;
    
    // Encode the function call for updateContributionAmount
    const message = ajo.interface.encodeFunctionData("updateContributionAmount", [newAmountUSD]);

    const sourceChainId = 137; // e.g., Polygon

    // Mock bridge receives the message and forwards it to Ajo
    const tx = await mockBridge.receiveMessage(sourceChainId, ajo.target, message);

    await expect(tx)
      .to.emit(mockBridge, "MessageReceived")
      .withArgs(ajo.target, sourceChainId, message);

    // Verify the state change in our contract
    const updatedAmountUSD = await ajo.contributionAmountUSD();
    expect(updatedAmountUSD).to.equal(newAmountUSD);
  });

  it("should emit MessageSent when sending a cross-chain message", async function () {
    const destinationChainId = 42161; // e.g., Arbitrum
    const receiver = user.address;
    const message = ethers.hexlify(ethers.toUtf8Bytes("test message"));

    const tx = await mockBridge.sendMessage(destinationChainId, receiver, message);

    await expect(tx)
      .to.emit(mockBridge, "MessageSent")
      .withArgs(admin.address, destinationChainId, message);
  });
});
