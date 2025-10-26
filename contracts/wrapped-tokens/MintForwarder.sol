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
    /**
     * @dev Gets the mintable token contract address
     * @return The address of the mintable token contract
     */

    IERC20 public  _sourceTokenContract;
    IERC20 public  _destinationTokenContract;

    /**
     * @dev Indicates that the contract has been initialized
     */
    bool internal initialized;


    /**
     * @notice Emitted when tokens are wrapped
     * @param wrapper The address initiating the wrap
     * @param to The address the wrapped tokens are sent to
     * @param amount The amount of tokens wrapped
     */
    event Wrap(address indexed wrapper, address indexed to, uint256 amount);
    
    /**
     * @notice Emitted when tokens are unwrapped
     * @param unwrapper The address initiating the unwrap
     * @param to The address the unwrapped tokens are sent to
     * @param amount The amount of tokens unwrapped
     */
    event Unwrap(address indexed unwrapper, address indexed to, uint256 amount);

    /**
     * @dev Function to initialize the contract
     * @dev Can an only be called once by the deployer of the contract
     * @dev The caller is responsible for ensuring that both the new owner and the token contract are configured correctly
     * @param newOwner The address of the new owner of the mint contract, can either be an EOA or a contract
     * @param sourceTokenContract The address of the source token contract
     * @param destinationTokenContract The address of the destination token contract
     */
    function initialize(address newOwner, address sourceTokenContract, address destinationTokenContract)
        external
        onlyOwner
    {
        require(!initialized, "MintForwarder: contract is already initialized");
        require(
            newOwner != address(0),
            "MintForwarder: owner is the zero address"
        );
        require(
            sourceTokenContract != address(0),
            "MintForwarder: sourceTokenContract is the zero address"
        );
        require(
            destinationTokenContract != address(0),
            "MintForwarder: destinationTokenContract is the zero address"
        );
        transferOwnership(newOwner);
        _sourceTokenContract = IERC20(sourceTokenContract);
        _destinationTokenContract = IERC20(destinationTokenContract);
        initialized = true;
    }

    /**
     * @dev Public function to wrap source tokens into destination tokens (1:1 exchange)
     * @dev Anyone can call this function to exchange source tokens for destination tokens
     * @param _to The address that will receive the wrapped tokens
     * @param _amount The amount of tokens to wrap
     */
    function mint(address _to, uint256 _amount) external nonReentrant whenNotPaused {
        require(
            _to != address(0),
            "MintForwarder: cannot mint to the zero address"
        );
        require(_amount > 0, "MintForwarder: mint amount not greater than 0");
        require(
            _sourceTokenContract.balanceOf(msg.sender) >= _amount,
            "MintForwarder: insufficient source token balance"
        );
        require(
            _sourceTokenContract.allowance(msg.sender, address(this)) >= _amount,
            "MintForwarder: insufficient allowance"
        );

        // Transfer source tokens from user to this contract
        require(
            _sourceTokenContract.transferFrom(msg.sender, address(this), _amount),
            "MintForwarder: source token transfer failed"
        );
        
        // Mint destination tokens to the specified recipient
        MintUtil.safeMint(_to, _amount, address(_destinationTokenContract));
        
        emit Wrap(msg.sender, _to, _amount);
    }

    /**
     * @dev Public function to unwrap destination tokens back to source tokens (1:1 exchange)
     * @dev Anyone can call this function to exchange destination tokens back to source tokens
     * @param _amount The amount of destination tokens to unwrap
     */
    function burn(uint256 _amount) external nonReentrant whenNotPaused {
        require(_amount > 0, "MintForwarder: burn amount not greater than 0");
        require(
            _destinationTokenContract.balanceOf(msg.sender) >= _amount,
            "MintForwarder: insufficient destination token balance"
        );
        require(
            _sourceTokenContract.balanceOf(address(this)) >= _amount,
            "MintForwarder: insufficient source token balance in contract"
        );

        // Burn destination tokens from the caller
        MintUtil.safeBurn(_amount, address(_destinationTokenContract));
        
        // Transfer source tokens back to the caller
        require(
            _sourceTokenContract.transfer(msg.sender, _amount),
            "MintForwarder: source token transfer failed"
        );
        
        emit Unwrap(msg.sender, msg.sender, _amount);
    }

    /**
     * @dev Emergency function to pause the contract
     * @dev Only owner can call this function
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Emergency function to unpause the contract
     * @dev Only owner can call this function
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Emergency function to recover stuck tokens
     * @dev Only owner can call this function
     * @param token The token contract address to recover
     * @param amount The amount of tokens to recover
     * @param to The address to send the recovered tokens to
     */
    function emergencyRecover(
        address token,
        uint256 amount,
        address to
    ) external onlyOwner {
        require(to != address(0), "MintForwarder: cannot recover to zero address");
        require(amount > 0, "MintForwarder: amount must be greater than 0");
        
        IERC20(token).transfer(to, amount);
    }

    /**
     * @dev Function to get contract balances
     * @return sourceTokenBalance The balance of source tokens in the contract
     * @return destinationTokenBalance The balance of destination tokens in the contract
     */
    function getContractBalances() external view returns (uint256 sourceTokenBalance, uint256 destinationTokenBalance) {
        sourceTokenBalance = _sourceTokenContract.balanceOf(address(this));
        destinationTokenBalance = _destinationTokenContract.balanceOf(address(this));
    }
}
