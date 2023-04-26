import { Address, DeploymentsExtension } from 'hardhat-deploy/types'
import { EthereumProvider } from 'hardhat/types'

export interface HardhatDeployRuntimeEnvironment {
  deployments: DeploymentsExtension
  getNamedAccounts: () => Promise<{
    [name: string]: Address
  }>
  getUnnamedAccounts: () => Promise<string[]>
  companionNetworks: {
    [name: string]: {
      deployments: DeploymentsExtension
      getNamedAccounts: () => Promise<{
        [name: string]: Address
      }>
      getUnnamedAccounts: () => Promise<string[]>
      getChainId(): Promise<string>
      provider: EthereumProvider
    }
  }

  getChainId(): Promise<string>
}

export interface HardhatDeployNetwork {
  live: boolean
  saveDeployments: boolean
  tags: Record<string, boolean>
  deploy: string[]
  companionNetworks: { [name: string]: string }
  verify?: { etherscan?: { apiKey?: string; apiUrl?: string } }
  zksync?: boolean
  autoImpersonate?: boolean
}
