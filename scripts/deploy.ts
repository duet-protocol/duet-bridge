import * as dotenv from 'dotenv'

dotenv.config()
import chalk from 'chalk'
import { tokensConfig } from '../config/tokens'

import { spawn } from 'child_process'
import { CHAINS, getProvider, NETWORK_NAMES } from '../config/defines'
import { REPO_BASE_PATH, useLogger } from './utils'
import path from 'path'
import fs from 'fs'
import { GlobSync } from 'glob'
import { pegTokenDeployName } from '../deploy/001_peg_tokens'
import { DuetBridge__factory, NaivePegToken__factory } from '../typechain'
import celerConfig, { CelerExecutorCbridgeConfig, CelerExecutorConfig } from '../config/celer'
import * as toml from '@ltd/j-toml'
import { Section } from '@ltd/j-toml'
import { isArray, isObjectLike } from 'lodash'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { BigNumber } from 'ethers'

const logger = useLogger(__filename)

async function run(command: string, args?: ReadonlyArray<string>) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args)
    child.stdout.on('data', (data) => {
      console.log(data.toString())
    })

    child.stderr.on('data', (data) => {
      console.error(data.toString())
    })
    child.on('close', (code) => {
      if (code !== 0) {
        reject(code)
        return
      }
      resolve(code)
    })
  })
}

function checkConfig() {
  if (!tokensConfig.originalChain) {
    throw new Error('originalChain is not set')
  }
  if (!tokensConfig.targetChains || tokensConfig.targetChains.length === 0) {
    throw new Error('targetChains is not set')
  }
  if (tokensConfig.targetChains.includes(tokensConfig.originalChain)) {
    throw new Error('targetChains should not include originalChain')
  }
  if (!tokensConfig.originalTokens || tokensConfig.originalTokens.length === 0) {
    throw new Error('originalTokens is not set')
  }
}

async function deploy() {
  logger.log(chalk.cyan(`Deploying originalChain(${tokensConfig.originalChain})...`))
  await run('npx', ['hardhat', 'deploy', '--network', tokensConfig.originalChain])
  let i = 0
  const targetChainCount = tokensConfig.targetChains.length
  for (const targetChain of tokensConfig.targetChains) {
    logger.log(chalk.cyan(`Deploying targetChain (${targetChain}, ${++i}/${targetChainCount})...`))
    await run('npx', ['hardhat', 'deploy', '--network', targetChain])
  }
  await run('ts-node', [path.join(REPO_BASE_PATH, 'scripts', 'clean-solc-inputs.ts')])
}

async function verify() {
  const targetChainCount = tokensConfig.targetChains.length
  let i = 0
  for (const chain of [tokensConfig.originalChain, ...tokensConfig.targetChains]) {
    // npx hardhat --network bsc verify:duet
    logger.log(chalk.cyan(`Verifying contracts on chain ${chain} (${chain}, ${++i}/${targetChainCount + 1})...`))
    await run('npx', ['hardhat', '--network', chain, 'verify:duet'])
  }
}

function getBridgeInfo(chain: NETWORK_NAMES): {
  address: string
} {
  return require(path.join(REPO_BASE_PATH, 'deployments', chain, 'DuetBridge.json'))
}

function getChainContracts() {
  const chainContracts: Record<number, string> = {}
  for (const chain of [tokensConfig.originalChain, ...tokensConfig.targetChains]) {
    const chainInfo = CHAINS[chain]
    if (!chainInfo || !chainInfo.chainId) {
      throw new Error(`Invalid chain ${chain}`)
    }
    const bridgeInfo = getBridgeInfo(chain)
    chainContracts[chainInfo.chainId] = bridgeInfo.address
  }
  return chainContracts
}

