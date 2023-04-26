require('dotenv').config()
const keythereum = require('keythereum')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const https = require('https')
const os = require('os')

async function run(command, args) {
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

function random(length) {
  let result = ''
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const charactersLength = characters.length
  let counter = 0
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
    counter += 1
  }
  return result
}

if (!process.env.EXECUTOR_PRIVATE_KEY) {
  console.error('EXECUTOR_PRIVATE_KEY not set')
  process.exit(1)
}
const keystorePassword = random(32)
const keyStorePath = path.join(__dirname, 'config', 'executor-key.json')
const dk = keythereum.create({ keyBytes: 32, ivBytes: 16 })
const keystore = keythereum.dump(keystorePassword, process.env.EXECUTOR_PRIVATE_KEY, dk.salt, dk.iv)

// process.
fs.writeFileSync(keyStorePath, JSON.stringify(keystore, null, 2))
if (!process.env.DB_CONN_URL) {
  console.error('DB_CONN_URL not set')
  process.exit(1)
}

const executorConfigPath = path.join(__dirname, 'config', 'executor.toml')
const executorConfig = fs.readFileSync(path.join(__dirname, 'config', 'executor.tpl.toml'), 'utf8').toString()

fs.writeFileSync(
  executorConfigPath,
  executorConfig
    .replace('<your-signer-keystore>', keyStorePath)
    .replace('<your-signer-keystore-pass>', keystorePassword)
    .replace('<postgresql-connect-url>', process.env.DB_CONN_URL),
)

async function downloadExecutor() {
  const platform = os.platform()
  const cpuArch = os.arch()
  const tarPath = path.resolve(path.join(__dirname, 'executor.tar.gz'))
  const file = fs.createWriteStream(tarPath)
  const url = `https://github.com/celer-network/sgn-v2-networks/raw/main/binaries/executor-v1.1.6-${platform}-${cpuArch}.tar.gz`
  console.log('Downloading Executor from', url)
  await new Promise((resolve, reject) => {
    const download = (url_) => {
      const req = https.get(url_, function (response) {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          console.log('redirecting to', response.headers.location)
          return download(response.headers.location)
        }
        response.pipe(file)
        file.on('finish', () => {
          file.close()
          console.log('Executor download Completed')
          resolve()
        })
      })
      req.on('error', (err) => {
        fs.rmSync(tarPath)
        reject(err)
      })
    }
    download(url)
  })
  await run('tar', ['zxvf', path.join(__dirname, 'executor.tar.gz')])
  fs.rmSync(path.join(__dirname, 'executor.tar.gz'))
}

async function main() {
  if (!fs.existsSync('./executor')) {
    await downloadExecutor()
  }
  await run('./executor', ['start', '--home', '.'])
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
