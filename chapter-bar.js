/*!
 * chapter-bar.js — drop-in chapter progress bar for any <video>.
 *
 * Usage: just include the script. It auto-attaches to every <video> on the
 * page (and any added later). No init call required.
 *
 *   <script src="chapter-bar.js"></script>
 *
 * Per-video config via data-attributes:
 *   <video data-cb-interval="10" data-cb-label-position="bottom"></video>
 *   <video data-cb-ignore>            <!-- opt this video out -->
 *
 * Page-wide defaults via attributes on the <script> tag:
 *   <script src="chapter-bar.js" data-interval="8" data-label-position="top"></script>
 *
 * Theme with CSS (no JS needed) by overriding custom properties:
 *   .cb-timeline { --cb-blue: #e11d48; }
 */
(function () {
  'use strict';

  // Page-wide defaults, read from the <script> tag that loaded us.
  var script = document.currentScript;
  var DEFAULTS = {
    interval: numAttr(script, 'data-interval', 8),
    labelPosition: (script && script.getAttribute('data-label-position')) || 'top',
  };

  injectStyles();

  /* ---------------------------------------------------------------- attach */

  function attach(video) {
    if (!(video instanceof HTMLVideoElement)) return;
    if (video.dataset.cbAttached === '1') return;      // idempotent
    if (video.hasAttribute('data-cb-ignore')) return;  // opt-out
    video.dataset.cbAttached = '1';

    var opts = {
      interval: Math.max(1, numAttr(video, 'data-cb-interval', DEFAULTS.interval)),
      labelPosition: video.getAttribute('data-cb-label-position') || DEFAULTS.labelPosition,
    };

    // Build the UI and insert it right after the video (never moves the
    // video node itself, so playback is never interrupted/reloaded).
    var timeline = el('div', 'cb-timeline');
    var track = el('div', 'cb-track');
    var tooltip = el('div', 'cb-tooltip');
    timeline.appendChild(track);
    timeline.appendChild(tooltip);
    if (opts.labelPosition === 'bottom') tooltip.classList.add('cb-place-bottom');
    video.insertAdjacentElement('afterend', timeline);

    var chapters = [];

    // Prefer real chapters from a <track kind="chapters"> if one is present
    // and has loaded; otherwise fall back to even intervals.
    function buildChapters(duration) {
      if (!isFinite(duration) || duration <= 0) return;
      var fromTrack = readChapterTrack(duration);
      chapters = fromTrack || generateIntervals(duration);
      renderSegments();
      updateProgress();
    }

    function generateIntervals(duration) {
      var list = [];
      var count = Math.max(1, Math.ceil(duration / opts.interval));
      for (var i = 0; i < count; i++) {
        list.push(makeChapter(i, 'Chapter ' + (i + 1),
          i * opts.interval, Math.min((i + 1) * opts.interval, duration)));
      }
      return list;
    }

    // Pull cues out of a chapters text track. Returns null if there's no
    // usable chapters track yet (so the caller can fall back / retry).
    function readChapterTrack(duration) {
      var tracks = video.textTracks;
      if (!tracks) return null;
      for (var i = 0; i < tracks.length; i++) {
        var tt = tracks[i];
        if (tt.kind !== 'chapters') continue;
        if (tt.mode === 'disabled') tt.mode = 'hidden';   // needed for cues to parse
        var cues = tt.cues;
        if (!cues || !cues.length) return null;           // not parsed yet -> retry later
        var list = [];
        for (var c = 0; c < cues.length; c++) {
          var cue = cues[c];
          var end = isFinite(cue.endTime) ? cue.endTime : duration;
          list.push(makeChapter(c, (cue.text || 'Chapter ' + (c + 1)).trim(),
            cue.startTime, Math.min(end, duration)));
        }
        return list.length ? list : null;
      }
      return null;
    }

    function makeChapter(index, name, start, end) {
      return { index: index, name: name, start: start, end: end, el: null, fill: null };
    }

    // A chapters track loads asynchronously; rebuild once its cues arrive.
    (function watchChapterTracks() {
      var tracks = video.textTracks;
      if (!tracks) return;
      for (var i = 0; i < tracks.length; i++) {
        if (tracks[i].kind !== 'chapters') continue;
        if (tracks[i].mode === 'disabled') tracks[i].mode = 'hidden';
        tracks[i].addEventListener('load', function () {
          if (video.duration) buildChapters(video.duration);
        });
      }
      if (tracks.addEventListener) {
        tracks.addEventListener('addtrack', function (e) {
          if (e.track && e.track.kind === 'chapters') {
            e.track.mode = 'hidden';
            e.track.addEventListener('load', function () {
              if (video.duration) buildChapters(video.duration);
            });
          }
        });
      }
    })();

    function renderSegments() {
      track.textContent = '';
      chapters.forEach(function (ch) {
        var seg = el('div', 'cb-seg');
        seg.style.flexGrow = (ch.end - ch.start).toFixed(3);
        seg.style.flexBasis = '0';
        var fill = el('div', 'cb-fill');
        seg.appendChild(fill);
        ch.el = seg;
        ch.fill = fill;
        track.appendChild(seg);
      });
    }

    function chapterAt(t) {
      for (var i = 0; i < chapters.length; i++) {
        if (t >= chapters[i].start && t < chapters[i].end) return chapters[i];
      }
      return chapters[chapters.length - 1];
    }

    // Blue only where the playhead is at/ahead of the section. No latching.
    function updateProgress() {
      if (!chapters.length) return;
      var t = video.currentTime;
      var active = chapterAt(t);
      chapters.forEach(function (ch) {
        var frac = (t - ch.start) / (ch.end - ch.start);
        ch.fill.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%';
        ch.el.classList.toggle('cb-active', ch === active && t > ch.start && t < ch.end);
      });
    }

    function timeAtClientX(clientX) {
      var rect = track.getBoundingClientRect();
      var ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return ratio * (video.duration || 0);
    }

    // ---- interactions ----
    timeline.addEventListener('mousemove', function (e) {
      if (!chapters.length) return;
      var hoverTime = timeAtClientX(e.clientX);      // exact second under cursor
      var ch = chapterAt(hoverTime);
      var rect = timeline.getBoundingClientRect();
      var x = Math.max(40, Math.min(rect.width - 40, e.clientX - rect.left));
      tooltip.style.left = x + 'px';
      tooltip.innerHTML = ch.name + '<span class="cb-time">' + fmt(hoverTime) + '</span>';
      tooltip.classList.add('cb-show');
      chapters.forEach(function (c) { c.el.classList.toggle('cb-hovered', c === ch); });
    });

    timeline.addEventListener('mouseleave', function () {
      tooltip.classList.remove('cb-show');
      chapters.forEach(function (c) { c.el.classList.remove('cb-hovered'); });
    });

    timeline.addEventListener('click', function (e) {
      if (!video.duration) return;
      video.currentTime = timeAtClientX(e.clientX);
      updateProgress();
    });

    // ---- keep the bar the same width as the video box ----
    function syncWidth() { timeline.style.width = video.offsetWidth + 'px'; }
    syncWidth();
    if (window.ResizeObserver) new ResizeObserver(syncWidth).observe(video);
    window.addEventListener('resize', syncWidth);

    // ---- wiring ----
    video.addEventListener('loadedmetadata', function () { buildChapters(video.duration); });
    video.addEventListener('durationchange', function () { buildChapters(video.duration); });
    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('seeking', updateProgress);
    video.addEventListener('seeked', updateProgress);
    if (video.readyState >= 1 && video.duration) buildChapters(video.duration);
  }

  /* --------------------------------------------------------------- runtime */

  function attachAll(root) {
    (root || document).querySelectorAll('video').forEach(attach);
  }

  function boot() {
    attachAll(document);
    // Catch videos added to the DOM after load (SPAs, lazy content).
    if (window.MutationObserver) {
      new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          m.addedNodes.forEach(function (node) {
            if (node.nodeType !== 1) return;
            if (node.tagName === 'VIDEO') attach(node);
            else if (node.querySelectorAll) attachAll(node);
          });
        });
      }).observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Small public API for manual/edge cases.
  window.ChapterBar = { attach: attach, attachAll: attachAll };

  /* --------------------------------------------------------------- helpers */

  function el(tag, cls) { var n = document.createElement(tag); n.className = cls; return n; }
  function numAttr(node, name, dflt) {
    if (!node) return dflt;
    var v = parseFloat(node.getAttribute(name));
    return isFinite(v) ? v : dflt;
  }
  function fmt(t) {
    var m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  function injectStyles() {
    if (document.getElementById('cb-styles')) return;
    var css = [
      '.cb-timeline{--cb-neutral:#d4d7dd;--cb-neutral-hover:#c4c8d0;--cb-blue:#2f6bff;--cb-blue-soft:#6f97ff;--cb-base-h:3px;--cb-hover-h:6px;--cb-gap:4px;',
      'position:relative;box-sizing:border-box;max-width:100%;margin:10px 0;padding:10px 0;cursor:pointer;}',
      '.cb-track{display:flex;align-items:center;gap:var(--cb-gap);height:var(--cb-hover-h);width:100%;}',
      '.cb-seg{position:relative;height:var(--cb-base-h);border-radius:999px;background:var(--cb-neutral);overflow:hidden;',
      'transition:height 120ms ease,background-color 120ms ease;}',
      '.cb-seg.cb-hovered{height:var(--cb-hover-h);background:var(--cb-neutral-hover);}',
      '.cb-fill{position:absolute;inset:0 auto 0 0;width:0%;background:var(--cb-blue);border-radius:999px;transition:width 90ms linear;}',
      '.cb-seg.cb-active .cb-fill{background:linear-gradient(90deg,var(--cb-blue) 0%,var(--cb-blue) 82%,var(--cb-blue-soft) 100%);}',
      '.cb-tooltip{position:absolute;bottom:calc(100% - 2px);left:0;transform:translateX(-50%);padding:5px 10px;',
      'background:#1a1d23;color:#fff;font:600 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
      'white-space:nowrap;border-radius:6px;pointer-events:none;opacity:0;transition:opacity 100ms ease;z-index:5;}',
      '.cb-tooltip::after{content:"";position:absolute;top:100%;left:50%;transform:translateX(-50%);',
      'border:4px solid transparent;border-top-color:#1a1d23;}',
      '.cb-tooltip.cb-show{opacity:1;}',
      '.cb-tooltip .cb-time{color:#9aa2b1;font-weight:500;margin-left:6px;}',
      '.cb-tooltip.cb-place-bottom{bottom:auto;top:calc(100% - 2px);}',
      '.cb-tooltip.cb-place-bottom::after{top:auto;bottom:100%;border-top-color:transparent;border-bottom-color:#1a1d23;}',
    ].join('');
    var style = document.createElement('style');
    style.id = 'cb-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }
})();
