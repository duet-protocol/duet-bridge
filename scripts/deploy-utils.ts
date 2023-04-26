import { ethers, getNamedAccounts, network } from 'hardhat'
import { HardhatDeployRuntimeEnvironment } from '../types/hardhat-deploy'
import { HardhatRuntimeEnvironment } from 'hardhat/types/runtime'
import { useLogger } from './utils'
import { resolve } from 'path'
import { mkdir, writeFile } from 'fs/promises'
import { DeployResult } from 'hardhat-deploy/types'
import { NETWORK_NAMES } from '../config/defines'

export function useNetworkName() {
  return network.name as NETWORK_NAMES
}

const logger = useLogger(__filename)

export async function writeExtraMeta(name: string, meta?: { class?: string; instance?: string } | string) {
  const directory = resolve(__dirname, '..', 'deployments', useNetworkName(), '.extraMeta')
  await mkdir(directory, { recursive: true })

  const className = typeof meta === 'string' ? meta : meta?.class || name
  const instanceName = typeof meta === 'string' ? meta : meta?.instance || className
  await writeFile(
    resolve(directory, name + '.json'),
    JSON.stringify({ class: className, instance: instanceName }, null, 2),
  )
}

export async function isProxiedContractDeployable(
  hre: HardhatRuntimeEnvironment | HardhatDeployRuntimeEnvironment,
  name: string,
) {
  const { deployments } = hre as unknown as HardhatDeployRuntimeEnvironment
  const { all, get } = deployments
  const { deployer } = await getNamedAccounts()

  if (!Object.keys(await all()).includes(name)) return true
  // bytes32(uint256(keccak256('eip1967.proxy.admin')) - 1) see: https://eips.ethereum.org/EIPS/eip-1967
  const proxyAdminSlot = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103'
  const adminSlotValue = await ethers.provider.getStorageAt((await get(name)).address, proxyAdminSlot)
  // not proxy or not deployed yet
  if (adminSlotValue === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    return true
  }

  const owner = `0x${adminSlotValue.substring(26).toLowerCase()}`
  return deployer.toLowerCase() === owner
}

export async function advancedDeploy(
  options: {
    hre: HardhatRuntimeEnvironment
    name: string
    logger: ReturnType<typeof useLogger>
    proxied?: boolean
    class?: string
    instance?: string
    dryRun?: boolean
  },
  fn: (ctx: typeof options) => Promise<DeployResult>,
): Promise<DeployResult> {
  const {
    deployments: { get },
  } = options.hre as unknown as HardhatDeployRuntimeEnvironment
  const deploy =
    (options.dryRun || process.env.DEPLOY_DRY_RUN === '1') !== true
      ? fn
      : async () => {
          options.logger.info(`[DRY] [DEPLOYING]`)
          return { ...(await get(options.name)), newlyDeployed: false }
        }
  const complete = async () => {
    const result = await deploy(options)
    options.logger.info(`${options.name}`, result.address)
    await writeExtraMeta(options.name, { class: options.class, instance: options.instance })
    return result
  }

  if (process.env.DEPLOY_NO_PROXY_OWNER_VALIDATION === '1' || !options.proxied) return await complete()
  if (!(await isProxiedContractDeployable(options.hre, options.name))) {
    options.logger.warn(`${options.name} is a proxied contract, but you are not allowed to deploy.`)
    return { ...(await get(options.name)), newlyDeployed: false }
  }
  options.logger.info(`${options.name} is a proxied contract, and you are allowed to deploy`)
  return await complete()
}
