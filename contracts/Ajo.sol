// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract Ajo is Initializable {
    address public admin;
    uint256 public contributionAmount;
    uint32 public currentCycle;
    uint32 public maxMembers;
    uint256 public totalPool;

    address[] public members;

    /// @notice Mapping from member address to their current balance in the pool
    mapping(address => uint256) public balances;

    /// @notice Event emitted when a deposit is made
    event Deposited(address indexed member, uint256 amount);

    /**
     * @dev Struct to represent a member's state within the pool
     * @param addr The wallet address of the member
     * @param hasContributed Whether the member has contributed in the current cycle
     * @param totalContributed The total amount this member has ever contributed
     */
    struct MemberInfo {
        address addr;
        bool hasContributed;
        uint256 totalContributed;
    }

    error InvalidContribution();
    error AjoIsFull();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the Ajo pool with core parameters
     * @param _amount The amount required for each contribution
     * @param _maxMembers The maximum capacity of the pool
     * @param _admin The administrator of the pool
     */
    function initialize(uint256 _amount, uint32 _maxMembers, address _admin) public initializer {
        admin = _admin;
        contributionAmount = _amount;
        maxMembers = _maxMembers;
        currentCycle = 1;
    }

    /**
     * @notice Allows a member to deposit the required contribution amount.
     * @dev Enforces strict deposit of contributionAmount and updates pool state.
     */
    function deposit() external payable {
        if(msg.value != contributionAmount) revert InvalidContribution();
        if(members.length >= maxMembers) revert AjoIsFull();

        bool isNewMember = balances[msg.sender] == 0;
        if(isNewMember) {
             members.push(msg.sender);
        }

        balances[msg.sender] += msg.value;
        totalPool += msg.value;

        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Get all member addresses
    function getMembers() external view returns (address[] memory) {
        return members;
    }

    /// @notice Get member count
    function memberCount() external view returns (uint256) {
        return members.length;
    }
}