async function syncChains() {
  const chainContracts = getChainContracts()
  logger.info('chainContracts', chainContracts)
  for (const chain of [tokensConfig.originalChain, ...tokensConfig.targetChains]) {
    const currentChainId = CHAINS[chain].chainId!
    const duetBridge = DuetBridge__factory.connect(chainContracts[currentChainId!], getProvider(chain))
    for (const [chainId, contract] of Object.entries(chainContracts)) {
      if ((await duetBridge.chainContractMapping(chainId)) === contract) {
        logger.log(chalk.cyan(`[${chain}]`, 'exists'), 'addChainContract', contract, `(${chainId})`)
        continue
      }
      logger.log(chalk.cyan(`[${chain}]`), 'addChainContract...', contract, `(${chainId})`)
      await duetBridge.addChainContract(chainId, contract)
      logger.log(chalk.green(`[${chain}]`), 'added chain contract', contract, `(${chainId})`)
    }
  }
}

async function syncTokens() {
  const originalChainProvider = getProvider(tokensConfig.originalChain)
  const originalBridgeInfo = getBridgeInfo(tokensConfig.originalChain)

  const originalDuetBridge = DuetBridge__factory.connect(originalBridgeInfo.address, originalChainProvider)

  for (const token of tokensConfig.originalTokens) {
    const originalTokenContract = NaivePegToken__factory.connect(token, originalChainProvider)
    const originalTokenName = await originalTokenContract.name()
    const originalDecimals = await originalTokenContract.decimals()
    if ((await originalDuetBridge.tokenMapping(token)) == token) {
      logger.info(chalk.cyan('[skipped]'), 'existed token:', `${originalTokenName}(${token})`)
      continue
    }
    logger.log(chalk.cyan(`[${tokensConfig.originalChain}]`), 'add original token...', `${originalTokenName}(${token})`)
    // min transfer amount 1
    await originalDuetBridge.addToken(token, token, Math.pow(10, originalDecimals).toString())
    logger.log(
      chalk.green(`[${tokensConfig.originalChain}]`),
      'added original token, ',
      `${originalTokenName}(${token})`,
    )
  }
  for (const chain of tokensConfig.targetChains) {
    const provider = getProvider(chain)
    const bridgeInfo = getBridgeInfo(chain)

    fs.readdirSync(path.join(REPO_BASE_PATH, 'deployments', chain))
    const glob = new GlobSync(path.join(REPO_BASE_PATH, 'deployments', chain, `${pegTokenDeployName('*')}.json`))
    for (const pegTokenDeployFile of glob.found) {
      const pegTokenDeployment = require(pegTokenDeployFile)
      if (pegTokenDeployment.args.length != 6) {
        throw new Error(`pegTokenDeployment.args.length != 6, file: ${pegTokenDeployFile}`)
      }
      const originalToken = pegTokenDeployment.args[4]

      if (!pegTokenDeployFile.includes(originalToken)) {
        throw new Error('Invalid originalToken')
      }
      const originalContract = NaivePegToken__factory.connect(originalToken, originalChainProvider)
      const pegTokenContract = NaivePegToken__factory.connect(pegTokenDeployment.address, provider)

      const originalTokenName = await originalContract.name()
      const originalDecimals = await originalContract.decimals()
      const pegTokenName = await pegTokenContract.name()
      const pegDecimals = await pegTokenContract.decimals()
      if (originalDecimals != pegDecimals) {
        throw new Error(`originalDecimals(${originalDecimals}) != pegDecimals(${pegDecimals})`)
      }
      const currentChainBridge = DuetBridge__factory.connect(bridgeInfo.address, provider)
      if ((await currentChainBridge.tokenMapping(originalToken)) == pegTokenDeployment.address) {
        logger.info(
          chalk.cyan('[skipped]'),
          'existed token:',
          `${originalTokenName}(${originalToken})`,
          '-->',
          chalk.cyan(`[${chain}]`),
          `${pegTokenName}(${pegTokenDeployment.address})`,
        )
        continue
      }
      logger.log(
        'addToken...',
        `${originalTokenName}(${originalToken})`,
        '-->',
        chalk.cyan(`[${chain}]`),
        `${pegTokenName}(${pegTokenDeployment.address})`,
      )
      // min transfer amount 1
      await currentChainBridge.addToken(
        originalToken,
        pegTokenDeployment.address,
        Math.pow(10, originalDecimals).toString(),
      )
      logger.info(
        chalk.green('[ADDED]'),
        `${originalTokenName}(${originalToken})`,
        '-->',
        chalk.cyan(`[${chain}]`),
        `${pegTokenName}(${pegTokenDeployment.address})`,
      )
    }
  }
}

