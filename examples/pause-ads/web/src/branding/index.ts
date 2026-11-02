import type { PlayerEvent, PlayerState } from '../player'
import logoUrl from './assets/logo.svg'
import faviconUrl from './assets/favicon.svg'
import './fonts.css'
import './branding.css'

/** A demo-specific option shown in the settings panel. */
export interface SettingDef {
  id: string
  label: string
  hint?: string
  unit?: string
  min?: number
  step?: number
  value: number
}

/** An editable list of key-value pairs shown in its own panel. */
export interface PairsDef {
  id: string
  title: string
  hint?: string
  initial?: Array<[string, string]>
}

export interface BrandingOptions {
  playbookUrl: string
  debug: boolean
  initialUrl?: string
  settings?: SettingDef[]
  pairs?: PairsDef[]
}

export interface BrandedShell {
  /** Empty element the player mounts into; it fills it. */
  playerSlot: HTMLElement
  handleEvent: (event: PlayerEvent) => void
  onPlay: (cb: (url: string) => void) => void
  onStop: (cb: () => void) => void
  /** Called with the new value whenever a setting is edited (invalid input is reported as the default). */
  onSettingChange: (cb: (id: string, value: number) => void) => void
  /** Called with the complete set of non-empty pairs whenever one is edited, added or removed. */
  onPairsChange: (cb: (id: string, pairs: Record<string, string>) => void) => void
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
    ['Triggered by the viewer', 'The ad is only requested when the viewer pauses.'],
    ['Interactive creative', 'Resume, dismiss, or open a landing page.'],
    ['Measured in the player', 'Impressions and clicks are tracked in the player.'],
  ],
  footer: 'Broadpeak.io · BannersIn2 Pause Ads example',
}

// The pill in the card heading: title, secondary label (shown with Advanced open) and colour
const STATES: Record<PlayerState, { title: string; label: string; banner: 'idle' | 'primary' | 'ad' }> = {
  idle: { title: 'No active playback', label: 'Ready', banner: 'idle' },
  loading: { title: 'Starting the session', label: 'Loading', banner: 'idle' },
  playing: { title: 'Playing', label: 'Content', banner: 'primary' },
  paused: { title: 'Paused', label: 'Waiting for a pause ad', banner: 'idle' },
  'pause-ad': { title: 'Pause ad showing', label: 'Pause ad', banner: 'ad' },
  error: { title: 'Playback error', label: 'Error', banner: 'idle' },
}

const MAX_LOG_ROWS = 300

// Text with `backticked` parts rendered as <code> (built with DOM nodes, so the text is never parsed as HTML)
const renderInline = (el: HTMLElement, text: string) => {
  text.split(/`([^`]+)`/).forEach((part, i) => {
    if (i % 2 === 0) { if (part) el.append(part) } else { const c = document.createElement('code'); c.textContent = part; el.append(c) }
  })
}

// HH:MM:SS.mmm, local time
const timestamp = () => {
  const d = new Date()
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
}

const pairRowMarkup = (key = '', value = '') => `
          <div class="pair-row">
            <input class="pair-key" type="text" placeholder="key" value="${escapeAttr(key)}" autocomplete="off" spellcheck="false" autocapitalize="off" aria-label="Key">
            <input class="pair-value" type="text" placeholder="value" value="${escapeAttr(value)}" autocomplete="off" spellcheck="false" autocapitalize="off" aria-label="Value">
            <button class="small-button pair-remove" type="button" aria-label="Remove">×</button>
          </div>`

const pairsMarkup = (d: PairsDef) => `
        <div class="setting pairs-block" data-pairs="${d.id}">
          <div class="setting-head"><label>${d.title}</label>${d.hint ? `<span class="setting-hint">${d.hint}</span>` : ''}</div>
          <div class="pair-list">${(d.initial ?? []).map(([k, v]) => pairRowMarkup(k, v)).join('')}</div>
          <button class="small-button pair-add" type="button">+ Add</button>
        </div>`

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

const settingsMarkup = (settings: SettingDef[], pairs: PairsDef[]) => settings.length + pairs.length === 0 ? '' : `
      <section class="demo-settings" aria-label="Settings">
        <span class="eyebrow">SETTINGS</span>
        ${settings.length ? `<div class="setting-list">
          ${settings.map(d => `<div class="setting">
            <div class="setting-head"><label for="setting-${d.id}">${d.label}</label>${d.hint ? `<span class="setting-hint">${d.hint}</span>` : ''}</div>
            <div class="setting-control"><input id="setting-${d.id}" data-setting="${d.id}" data-default="${d.value}" type="number" inputmode="decimal" value="${d.value}"${d.min !== undefined ? ` min="${d.min}"` : ''}${d.step !== undefined ? ` step="${d.step}"` : ''}>${d.unit ? `<span class="setting-unit">${d.unit}</span>` : ''}</div>
          </div>`).join('')}
        </div>` : ''}
        ${pairs.map(pairsMarkup).join('')}
      </section>`

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

      ${settingsMarkup(opts.settings ?? [], opts.pairs ?? [])}

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
  let settingCb: (id: string, value: number) => void = () => {}
  let pairsCb: (id: string, pairs: Record<string, string>) => void = () => {}

  root.querySelectorAll<HTMLInputElement>('input[data-setting]').forEach(el => {
    el.addEventListener('input', () => {
      const v = el.valueAsNumber
      const min = el.min === '' ? -Infinity : Number(el.min)
      settingCb(el.dataset.setting!, Number.isFinite(v) && v >= min ? v : Number(el.dataset.default))
    })
  })

  root.querySelectorAll<HTMLElement>('[data-pairs]').forEach(panel => {
    const list = panel.querySelector('.pair-list') as HTMLElement
    const emit = () => {
      const pairs: Record<string, string> = {}
      list.querySelectorAll('.pair-row').forEach(row => {
        const key = (row.querySelector('.pair-key') as HTMLInputElement).value.trim()
        if (key) pairs[key] = (row.querySelector('.pair-value') as HTMLInputElement).value
      })
      pairsCb(panel.dataset.pairs!, pairs)
    }
    panel.addEventListener('input', emit)
    panel.addEventListener('click', e => {
      const target = e.target as HTMLElement
      if (target.closest('.pair-add')) {
        list.insertAdjacentHTML('beforeend', pairRowMarkup())
        ;(list.lastElementChild!.querySelector('.pair-key') as HTMLInputElement).focus()
      } else if (target.closest('.pair-remove')) {
        target.closest('.pair-row')!.remove()
        emit()
      }
    })
  })

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
    row.insertCell().textContent = timestamp()
    row.insertCell().textContent = event.source
    renderInline(row.insertCell(), event.message)
    while (log.rows.length > MAX_LOG_ROWS) log.deleteRow(0)
    log.parentElement!.parentElement!.scrollTop = log.parentElement!.parentElement!.scrollHeight
  }

  return {
    playerSlot: $('slot'),
    handleEvent,
    onPlay: cb => { playCb = cb },
    onStop: cb => { stopCb = cb },
    onSettingChange: cb => { settingCb = cb },
    onPairsChange: cb => { pairsCb = cb },
    play,
  }
}
