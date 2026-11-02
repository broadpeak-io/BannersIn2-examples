# Pause ads · Web

Shaka Player 5 + SmartLib + the SIMID controller 0.11.0. Pausing the video requests a pause ad (`requestOutOfBandAds('pause')`); resuming ends the break.

## Run it

1. Configure a service by following the Pause Ads playbook on [developers.broadpeak.io](https://developers.broadpeak.io/docs/demonstrating-pause-ads). You get a service URL.
2. Start the example (needs Node 20+ and git):
   ```
   npm install
   npm start
   ```
   The first start fetches and builds the SIMID controller (see Versions).
3. Provide the broadpeak.io service URL in any of these ways (first match wins):
   - `?url=<service URL>` in the page address
   - `public/config.local.json`, copied from `public/config.example.json` (git-ignored)
   - the **Stream URL** field in the page

Press play, then pause. The ad appears after the pause ad request returns.

## Query parameters

| Parameter | Effect |
| --- | --- |
| `url` | Service URL to play |
| `chrome=false` | Full-frame player, without the branded page |
| `delay=<seconds>` | Pre-sets the pause ad delay (see Settings) |
| `ap.<name>=<value>` | Pre-fills an ad parameter (see Settings). Repeat for several. Works with `chrome=false` too |
| `debug=true` | Opens the **Advanced** event log (player, SmartLib and SIMID events) |

## Settings

A single **Settings** panel under the URL field holds options specific to this demo:

| Setting | Effect |
| --- | --- |
| Pause ad delay (seconds) | How long the video stays paused before the pause ad is requested. `0` (default) requests it immediately. Resuming before the delay ends cancels the request. Applies from the next pause. |
| Ad parameters | Key-value pairs to inject into the creative at initialisation (see https://developers.broadpeak.io/docs/client-side-implementation#metadata-injection). |

For ad parameters, a key that already exists in the ad is overwritten, values are plain text, empty keys are ignored, and if a key is repeated the last value wins. Each injected pair shows up in the event log.


## Structure

```
src/
  main.ts        the only file that connects player and branding
  config.ts      playbook link
  player/        branding-free: Shaka + SmartLib + SIMID. Fills whatever element you mount it in
  branding/      masthead, hero, status banner, settings panel, event log, CSS, logo, fonts
```

**Removing or replacing the branding:** run with `?chrome=false` to try it. To make it permanent, delete `src/branding/` and the `mountBranding` branch in `src/main.ts`. To rebrand rather than remove, edit the CSS variables at the top of `src/branding/branding.css`, the wording in the `TEXT` block of `src/branding/index.ts`, and swap `assets/logo.svg` and `assets/favicon.svg`. 

## Versions

Everything is pinned inside this folder:
- Shaka Player (5.3.3), SmartLib (6.1.6): `package.json` and `package-lock.json`
- SIMID controller (tag 0.11.0): git ref in `controller.json`. Change it and run `npm run setup`.

## Notes

- The SIMID creative is displayed above the Shaka controls and takes the keyboard focus, so the viewer acts through the creative.
- Seeks, the end of the stream, and pauses caused by the ad itself are not treated as user pauses.

## How the player supports the creative

The pause ad creative (template `base-pause-nav-fullframe-card-v1`: [a full-frame image with a Resume card](https://developers.broadpeak.io/docs/base-pause-nav-fullframe-card-v1)) talks to the player through SIMID. The player handles each interaction as follows:

| Viewer action in the creative | SIMID request | Player behaviour |
| --- | --- | --- |
| Clicks the Resume card (or the resume key) | `requestPlay` | Ends the pause ad break and resumes playback |
| Clicks the discard button (or the skip key) | `requestSkip` | Ends the pause ad break; the video **stays paused** |
| Clicks the image | `clickThru` (player handles) | Pauses if needed and opens the landing page in a **new tab** |
| Resizes the window | | The player sends the creative its new dimensions |

The creative's own parameters (image, labels, card width, colours…) are set on the service, as described in the playbook. Anything added under **Ad parameters** is injected on top.
