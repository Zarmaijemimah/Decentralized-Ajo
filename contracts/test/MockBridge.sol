// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockBridge
 * @dev Mock bridge for simulating cross-chain messages.
 */
contract MockBridge {
    event MessageSent(address indexed sender, uint256 destinationChainId, bytes message);
    event MessageReceived(address indexed receiver, uint256 sourceChainId, bytes message);

    function sendMessage(uint256 _destinationChainId, address _receiver, bytes calldata _message) external {
        emit MessageSent(msg.sender, _destinationChainId, _message);
    }

    function receiveMessage(uint256 _sourceChainId, address _receiver, bytes calldata _message) external {
        // Simulate bridge calling the destination contract
        (bool success, bytes memory returnData) = _receiver.call(_message);
        if (!success) {
            if (returnData.length > 0) {
                assembly {
                    let returndata_size := mload(returnData)
                    revert(add(32, returnData), returndata_size)
                }
            } else {
                revert("Message execution failed");
            }
        }
        emit MessageReceived(_receiver, _sourceChainId, _message);
    }
}
