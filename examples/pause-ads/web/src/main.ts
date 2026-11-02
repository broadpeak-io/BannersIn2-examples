import { PauseAdsPlayer } from './player'
import { PLAYBOOK_URL } from './config'
import type { PairsDef, SettingDef } from './branding'

// ?delay=<seconds> pre-sets the pause ad delay
const PAUSE_DELAY_SETTING = 'pauseAdDelay'

// ?ap.<name>=<value> pre-sets ad parameters (injected into the creative's adParameters JSON)
const AD_PARAMS = 'adParams'
const readAdParams = (params: URLSearchParams): Array<[string, string]> =>
  [...params.entries()].filter(([k]) => k.startsWith('ap.') && k.length > 3).map(([k, v]) => [k.slice(3), v])

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
  const delay = Number(params.get('delay')) || 0

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
    player.setPauseAdDelay(delay)
    player.setCreativeParameters(Object.fromEntries(readAdParams(params)))
    window.addEventListener('resize', () => player.handleResize())
    await player.load(url)
    return
  }

  const settings: SettingDef[] = [{
    id: PAUSE_DELAY_SETTING,
    label: 'Pause ad delay',
    unit: 'seconds',
    min: 0,
    step: 0.5,
    value: delay,
    hint: 'How long the video stays paused before the pause ad is requested. 0 requests it immediately.',
  }]
  const pairs: PairsDef[] = [{
    id: AD_PARAMS,
    title: 'Ad parameters',
    hint: 'Key-value pairs to inject into the creative at initialisation.',
    initial: readAdParams(params),
  }]
  const { mountBranding } = await import('./branding')
  const shell = mountBranding(root, { playbookUrl: PLAYBOOK_URL, debug: params.get('debug') === 'true', initialUrl: url, settings, pairs })
  const player = new PauseAdsPlayer(shell.playerSlot)
  player.setPauseAdDelay(delay)
  player.setCreativeParameters(Object.fromEntries(readAdParams(params)))
  shell.onSettingChange((id, value) => { if (id === PAUSE_DELAY_SETTING) player.setPauseAdDelay(value) })
  shell.onPairsChange((id, p) => { if (id === AD_PARAMS) player.setCreativeParameters(p) })
  player.on(shell.handleEvent)
  window.addEventListener('resize', () => player.handleResize())
  shell.onPlay(u => player.load(u).catch(() => { /* surfaced through the status banner */ }))
  shell.onStop(() => player.stop())
  if (url) shell.play()
}

start()
