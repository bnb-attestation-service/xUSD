import { ethers } from "hardhat";
import * as dotenv from "dotenv";



//---------------------------------------------------------
// USDC:
//---------------------------------------------------------
// testnet: 0x8fbaFC8c1f49B66F852B354a623d829661229C73
// mainnet: 
//---------------------------------------------------------
// Wrapped USDC:
//---------------------------------------------------------
// testnet: 
// mainnet: 
//---------------------------------------------------------
// Mint Forwarder:
//---------------------------------------------------------
// testnet:
// mainnet:
//---------------------------------------------------------
// 加载环境变量
dotenv.config();

/**
 * 部署基于 FiatTokenV2_1 的 Wrapped USDC 合约
 * 
 * 部署流程说明：
 * 1. 部署 FiatTokenV2_1 实现合约（目标代币）
 * 2. 初始化 Token（名称、符号、精度等）
 * 3. 初始化 V2 功能
 * 4. 部署 MintForwarder（公开包装代币交换合约）
 * 5. 配置 MintForwarder 为 FiatToken 的 Minter
 * 6. 初始化 MintForwarder（设置源代币和目标代币地址）
 * 7. 配置源代币（如 USDC）地址
 */

// 从环境变量读取角色地址，如果没有配置则使用部署者地址
const OWNER_ADDRESS = process.env.OWNER_ADDRESS || "";
const PAUSER_ADDRESS = process.env.PAUSER_ADDRESS || "";
const BLACKLISTER_ADDRESS = process.env.BLACKLISTER_ADDRESS || "";
const MASTER_MINTER_ADDRESS = process.env.MASTER_MINTER_ADDRESS || "";
const MAX_MINT_ALLOWANCE = process.env.MAX_MINT_ALLOWANCE || "100000000000000";

// 源代币地址（如 USDC）
const SOURCE_TOKEN_ADDRESS = process.env.SOURCE_TOKEN_ADDRESS || "0x8fbaFC8c1f49B66F852B354a623d829661229C73";

async function deployWrappedUSDCV2_1() {
  // 获取签名者（使用配置的私钥）
  const signers = await ethers.getSigners();
  
  if (signers.length === 0) {
    throw new Error("没有可用的签名者。请检查 .env 文件中的 DEPLOYER_PRIVATE_KEY 配置。");
  }
  
  const deployer = signers[0];
  
  console.log("========== 开始部署 Wrapped USDC ==========\n");
  console.log(`部署者地址: ${deployer.address}\n`);

  // 检查源代币地址配置
  if (!SOURCE_TOKEN_ADDRESS) {
    console.log("⚠️  警告: 未配置 SOURCE_TOKEN_ADDRESS，将使用零地址作为占位符");
    console.log("   请在 .env 文件中设置 SOURCE_TOKEN_ADDRESS=源代币合约地址\n");
  }

  // 使用环境变量中的地址，如果没有配置则使用部署者地址
  const owner = OWNER_ADDRESS || deployer.address;
  const pauser = PAUSER_ADDRESS || deployer.address;
  const blacklister = BLACKLISTER_ADDRESS || deployer.address;
  const masterMinter = MASTER_MINTER_ADDRESS || deployer.address;
  const sourceTokenAddress = SOURCE_TOKEN_ADDRESS || ethers.constants.AddressZero;


  console.log("角色配置:");
  console.log(`  - Owner:         ${owner}`);
  console.log(`  - Pauser:        ${pauser}`);
  console.log(`  - Blacklister:   ${blacklister}`);
  console.log(`  - MasterMinter:  ${masterMinter}`);
  console.log(`  - Source Token:  ${sourceTokenAddress}`);
  
  // 1. 部署 FiatTokenV2_1
  console.log("1. 部署 FiatTokenV2_1...");
  const FiatTokenV2_1Factory = await ethers.getContractFactory("FiatTokenV2_1");
  const fiatToken = await FiatTokenV2_1Factory.deploy();
  await fiatToken.deployed();
  console.log(`   ✓ FiatTokenV2_1 deployed at: ${fiatToken.address}\n`);

  // 2. 初始化 Token
  console.log("2. 初始化 Token...");
  await fiatToken.initialize(
    "Wrapped USDC",   // 名称
    "XUSD",          // 符号
    "USD",            // 货币代码
    6,                // 精度（6位小数，与USDC一致）
    owner,            // owner
    pauser,           // pauser
    blacklister,      // blacklister
    masterMinter      // masterMinter
  );
  console.log("   ✓ Token 初始化参数设置完成\n");


  // 4. 部署 MintForwarder
  console.log("4. 部署 MintForwarder...");
  const MintForwarderFactory = await ethers.getContractFactory("MintForwarder");
  const mintForwarder = await MintForwarderFactory.deploy();
  await mintForwarder.deployed();
  console.log(`   ✓ MintForwarder deployed at: ${mintForwarder.address}\n`);

  // 5. 配置 MintForwarder 为 FiatToken 的 Minter
  console.log("5. 配置 MintForwarder 为 FiatToken 的 Minter...");
  const maxMinterAllowance = ethers.utils.parseUnits(MAX_MINT_ALLOWANCE, 6); // 1000 万亿 USDC 限额
  await fiatToken.connect(deployer).configureMinter(
    mintForwarder.address,
    maxMinterAllowance
  );
  console.log(`   ✓ Minter 配置完成，最大 mint 限额: ${ethers.utils.formatUnits(maxMinterAllowance, 6)} USDC\n`);

  // 6. 初始化 MintForwarder
  console.log("6. 初始化 MintForwarder...");
  await mintForwarder.connect(deployer).initialize(
    owner,                    // newOwner
    sourceTokenAddress,       // sourceTokenContract (如 USDC)
    fiatToken.address         // destinationTokenContract (Wrapped USDC)
  );
  console.log("   ✓ MintForwarder 初始化完成\n");

  // 7. 显示部署结果和使用说明
  console.log("========== 部署完成 ==========\n");
  console.log("合约地址:");
  console.log(`  - FiatTokenV2_1:    ${fiatToken.address}`);
  console.log(`  - MintForwarder:    ${mintForwarder.address}\n`);
  
  console.log("使用说明:");
  console.log("1. 包装代币 (Source → Destination):");
  console.log(`   sourceToken.approve("${mintForwarder.address}", amount);`);
  console.log(`   mintForwarder.mint(recipientAddress, amount);\n`);
  
  console.log("2. 解包装代币 (Destination → Source):");
  console.log(`   mintForwarder.burn(amount);\n`);
  
  console.log("3. 管理功能 (仅 Owner):");
  console.log(`   mintForwarder.pause();     // 暂停合约`);
  console.log(`   mintForwarder.unpause();   // 恢复合约`);
  console.log(`   mintForwarder.emergencyRecover(token, amount, to); // 紧急恢复\n`);

  return { 
    fiatToken, 
    mintForwarder,
    owner,
    pauser,
    blacklister,
    masterMinter,
    sourceTokenAddress,
  };
}

// 执行部署
deployWrappedUSDCV2_1()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
