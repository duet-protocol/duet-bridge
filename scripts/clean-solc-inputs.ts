import * as path from 'path'
import * as fs from 'fs'
import { useLogger } from './utils'
import { uniq } from 'lodash'
import * as process from 'process'
import { tokensConfig } from '../config/tokens'

const logger = useLogger(__filename)
logger.info('Cleaning unused solc input files...')
for (const network of [tokensConfig.originalChain, ...tokensConfig.targetChains]) {
  let solcInputsInUsed: string[] = []
  const dir = path.resolve(process.cwd(), 'deployments', network)
  logger.info(`Processing dir: ${dir}`)
  if (!fs.existsSync(dir)) continue
  for (const fileName of fs.readdirSync(dir)) {
    if (!fileName.endsWith('.json')) {
      logger.info('[', network, ']', 'Ignored file/dir:', fileName)
      continue
    }
    const deployment = require(path.resolve(dir, fileName))
    solcInputsInUsed.push(deployment.solcInputHash)
    // path.resolve(__dirname, '../', 'deployments', network)
  }
  solcInputsInUsed = uniq(solcInputsInUsed)
  logger.info(network, 'solcInputsInUsed', solcInputsInUsed.join(','))

  for (const solcFile of fs.readdirSync(path.resolve(dir, 'solcInputs'))) {
    const hash = solcFile.substring(0, solcFile.length - '.json'.length)
    if (!solcInputsInUsed.includes(hash)) {
      const solcFullPath = path.resolve(dir, 'solcInputs', solcFile)
      logger.warn('[', network, ']', 'Removing', solcFile)
      fs.rmSync(solcFullPath)
    }
  }
}
