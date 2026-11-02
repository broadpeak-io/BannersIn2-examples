import shaka from 'shaka-player/dist/shaka-player.ui.js'
import 'shaka-player/dist/controls.css'
import { SmartLib, StreamingSessionOptions } from '@broadpeak/smartlib'
import '@broadpeak/smartlib-ad'
import '@broadpeak/smartlib-analytics'
import '@broadpeak/smartlib-shaka'
import { GenericSimidControllerApi } from '@broadpeak/smartlib-simid'
import { CreativeData, MediaState, SimidController } from '@broadpeak-tv/simid-controller'
import { PlayerEvent, PlayerListener, PlayerState } from './events'
import './player.css'

export type { PlayerEvent, PlayerListener, PlayerState } from './events'

// Names the SIMID controller in SmartLib's logs
class SimidControllerAdapter extends GenericSimidControllerApi {
  getSimidControllerName(): String {
    return 'PauseAdsExample'
  }
}

// SmartLib rejects with its own error objects rather than Error instances
function describeError(e: any): string {
  if (e?.message) return e.message
  const parts = [e?.description, e?.statusMessage, e?.code !== undefined ? `code ${e.code}` : undefined].filter(Boolean)
  return parts.length ? parts.join(' · ') : String(e)
}

// Self-contained: knows nothing about page layout or branding.
// Mount it in any element (it fills it) and listen to what happens with `on()`.
export class PauseAdsPlayer {

  private readonly root: HTMLElement
  private readonly video: HTMLVideoElement
  private readonly shakaPlayer: any
  private readonly listeners = new Set<PlayerListener>()

  private readonly attached: Promise<void>
  private pauseAdDelayMs = 0
  private creativeParameters: Record<string, string> = {}
  private pauseAdTimer?: number
  private session?: any /* StreamingSession */
  private simidControllerAdapter?: SimidControllerAdapter
  private adDatas = new Map<string, any>()
  private simidControllers = new Map<string, SimidController>()
  private simidIframes = new Map<string, HTMLIFrameElement>()
  private activePauseAdBreak?: any /* AdBreakData */
  private activePauseAdId?: string

  constructor(container: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'bpx-player'
    this.root.setAttribute('data-shaka-player-container', '')
    this.video = document.createElement('video')
    this.video.playsInline = true
    this.root.appendChild(this.video)
    container.appendChild(this.root)

    shaka.polyfill.installAll()
    ;(window as any).shaka = shaka // the SmartLib Shaka adapter looks for the global
    this.shakaPlayer = new shaka.Player()
    this.attached = this.shakaPlayer.attach(this.video) // async: SmartLib needs the media element, so load() waits for it
    new shaka.ui.Overlay(this.shakaPlayer, this.root, this.video)
    this.shakaPlayer.addEventListener('error', (e: any) => this.setState('error', `Shaka error ${e.detail?.code}`))

    // Pausing requests a pause ad; resuming dismisses it
    this.video.addEventListener('pause', () => this.onVideoPaused())
    this.video.addEventListener('play', () => this.onVideoPlay())
    this.video.addEventListener('playing', () => { if (this.session && !this.activePauseAdBreak) this.setState('playing') })

    SmartLib.getInstance().init('', '', '*')
    this.setState('idle')
  }

  /** Delay between the viewer pausing and the pause ad request. Applies from the next pause. */
  public setPauseAdDelay(seconds: number): void {
    this.pauseAdDelayMs = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0
  }

  /**
   * Key-value pairs merged into the creative's `adParameters` JSON before the SIMID controller is initialised
   * (they reach the creative in the `SIMID:Player:init` message). Applies from the next pause ad shown.
   */
  public setCreativeParameters(params: Record<string, string>): void {
    this.creativeParameters = { ...params }
  }

