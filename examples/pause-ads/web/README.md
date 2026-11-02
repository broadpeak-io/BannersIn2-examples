# Pause ads · Web

Shaka Player 5 + SmartLib + the SIMID controller 0.11.0. Pausing the video requests a pause ad (`requestOutOfBandAds('pause')`); resuming ends the break.

## Run it

1. Configure a service by following the Pause Ads playbook on [developers.broadpeak.io](https://developers.broadpeak.io/docs/introduction). You get a service URL.
2. Start the example (needs Node 20+, git, and access to the `@broadpeak` npm registry configured in `.npmrc`):
   ```
   npm install
   npm start
   ```
   The first start fetches and builds the SIMID controller (see Versions).
3. Provide the URL in any of these ways (first match wins):
   - `?url=<service URL>` in the page address
   - `public/config.local.json`, copied from `public/config.example.json` (git-ignored)
   - the **Stream URL** field in the page

Press play, then pause. The ad appears after the pause ad request returns.

## Query parameters

| Parameter | Effect |
| --- | --- |
| `url` | Service URL to play |
| `chrome=false` | Full-frame player, without the branded page. The branding code is not loaded. |
| `debug=true` | Opens the **Advanced** event log (player, SmartLib and SIMID events) |

## Structure

```
src/
  main.ts        the only file that connects player and branding
  config.ts      playbook link
  player/        branding-free: Shaka + SmartLib + SIMID. Fills whatever element you mount it in
  branding/      masthead, hero, status banner, event log, CSS, logo, fonts
```

**Using the player in your own page:** import `PauseAdsPlayer` from `src/player`, then `new PauseAdsPlayer(element)`, `player.on(listener)` for state and log events, and `player.load(url)`.

**Removing or replacing the branding:** run with `?chrome=false` to try it. To make it permanent, delete `src/branding/` and the `mountBranding` branch in `src/main.ts`. To rebrand rather than remove, edit the CSS variables at the top of `src/branding/branding.css`, the wording in the `TEXT` block of `src/branding/index.ts`, and swap `assets/logo.svg` and `assets/favicon.svg`. The skin is a port of the [SGAI demo](https://bpkio-cs-demos.s3-eu-west-1.amazonaws.com/sgai/index.html) (same logo, fonts, class names and values), and its generic rules are scoped so they cannot affect the player.

## Versions

Everything is pinned inside this folder:

- Shaka Player (5.3.3), SmartLib (6.1.6): `package.json` and `package-lock.json`
- SIMID controller (tag 0.11.0): git ref in `controller.json`. Change it and run `npm run setup`.

## Notes

- The SIMID creative is displayed above the Shaka controls and takes the keyboard focus, so the viewer acts through the creative.
- Seeks, the end of the stream, and pauses caused by the ad itself are not treated as user pauses.

## How the player supports the creative

The pause ad creative (template `base-pause-nav-fullframe-card-v1`: a full-frame image with a Resume card) talks to the player through SIMID. The player handles each interaction as follows:

| Viewer action in the creative | SIMID request | Player behaviour |
| --- | --- | --- |
| Clicks the Resume card (or the resume key) | `requestPlay` | Ends the pause ad break and resumes playback |
| Clicks the discard button (or the skip key) | `requestSkip` | Ends the pause ad break; the video **stays paused** |
| Clicks the image | `clickThru` (player handles) | Pauses if needed and opens the landing page in a **new tab** |
| Resizes the window | | The player sends the creative its new dimensions |

The player never reads the creative's own parameters (image, labels, card width, colours…). Those are set on the service, as described in the playbook.
