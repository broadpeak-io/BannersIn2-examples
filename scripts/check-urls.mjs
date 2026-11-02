// Fails if a tracked file contains something that looks like a stream URL.
// Accepted URLs are listed in .url-allowlist (one pattern per line, `*` matches anything, `#` starts a comment).
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const IGNORED_FILES = /(^|\/)(package-lock\.json|\.url-allowlist)$|\.(woff2?|png|jpe?g|gif|ico|svg|pdf|zip)$/i
const URL_RE = /https?:\/\/[^\s"'`<>)\]}\\,]+/g
const STREAM_HINTS = [
  /\.(m3u8|mpd|isml?|f4m)(\?|#|$)/i,
  /\/(manifest|playlist|master|stream)(\.[a-z0-9]+)?(\?|\/|$)/i,
  /[?&](ooba-tag|bpkio_serviceid)=/i,
  /^https?:\/\/[^/]*(cloudfront\.net|broadpeak\.io|broadpeak\.tv)(\/|$)/i,
]
// Documentation hosts that are never streams
const SAFE = /^https?:\/\/(developers\.broadpeak\.io|github\.com|www\.w3\.org)(\/|$)/i

const globToRegExp = g => new RegExp('^' + g.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$')
const allow = readFileSync('.url-allowlist', 'utf8').split('\n')
  .map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(globToRegExp)

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(f => f && !IGNORED_FILES.test(f))
const violations = []
for (const file of files) {
  let text
  try { text = readFileSync(file, 'utf8') } catch { continue }
  text.split('\n').forEach((line, i) => {
    for (const url of line.match(URL_RE) ?? []) {
      if (SAFE.test(url) || allow.some(r => r.test(url))) continue
      if (STREAM_HINTS.some(r => r.test(url))) violations.push(`${file}:${i + 1}  ${url}`)
    }
  })
}

if (violations.length) {
  console.error('Possible stream URLs found. Examples must never contain them.\n' +
    'Remove them, or if a URL is legitimate add a pattern to .url-allowlist.\n')
  violations.forEach(v => console.error('  ' + v))
  process.exit(1)
}
console.log(`url-guard: ${files.length} files checked, no stream URLs found`)
