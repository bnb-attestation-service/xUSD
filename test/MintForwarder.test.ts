import { ethers } from "hardhat";
import { expect } from "chai";

/**
 * 测试 MintForwarder 合约的基本功能
 */

describe("MintForwarder Contract", function () {
  let mintForwarder: any;
  let sourceToken: any;
  let destinationToken: any;
  let owner: any;
  let user1: any;
  let user2: any;

  beforeEach(async function () {
    // 获取签名者
    [owner, user1, user2] = await ethers.getSigners();

    // 部署源代币 (USDC)
    const USDCFactory = await ethers.getContractFactory("USDC");
    sourceToken = await USDCFactory.deploy(ethers.utils.parseUnits("1000000", 6));
    await sourceToken.deployed();

    // 部署目标代币 (Wrapped USDC)
    const FiatTokenV2_1Factory = await ethers.getContractFactory("FiatTokenV2_1");
    destinationToken = await FiatTokenV2_1Factory.deploy();
    await destinationToken.deployed();

    // 初始化目标代币
    await destinationToken.initialize(
      "Wrapped USDC",
      "XUSDC",
      "USD",
      6,
      owner.address,
      owner.address,
      owner.address,
      owner.address
    );

    // 部署 MintForwarder
    const MintForwarderFactory = await ethers.getContractFactory("MintForwarder");
    mintForwarder = await MintForwarderFactory.deploy();
    await mintForwarder.deployed();

    // 配置 MintForwarder 为目标代币的 Minter
    await destinationToken.connect(owner).configureMinter(
      mintForwarder.address,
      ethers.utils.parseUnits("1000000000", 6)
    );

    // 初始化 MintForwarder
    await mintForwarder.connect(owner).initialize(
      owner.address,
      sourceToken.address,
      destinationToken.address
    );

    // 给用户一些源代币用于测试
    await sourceToken.connect(owner).mint(user1.address, ethers.utils.parseUnits("10000", 6));
    await sourceToken.connect(owner).mint(user2.address, ethers.utils.parseUnits("5000", 6));
  });

  describe("基本信息", function () {
    it("应该返回正确的合约信息", async function () {
      const sourceTokenAddr = await mintForwarder._sourceTokenContract();
      const destinationTokenAddr = await mintForwarder._destinationTokenContract();
      const contractOwner = await mintForwarder.owner();
      const isPaused = await mintForwarder.paused();

      expect(sourceTokenAddr).to.equal(sourceToken.address);
      expect(destinationTokenAddr).to.equal(destinationToken.address);
      expect(contractOwner).to.equal(owner.address);
      expect(isPaused).to.be.false;
    });
  });

  describe("包装功能 (mint)", function () {
    it("应该允许用户包装代币", async function () {
      const amount = ethers.utils.parseUnits("1000", 6);
      
      // 用户授权 MintForwarder 使用源代币
      await sourceToken.connect(user1).approve(mintForwarder.address, amount);
      
      // 用户包装代币
      await mintForwarder.connect(user1).mint(user1.address, amount);
      
      // 检查余额变化
      const sourceBalance = await sourceToken.balanceOf(user1.address);
      const destinationBalance = await destinationToken.balanceOf(user1.address);
      const contractSourceBalance = await sourceToken.balanceOf(mintForwarder.address);
      
      expect(sourceBalance.toString()).to.equal(ethers.utils.parseUnits("9000", 6).toString());
      expect(destinationBalance.toString()).to.equal(amount.toString());
      expect(contractSourceBalance.toString()).to.equal(amount.toString());
    });

    it("应该拒绝包装到零地址", async function () {
      const amount = ethers.utils.parseUnits("1000", 6);
      
      await sourceToken.connect(user1).approve(mintForwarder.address, amount);
      
      try {
        await mintForwarder.connect(user1).mint(ethers.constants.AddressZero, amount);
        expect.fail("应该抛出错误");
      } catch (error) {
        expect((error as Error).message).to.include("cannot mint to the zero address");
      }
    });

    it("应该拒绝零金额包装", async function () {
      try {
        await mintForwarder.connect(user1).mint(user1.address, 0);
        expect.fail("应该抛出错误");
      } catch (error) {
        expect((error as Error).message).to.include("mint amount not greater than 0");
      }
    });

    it("应该拒绝余额不足的包装", async function () {
      const amount = ethers.utils.parseUnits("20000", 6); // 超过用户余额
      
      try {
        await mintForwarder.connect(user1).mint(user1.address, amount);
        expect.fail("应该抛出错误");
      } catch (error) {
        expect((error as Error).message).to.include("insufficient source token balance");
      }
    });

    it("应该拒绝授权不足的包装", async function () {
      const amount = ethers.utils.parseUnits("1000", 6);
      
      // 不进行授权
      try {
        await mintForwarder.connect(user1).mint(user1.address, amount);
        expect.fail("应该抛出错误");
      } catch (error) {
        expect((error as Error).message).to.include("insufficient allowance");
      }
    });
  });

  describe("解包装功能 (burn)", function () {
    beforeEach(async function () {
      // 先包装一些代币用于测试
      const amount = ethers.utils.parseUnits("1000", 6);
      await sourceToken.connect(user1).approve(mintForwarder.address, amount);
      await mintForwarder.connect(user1).mint(user1.address, amount);
    });

    it("应该允许用户解包装代币", async function () {
      const amount = ethers.utils.parseUnits("500", 6);
      
      // 用户需要先授权 MintForwarder 使用目标代币
      await destinationToken.connect(user1).approve(mintForwarder.address, amount);
      
      // 用户解包装代币
      await mintForwarder.connect(user1).burn(amount);
      
      // 检查余额变化
      const sourceBalance = await sourceToken.balanceOf(user1.address);
      const destinationBalance = await destinationToken.balanceOf(user1.address);
      const contractSourceBalance = await sourceToken.balanceOf(mintForwarder.address);
      
      expect(sourceBalance.toString()).to.equal(ethers.utils.parseUnits("9500", 6).toString());
      expect(destinationBalance.toString()).to.equal(ethers.utils.parseUnits("500", 6).toString());
      expect(contractSourceBalance.toString()).to.equal(ethers.utils.parseUnits("500", 6).toString());
    });

    it("应该拒绝零金额解包装", async function () {
      try {
        await mintForwarder.connect(user1).burn(0);
        expect.fail("应该抛出错误");
      } catch (error) {
        expect((error as Error).message).to.include("burn amount not greater than 0");
      }
    });

    it("应该拒绝余额不足的解包装", async function () {
      const amount = ethers.utils.parseUnits("2000", 6); // 超过用户的目标代币余额
      
      try {
        await mintForwarder.connect(user1).burn(amount);
        expect.fail("应该抛出错误");
      } catch (error) {
        expect((error as Error).message).to.include("insufficient destination token balance");
      }
    });

    it("应该拒绝合约余额不足的解包装", async function () {
      const amount = ethers.utils.parseUnits("500", 6); // 使用用户实际拥有的数量
      
      // 使用紧急恢复功能来消耗合约中的源代币
      // 合约中有1000个源代币，我们恢复800个，剩下200个，但用户要解包装500个
      await mintForwarder.connect(owner).emergencyRecover(
        sourceToken.address,
        ethers.utils.parseUnits("800", 6),
        owner.address
      );
      
      // 用户需要先授权 MintForwarder 使用目标代币
      await destinationToken.connect(user1).approve(mintForwarder.address, amount);
      
      try {
        await mintForwarder.connect(user1).burn(amount);
        expect.fail("应该抛出错误");
      } catch (error) {
        expect((error as Error).message).to.include("insufficient source token balance in contract");
      }
    });
  });

  describe("暂停功能", function () {
    it("应该允许所有者暂停合约", async function () {
      await mintForwarder.connect(owner).pause();
      const isPaused = await mintForwarder.paused();
      expect(isPaused).to.be.true;
    });

    it("应该拒绝非所有者暂停合约", async function () {
      try {
        await mintForwarder.connect(user1).pause();
        expect.fail("应该抛出错误");
      } catch (error) {
        expect((error as Error).message).to.include("Ownable: caller is not the owner");
      }
    });

    it("暂停后应该拒绝包装和解包装", async function () {
      await mintForwarder.connect(owner).pause();
      
      const amount = ethers.utils.parseUnits("1000", 6);
      await sourceToken.connect(user1).approve(mintForwarder.address, amount);
      
      try {
        await mintForwarder.connect(user1).mint(user1.address, amount);
        expect.fail("应该抛出错误");
      } catch (error) {
        expect((error as Error).message).to.include("Pausable: paused");
      }
    });

    it("应该允许所有者恢复合约", async function () {
      await mintForwarder.connect(owner).pause();
      await mintForwarder.connect(owner).unpause();
      
      const isPaused = await mintForwarder.paused();
      expect(isPaused).to.be.false;
    });
  });

  describe("紧急恢复功能", function () {
    it("应该允许所有者恢复代币", async function () {
      const amount = ethers.utils.parseUnits("1000", 6);
      
      // 先给合约一些代币
      await sourceToken.connect(owner).mint(mintForwarder.address, amount);
      
      // 恢复代币
      await mintForwarder.connect(owner).emergencyRecover(
        sourceToken.address,
        amount,
        user1.address
      );
      
      const balance = await sourceToken.balanceOf(user1.address);
      expect(balance.toString()).to.equal(ethers.utils.parseUnits("11000", 6).toString());
    });

    it("应该拒绝非所有者恢复代币", async function () {
      const amount = ethers.utils.parseUnits("1000", 6);
      
      try {
        await mintForwarder.connect(user1).emergencyRecover(
          sourceToken.address,
          amount,
          user1.address
        );
        expect.fail("应该抛出错误");
      } catch (error) {
        expect((error as Error).message).to.include("Ownable: caller is not the owner");
      }
    });
  });

  describe("合约余额查询", function () {
    it("应该返回正确的合约余额", async function () {
      const amount = ethers.utils.parseUnits("1000", 6);
      
      // 包装一些代币
      await sourceToken.connect(user1).approve(mintForwarder.address, amount);
      await mintForwarder.connect(user1).mint(user1.address, amount);
      
      // 查询余额
      const balances = await mintForwarder.getContractBalances();
      
      expect(balances.sourceTokenBalance.toString()).to.equal(amount.toString());
      expect(balances.destinationTokenBalance.toString()).to.equal("0");
    });
  });
});
