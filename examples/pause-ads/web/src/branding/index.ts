import type { PlayerEvent, PlayerState } from '../player'
import logoUrl from './assets/logo.svg'
import faviconUrl from './assets/favicon.svg'
import './fonts.css'
import './branding.css'

export interface BrandingOptions {
  playbookUrl: string
  debug: boolean
  initialUrl?: string
}

export interface BrandedShell {
  /** Empty element the player mounts into; it fills it. */
  playerSlot: HTMLElement
  handleEvent: (event: PlayerEvent) => void
  onPlay: (cb: (url: string) => void) => void
  onStop: (cb: () => void) => void
  /** Plays whatever URL is currently in the input field. */
  play: () => void
}

// Copy: edit here to change the wording of the page
const TEXT = {
  title: 'Pause Ads · Broadpeak.io BannersIn2',
  masthead: 'BANNERSIN2 · PAUSE ADS',
  heading: 'Pause the video. Show a relevant ad.',
  lead: 'When the viewer presses pause, the player asks the ad server for a pause ad and shows it as an interactive overlay on the paused frame.',
  benefits: [
    ['Triggered by the viewer', 'The ad appears only when the viewer pauses.'],
    ['Interactive creative', 'Resume, dismiss, or open a landing page.'],
    ['Measured in the player', 'Impressions and clicks are tracked in the player.'],
  ],
  footer: 'Broadpeak.io · BannersIn2 Pause Ads example',
}

// banner = the pill, status = the small text on the right
const STATES: Record<PlayerState, { title: string; label: string; banner: 'idle' | 'primary' | 'ad'; status: string; statusState: string }> = {
  idle: { title: 'No active playback', label: 'Ready', banner: 'idle', status: 'Ready', statusState: 'idle' },
  loading: { title: 'Starting the session', label: 'Loading', banner: 'idle', status: 'Loading', statusState: 'loading' },
  playing: { title: 'Playing', label: 'Content', banner: 'primary', status: 'Playing', statusState: 'playing' },
  paused: { title: 'Paused', label: 'Waiting for a pause ad', banner: 'idle', status: 'Paused', statusState: 'idle' },
  'pause-ad': { title: 'Pause ad showing', label: 'Pause ad', banner: 'ad', status: 'Playing', statusState: 'playing' },
  error: { title: 'Playback error', label: 'Error', banner: 'idle', status: 'Error', statusState: 'error' },
}

const MAX_LOG_ROWS = 300