function objectArrayToSectionObject(input: any): Readonly<Record<string, string>> {
  if (isArray(input)) {
    // @ts-ignore
    return input.map(objectArrayToSectionObject)
  }
  if (isObjectLike(input)) {
    for (const [key, value] of Object.entries(input)) {
      input[key] = objectArrayToSectionObject(value)
    }
    return Section(input)
  }
  return input as unknown as Readonly<Record<string, string>>
}

async function genExecConfigs() {
  const executorConfig: CelerExecutorConfig = {
    service: [
      {
        signer_keystore: '<your-signer-keystore>',
        signer_passphrase: '<your-signer-keystore-pass>',
        contracts: [],
        contract_sender_groups: [],
      },
    ],
    sgnd: {
      sgn_grpc: celerConfig.rpc.sgn,
      gateway_grpc: celerConfig.rpc.gateway,
    },
    db: {
      url: '<postgresql-connect-url>',
    },
  }
  const chainContracts = getChainContracts()
  const groupName = 'DuetBridge'
  executorConfig.service[0].contract_sender_groups.push({
    name: groupName,
    allow: Object.entries(chainContracts).map(([chainId, contract]) => {
      return {
        chain_id: parseInt(chainId),
        address: contract,
      }
    }),
  })
  for (const [chainId, contract] of Object.entries(chainContracts)) {
    executorConfig.service[0].contracts.push({
      chain_id: parseInt(chainId),
      address: contract,
      allow_sender_groups: [groupName],
    })
  }
  const executorCbridgeConfig: CelerExecutorCbridgeConfig = {
    multichain: [],
  }
  for (const chain of [tokensConfig.originalChain, ...tokensConfig.targetChains]) {
    const chainInfo = CHAINS[chain]
    executorCbridgeConfig.multichain.push({
      chainID: chainInfo.chainId,
      name: chain,
      gateway: chainInfo.url,
      cbridge: celerConfig.contracts[chain].cBridge,
      msgbus: celerConfig.contracts[chain].messageBus,
      ...celerConfig.executor[chain as NETWORK_NAMES],
    })
  }
  const executorTplPath = path.join(REPO_BASE_PATH, 'executor', 'config', 'executor.toml.tpl')
  fs.writeFileSync(
    executorTplPath,
    (
      toml.stringify(objectArrayToSectionObject(executorConfig), {
        indent: 2,
        integer: Number.MAX_SAFE_INTEGER,
        newlineAround: 'section',
      }) as unknown as string[]
    )
      .join('\n')
      .trim(),
  )
  logger.info('executor.toml.tpl generated to', chalk.cyan(executorTplPath.replace(`${REPO_BASE_PATH}/`, '')))
  const cbridgePath = path.join(REPO_BASE_PATH, 'executor', 'config', 'cbridge.toml')
  fs.writeFileSync(
    cbridgePath,
    (
      toml.stringify(objectArrayToSectionObject(executorCbridgeConfig), {
        indent: 2,
        integer: Number.MAX_SAFE_INTEGER,
        newlineAround: 'section',
      }) as unknown as string[]
    )
      .join('\n')
      .trim(),
  )
  logger.info('cbridge.toml generated to', chalk.cyan(cbridgePath.replace(`${REPO_BASE_PATH}/`, '')))
}

async function pauseAll() {
  for (const chain of [tokensConfig.originalChain, ...tokensConfig.targetChains]) {
    const provider = getProvider(chain)
    const bridgeInfo = getBridgeInfo(chain)
    logger.info(chalk.cyan(`[${chain}]`), 'pause...')
    const currentChainBridge = DuetBridge__factory.connect(bridgeInfo.address, provider)
    await currentChainBridge.pause()
    logger.info(chalk.green(`[${chain}]`), 'paused')
  }
}

