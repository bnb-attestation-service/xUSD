/**
 * SPDX-License-Identifier: MIT
 *
 * Copyright (c) 2022 Coinbase, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

pragma solidity 0.8.6;


import { MintUtil } from "./MintUtil.sol";
import { IERC20 } from "@openzeppelin4.2.0/contracts/token/ERC20/IERC20.sol";
import { ReentrancyGuard } from "@openzeppelin4.2.0/contracts/security/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin4.2.0/contracts/security/Pausable.sol";
import { Ownable } from "@openzeppelin4.2.0/contracts/access/Ownable.sol";

/**
 * @title MintForwarder
 * @notice Public wrapper contract for 1:1 token exchange
 * @dev Allows anyone to exchange source tokens for destination tokens and vice versa
 */
contract MintForwarder is Ownable, ReentrancyGuard, Pausable {
    // 使用 immutable 减少存储读取
    IERC20 public immutable sourceToken;
    IERC20 public immutable destinationToken;
    
    // 使用 packed struct 优化存储
    struct ContractState {
        bool initialized;
        uint128 totalWrapped;    // 总包装量
        uint128 totalUnwrapped;  // 总解包装量
    }
    
    ContractState private _state;

    // 事件优化：减少索引字段
    event Wrap(address indexed user, uint256 amount);
    event Unwrap(address indexed user, uint256 amount);
    event EmergencyRecover(address indexed token, uint256 amount);

    // 自定义错误，比 require 更省 gas
    error NotInitialized();
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientBalance();
    error InsufficientAllowance();
    error TransferFailed();

    modifier onlyInitialized() {
        if (!_state.initialized) revert NotInitialized();
        _;
    }

    constructor(address _sourceToken, address _destinationToken) {
        if (_sourceToken == address(0) || _destinationToken == address(0)) {
            revert ZeroAddress();
        }
        sourceToken = IERC20(_sourceToken);
        destinationToken = IERC20(_destinationToken);
    }

    /**
     * @dev Initialize the contract with owner
     * @param newOwner The new owner address
     */
    function initialize(address newOwner) external onlyOwner {
        if (_state.initialized) revert NotInitialized();
        if (newOwner == address(0)) revert ZeroAddress();
        
        transferOwnership(newOwner);
        _state.initialized = true;
    }

    /**
     * @dev Wrap source tokens into destination tokens
     * @param amount The amount to wrap
     */
    function wrap(uint256 amount) external nonReentrant whenNotPaused onlyInitialized {
        if (amount == 0) revert ZeroAmount();
        
        uint256 userBalance = sourceToken.balanceOf(msg.sender);
        uint256 allowance = sourceToken.allowance(msg.sender, address(this));
        
        if (userBalance < amount) revert InsufficientBalance();
        if (allowance < amount) revert InsufficientAllowance();

        // 使用 safeTransferFrom 避免额外的 require
        if (!sourceToken.transferFrom(msg.sender, address(this), amount)) {
            revert TransferFailed();
        }
        
        // Mint destination tokens
        MintUtil.safeMint(msg.sender, amount, address(destinationToken));
        
        // 更新状态
        _state.totalWrapped += uint128(amount);
        
        emit Wrap(msg.sender, amount);
    }

    /**
     * @dev Unwrap destination tokens back to source tokens
     * @param amount The amount to unwrap
     */
    function unwrap(uint256 amount) external nonReentrant whenNotPaused onlyInitialized {
        if (amount == 0) revert ZeroAmount();
        
        // 检查用户余额
        if (destinationToken.balanceOf(msg.sender) < amount) revert InsufficientBalance();
        
        // 检查合约余额
        if (sourceToken.balanceOf(address(this)) < amount) revert InsufficientBalance();

        // 先转移目标代币到合约
        if (!destinationToken.transferFrom(msg.sender, address(this), amount)) {
            revert TransferFailed();
        }

        // 销毁目标代币
        MintUtil.safeBurn(amount, address(destinationToken));
        
        // 转移源代币给用户
        if (!sourceToken.transfer(msg.sender, amount)) {
            revert TransferFailed();
        }
        
        // 更新状态
        _state.totalUnwrapped += uint128(amount);
        
        emit Unwrap(msg.sender, amount);
    }

    /**
     * @dev Emergency recover function with batch support
     * @param tokens Array of token addresses
     * @param amounts Array of amounts to recover
     * @param to Recipient address
     */
    function emergencyRecoverBatch(
        address[] calldata tokens,
        uint256[] calldata amounts,
        address to
    ) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (tokens.length != amounts.length) revert();
        
        for (uint256 i = 0; i < tokens.length; i++) {
            if (amounts[i] > 0) {
                IERC20(tokens[i]).transfer(to, amounts[i]);
                emit EmergencyRecover(tokens[i], amounts[i]);
            }
        }
    }

    /**
     * @dev Get contract statistics
     * @return totalWrapped Total amount wrapped
     * @return totalUnwrapped Total amount unwrapped
     * @return sourceBalance Current source token balance
     * @return destinationBalance Current destination token balance
     */
    function getStats() external view returns (
        uint256 totalWrapped,
        uint256 totalUnwrapped,
        uint256 sourceBalance,
        uint256 destinationBalance
    ) {
        return (
            _state.totalWrapped,
            _state.totalUnwrapped,
            sourceToken.balanceOf(address(this)),
            destinationToken.balanceOf(address(this))
        );
    }

    /**
     * @dev Check if contract is initialized
     */
    function isInitialized() external view returns (bool) {
        return _state.initialized;
    }
}
