import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-truffle5";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-contract-sizer";
import "solidity-coverage";
import "@typechain/hardhat";
import * as dotenv from "dotenv";

// 加载环境变量
dotenv.config();

// 从环境变量或 .env 文件读取私钥
// 使用前请创建 .env 文件并添加: DEPLOYER_PRIVATE_KEY=your_private_key
const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY || "";
const bscScanApiKey = process.env.BSCSCAN_API_KEY || "";

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 10000000,
          },
        },
      },
      {
        version: "0.8.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 10000000,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      // Local Hardhat network
    },
    bscTestnet: {
      url: "https://bsc-testnet.nodereal.io/v1/67474aba58b44063b80db0030176c887",
      chainId: 97,
      accounts: deployerPrivateKey ? [deployerPrivateKey] : [],
      gasPrice: 2000000000, // 1 gwei
    },
    bscMainnet: {
      url: "https://bsc-mainnet.nodereal.io/v1/67474aba58b44063b80db0030176c887",
      chainId: 56,  
      accounts: deployerPrivateKey ? [deployerPrivateKey] : [],
      gasPrice: 1000000000, // 1 gwei
    },
  },
  etherscan: {
    apiKey: {
      bscTestnet: bscScanApiKey,
      bsc: bscScanApiKey,
    },
    customChains: [
      {
        network: "bscTestnet",
        chainId: 97,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=97",
          browserURL: "https://testnet.bscscan.com/"
        }
      },
      {
        network: "bscMainnet",
        chainId: 56,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=56",
          browserURL: "https://bscscan.com/"
        }
      }
    ]

  },
  typechain: {
    outDir: "@types/generated",
    target: "truffle-v5",
  },
  mocha: {
    timeout: 0,
  },
};
