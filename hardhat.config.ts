import * as dotenv from 'dotenv'

dotenv.config()

import { HardhatUserConfig, task } from 'hardhat/config'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-waffle'
import '@typechain/hardhat'
import 'hardhat-gas-reporter'
import 'solidity-coverage'
import '@nomiclabs/hardhat-solhint'
import '@openzeppelin/hardhat-upgrades'
import 'hardhat-abi-exporter'
import 'hardhat-contract-sizer'
import 'hardhat-watcher'
import 'solidity-docgen'
import 'hardhat-deploy'
import { removeConsoleLog } from 'hardhat-preprocessor'
import * as path from 'path'
import * as fs from 'fs'
import axios from 'axios'
import * as ethers from 'ethers'
import { resolveEtherscanApiKey } from '@nomiclabs/hardhat-etherscan/dist/src/resolveEtherscanApiKey'
import { getEtherscanEndpoints } from '@nomiclabs/hardhat-etherscan/dist/src/network/prober'
import { chainConfig } from '@nomiclabs/hardhat-etherscan/dist/src/ChainConfig'
import _ from 'lodash'
import { readFile } from 'fs/promises'
import { CHAINS } from './config/defines'
import { useLogger } from './scripts/utils'

const logger = useLogger(__filename)
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners()

  for (const account of accounts) {
    console.log(account.address)
  }
})
// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: {
        enabled: true,
      },
      viaIR: true,
    },
  },
  // Named accounts for plugin `hardhat-deploy`
  namedAccounts: {
    deployer: 0,
  },
  docgen: {
    pages: 'files',
    outputDir: './docs',
  },
  networks: {
    hardhat: {
      chainId: 30097,
      ...(process.env.FORK_ENABLED === 'on'
        ? {
            chainId: process.env.FORK_CHAIN_ID ? parseInt(process.env.FORK_CHAIN_ID) : 30097,
            forking: {
              url: process.env.FORK_URL!,
              blockNumber: parseInt(process.env.FORK_BLOCK_NUMBER!),
            },
            accounts: [
              {
                privateKey: process.env.FORK_KEY!,
                balance: ethers.utils.parseEther('1000').toString(),
              },
            ],
          }
        : {}),
    },
    bsctest: {
      url: 'https://data-seed-prebsc-1-s3.binance.org:8545',
      // url: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
      chainId: 97,
      accounts: [process.env.KEY_BSC_TEST!],
      // for hardhat-eploy
      verify: {
        etherscan: {
          apiKey: process.env.BSCSCAN_TEST_KEY,
        },
      },
    },
    ...CHAINS,
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  gasReporter: {
    enabled: Boolean(process.env.REPORT_GAS),
    currency: 'USD',
    token: 'BNB',
    gasPriceApi: 'https://api.bscscan.com/api?module=proxy&action=eth_gasPrice',
    coinmarketcap: process.env.COIN_MARKETCAP_API_KEY,
  },
  watcher: {
    compile: {
      tasks: ['compile'],
    },
    test: {
      tasks: ['test'],
    },
  },
  abiExporter: {
    path: './data/abi',
    clear: true,
    flat: false,
    // runOnCompile: true,
    pretty: true,
  },
  etherscan: {
    // for hardhat-verify
    apiKey: {
      bsc: process.env.BSCSCAN_KEY!,
      arbitrumOne: process.env.ARBISCAN_KEY!,
      arbitrum: process.env.ARBISCAN_KEY!,
      bscTestnet: process.env.BSCSCAN_TEST_KEY!,
      mainnet: process.env.ETHERSCAN_API_KEY!,
    },
    customChains: [],
  },
  preprocess: {
    eachLine: removeConsoleLog((hre) => !['hardhat', 'local'].includes(hre.network.name)),
  },
}

export default config

task('verify:duet', 'Verifies contract on Etherscan(Duet customized)', async (taskArgs, hre) => {
  const deploymentsPath = path.resolve(__dirname, 'deployments', hre.network.name)
  logger.info('deploymentsPath', deploymentsPath)
  const networkName = hre.network.name === 'bsctest' ? 'bscTestnet' : hre.network.name
  const apiKey = resolveEtherscanApiKey(config.etherscan?.apiKey, networkName)
  const etherscanEndpoint = await getEtherscanEndpoints(
    hre.network.provider,
    networkName,
    chainConfig,
    config.etherscan?.customChains ?? [],
  )
  for (const deploymentFile of fs.readdirSync(deploymentsPath)) {
    if (deploymentFile.startsWith('.') || !deploymentFile.endsWith('.json')) {
      continue
    }
    const deployment = require(path.resolve(deploymentsPath, deploymentFile))
    const address = deployment.address
    if (!address) {
      logger.warn(`No address found in deployment file ${deploymentFile}`)
      continue
    }
    const contract = Object.entries(JSON.parse(deployment.metadata).settings.compilationTarget)[0].join(':')

    logger.info('metadataString', contract)
    if (deployment?.userdoc?.notice === 'Proxy implementing EIP173 for ownership management') {
      logger.warn(
        `EIP173 Proxy found in deployment file ${deploymentFile} (${deployment.address}), skipped, it generated by hardhat-deploy, run "npx hardhat --network ${hre.network.name} etherscan-verify"`,
      )
      continue
    }

    const ret = await axios.get(
      `${_.trim(etherscanEndpoint.urls.apiURL, '/')}?module=contract&action=getabi&address=${address}&apikey=${apiKey}`,
    )

    if (ret.data.message === 'OK') {
      logger.info(`already verified: ${deploymentFile} - ${address}`)
      continue
    }
    logger.info(`verifying ${deploymentFile} - ${address}`)
    const constructorArguments: string[] = deployment.args ?? []
    try {
      await hre.run('verify:verify', {
        address,
        contract,
        constructorArguments,
      })
      logger.info(`verified ${deploymentFile} - ${address}`)
    } catch (e) {
      logger.error(`verify failed: ${deploymentFile} - ${address}`, e)
    }
  }
})
