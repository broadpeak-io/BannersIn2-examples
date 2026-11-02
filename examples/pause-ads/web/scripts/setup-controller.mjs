// Fetches and builds the SIMID controller at the git ref pinned in controller.json,
// into .deps/simid-controller (git-ignored). Safe to run repeatedly.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { repository, ref } = JSON.parse(readFileSync(join(root, 'controller.json'), 'utf8'))
const dir = join(root, '.deps', 'simid-controller')
const stamp = join(dir, '.built-ref')
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' })

if (existsSync(stamp) && readFileSync(stamp, 'utf8').trim() === ref) {
  console.log(`[setup] SIMID controller ${ref} already built`)
  process.exit(0)
}

console.log(`[setup] Fetching SIMID controller ${ref} from ${repository}`)
mkdirSync(dir, { recursive: true })
if (!existsSync(join(dir, '.git'))) {
  run('git', ['init', '-q'], dir)
  run('git', ['remote', 'add', 'origin', repository], dir)
}
run('git', ['fetch', '--depth', '1', 'origin', ref], dir)
run('git', ['checkout', '-q', '--force', 'FETCH_HEAD'], dir)

const controller = join(dir, 'web', 'controller')
run('npm', ['ci'], controller)
run('npm', ['run', 'build'], controller)
writeFileSync(stamp, ref)
console.log('[setup] SIMID controller built')