export function mountBranding(root: HTMLElement, opts: BrandingOptions): BrandedShell {
  document.title = TEXT.title
  const icon = document.createElement('link')
  icon.rel = 'icon'
  icon.type = 'image/svg+xml'
  icon.href = faviconUrl
  document.head.appendChild(icon)

  root.innerHTML = `
  <div class="bp-shell">
    <header class="masthead">
      <a class="brand" href="./" aria-label="Broadpeak.io ${TEXT.masthead} home"><img src="${logoUrl}" alt="Broadpeak.io"><span class="brand-divider"></span><span>${TEXT.masthead}</span></a>
    </header>
    <main>
      <section class="hero">
        <h1>${TEXT.heading}</h1>
        <p class="lead">${TEXT.lead}</p>
        <ul class="benefits">
          ${TEXT.benefits.map(([title, text]) => `<li><strong>${title}</strong><span>${text}</span></li>`).join('')}
        </ul>
      </section>

      <section class="player-card demo-player" aria-label="Video">
        <div class="card-heading">
          <span class="ad-playback-banner" data-role="banner" role="status" aria-live="polite" data-state="idle"><span class="ad-playing-dot" aria-hidden="true"></span><strong data-role="banner-title"></strong><span data-role="banner-label"></span></span>
          <span class="status-group"><span class="status" data-role="status" role="status"></span></span>
        </div>
        <div class="video-stage">
          <div class="bp-player-slot" data-role="slot"></div>
          <div id="video-placeholder" data-role="placeholder"><span class="play-symbol" aria-hidden="true">▶</span><h2>Ready when you are</h2><p>Paste a stream URL below and press Play.</p><p>No URL yet? <a href="${opts.playbookUrl}" target="_blank" rel="noopener">Configure a service with the playbook</a>.</p></div>
        </div>
      </section>

      <form class="demo-input" onsubmit="return false">
        <label for="playback-url">Stream URL</label>
        <div class="demo-input-row">
          <textarea id="playback-url" rows="1" placeholder="https://…" autocomplete="off" spellcheck="false" autocapitalize="off"></textarea>
          <button class="primary" type="button" data-role="play"><span aria-hidden="true">▶</span> Play</button>
          <button class="secondary" type="button" data-role="stop"><span aria-hidden="true">■</span> Stop</button>
        </div>
        <p class="demo-hint" role="alert" data-role="hint" hidden></p>
      </form>

      <div class="advanced-bar"><button class="advanced-toggle" type="button" data-role="advanced-toggle" aria-expanded="false" aria-controls="advanced">Advanced <svg class="chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button></div>

      <div id="advanced" class="advanced" data-role="advanced" hidden>
        <section class="player-card" aria-label="Event log">
          <div class="diagnostic-heading"><div><span class="eyebrow">THIS SESSION</span><h2>Event log</h2></div><button class="small-button" type="button" data-role="clear">Clear</button></div>
          <div class="tracking-table"><table><thead><tr><th>Time</th><th>Source</th><th>Event</th></tr></thead><tbody data-role="log"></tbody></table></div>
          <p class="empty-hint">Player, SmartLib and SIMID events appear here.</p>
        </section>
      </div>

      <footer><span>${TEXT.footer}</span><span aria-label="Page version">${__EXAMPLE_VERSIONS__}</span></footer>
    </main>
  </div>`

  const $ = <T extends HTMLElement>(role: string) => root.querySelector(`[data-role=${role}]`) as T
  const shell = root.querySelector('.bp-shell') as HTMLElement
  const input = root.querySelector('#playback-url') as HTMLTextAreaElement
  const hint = $('hint')
  const log = $<HTMLTableSectionElement>('log')
  const advanced = $('advanced')
  const toggle = $('advanced-toggle')
  let playCb: (url: string) => void = () => {}
  let stopCb: () => void = () => {}

  const autosize = () => { input.style.height = 'auto'; input.style.height = `${input.scrollHeight + 2}px` }
  input.addEventListener('input', autosize)
  if (opts.initialUrl) { input.value = opts.initialUrl; autosize() }

  const setAdvanced = (open: boolean) => {
    advanced.hidden = !open
    toggle.setAttribute('aria-expanded', String(open))
    shell.classList.toggle('advanced-open', open)
  }
  toggle.onclick = () => setAdvanced(advanced.hidden)
  setAdvanced(opts.debug)

  // Until a stream is loaded the player (and its controls) stays hidden behind the placeholder
  const showPlaceholder = (show: boolean) => { $('placeholder').hidden = !show; $('slot').style.visibility = show ? 'hidden' : 'visible' }
  const showHint = (text?: string) => { hint.textContent = text ?? ''; hint.hidden = !text }
  const setState = (state: PlayerState, detail?: string) => {
    const s = STATES[state]
    $('banner').dataset.state = s.banner
    $('banner-title').textContent = s.title
    $('banner-label').textContent = detail && state !== 'error' ? detail : s.label
    $('status').textContent = s.status
    $('status').dataset.state = s.statusState
    showHint(state === 'error' ? detail || 'Playback failed' : undefined)
  }
  setState('idle')
  showPlaceholder(true)

  const play = () => {
    const url = input.value.trim()
    if (!url) { input.focus(); return }
    showPlaceholder(false)
    playCb(url)
  }
  $('play').onclick = play
  $('stop').onclick = () => { stopCb(); showPlaceholder(true) }
  $('clear').onclick = () => { log.innerHTML = '' }

  const handleEvent = (event: PlayerEvent) => {
    if (event.type === 'state') { setState(event.state, event.detail); return }
    const row = log.insertRow()
    row.insertCell().textContent = new Date().toLocaleTimeString()
    row.insertCell().textContent = event.source
    row.insertCell().textContent = event.message
    while (log.rows.length > MAX_LOG_ROWS) log.deleteRow(0)
    log.parentElement!.parentElement!.scrollTop = log.parentElement!.parentElement!.scrollHeight
  }

  return {
    playerSlot: $('slot'),
    handleEvent,
    onPlay: cb => { playCb = cb },
    onStop: cb => { stopCb = cb },
    play,
  }
}
