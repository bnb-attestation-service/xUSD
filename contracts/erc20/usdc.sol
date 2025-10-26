// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin4.2.0/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin4.2.0/contracts/access/Ownable.sol";

/**
 * @title USDC
 * @dev Simple ERC20 token contract for USDC
 * @notice This is a basic implementation of USDC token with 6 decimals
 */
contract USDC is ERC20, Ownable {
    uint8 private constant _DECIMALS = 6;
    
    /**
     * @dev Constructor that gives msg.sender all of existing tokens.
     * @param initialSupply Initial supply of tokens (in smallest unit, 6 decimals)
     */
    constructor(uint256 initialSupply) ERC20("USD Coin", "USDC") {
        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply);
        }
    }
    
    /**
     * @dev Returns the number of decimals used to get its user representation.
     * @return The number of decimals
     */
    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }
    
    /**
     * @dev Mint new tokens to a specific address
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint (in smallest unit, 6 decimals)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "USDC: mint to the zero address");
        _mint(to, amount);
    }
    
    /**
     * @dev Burn tokens from a specific address
     * @param from The address to burn tokens from
     * @param amount The amount of tokens to burn (in smallest unit, 6 decimals)
     */
    function burn(address from, uint256 amount) external onlyOwner {
        require(from != address(0), "USDC: burn from the zero address");
        require(balanceOf(from) >= amount, "USDC: burn amount exceeds balance");
        _burn(from, amount);
    }
    
    /**
     * @dev Emergency function to recover accidentally sent tokens
     * @param token The token contract address
     * @param amount The amount of tokens to recover
     * @param to The address to send recovered tokens to
     */
    function emergencyRecover(address token, uint256 amount, address to) external onlyOwner {
        require(to != address(0), "USDC: recover to the zero address");
        require(amount > 0, "USDC: amount must be greater than 0");
        
        IERC20(token).transfer(to, amount);
    }
}