  public on(listener: PlayerListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  public async load(url: string): Promise<void> {
    await this.stop()
    this.setState('loading')
    try {
      this.session = SmartLib.getInstance().createStreamingSession()
      // Trackers are sent explicitly when the creative is shown (see showSimidIframe)
      this.session.setOption(StreamingSessionOptions.AD_TRACKERS_NON_LINEAR_AUTO_SEND, false)
      this.setAdDataListeners(this.session)
      this.setAdEventsListeners(this.session)

      this.simidControllerAdapter = new SimidControllerAdapter()
      this.session.attachPlayer(this.shakaPlayer)
      this.session.attachSimidController(this.simidControllerAdapter)

      const result = await this.session.getURL(url)
      await this.shakaPlayer.load(result.url || url)
      await this.video.play().catch(() => {
        // Autoplay with sound is often blocked: retry muted
        this.video.muted = true
        return this.video.play()
      })
    } catch (e: any) {
      console.error('[pause-ads] load failed', e)
      this.setState('error', describeError(e))
      throw e
    }
  }

  public async stop(): Promise<void> {
    window.clearTimeout(this.pauseAdTimer)
    await this.attached // unloading while still attaching leaves Shaka without a media element
    this.simidControllers.forEach(c => c.reset())
    this.simidControllers.clear()
    this.simidIframes.forEach(i => i.remove())
    this.simidIframes.clear()
    this.session?.stopStreamingSession()
    this.session = undefined
    this.activePauseAdBreak = undefined
    this.activePauseAdId = undefined
    await this.shakaPlayer.unload()
    this.setState('idle')
  }

  public async destroy(): Promise<void> {
    await this.stop()
    await this.shakaPlayer.destroy()
    this.root.remove()
    this.listeners.clear()
  }

  public handleResize(): void {
    const rect = this.rect(this.root)
    this.simidControllers.forEach(c => c.notifyResize(rect, rect, false))
  }

  // ---- events -------------------------------------------------------------

  private log(source: 'player' | 'smartlib' | 'simid', message: string, data?: unknown) {
    this.listeners.forEach(l => l({ type: 'log', source, message, data }))
  }
  private setState(state: PlayerState, detail?: string) {
    this.listeners.forEach(l => l({ type: 'state', state, detail }))
  }

  // ---- SmartLib -----------------------------------------------------------

  private setAdDataListeners(session: any) {
    session.setAdDataListener({
      onAdData: (adData: any) => this.log('smartlib', '`onAdData`', adData),
      onOutOfBandAdData: (adData: any) => this.log('smartlib', '`onOutOfBandAdData`', adData),
    })
  }

  private setAdEventsListeners(session: any) {
    session.activateAdvertising()
    session.setAdEventsListener({
      onPrepareAdBreak: (b: any) => this.log('smartlib', '`onPrepareAdBreak`', b),
      onAdBreakBegin: (b: any) => {
        this.log('smartlib', '`onAdBreakBegin`', b)
        if (b.ooba?.name === 'pause') {
          this.activePauseAdBreak = b
          this.activePauseAdId = b.ads[0]?.adId
        }
      },
      onPrepareAd: (ad: any) => {
        this.log('smartlib', '`onPrepareAd`', ad)
        this.adDatas.set(ad.adId, ad)
        const res = ad.nonLinearIframeResources?.[0]
        if (res) this.loadSimid(ad.adId, res.url, this.injectParameters(res.parameters), res.clickURL, ad.duration ? ad.duration / 1000 : 0)
      },
      onAdBegin: (ad: any) => {
        this.log('smartlib', '`onAdBegin`', ad)
        this.simidControllers.get(ad.adId)?.start()
      },
      onAdSkippable: (ad: any) => this.log('smartlib', '`onAdSkippable`', ad),
      onAdEnd: (ad: any) => {
        this.log('smartlib', '`onAdEnd`', ad)
        this.simidControllers.get(ad.adId)?.reset()
        this.simidControllers.delete(ad.adId)
        this.adDatas.delete(ad.adId)
      },
      onAdBreakEnd: (b: any) => this.log('smartlib', '`onAdBreakEnd`', b),
    })
  }

  // ---- SIMID --------------------------------------------------------------

  private loadSimid(adId: string, creativeUri: string, adParameters: string, clickThruUrl: string, duration: number) {
    // The player container is the creative's initial size
    const rect = this.rect(this.root)
    const creativeData: CreativeData = { adParameters, clickThruUrl }
    const c = new SimidController(rect, rect, creativeUri, creativeData, duration, false)
    c.onGetMediaState = (): MediaState => ({ currentTime: this.video.currentTime })
    c.onAddSimid = (iframe: HTMLIFrameElement) => this.addSimidIframe(adId, iframe)
    c.onShowSimid = (show: boolean) => this.showSimidIframe(adId, show)
    c.onResizeSimid = (d: DOMRect) => this.resizeSimid(adId, d)
    c.onResizePlayer = () => { /* creatives may not resize the player in this example */ }
    c.onPauseMedia = () => { this.video.pause(); return true }
    c.onPlayMedia = () => { this.endPauseAd(); this.video.play(); return true }
    // Navigation: the controller pauses the media, then hands over the landing page. It opens in a new tab.
    c.onOpenPage = (uri: string) => {
      this.log('player', '`onOpenPage`: opening the landing page in a new tab')
      window.open(uri, '_blank', 'noopener')
    }
    c.onComplete = (skipped: boolean) => this.completeAd(adId, skipped)
    c.onError = (messageType: string, errorCode: number, errorMessage: string) => {
      this.log('simid', `Error: \`${messageType}\` code ${errorCode} ${errorMessage}`)
    }
    // Mirror the SIMID traffic to SmartLib (analytics) and to the event log
    c.onMessageReceived = (message: string) => { this.simidControllerAdapter?.onMessageReceived(message); this.logSimid('received', message) }
    c.onMessageSent = (message: string) => { this.simidControllerAdapter?.onMessageSent(message); this.logSimid('sent', message) }
    this.log('simid', `Load creative (controller v${c.getVersion()})`)
    c.load(false)
    this.simidControllers.set(adId, c)
  }

  private logSimid(direction: 'received' | 'sent', raw: string) {
    let label = raw
    try { label = JSON.parse(raw).type ?? raw } catch { /* not JSON */ }
    this.log('simid', `${direction === 'sent' ? '→ creative' : '← creative'}: \`${label}\``, raw)
  }

  private addSimidIframe(adId: string, iframe: HTMLIFrameElement): boolean {
    this.root.appendChild(iframe)
    this.simidIframes.set(adId, iframe)
    return true
  }

  private showSimidIframe(adId: string, show: boolean) {
    const iframe = this.simidIframes.get(adId)
    if (!iframe) return
    if (this.activePauseAdId) iframe.style.zIndex = '20' // the pause ad sits above any other non-linear ad
    iframe.style.display = show ? 'block' : 'none'
    if (show) {
      if (this.activePauseAdBreak) {
        this.setState('pause-ad')
        iframe.focus() // creatives handle keys themselves (e.g. resume, discard): they need the focus
      }
      this.log('smartlib', `\`sendTracker('impression')\` + \`sendTracker('creativeView')\` for ${adId}`)
      this.session?.sendTracker('impression', adId)
      this.session?.sendTracker('creativeView', adId)
    }
  }

  private resizeSimid(adId: string, d: DOMRect): boolean {
    const iframe = this.simidIframes.get(adId)
    if (!iframe) return false
    // Refuse sizes that fall outside the player
    const r = this.rect(this.root)
    if (d.x + d.width > Math.ceil(r.width) || d.y + d.height > Math.ceil(r.height)) return false
    const box = this.root.getBoundingClientRect()
    iframe.style.height = (d.height * 100 / box.height).toFixed(2) + '%'
    iframe.style.width = (d.width * 100 / box.width).toFixed(2) + '%'
    iframe.style.left = (d.x * 100 / box.width).toFixed(2) + '%'
    iframe.style.top = (d.y * 100 / box.height).toFixed(2) + '%'
    return true
  }

  private completeAd(adId: string, skipped: boolean) {
    this.log('simid', `Creative complete (\`skipped\`: ${skipped})`)
    // Skipping a pause ad means the viewer discarded it: close the break but stay paused.
    // (Unlike a linear ad there is nothing to seek over.)
    if (skipped && this.activePauseAdBreak) {
      this.endPauseAd()
      this.setState('paused', 'Ad dismissed')
    }
  }

  // ---- Pause ads lifecycle ------------------------------------------------

  private onVideoPaused() {
    // Seeks, the end of the stream, and pauses caused by the ad itself (e.g. navigation) are not user pauses
    if (this.video.seeking || this.video.ended || !this.session || this.activePauseAdBreak) return
    this.setState('paused')
    window.clearTimeout(this.pauseAdTimer)
    const request = () => {
      this.pauseAdTimer = undefined
      if (!this.session || !this.video.paused) return // resumed or stopped in the meantime
      this.log('smartlib', "`requestOutOfBandAds('pause')`")
      // autoBegin=true: SmartLib begins the break as soon as the ad arrives
      this.session.requestOutOfBandAds('pause', 0, true, {})
    }
    if (this.pauseAdDelayMs > 0) {
      this.log('player', `Video \`pause\` event: requesting the pause ad in ${this.pauseAdDelayMs / 1000}s`)
      this.pauseAdTimer = window.setTimeout(request, this.pauseAdDelayMs)
    } else {
      this.log('player', 'Video `pause` event')
      request()
    }
  }

  private onVideoPlay() {
    window.clearTimeout(this.pauseAdTimer) // resumed before the delay elapsed: no pause ad
    this.pauseAdTimer = undefined
    this.log('player', 'Video `play` event')
    this.endPauseAd()
  }

  private endPauseAd() {
    if (!this.activePauseAdBreak) return
    this.log('player', 'Pause ad dismissed: `endOutOfBandAdBreak`')
    this.session?.endOutOfBandAdBreak(this.activePauseAdBreak.id)
    this.activePauseAdBreak = undefined
    this.activePauseAdId = undefined
  }

  // ---- helpers ------------------------------------------------------------

  // The creative's adParameters is a JSON string: merge the user's key-value pairs into it
  private injectParameters(adParameters: string): string {
    const extra = Object.entries(this.creativeParameters)
    if (extra.length === 0) return adParameters
    let params: Record<string, unknown> = {}
    try {
      params = JSON.parse(adParameters)
    } catch {
      this.log('player', '`adParameters` is not valid JSON: starting from an empty object', adParameters)
    }
    extra.forEach(([name, value]) => {
      this.log('player', `Injecting \`${name}\` = \`${value}\` into \`adParameters\``)
      params[name] = value
    })
    return JSON.stringify(params)
  }

  private rect(el: HTMLElement): DOMRect {
    const r = el.getBoundingClientRect()
    const c = this.root.getBoundingClientRect()
    return new DOMRect(r.x - c.x, r.y - c.y, r.width, r.height)
  }
}
