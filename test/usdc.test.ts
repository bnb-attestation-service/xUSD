import { ethers } from "hardhat";
import { expect } from "chai";

/**
 * 测试 USDC 合约的基本功能
 */

describe("USDC Contract", function () {
  let usdc: any;
  let owner: any;
  let user1: any;
  let user2: any;

  beforeEach(async function () {
    // 获取签名者
    [owner, user1, user2] = await ethers.getSigners();

    // 部署 USDC 合约，初始供应量为 100万 USDC
    const USDCFactory = await ethers.getContractFactory("USDC");
    usdc = await USDCFactory.deploy(ethers.utils.parseUnits("1000000", 6));
    await usdc.deployed();
  });

  describe("基本信息", function () {
    it("应该返回正确的代币名称", async function () {
      expect(await usdc.name()).to.equal("USD Coin");
    });

    it("应该返回正确的代币符号", async function () {
      expect(await usdc.symbol()).to.equal("USDC");
    });

    it("应该返回正确的精度", async function () {
      expect(await usdc.decimals()).to.equal(6);
    });

    it("应该返回正确的总供应量", async function () {
      const totalSupply = await usdc.totalSupply();
      expect(totalSupply.toString()).to.equal(ethers.utils.parseUnits("1000000", 6).toString());
    });
  });

  describe("转账功能", function () {
    it("应该允许所有者转账", async function () {
      const amount = ethers.utils.parseUnits("1000", 6);
      
      await usdc.connect(owner).transfer(user1.address, amount);
      
      const balance = await usdc.balanceOf(user1.address);
      expect(balance.toString()).to.equal(amount.toString());
    });

    it("应该允许授权转账", async function () {
      const amount = ethers.utils.parseUnits("1000", 6);
      
      // 授权 user1 使用 owner 的代币
      await usdc.connect(owner).approve(user1.address, amount);
      
      // user1 从 owner 转账给 user2
      await usdc.connect(user1).transferFrom(owner.address, user2.address, amount);
      
      const balance = await usdc.balanceOf(user2.address);
      expect(balance.toString()).to.equal(amount.toString());
    });
  });

  describe("铸造功能", function () {
    it("应该允许所有者铸造新代币", async function () {
      const amount = ethers.utils.parseUnits("10000", 6);
      const initialBalance = await usdc.balanceOf(user1.address);
      
      await usdc.connect(owner).mint(user1.address, amount);
      
      const finalBalance = await usdc.balanceOf(user1.address);
      expect(finalBalance.toString()).to.equal(initialBalance.add(amount).toString());
    });

    it("应该拒绝非所有者铸造", async function () {
      const amount = ethers.utils.parseUnits("10000", 6);
      
      try {
        await usdc.connect(user1).mint(user2.address, amount);
        expect.fail("应该抛出错误");
      } catch (error) {
        expect((error as Error).message).to.include("Ownable: caller is not the owner");
      }
    });
  });

  describe("销毁功能", function () {
    it("应该允许所有者销毁代币", async function () {
      const amount = ethers.utils.parseUnits("10000", 6);
      const initialBalance = await usdc.balanceOf(owner.address);
      
      await usdc.connect(owner).burn(owner.address, amount);
      
      const finalBalance = await usdc.balanceOf(owner.address);
      expect(finalBalance.toString()).to.equal(initialBalance.sub(amount).toString());
    });

    it("应该拒绝销毁超过余额的代币", async function () {
      const amount = ethers.utils.parseUnits("2000000", 6); // 超过总供应量
      
      try {
        await usdc.connect(owner).burn(owner.address, amount);
        expect.fail("应该抛出错误");
      } catch (error) {
        expect((error as Error).message).to.include("USDC: burn amount exceeds balance");
      }
    });
  });

  describe("所有权管理", function () {
    it("应该允许转移所有权", async function () {
      await usdc.connect(owner).transferOwnership(user1.address);
      
      const newOwner = await usdc.owner();
      expect(newOwner).to.equal(user1.address);
    });

    it("应该拒绝非所有者转移所有权", async function () {
      try {
        await usdc.connect(user1).transferOwnership(user2.address);
        expect.fail("应该抛出错误");
      } catch (error) {
        expect((error as Error).message).to.include("Ownable: caller is not the owner");
      }
    });
  });
});
