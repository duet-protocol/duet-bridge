import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { useLogger } from '../scripts/utils'
import { HardhatDeployRuntimeEnvironment } from '../types/hardhat-deploy'
import { useNetworkName, advancedDeploy } from '../scripts/deploy-utils'
import { tokensConfig } from '../config/tokens'

import { Names as DuetBridgeNames } from './000_deploy_bridge'
import { getProvider } from '../config/defines'
import { NaivePegToken__factory } from '../typechain'

const logger = useLogger(__filename)

export function pegTokenDeployName(originalAddress: string) {
  return `PegToken-${originalAddress}`
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre as unknown as HardhatDeployRuntimeEnvironment
  const { deploy, get, execute } = deployments

  const bridge = await get(DuetBridgeNames.DuetBridge)
  const networkName = useNetworkName()
  if (networkName === 'bsc') {
    logger.info('Skipping peg token deployment on bsc')
    return
  }
  const { deployer } = await getNamedAccounts()
  const originalProvider = getProvider(tokensConfig.originalChain)
  for (const token of tokensConfig.originalTokens) {
    const originalToken = NaivePegToken__factory.connect(token, originalProvider)
    const originalName = await originalToken.name()
    const originalSymbol = await originalToken.symbol()
    const originalDecimals = await originalToken.decimals()
    const originalTotalSupply = await originalToken.totalSupply()

    await advancedDeploy(
      {
        hre,
        logger,
        proxied: false,
        name: pegTokenDeployName(token),
      },
      async ({ name }) => {
        return await deploy(name, {
          from: deployer,
          contract: 'NaivePegToken',
          skipIfAlreadyDeployed: true,
          log: true,
          // string memory name_,
          // string memory symbol_,
          // uint8 decimals_,
          // uint256 maxSupply_,
          // address originalToken_,
          // address minter_
          args: [
            `${originalName}(DUET-PEG)`,
            originalSymbol,
            originalDecimals,
            originalTotalSupply,
            token,
            bridge.address,
          ],
          autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
        })
      },
    )
  }
}
func.dependencies = [DuetBridgeNames.DuetBridge]
export default func
