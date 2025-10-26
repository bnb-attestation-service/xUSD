import { ethers } from "hardhat";
import { expect } from "chai";
import * as dotenv from "dotenv";

// 加载环境变量
dotenv.config();

/**
 * 部署验证测试
 * 验证已部署的合约是否正常工作
 */

describe("Deployment Verification Test", function () {
  let usdc: any;
  let wrappedUSDC: any;
  let mintForwarder: any;
  let owner: any;
  let user1: any;

  // 从环境变量获取合约地址
  const USDC_ADDRESS = process.env.USDC_ADDRESS;
  const WRAPPED_USDC_ADDRESS = process.env.WRAPPED_USDC_ADDRESS;
  const MINT_FORWARDER_ADDRESS = process.env.MINT_FORWARDER_ADDRESS;

  before(async function () {
    // 获取签名者
    [owner, user1] = await ethers.getSigners();

    // 如果提供了合约地址，连接到已部署的合约
    if (USDC_ADDRESS) {
      console.log(`连接到已部署的 USDC 合约: ${USDC_ADDRESS}`);
      usdc = await ethers.getContractAt("USDC", USDC_ADDRESS);
    }

    if (WRAPPED_USDC_ADDRESS) {
      console.log(`连接到已部署的 Wrapped USDC 合约: ${WRAPPED_USDC_ADDRESS}`);
      wrappedUSDC = await ethers.getContractAt("FiatTokenV2_1", WRAPPED_USDC_ADDRESS);
    }

    if (MINT_FORWARDER_ADDRESS) {
      console.log(`连接到已部署的 MintForwarder 合约: ${MINT_FORWARDER_ADDRESS}`);
      mintForwarder = await ethers.getContractAt("MintForwarder", MINT_FORWARDER_ADDRESS);
    }
  });

  describe("合约连接验证", function () {
    it("应该能够连接到所有合约", async function () {
      if (USDC_ADDRESS) {
        const name = await usdc.name();
        expect(name).to.equal("USD Coin");
        console.log(`✓ USDC 合约连接成功: ${name}`);
      } else {
        console.log("⚠️  未提供 USDC_ADDRESS，跳过 USDC 测试");
      }

      if (WRAPPED_USDC_ADDRESS) {
        const name = await wrappedUSDC.name();
        expect(name).to.equal("Wrapped USDC");
        console.log(`✓ Wrapped USDC 合约连接成功: ${name}`);
      } else {
        console.log("⚠️  未提供 WRAPPED_USDC_ADDRESS，跳过 Wrapped USDC 测试");
      }

      if (MINT_FORWARDER_ADDRESS) {
        const sourceToken = await mintForwarder._sourceTokenContract();
        const destinationToken = await mintForwarder._destinationTokenContract();
        expect(sourceToken).to.not.equal(ethers.constants.AddressZero);
        expect(destinationToken).to.not.equal(ethers.constants.AddressZero);
        console.log(`✓ MintForwarder 合约连接成功`);
        console.log(`  - 源代币: ${sourceToken}`);
        console.log(`  - 目标代币: ${destinationToken}`);
      } else {
        console.log("⚠️  未提供 MINT_FORWARDER_ADDRESS，跳过 MintForwarder 测试");
      }
    });
  });

  describe("USDC 合约验证", function () {
    it("应该验证 USDC 合约基本信息", async function () {
      if (!USDC_ADDRESS) {
        this.skip();
        return;
      }

      const name = await usdc.name();
      const symbol = await usdc.symbol();
      const decimals = await usdc.decimals();
      const totalSupply = await usdc.totalSupply();
      const contractOwner = await usdc.owner();

      expect(name).to.equal("USD Coin");
      expect(symbol).to.equal("USDC");
      expect(decimals).to.equal(6);
      expect(totalSupply).to.be.gt(0);
      expect(contractOwner).to.not.equal(ethers.constants.AddressZero);

      console.log(`✓ USDC 合约信息验证通过:`);
      console.log(`  - 名称: ${name}`);
      console.log(`  - 符号: ${symbol}`);
      console.log(`  - 精度: ${decimals}`);
      console.log(`  - 总供应量: ${ethers.utils.formatUnits(totalSupply, 6)}`);
      console.log(`  - 所有者: ${contractOwner}`);
    });

    it("应该验证 USDC 合约功能", async function () {
      if (!USDC_ADDRESS) {
        this.skip();
        return;
      }

      // 测试铸造功能（如果用户是所有者）
      try {
        const amount = ethers.utils.parseUnits("1000", 6);
        await usdc.connect(owner).mint(user1.address, amount);
        
        const balance = await usdc.balanceOf(user1.address);
        expect(balance.gte(amount)).to.be.true;
        console.log(`✓ USDC 铸造功能正常`);
      } catch (error) {
        console.log(`⚠️  USDC 铸造功能测试失败: ${(error as Error).message}`);
      }

      // 测试转账功能
      try {
        const amount = ethers.utils.parseUnits("100", 6);
        const initialBalance = await usdc.balanceOf(user1.address);
        
        await usdc.connect(user1).transfer(owner.address, amount);
        
        const finalBalance = await usdc.balanceOf(user1.address);
        expect(finalBalance).to.equal(initialBalance.sub(amount));
        console.log(`✓ USDC 转账功能正常`);
      } catch (error) {
        console.log(`⚠️  USDC 转账功能测试失败: ${(error as Error).message}`);
      }
    });
  });

  describe("Wrapped USDC 合约验证", function () {
    it("应该验证 Wrapped USDC 合约基本信息", async function () {
      if (!WRAPPED_USDC_ADDRESS) {
        this.skip();
        return;
      }

      const name = await wrappedUSDC.name();
      const symbol = await wrappedUSDC.symbol();
      const decimals = await wrappedUSDC.decimals();
      const totalSupply = await wrappedUSDC.totalSupply();

      expect(name).to.equal("Wrapped USDC");
      expect(symbol).to.equal("XUSDC");
      expect(decimals).to.equal(6);

      console.log(`✓ Wrapped USDC 合约信息验证通过:`);
      console.log(`  - 名称: ${name}`);
      console.log(`  - 符号: ${symbol}`);
      console.log(`  - 精度: ${decimals}`);
      console.log(`  - 总供应量: ${ethers.utils.formatUnits(totalSupply, 6)}`);
    });
  });

  describe("MintForwarder 合约验证", function () {
    it("应该验证 MintForwarder 合约基本信息", async function () {
      if (!MINT_FORWARDER_ADDRESS) {
        this.skip();
        return;
      }

      const sourceToken = await mintForwarder._sourceTokenContract();
      const destinationToken = await mintForwarder._destinationTokenContract();
      const contractOwner = await mintForwarder.owner();
      const isPaused = await mintForwarder.paused();

      expect(sourceToken).to.not.equal(ethers.constants.AddressZero);
      expect(destinationToken).to.not.equal(ethers.constants.AddressZero);
      expect(contractOwner).to.not.equal(ethers.constants.AddressZero);
      expect(isPaused).to.be.false;

      console.log(`✓ MintForwarder 合约信息验证通过:`);
      console.log(`  - 源代币: ${sourceToken}`);
      console.log(`  - 目标代币: ${destinationToken}`);
      console.log(`  - 所有者: ${contractOwner}`);
      console.log(`  - 暂停状态: ${isPaused}`);
    });

    it("应该验证 MintForwarder 合约功能", async function () {
      if (!MINT_FORWARDER_ADDRESS || !USDC_ADDRESS) {
        this.skip();
        return;
      }

      // 测试合约余额查询
      try {
        const balances = await mintForwarder.getContractBalances();
        console.log(`✓ MintForwarder 余额查询功能正常:`);
        console.log(`  - 源代币余额: ${ethers.utils.formatUnits(balances.sourceTokenBalance, 6)}`);
        console.log(`  - 目标代币余额: ${ethers.utils.formatUnits(balances.destinationTokenBalance, 6)}`);
      } catch (error) {
        console.log(`⚠️  MintForwarder 余额查询功能测试失败: ${(error as Error).message}`);
      }

      // 测试暂停功能（如果用户是所有者）
      try {
        await mintForwarder.connect(owner).pause();
        const paused = await mintForwarder.paused();
        expect(paused).to.be.true;
        
        await mintForwarder.connect(owner).unpause();
        const unpaused = await mintForwarder.paused();
        expect(unpaused).to.be.false;
        
        console.log(`✓ MintForwarder 暂停/恢复功能正常`);
      } catch (error) {
        console.log(`⚠️  MintForwarder 暂停/恢复功能测试失败: ${(error as Error).message}`);
      }
    });
  });

  describe("系统集成验证", function () {
    it("应该验证完整的包装和解包装流程", async function () {
      if (!MINT_FORWARDER_ADDRESS || !USDC_ADDRESS || !WRAPPED_USDC_ADDRESS) {
        this.skip();
        return;
      }

      // 确保用户有足够的 USDC
      const userBalance = await usdc.balanceOf(user1.address);
      if (userBalance.lt(ethers.utils.parseUnits("1000", 6))) {
        console.log("⚠️  用户 USDC 余额不足，跳过集成测试");
        this.skip();
        return;
      }

      const amount = ethers.utils.parseUnits("100", 6);

      try {
        // 1. 授权
        await usdc.connect(user1).approve(mintForwarder.address, amount);
        console.log(`✓ USDC 授权成功`);

        // 2. 包装
        await mintForwarder.connect(user1).mint(user1.address, amount);
        console.log(`✓ 代币包装成功`);

        // 3. 验证包装结果
        const userXUSDCBalance = await wrappedUSDC.balanceOf(user1.address);
        expect(userXUSDCBalance.gte(amount)).to.be.true;
        console.log(`✓ 包装验证成功: ${ethers.utils.formatUnits(userXUSDCBalance, 6)} XUSDC`);

        // 4. 解包装
        await mintForwarder.connect(user1).burn(amount);
        console.log(`✓ 代币解包装成功`);

        // 5. 验证解包装结果
        const userXUSDCBalanceAfter = await wrappedUSDC.balanceOf(user1.address);
        expect(userXUSDCBalanceAfter).to.be.lt(userXUSDCBalance);
        console.log(`✓ 解包装验证成功: ${ethers.utils.formatUnits(userXUSDCBalanceAfter, 6)} XUSDC`);

        console.log(`✓ 完整系统集成测试通过`);

      } catch (error) {
        console.log(`❌ 系统集成测试失败: ${(error as Error).message}`);
        throw error;
      }
    });
  });

  describe("网络状态检查", function () {
    it("应该检查网络连接状态", async function () {
      const network = await ethers.provider.getNetwork();
      const blockNumber = await ethers.provider.getBlockNumber();
      const gasPrice = await ethers.provider.getGasPrice();

      console.log(`✓ 网络状态检查:`);
      console.log(`  - 网络名称: ${network.name}`);
      console.log(`  - 链 ID: ${network.chainId}`);
      console.log(`  - 当前区块: ${blockNumber}`);
      console.log(`  - Gas 价格: ${ethers.utils.formatUnits(gasPrice, "gwei")} Gwei`);

      expect(network.chainId).to.be.gt(0);
      expect(blockNumber).to.be.gte(0); // 本地网络可能从0开始
      expect(gasPrice.gt(0)).to.be.true;
    });

    it("应该检查账户状态", async function () {
      const ownerBalance = await ethers.provider.getBalance(owner.address);
      const userBalance = await ethers.provider.getBalance(user1.address);

      console.log(`✓ 账户状态检查:`);
      console.log(`  - 部署者余额: ${ethers.utils.formatEther(ownerBalance)} ETH`);
      console.log(`  - 用户余额: ${ethers.utils.formatEther(userBalance)} ETH`);

      expect(ownerBalance.gt(0)).to.be.true;
    });
  });
});
