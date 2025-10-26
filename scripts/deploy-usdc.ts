import { ethers } from "hardhat";
import * as dotenv from "dotenv";

//---------------------------------------------------------
//testnet: 0x8fbaFC8c1f49B66F852B354a623d829661229C73
//mainnet: 
//---------------------------------------------------------
// 加载环境变量
dotenv.config();

/**
 * 部署简单的 USDC ERC20 合约
 * 
 * 部署流程说明：
 * 1. 部署 USDC 合约
 * 2. 可选择铸造初始供应量
 * 3. 配置所有者权限
 */

// 从环境变量读取配置
const OWNER_ADDRESS = process.env.OWNER_ADDRESS || "";
const INITIAL_SUPPLY = process.env.INITIAL_SUPPLY || "1000000000"; // 默认 10亿 USDC

async function deployUSDC() {
  // 获取签名者
  const signers = await ethers.getSigners();
  
  if (signers.length === 0) {
    throw new Error("没有可用的签名者。请检查 .env 文件中的 DEPLOYER_PRIVATE_KEY 配置。");
  }
  
  const deployer = signers[0];
  
  console.log("========== 开始部署 USDC 合约 ==========\n");
  console.log(`部署者地址: ${deployer.address}\n`);

  // 角色配置
  const owner = OWNER_ADDRESS || deployer.address;
  
  console.log("配置信息:");
  console.log(`  - 所有者:        ${owner}`);
  console.log(`  - 初始供应量:    ${INITIAL_SUPPLY} USDC\n`);
  
  // 1. 部署 USDC 合约
  console.log("1. 部署 USDC 合约...");
  const USDCFactory = await ethers.getContractFactory("USDC");
  
  // 将初始供应量转换为最小单位（6位小数）
  const initialSupplyAmount = ethers.utils.parseUnits(INITIAL_SUPPLY, 6);
  
  const usdc = await USDCFactory.deploy(initialSupplyAmount);
  await usdc.deployed();
  console.log(`   ✓ USDC 合约 deployed at: ${usdc.address}\n`);

  // 2. 转移所有权（如果需要）
  if (owner !== deployer.address) {
    console.log("2. 转移所有权...");
    await usdc.connect(deployer).transferOwnership(owner);
    console.log(`   ✓ 所有权已转移给: ${owner}\n`);
  } else {
    console.log("2. 跳过所有权转移（部署者即为所有者）\n");
  }

  // 3. 验证部署结果
  console.log("3. 验证部署结果...");
  const tokenName = await usdc.name();
  const tokenSymbol = await usdc.symbol();
  const tokenDecimals = await usdc.decimals();
  const totalSupply = await usdc.totalSupply();
  const contractOwner = await usdc.owner();
  
  console.log(`   ✓ 代币名称:      ${tokenName}`);
  console.log(`   ✓ 代币符号:      ${tokenSymbol}`);
  console.log(`   ✓ 代币精度:      ${tokenDecimals}`);
  console.log(`   ✓ 总供应量:      ${ethers.utils.formatUnits(totalSupply, 6)} USDC`);
  console.log(`   ✓ 合约所有者:    ${contractOwner}\n`);

  // 4. 显示部署结果和使用说明
  console.log("========== 部署完成 ==========\n");
  console.log("合约信息:");
  console.log(`  - 合约地址:      ${usdc.address}`);
  console.log(`  - 代币名称:      ${tokenName}`);
  console.log(`  - 代币符号:      ${tokenSymbol}`);
  console.log(`  - 代币精度:      ${tokenDecimals}`);
  console.log(`  - 总供应量:      ${ethers.utils.formatUnits(totalSupply, 6)} USDC\n`);
  
  console.log("使用说明:");
  console.log("1. 转账代币:");
  console.log(`   usdc.transfer(recipientAddress, amount);\n`);
  
  console.log("2. 授权其他地址使用代币:");
  console.log(`   usdc.approve(spenderAddress, amount);\n`);
  
  console.log("3. 铸造新代币 (仅所有者):");
  console.log(`   usdc.mint(recipientAddress, amount);\n`);
  
  console.log("4. 销毁代币 (仅所有者):");
  console.log(`   usdc.burn(fromAddress, amount);\n`);
  
  console.log("5. 紧急恢复代币 (仅所有者):");
  console.log(`   usdc.emergencyRecover(tokenAddress, amount, recipientAddress);\n`);

  console.log("环境变量配置:");
  console.log(`# 将此地址设置为源代币地址`);
  console.log(`SOURCE_TOKEN_ADDRESS=${usdc.address}\n`);

  return { 
    usdc,
    owner,
    totalSupply: totalSupply,
  };
}

// 执行部署
deployUSDC()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
