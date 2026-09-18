# chapter-bar

A zero-config, drop-in **chapter progress bar for any `<video>`**. Include one
script and every video on the page gets a segmented chapter timeline with
hover labels, click-to-seek, and playhead-driven progress fill.

- **No build step, no dependencies** — one plain `<script>` tag.
- **Auto-attaches** to every `<video>` on the page, including ones added later.
- **Real chapters** from a WebVTT `chapters` track, or an even-interval
  fallback when you don't provide one.
- **Themeable** with CSS custom properties — no JS required.

![Chapter bar under an HTML5 video: a segmented timeline with a hover label showing the chapter name and start time.](https://raw.githubusercontent.com/assassinave/chapter-bar/main/chapter-bar.jpg)

*Segmented timeline under the native video controls. Watched and skipped
chapters fill in; hovering a segment reveals its name and start time.*

---

## Quick start

```html
<video src="talk.mp4" controls></video>

<!-- the entire integration -->
<script src="chapter-bar.js"></script>
```

That's it. The bar appears under the video. With no chapter data it splits the
video into even segments (8 seconds by default).

Prefer a CDN? Once published to npm, it's served automatically:

```html
<script src="https://cdn.jsdelivr.net/npm/chapter-bar/chapter-bar.js"></script>
```

---

## Add it with a coding agent

Paste this into Claude Code (or any coding agent) from inside your project and
it will wire chapter-bar into your own pages:

```text
Add the chapter-bar library to this project so every <video> gets a segmented
chapter progress bar under it.

What it is: a single dependency-free browser script. It auto-attaches to every
<video> on the page on DOMContentLoaded and watches the DOM with a
MutationObserver, so videos added later are picked up too. There is no build
step, no import, and no init call — loading the script is the whole integration.

Do this:
1. Find the pages or templates in this project that render a <video> element.
2. Load the script once per page, via the CDN:
   <script src="https://cdn.jsdelivr.net/npm/chapter-bar/chapter-bar.js"></script>
   Put it wherever this project normally puts third-party scripts (the shared
   layout/template is usually right). If the project vendors its assets locally
   instead, download chapter-bar.js into the static assets directory and
   reference that path.
3. Do NOT wrap it in a component, hook, module import, or bundler entry unless
   this project has no way to emit a plain script tag. It is a side-effecting
   global script.
4. If any video already has chapter data available, add a WebVTT chapters
   track to it:
     <track kind="chapters" src="chapters.vtt" default>
   The .vtt must be same-origin, or the video needs crossorigin="anonymous"
   and the file needs CORS headers. With no track, the bar falls back to even
   8-second segments — that is fine, do not invent chapter data.
5. Optional, only where it fits this project's design:
   - per video: data-cb-interval="10" (fallback segment seconds),
     data-cb-label-position="top|bottom", data-cb-ignore (skip this video)
   - page-wide defaults on the script tag: data-interval, data-label-position
   - theming via CSS custom properties on .cb-timeline: --cb-blue (progress
     fill), --cb-neutral (track), --cb-base-h, --cb-hover-h. Match the existing
     palette rather than leaving the default blue if this project has brand
     colors.
6. If videos here are rendered into a shadow root or injected by custom JS that
   the observer can't see, call ChapterBar.attach(videoEl) or
   ChapterBar.attachAll(rootEl) after that render. Attachment is idempotent.

Then tell me which files you changed and how to view a page with a video on it.
```

Until the package is published to npm, swap the CDN line in the prompt for a
copy of [`chapter-bar.js`](chapter-bar.js) served from your own project.

---

## Adding real chapters

To get named chapters with meaningful boundaries, give the video a **WebVTT
chapters file** — the same mechanism used for subtitles.

**1. Write a `chapters.vtt`** (copy [`chapters.vtt`](chapters.vtt) and edit it):

```
WEBVTT

00:00:00.000 --> 00:02:14.000
Intro

00:02:14.000 --> 00:06:40.000
Stablecoins

00:06:40.000 --> 00:14:42.000
Card Issuing
```

`WEBVTT` on the first line, a blank line, then one block per chapter:
`start --> end` (as `HH:MM:SS.mmm`) followed by the chapter name.

**2. Reference it from the video** with one line:

```html
<video src="talk.mp4" controls>
  <track kind="chapters" src="chapters.vtt" default>
</video>
```

The script reads the track automatically and uses those names and boundaries.
No chapters file? It quietly falls back to even intervals.

> **Cross-origin note:** like subtitles, a chapters file served from a
> *different* domain than the page needs `crossorigin="anonymous"` on the
> `<video>` and CORS headers on the `.vtt`. Same-origin just works.

---

## Configuration

### Per video — `data-*` attributes

| Attribute | Default | Description |
| --- | --- | --- |
| `data-cb-interval` | `8` | Fallback segment length in seconds (ignored when a chapters track is present). |
| `data-cb-label-position` | `top` | Hover label placement: `top` or `bottom`. |
| `data-cb-ignore` | — | Present = skip this video entirely. |

```html
<video src="talk.mp4" data-cb-interval="10" data-cb-label-position="bottom"></video>
```

### Page-wide defaults — attributes on the `<script>` tag

```html
<script src="chapter-bar.js" data-interval="8" data-label-position="top"></script>
```

### Theming — CSS custom properties (no JS)

Override on `.cb-timeline` (or globally):

```css
.cb-timeline {
  --cb-blue: #e11d48;        /* watched / progress fill */
  --cb-neutral: #d4d7dd;     /* base track color */
  --cb-base-h: 3px;          /* line height at rest */
  --cb-hover-h: 6px;         /* line height on hover */
}
```

---

## Behavior

- **Base:** a thin (3px) segmented track, one neutral color, sized to the video.
- **Hover:** only the segment under the cursor grows (to 6px); a label shows the
  chapter name and the exact second under the cursor.
- **Progress:** a segment fills blue only where the playhead is at or ahead of
  it; the live chapter fills progressively. No latching — scrubbing back clears
  fill from sections you moved off.
- **Seek:** click anywhere on the bar to jump there.

---

## JavaScript API

Auto-attach covers almost everything, but a small API is exposed for edge cases
(e.g. videos rendered inside a shadow root or after custom logic):

```js
ChapterBar.attach(videoElement);   // attach to one <video>
ChapterBar.attachAll(rootElement); // attach to all <video>s under a root
```

Attachment is idempotent — calling it on an already-attached video is a no-op.

---

## Demos

- [`auto-demo.html`](auto-demo.html) — the drop-in script attached to two videos
  (one with a chapters track, one on interval fallback).
- [`index.html`](index.html) — a single-file reference build with a live
  top/bottom label-position toggle.

Run locally (any static server works):

```bash
npm start          # python3 -m http.server 8123
# then open http://localhost:8123/auto-demo.html
```

> The demos reference a local `keynote.mov`, which is **not committed**
> (see `.gitignore`). Drop any video in at that path, or edit the `src`.

---

## License

[MIT](LICENSE)
