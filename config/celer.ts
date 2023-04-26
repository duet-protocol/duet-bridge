import { NETWORK_NAMES } from './defines'

export interface CelerExecutorConfig {
  service: Array<{
    signer_keystore: string
    signer_passphrase: string
    contracts: Array<{
      chain_id: number
      address: string
      allow_sender_groups: string[]
    }>

    contract_sender_groups: Array<{
      name: string
      allow: Array<{
        chain_id: number
        address: string
      }>
    }>
  }>
  sgnd: {
    sgn_grpc: string
    gateway_grpc: string
  }
  db: {
    url: string
  }
}

export interface CelerExecutorCbridgeOptions {
  // polling interval
  blkinterval: number
  // how many blocks confirmations are required
  blkdelay: number
  // max number of blocks per poll request
  maxblkdelta: number
  // on some EVM chains the gas estimation can be off. the below fields
  // are added to make up for the inconsistancies.
  addgasgwei: number
  // multiply gas limit by this ratio
  addgasestimateratio: number
}

export interface CelerExecutorCbridgeConfig {
  multichain: Array<
    {
      chainID: number
      name: string
      gateway: string
      cbridge: string
      msgbus: string
    } & CelerExecutorCbridgeOptions
  >
}

interface CelerConfig {
  rpc: {
    sgn: string
    gateway: string
    celerScan: string
    celerScanApi: string
  }
  contracts: Record<
    NETWORK_NAMES,
    {
      cBridge: string
      messageBus: string
    }
  >
  executor: Record<NETWORK_NAMES, CelerExecutorCbridgeOptions>
}

const celerConfig: CelerConfig = {
  rpc: {
    sgn: 'cbridge-prod2.celer.app:9094',
    gateway: 'cbridge-prod2.celer.app:9094',
    celerScan: 'https://celerscan.com',
    // @see https://im-docs.celer.network/developer/development-guide/query-im-tx-status
    celerScanApi: 'https://api.celerscan.com',
  },
  contracts: {
    bsc: {
      cBridge: '0xdd90E5E87A2081Dcf0391920868eBc2FFB81a1aF',
      messageBus: '0x95714818fdd7a5454f73da9c777b3ee6ebaeea6b',
    },
    arbitrum: {
      cBridge: '0x1619DE6B6B20eD217a58d00f37B9d47C7663feca',
      messageBus: '0x3ad9d0648cdaa2426331e894e980d0a5ed16257f',
    },
  },
  executor: {
    bsc: {
      blkinterval: 20,
      blkdelay: 20,
      maxblkdelta: 200,
      addgasgwei: 0,
      addgasestimateratio: 0.2,
    },
    arbitrum: {
      blkinterval: 20,
      blkdelay: 20,
      maxblkdelta: 200,
      addgasgwei: 0,
      addgasestimateratio: 0.2,
    },
  },
} as const

export default celerConfig
