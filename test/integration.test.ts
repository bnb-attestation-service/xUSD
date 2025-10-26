import { ethers } from "hardhat";
import { expect } from "chai";

/**
 * 完整系统集成测试
 * 测试 USDC + MintForwarder + Wrapped USDC 的完整流程
 */

describe("Complete System Integration Test", function () {
  let usdc: any;
  let wrappedUSDC: any;
  let mintForwarder: any;
  let owner: any;
  let user1: any;
  let user2: any;

  beforeEach(async function () {
    // 获取签名者
    [owner, user1, user2] = await ethers.getSigners();

    // 1. 部署 USDC 源代币
    const USDCFactory = await ethers.getContractFactory("USDC");
    usdc = await USDCFactory.deploy(ethers.utils.parseUnits("10000000", 6)); // 1000万 USDC
    await usdc.deployed();

    // 2. 部署 Wrapped USDC 目标代币
    const FiatTokenV2_1Factory = await ethers.getContractFactory("FiatTokenV2_1");
    wrappedUSDC = await FiatTokenV2_1Factory.deploy();
    await wrappedUSDC.deployed();

    // 初始化 Wrapped USDC
    await wrappedUSDC.initialize(
      "Wrapped USDC",
      "XUSDC",
      "USD",
      6,
      owner.address,
      owner.address,
      owner.address,
      owner.address
    );

    // 3. 部署 MintForwarder
    const MintForwarderFactory = await ethers.getContractFactory("MintForwarder");
    mintForwarder = await MintForwarderFactory.deploy();
    await mintForwarder.deployed();

    // 4. 配置 MintForwarder 为 Wrapped USDC 的 Minter
    await wrappedUSDC.connect(owner).configureMinter(
      mintForwarder.address,
      ethers.utils.parseUnits("1000000000", 6) // 10亿 XUSDC 铸造权限
    );

    // 5. 初始化 MintForwarder
    await mintForwarder.connect(owner).initialize(
      owner.address,
      usdc.address,
      wrappedUSDC.address
    );

    // 6. 给用户分配 USDC 用于测试
    await usdc.connect(owner).mint(user1.address, ethers.utils.parseUnits("100000", 6)); // 10万 USDC
    await usdc.connect(owner).mint(user2.address, ethers.utils.parseUnits("50000", 6));  // 5万 USDC
  });

  describe("系统初始化验证", function () {
    it("应该正确初始化所有合约", async function () {
      // 验证 USDC
      expect(await usdc.name()).to.equal("USD Coin");
      expect(await usdc.symbol()).to.equal("USDC");
      expect(await usdc.decimals()).to.equal(6);
      expect((await usdc.totalSupply()).toString()).to.equal(ethers.utils.parseUnits("10150000", 6).toString()); // 1000万 + 15万

      // 验证 Wrapped USDC
      expect(await wrappedUSDC.name()).to.equal("Wrapped USDC");
      expect(await wrappedUSDC.symbol()).to.equal("XUSDC");
      expect(await wrappedUSDC.decimals()).to.equal(6);

      // 验证 MintForwarder
      expect(await mintForwarder._sourceTokenContract()).to.equal(usdc.address);
      expect(await mintForwarder._destinationTokenContract()).to.equal(wrappedUSDC.address);
      expect(await mintForwarder.owner()).to.equal(owner.address);
      expect(await mintForwarder.paused()).to.be.false;
    });

    it("应该正确分配初始代币", async function () {
      const user1Balance = await usdc.balanceOf(user1.address);
      const user2Balance = await usdc.balanceOf(user2.address);
      const ownerBalance = await usdc.balanceOf(owner.address);

      expect(user1Balance.toString()).to.equal(ethers.utils.parseUnits("100000", 6).toString());
      expect(user2Balance.toString()).to.equal(ethers.utils.parseUnits("50000", 6).toString());
      expect(ownerBalance.toString()).to.equal(ethers.utils.parseUnits("10000000", 6).toString()); // 1000万（mint 不会减少 owner 余额）
    });
  });

  describe("完整包装流程测试", function () {
    it("应该完成完整的包装和解包装流程", async function () {
      const wrapAmount = ethers.utils.parseUnits("10000", 6); // 1万 USDC

      // === 步骤 1: 用户1 包装代币 ===
      console.log("步骤 1: 用户1 包装 1万 USDC");
      
      // 授权
      await usdc.connect(user1).approve(mintForwarder.address, wrapAmount);
      
      // 包装
      const wrapTx = await mintForwarder.connect(user1).mint(user1.address, wrapAmount);
      await wrapTx.wait();

      // 验证包装结果
      const user1USDCBalance = await usdc.balanceOf(user1.address);
      const user1XUSDCBalance = await wrappedUSDC.balanceOf(user1.address);
      const contractUSDCBalance = await usdc.balanceOf(mintForwarder.address);

      expect(user1USDCBalance.toString()).to.equal(ethers.utils.parseUnits("90000", 6).toString());
      expect(user1XUSDCBalance.toString()).to.equal(wrapAmount.toString());
      expect(contractUSDCBalance.toString()).to.equal(wrapAmount.toString());

      console.log(`✓ 用户1 USDC 余额: ${ethers.utils.formatUnits(user1USDCBalance, 6)}`);
      console.log(`✓ 用户1 XUSDC 余额: ${ethers.utils.formatUnits(user1XUSDCBalance, 6)}`);
      console.log(`✓ 合约 USDC 余额: ${ethers.utils.formatUnits(contractUSDCBalance, 6)}`);

      // === 步骤 2: 用户1 转账 XUSDC 给用户2 ===
      console.log("\n步骤 2: 用户1 转账 5000 XUSDC 给用户2");
      
      const transferAmount = ethers.utils.parseUnits("5000", 6);
      await wrappedUSDC.connect(user1).transfer(user2.address, transferAmount);

      // 验证转账结果
      const user1XUSDCBalanceAfter = await wrappedUSDC.balanceOf(user1.address);
      const user2XUSDCBalance = await wrappedUSDC.balanceOf(user2.address);

      expect(user1XUSDCBalanceAfter.toString()).to.equal(ethers.utils.parseUnits("5000", 6).toString());
      expect(user2XUSDCBalance.toString()).to.equal(transferAmount.toString());

      console.log(`✓ 用户1 XUSDC 余额: ${ethers.utils.formatUnits(user1XUSDCBalanceAfter, 6)}`);
      console.log(`✓ 用户2 XUSDC 余额: ${ethers.utils.formatUnits(user2XUSDCBalance, 6)}`);

      // === 步骤 3: 用户2 解包装代币 ===
      console.log("\n步骤 3: 用户2 解包装 3000 XUSDC");
      
      const unwrapAmount = ethers.utils.parseUnits("3000", 6);
      
      // 用户2 需要先授权 MintForwarder 使用 XUSDC
      await wrappedUSDC.connect(user2).approve(mintForwarder.address, unwrapAmount);
      
      const unwrapTx = await mintForwarder.connect(user2).burn(unwrapAmount);
      await unwrapTx.wait();

      // 验证解包装结果
      const user2USDCBalance = await usdc.balanceOf(user2.address);
      const user2XUSDCBalanceAfter = await wrappedUSDC.balanceOf(user2.address);
      const contractUSDCBalanceAfter = await usdc.balanceOf(mintForwarder.address);

      expect(user2USDCBalance.toString()).to.equal(ethers.utils.parseUnits("53000", 6).toString()); // 5万 + 3000
      expect(user2XUSDCBalanceAfter.toString()).to.equal(ethers.utils.parseUnits("2000", 6).toString()); // 5000 - 3000
      expect(contractUSDCBalanceAfter.toString()).to.equal(ethers.utils.parseUnits("7000", 6).toString()); // 1万 - 3000

      console.log(`✓ 用户2 USDC 余额: ${ethers.utils.formatUnits(user2USDCBalance, 6)}`);
      console.log(`✓ 用户2 XUSDC 余额: ${ethers.utils.formatUnits(user2XUSDCBalanceAfter, 6)}`);
      console.log(`✓ 合约 USDC 余额: ${ethers.utils.formatUnits(contractUSDCBalanceAfter, 6)}`);

      // === 步骤 4: 用户1 解包装剩余代币 ===
      console.log("\n步骤 4: 用户1 解包装剩余 5000 XUSDC");
      
      const finalUnwrapAmount = ethers.utils.parseUnits("5000", 6);
      
      // 用户1 需要先授权 MintForwarder 使用 XUSDC
      await wrappedUSDC.connect(user1).approve(mintForwarder.address, finalUnwrapAmount);
      
      const finalUnwrapTx = await mintForwarder.connect(user1).burn(finalUnwrapAmount);
      await finalUnwrapTx.wait();

      // 验证最终结果
      const finalUser1USDCBalance = await usdc.balanceOf(user1.address);
      const finalUser1XUSDCBalance = await wrappedUSDC.balanceOf(user1.address);
      const finalContractUSDCBalance = await usdc.balanceOf(mintForwarder.address);

      expect(finalUser1USDCBalance.toString()).to.equal(ethers.utils.parseUnits("95000", 6).toString()); // 9万 + 5000
      expect(finalUser1XUSDCBalance.toString()).to.equal("0");
      expect(finalContractUSDCBalance.toString()).to.equal(ethers.utils.parseUnits("2000", 6).toString()); // 7000 - 5000

      console.log(`✓ 最终用户1 USDC 余额: ${ethers.utils.formatUnits(finalUser1USDCBalance, 6)}`);
      console.log(`✓ 最终用户1 XUSDC 余额: ${ethers.utils.formatUnits(finalUser1XUSDCBalance, 6)}`);
      console.log(`✓ 最终合约 USDC 余额: ${ethers.utils.formatUnits(finalContractUSDCBalance, 6)}`);
    });

    it("应该正确处理多个用户的并发操作", async function () {
      const amount1 = ethers.utils.parseUnits("5000", 6);
      const amount2 = ethers.utils.parseUnits("3000", 6);

      // 用户1 和用户2 同时授权
      await usdc.connect(user1).approve(mintForwarder.address, amount1);
      await usdc.connect(user2).approve(mintForwarder.address, amount2);

      // 用户1 和用户2 同时包装
      const tx1 = mintForwarder.connect(user1).mint(user1.address, amount1);
      const tx2 = mintForwarder.connect(user2).mint(user2.address, amount2);

      await Promise.all([tx1, tx2]);

      // 验证结果
      const user1XUSDCBalance = await wrappedUSDC.balanceOf(user1.address);
      const user2XUSDCBalance = await wrappedUSDC.balanceOf(user2.address);
      const contractUSDCBalance = await usdc.balanceOf(mintForwarder.address);

      expect(user1XUSDCBalance.toString()).to.equal(amount1.toString());
      expect(user2XUSDCBalance.toString()).to.equal(amount2.toString());
      expect(contractUSDCBalance.toString()).to.equal(amount1.add(amount2).toString());
    });
  });

  describe("边界条件测试", function () {
    it("应该处理最小金额的包装和解包装", async function () {
      const minAmount = ethers.utils.parseUnits("1", 6); // 1 USDC (最小单位)

      // 包装
      await usdc.connect(user1).approve(mintForwarder.address, minAmount);
      await mintForwarder.connect(user1).mint(user1.address, minAmount);

      // 验证
      const user1XUSDCBalance = await wrappedUSDC.balanceOf(user1.address);
      expect(user1XUSDCBalance.toString()).to.equal(minAmount.toString());

      // 解包装
      await wrappedUSDC.connect(user1).approve(mintForwarder.address, minAmount);
      await mintForwarder.connect(user1).burn(minAmount);

      // 验证
      const user1XUSDCBalanceAfter = await wrappedUSDC.balanceOf(user1.address);
      expect(user1XUSDCBalanceAfter.toString()).to.equal("0");
    });

    it("应该处理大金额的包装和解包装", async function () {
      const largeAmount = ethers.utils.parseUnits("100000", 6); // 10万 USDC

      // 包装
      await usdc.connect(user1).approve(mintForwarder.address, largeAmount);
      await mintForwarder.connect(user1).mint(user1.address, largeAmount);

      // 验证
      const user1XUSDCBalance = await wrappedUSDC.balanceOf(user1.address);
      expect(user1XUSDCBalance.toString()).to.equal(largeAmount.toString());

      // 解包装
      await wrappedUSDC.connect(user1).approve(mintForwarder.address, largeAmount);
      await mintForwarder.connect(user1).burn(largeAmount);

      // 验证
      const user1XUSDCBalanceAfter = await wrappedUSDC.balanceOf(user1.address);
      expect(user1XUSDCBalanceAfter.toString()).to.equal("0");
    });
  });

  describe("系统状态管理", function () {
    it("应该正确处理暂停和恢复", async function () {
      const amount = ethers.utils.parseUnits("1000", 6);

      // 先包装一些代币
      await usdc.connect(user1).approve(mintForwarder.address, amount);
      await mintForwarder.connect(user1).mint(user1.address, amount);

      // 暂停系统
      await mintForwarder.connect(owner).pause();
      expect(await mintForwarder.paused()).to.be.true;

      // 尝试包装（应该失败）
      await usdc.connect(user2).approve(mintForwarder.address, amount);
      try {
        await mintForwarder.connect(user2).mint(user2.address, amount);
        expect.fail("应该抛出错误");
      } catch (error) {
        expect((error as Error).message).to.include("Pausable: paused");
      }

      // 尝试解包装（应该失败）
      try {
        await mintForwarder.connect(user1).burn(amount);
        expect.fail("应该抛出错误");
      } catch (error) {
        expect((error as Error).message).to.include("Pausable: paused");
      }

      // 恢复系统
      await mintForwarder.connect(owner).unpause();
      expect(await mintForwarder.paused()).to.be.false;

      // 现在应该可以正常操作
      await wrappedUSDC.connect(user1).approve(mintForwarder.address, amount);
      await mintForwarder.connect(user1).burn(amount);
      const user1XUSDCBalance = await wrappedUSDC.balanceOf(user1.address);
      expect(user1XUSDCBalance.toString()).to.equal("0");
    });
  });
});
