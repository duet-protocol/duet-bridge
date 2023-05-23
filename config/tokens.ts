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
    // bDUET#4
    '0xe25e744b905bBFefAED43346764034F536C9D5d5',
    // bDUET#5
    '0x684fEfb526066FAc3A9b63319eEC64F89A167D77',
    // bDUET#6
    '0xC382911459d4F8A2c7dbca957e28b02c8f7e03c9',
    // bDuet#7
    '0xa277350F04f1642D6B93Ea5Ebf951b0D2a9bD756',
    // bDUET#8
    '0x1b9a2a68f44620745c09699adf022cb33ac072f7',
    // bDUET#9
    '0x9c5657692447400ca70a4efa75347f6878612300',
    // bDUET#10
    '0x857eae5b1d7ee68bf7df93f68fad515c721526e6',
    // bDUET#11
    '0x4b8ba4cc10181aed4755c386e5e26f4bdcf3e0f7',
  ],
  originalChain: 'bsc',
  targetChains: ['arbitrum'],
}
