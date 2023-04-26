import type { NetworkUserConfig } from 'hardhat/src/types/config'
import { ethers } from 'ethers'

const CHAINS_ = {
  bsc: {
    // url: 'https://bsc-dataseed.binance.org/',
    url: 'https://1rpc.io/bnb',
    chainId: 56,
    accounts: [process.env.KEY_BSC_MAINNET!],
    // for hardhat-eploy
    verify: {
      etherscan: {
        apiKey: process.env.BSCSCAN_KEY,
      },
    },
  },
  arbitrum: {
    // url: 'https://arbitrum.api.onfinality.io/public',
    url: 'https://1rpc.io/arb',
    chainId: 42161,
    accounts: [process.env.KEY_BSC_MAINNET!],
    // for hardhat-eploy
    verify: {
      etherscan: {
        apiKey: process.env.ARBISCAN_KEY,
      },
    },
  },
}
export type NETWORK_NAMES = keyof typeof CHAINS_
export const CHAINS: Record<
  NETWORK_NAMES,
  NetworkUserConfig & {
    url: string
    chainId: number
  }
> = CHAINS_

const providers: Partial<Record<NETWORK_NAMES, ethers.Wallet>> = {}

export function getProvider(network: NETWORK_NAMES) {
  if (!providers[network]) {
    const chainInfo = CHAINS_[network]
    const provider = new ethers.providers.JsonRpcProvider(CHAINS_[network].url)
    const signer = new ethers.Wallet(chainInfo.accounts[0], provider)
    providers[network] = signer
  }
  return providers[network]!
}
