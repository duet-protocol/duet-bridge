import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { useLogger } from '../scripts/utils'
import { HardhatDeployRuntimeEnvironment } from '../types/hardhat-deploy'
import { useNetworkName, advancedDeploy } from '../scripts/deploy-utils'
import { tokensConfig } from '../config/tokens'
import celerConfig from '../config/celer'
import { CHAINS } from '../config/defines'

const logger = useLogger(__filename)

export enum Names {
  DuetBridge = 'DuetBridge',
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre as unknown as HardhatDeployRuntimeEnvironment
  const { deploy } = deployments

  const networkName = useNetworkName()
  const messageBus = celerConfig.contracts[networkName].messageBus
  const originalChain = CHAINS[tokensConfig.originalChain]
  const currentChain = CHAINS[networkName]
  if (!originalChain) {
    throw new Error(`Invalid source chain ${tokensConfig.originalChain}`)
  }
  const { deployer } = await getNamedAccounts()
  for (const token of tokensConfig.originalTokens) {
    await advancedDeploy(
      {
        hre,
        logger,
        proxied: true,
        name: Names.DuetBridge,
      },
      async ({ name }) => {
        return await deploy(name, {
          from: deployer,
          contract: 'DuetBridge',
          log: true,
          proxy: {
            execute: {
              init: {
                methodName: 'initialize',
                // address messageBus_, uint64 originalChainId_
                args: [messageBus, originalChain.chainId],
              },
            },
          },
          autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
        })
      },
    )
  }
}
export default func
