/* VoX-DoN-3 host controller.
 *
 * One page, one button. The landing page (index.html) keeps its own interface
 * and its blue Jailbreak button; SlopKit itself is never navigated to as a
 * page of its own. It is loaded in a transparent same-origin layer on top of
 * the landing page, so the user never leaves this interface and never sees
 * SlopKit's own screen - only the stage lines it prints, mirrored into this
 * page's log box.
 *
 * Flow:
 *   press Jailbreak -> the button disappears, the log box opens, the layer
 *   loads -> the real stage lines (POOPS-BOOT, OFFSETS-READY, STAGE0..5,
 *   STAGE5-DONE) are copied into #vox-log as SlopKit writes them -> when the
 *   chain is done and the ELF loader owns port 9021, the latest Payload
 *   Manager tile is tapped for the user, exactly the tap a person would make
 *   by hand, through SlopKit's own sendPayloadInPlace().
 *
 * SlopKit is not patched here: nothing in slopkit/ is modified to make this
 * work, this file only reads the layer and clicks one button in it.
 */
(function () {
  "use strict";

  /* SlopKit's production query, byte for byte. Its exactQuery() check compares
   * the whole string, so this must not be edited. It is also the exact URL
   * listed in cache.appcache, which is what makes the offline run work. */
  var SLOPKIT_URL =
    "slopkit/poops.html?go=1&auto=1&production=1&trigger=netcontrol&attempts=8" +
    "&only=ps0_preflight,ps1_prepare,ps3_stage0,ps4_validate,ps5_stage1,ps6_stage2," +
    "ps8_stage3,ps9_stage4,ps10_stage5&log=debug&payload=1&v=final";

  var PAYLOAD_NAME = "pldmgr_v0.5.2.elf";
  var PAYLOAD_LABEL = "Payload Manager";

  var POLL_MS = 250;
  var CHAIN_WAIT_MS = 900000;   /* the chain can retry 8 times before giving up */
  var MENU_WAIT_MS = 120000;    /* loader up to 20s, then the menu */
  var TILE_WAIT_MS = 10000;     /* the menu builds its buttons synchronously */
  var CLICK_RETRY_MS = 1500;
  var MAX_CLICKS = 10;

  var DONE_RE = /ELF LOADER READY|SUCCESS --|STAGE5-DONE|POOPS-COMPLETE/;

  function el(id) { return document.getElementById(id); }

  /* The log box is rendered from two buffers: whatever SlopKit has printed in
   * the layer, and this page's own [VOX-HOST] lines. Mirroring therefore never
   * eats a host line, and a host line never lands in the middle of the screen
   * SlopKit is writing. */
  var screenText = "";
  var hostLines = [];

  function render() {
    var box = el("vox-log");
    if (!box) return;
    var head = screenText.replace(/\n+$/, "");
    box.textContent = (head ? head + "\n" : "") + hostLines.join("\n");
    box.scrollTop = box.scrollHeight;
  }

  function say(text) {
    hostLines.push(text);
    render();
  }

  function status(text, cls) {
    var box = el("vox-status");
    if (!box) return;
    box.textContent = text || "";
    box.className = cls || "";
  }

  function frameDoc() {
    var frame = el("vox-slopkit-frame");
    if (!frame) return null;
    try {
      if (!frame.contentWindow || !frame.contentDocument) return null;
      return frame.contentDocument;
    } catch (e) {
      return null;      /* different origin: never touch it */
    }
  }

  function mirrorScreen(doc) {
    var scr = doc.getElementById("scr");
    if (!scr) return;
    var text = scr.textContent || "";
    if (text === screenText) return;
    screenText = text;
    render();
  }

  function stageText(doc) {
    var stage = doc.getElementById("stage");
    return stage ? (stage.textContent || "") : "";
  }

  /* stage() writes the class SlopKit itself sets: "bad" means the chain gave
   * up, "ok" means it is through. The stage line is the only honest signal -
   * the log also holds failed attempts that were retried, so it must not be
   * used to decide that the run is over. */
  function stageClass(doc) {
    var stage = doc.getElementById("stage");
    return stage ? (stage.className || "") : "";
  }

  function menuIsOpen(doc) {
    var view = doc.getElementById("payloads-view");
    return !!(view && view.classList.contains("on"));
  }

  function findTile(doc) {
    var tiles = doc.getElementsByClassName("payloadTile");
    for (var i = 0; i < tiles.length; ++i) {
      if (tiles[i].getAttribute("data-name") === PAYLOAD_NAME) return tiles[i];
    }
    return null;
  }

  function tileState(tile) {
    return tile ? tile.getAttribute("data-state") : null;
  }

  function tapTile(tile) {
    try {
      if (tile && tile.click) { tile.click(); return true; }
    } catch (e) { }
    return false;
  }

  /* ---- phase 2: hand the finished chain the latest Payload Manager ---- */
  var payloadPhase = { started: false, clicks: 0, last: 0, tile: null, from: 0 };

  function drivePayload(doc) {
    if (!payloadPhase.started) {
      payloadPhase.started = true;
      payloadPhase.from = Date.now();
      status("Loading " + PAYLOAD_LABEL + " ...", "busy");
    }

    if (!payloadPhase.tile) {
      payloadPhase.tile = findTile(doc);
      if (!payloadPhase.tile) {
        if (Date.now() - payloadPhase.from > TILE_WAIT_MS) {
          status(PAYLOAD_LABEL + " is not on the payload menu", "bad");
          return "stop";
        }
        return "wait";                 /* menu still being built */
      }
    }

    var tile = payloadPhase.tile;
    var state = tileState(tile);
    var now = Date.now();

    if (state === "sent") {
      say("[" + now % 100000 + "  [VOX-HOST] " + PAYLOAD_LABEL + " SENT]");
      status(PAYLOAD_LABEL + " sent - the window opens on the console", "good");
      return "stop";
    }

    if (state === "failed") {
      if (now - payloadPhase.last < CLICK_RETRY_MS) return "wait";
      if (payloadPhase.clicks >= MAX_CLICKS) {
        status(PAYLOAD_LABEL + " was refused by the loader", "bad");
        return "stop";
      }
      payloadPhase.last = now;
      payloadPhase.clicks++;
      tapTile(tile);
      return "wait";
    }

    if (state === "sending") return "wait";

    if (now - payloadPhase.last < CLICK_RETRY_MS) return "wait";
    if (payloadPhase.clicks >= MAX_CLICKS) {
      status(PAYLOAD_LABEL + " did not go through", "bad");
      return "stop";
    }
    payloadPhase.last = now;
    payloadPhase.clicks++;
    say("[" + (now % 100000) + "  [VOX-HOST] TAPPING " + PAYLOAD_LABEL
      + " (" + PAYLOAD_NAME + ")");
    tapTile(tile);
    return "wait";
  }

  /* ---- phase 1: run the chain and mirror its stage lines ---- */
  function watch() {
    var doc = frameDoc();
    if (!doc) return;

    mirrorScreen(doc);

    var stage = stageText(doc);
    if (stageClass(doc) === "bad") {
      status(stage || "the chain failed", "bad");
      return;
    }

    if (menuIsOpen(doc) || DONE_RE.test(stage)) {
      if (drivePayload(doc) === "stop") return;
      setTimeout(watch, POLL_MS);
      return;
    }

    if (stage && stage !== "idle") status(stage, "");
    setTimeout(watch, POLL_MS);
  }

  function start() {
    var button = el("run-jb");
    var box = el("vox-logbox");
    if (!button) return;

    var menuDeadline = Date.now() + MENU_WAIT_MS;

    button.addEventListener("click", function (event) {
      if (event && event.preventDefault) event.preventDefault();
      if (window.__voxStarted) return;
      window.__voxStarted = true;

      button.style.display = "none";     /* the button goes away */
      if (box) box.hidden = false;

      say("[" + (Date.now() % 100000) + "  [VOX-HOST] STARTING SLOPKIT...");
      status("starting", "busy");

      var frame = document.createElement("iframe");
      frame.id = "vox-slopkit-frame";
      frame.setAttribute("title", "slopkit");
      frame.src = SLOPKIT_URL;
      document.body.appendChild(frame);

      var chainDeadline = Date.now() + CHAIN_WAIT_MS;
      (function wait() {
        var doc = frameDoc();
        if (!doc) {
          if (Date.now() > chainDeadline) {
            status("the jailbreak page did not load", "bad");
            return;
          }
          setTimeout(wait, POLL_MS);
          return;
        }
        mirrorScreen(doc);
        var stage = stageText(doc);
        if (menuIsOpen(doc) || DONE_RE.test(stage)) {
          if (Date.now() > menuDeadline + CHAIN_WAIT_MS) {
            status("the payload menu never opened", "bad");
            return;
          }
          watch();
          return;
        }
        if (stageClass(doc) === "bad") {
          status(stage || "the chain failed", "bad");
          return;
        }
        if (stage && stage !== "idle") status(stage, "");
        if (Date.now() > chainDeadline) {
          status("the jailbreak did not finish in time", "bad");
          return;
        }
        setTimeout(wait, POLL_MS);
      })();
    });
  }

  function boot() {
    if (window.__voxHostStarted) return;
    window.__voxHostStarted = true;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start);
      return;
    }
    start();
  }

  boot();
})();