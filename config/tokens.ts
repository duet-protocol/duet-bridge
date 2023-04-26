import { NETWORK_NAMES } from './defines'

interface DuetConfig {
  originalTokens: string[]
  originalChain: NETWORK_NAMES
  targetChains: NETWORK_NAMES[]
}

export const tokensConfig: DuetConfig = {
  originalTokens: [
    // DUET
    '0x95EE03e1e2C5c4877f9A298F1C0D6c98698FAB7B',
    // bDuet#7
    // '0xa277350F04f1642D6B93Ea5Ebf951b0D2a9bD756',
  ],
  originalChain: 'bsc',
  targetChains: ['arbitrum'],
}
