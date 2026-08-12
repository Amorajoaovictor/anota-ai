import { spawn } from 'node:child_process'

const childOptions = { stdio: 'inherit' }
const children = [
  spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--experimental-https'], childOptions),
  spawn(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', '--env-file=.env.local', 'src/server/jobs/worker-cli.ts'],
    childOptions,
  ),
]

let stopping = false
function stop(signal = 'SIGTERM') {
  if (stopping) return
  stopping = true
  children.forEach((child) => {
    if (!child.killed) child.kill(signal)
  })
}

process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))

children.forEach((child) => {
  child.on('error', (error) => {
    console.error(error)
    stop()
    process.exitCode = 1
  })
  child.on('exit', (code) => {
    if (stopping) return
    stop()
    process.exitCode = code ?? 1
  })
})