async function unpauseAll() {
  for (const chain of [tokensConfig.originalChain, ...tokensConfig.targetChains]) {
    const provider = getProvider(chain)
    const bridgeInfo = getBridgeInfo(chain)
    logger.info(chalk.cyan(`[${chain}]`), 'unpause...')
    const currentChainBridge = DuetBridge__factory.connect(bridgeInfo.address, provider)
    await currentChainBridge.unpause()
    logger.info(chalk.green(`[${chain}]`), 'unpaused')
  }
}

async function fullyDeploy() {
  checkConfig()
  await deploy()
  await verify()
  await syncTokens()
  await syncChains()
  await genExecConfigs()
}

async function testTransferX(chain: NETWORK_NAMES, destChain: NETWORK_NAMES) {
  const provider = getProvider(chain)
  const bridgeInfo = getBridgeInfo(chain)
  const transferAmount = BigNumber.from(10).pow(18).mul(10)
  const bridgeContract = DuetBridge__factory.connect(bridgeInfo.address, provider)
  const testOriginalToken = tokensConfig.originalTokens[0]
  const tokenContract =
    chain === tokensConfig.originalChain
      ? NaivePegToken__factory.connect(testOriginalToken, provider)
      : NaivePegToken__factory.connect(await bridgeContract.tokenMapping(testOriginalToken), provider)
  const tokenBalance = await tokenContract.balanceOf(provider.address)
  if (tokenBalance.lt(transferAmount)) {
    throw new Error(`[${chain}] token balance is not enough`)
  }
  const allowance = await tokenContract.allowance(provider.address, bridgeContract.address)
  if (allowance.lt(transferAmount)) {
    await tokenContract.approve(bridgeContract.address, transferAmount.sub(allowance))
  }
  const ret = await bridgeContract.transferX(
    tokensConfig.originalTokens[0],
    transferAmount,
    CHAINS[destChain].chainId,
    {
      value: await bridgeContract.getTransferXFee(provider.address, transferAmount),
    },
  )
  logger.info(
    chalk.green(`[${chain}]`),
    'transferX from',
    chalk.cyan(chain),
    'to',
    chalk.cyan(destChain),
    'with amount:',
    transferAmount.div(BigNumber.from(10).pow(18)).toString(),
    'tx:',
    ret.hash,
  )
}

yargs(hideBin(process.argv))
  .scriptName('ts-node ./scripts/deploy')
  .version(require('../package.json').version)
  .command(
    'all',
    'fully deploy, includes: deploy, verify, sync-tokens, sync-chains, gen-exec-configs',
    () => {},
    async (argv) => {
      await fullyDeploy()
    },
  )
  .command(
    'deploy',
    'deploy contracts',
    () => {},
    async (argv) => {
      checkConfig()
      await deploy()
    },
  )
  .command(
    'verify',
    'verify contracts',
    () => {},
    async (argv) => {
      checkConfig()
      await verify()
    },
  )
  .command(
    'sync-tokens',
    'Sync tokens',
    () => {},
    async (argv) => {
      checkConfig()
      await syncTokens()
    },
  )
  .command(
    'sync-chains',
    'Sync chains',
    () => {},
    async (argv) => {
      checkConfig()
      await syncChains()
    },
  )
  .command(
    'gen-exec-configs',
    'Generate celer executor configs',
    () => {},
    async (argv) => {
      checkConfig()
      await genExecConfigs()
    },
  )
  .command(
    'pause',
    'Pause all bridges',
    () => {},
    async (argv) => {
      checkConfig()
      await pauseAll()
    },
  )
  .command(
    'unpause',
    'Unpause all bridges',
    () => {},
    async (argv) => {
      checkConfig()
      await unpauseAll()
    },
  )
  .command(
    'test-transferx <chain> <dest-chain>',
    'test transferX from chain to dest-chain',
    (yarg) => {
      return yarg.requiresArg('chain').requiresArg('dest-chain')
    },
    async (argv) => {
      checkConfig()
      await testTransferX(argv.chain as NETWORK_NAMES, argv.destChain as NETWORK_NAMES)
    },
  )
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging',
  })
  .demandCommand()
  .help()
  .parse()
