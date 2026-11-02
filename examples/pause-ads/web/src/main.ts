import { PauseAdsPlayer } from './player'
import { PLAYBOOK_URL } from './config'

// Resolution order for the stream URL: ?url=  >  public/config.local.json (git-ignored)
async function resolveStreamUrl(params: URLSearchParams): Promise<string | undefined> {
  const fromQuery = params.get('url')
  if (fromQuery) return fromQuery
  try {
    const res = await fetch('config.local.json', { cache: 'no-store' })
    if (res.ok) return (await res.json()).streamUrl || undefined
  } catch { /* no local config */ }
  return undefined
}

async function start() {
  const root = document.getElementById('app') as HTMLElement
  const params = new URLSearchParams(location.search)
  const url = await resolveStreamUrl(params)

  // ?chrome=false: the player alone, filling the page. The branding module is never even loaded.
  // To make this permanent, delete src/branding/ and the `else` branch below.
  if (params.get('chrome') === 'false') {
    document.body.style.cssText = 'margin:0;background:#000'
    root.style.cssText = 'position:fixed;inset:0'
    if (!url) {
      root.innerHTML = `<p style="color:#fff;font:16px system-ui;padding:24px">No stream URL. Pass <code>?url=…</code>, or see the <a style="color:#0bbbef" href="${PLAYBOOK_URL}">playbook</a> to configure a service.</p>`
      return
    }
    const player = new PauseAdsPlayer(root)
    window.addEventListener('resize', () => player.handleResize())
    await player.load(url)
    return
  }

  const { mountBranding } = await import('./branding')
  const shell = mountBranding(root, { playbookUrl: PLAYBOOK_URL, debug: params.get('debug') === 'true', initialUrl: url })
  const player = new PauseAdsPlayer(shell.playerSlot)
  player.on(shell.handleEvent)
  window.addEventListener('resize', () => player.handleResize())
  shell.onPlay(u => player.load(u).catch(() => { /* surfaced through the status banner */ }))
  shell.onStop(() => player.stop())
  if (url) shell.play()
}

start()
