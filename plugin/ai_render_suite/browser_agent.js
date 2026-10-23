// Runs inside the chat site (Gemini, ChatGPT, Google Flow) in the plugin's
// browser window. SketchUp injects it with execute_script before each
// command. It fills the chat box with the image and prompt; the user presses
// Send, then "Bring result back" sends the image through sketchup.airsBrowser.
// These sites change their pages often; the selectors below are the part
// that may need updating.
(function () {
  if (window.__airsAgent) return;

  var SITES = {
    gemini: {
      box: ['rich-textarea .ql-editor', 'div[contenteditable="true"][role="textbox"]', 'div[contenteditable="true"]'],
    },
    chatgpt: {
      box: ['#prompt-textarea', 'div[contenteditable="true"]', 'textarea'],
    },
    flow: {
      box: ['textarea', 'div[contenteditable="true"]'],
    },
  };

  var job = null; // { site, before: Set of image srcs, timer }

  function post(msg) {
    try {
      window.sketchup.airsBrowser(JSON.stringify(msg));
    } catch (e) {
      /* not inside SketchUp */
    }
  }

  function status(text, kind) {
    post({ type: 'status', text: text, kind: kind || 'info' });
    bar(text);
  }

  function first(list) {
    for (var i = 0; i < list.length; i++) {
      var els = document.querySelectorAll(list[i]);
      for (var j = 0; j < els.length; j++) if (els[j].offsetParent !== null) return els[j];
    }
    return null;
  }

  function wait(test, ms, step) {
    return new Promise(function (resolve) {
      var t0 = Date.now();
      (function loop() {
        var v = test();
        if (v || Date.now() - t0 > ms) return resolve(v || null);
        setTimeout(loop, step || 300);
      })();
    });
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function toFile(img, i) {
    var bin = atob(img.data);
    var bytes = new Uint8Array(bin.length);
    for (var k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    var ext = /jpeg/.test(img.mimeType) ? 'jpg' : 'png';
    return new File([bytes], 'sketchup_view_' + (i + 1) + '.' + ext, { type: img.mimeType });
  }

  function transfer(files) {
    var dt = new DataTransfer();
    files.forEach(function (f) { dt.items.add(f); });
    return dt;
  }

  // Images on the page that look like attachments or results.
  function pictures() {
    return Array.prototype.slice.call(document.images).filter(function (im) {
      return im.naturalWidth >= 64 && im.offsetParent !== null;
    });
  }

  async function attach(box, files) {
    var count = pictures().length;
    var grew = function () { return pictures().length > count; };
    // 1. paste, the way a user would with Ctrl+V
    try {
      box.focus();
      box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer(files), bubbles: true, cancelable: true }));
      if (await wait(grew, 2500)) return true;
    } catch (e) { /* try the next way */ }
    // 2. drop onto the chat box
    try {
      var dt = transfer(files);
      ['dragenter', 'dragover', 'drop'].forEach(function (name) {
        box.dispatchEvent(new DragEvent(name, { dataTransfer: dt, bubbles: true, cancelable: true }));
      });
      if (await wait(grew, 2500)) return true;
    } catch (e) { /* try the next way */ }
    // 3. a file input on the page
    var inputs = document.querySelectorAll('input[type="file"]');
    for (var i = 0; i < inputs.length; i++) {
      var accept = inputs[i].getAttribute('accept') || '';
      if (accept && !/image|\*/.test(accept)) continue;
      try {
        inputs[i].files = transfer(files).files;
        inputs[i].dispatchEvent(new Event('change', { bubbles: true }));
        if (await wait(grew, 2500)) return true;
      } catch (e) { /* next input */ }
    }
    return false;
  }

  function typeText(box, text) {
    box.focus();
    if (box.tagName === 'TEXTAREA' || box.tagName === 'INPUT') {
      var setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(box), 'value').set;
      setter.call(box, text);
      box.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    var sel = window.getSelection();
    var range = document.createRange();
    range.selectNodeContents(box);
    sel.removeAllRanges();
    sel.addRange(range);
    if (!document.execCommand('insertText', false, text)) {
      box.textContent = text;
      box.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }
  }

  function boxText(box) {
    return (box.tagName === 'TEXTAREA' || box.tagName === 'INPUT' ? box.value : box.innerText || '').trim();
  }

  // Last resort when the site ignores our typing: put the prompt on the
  // clipboard so one Ctrl+V finishes the job.
  async function toClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      return false;
    }
  }

  function largestNew(before) {
    var list = pictures().filter(function (im) {
      return im.naturalWidth >= 400 && !(before && before.has(im.currentSrc || im.src));
    });
    return list.length ? list[list.length - 1] : null;
  }

  async function asData(im) {
    var src = im.currentSrc || im.src;
    try {
      var res = await fetch(src, { credentials: 'include' });
      var blob = await res.blob();
      return await new Promise(function (resolve, reject) {
        var r = new FileReader();
        r.onload = function () { resolve(String(r.result)); };
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    } catch (e) {
      var c = document.createElement('canvas');
      c.width = im.naturalWidth;
      c.height = im.naturalHeight;
      c.getContext('2d').drawImage(im, 0, 0);
      return c.toDataURL('image/png'); // throws if the image is locked by the site
    }
  }

  async function sendBack(im) {
    try {
      var url = await asData(im);
      var m = /^data:([^;]+);base64,(.*)$/.exec(url);
      if (!m) throw new Error('bad image');
      post({ type: 'result', mimeType: m[1], data: m[2] });
      bar('Result sent back to David Render Studio.');
      return true;
    } catch (e) {
      status('This image could not be read from the page. Right-click it, Save image, then upload it in the panel.', 'error');
      return false;
    }
  }

  async function fill(d) {
    var site = SITES[d.site] || SITES.gemini;
    stop();
    job = { site: site, before: null };
    status('Waiting for the chat box...');
    var box = await wait(function () { return first(site.box); }, 25000, 400);
    if (!box) {
      post({ type: 'failed', text: 'No chat box found. Sign in to the site in the browser window, then press Render again.' });
      bar('Sign in, then press Render again in the panel.');
      return;
    }
    var files = (d.images || []).map(toFile);
    var ok = files.length ? await attach(box, files) : true;
    var prompt = d.prompt || '';
    typeText(box, prompt);
    await sleep(300);
    var typed = !prompt || boxText(box).indexOf(prompt.slice(0, 24).trim()) !== -1;
    if (!ok) {
      // SketchUp puts the image on the clipboard and tells the user to paste it.
      post({ type: 'noimage' });
      bar('Image not attached: click the chat box, press Ctrl+V, then Send.');
    } else if (!typed) {
      var copied = await toClipboard(prompt);
      status(copied
        ? 'Image is in, but the site blocked the text. The prompt is on your clipboard: click the chat box, press Ctrl+V, then Send.'
        : 'Image is in, but the site blocked the text. Copy the prompt from the panel, paste it, then Send.', 'error');
    } else {
      status('Image and prompt are in. Check them, press Send, then "Bring result back" when the image is done.', 'ok');
    }
    job.before = new Set(pictures().map(function (im) { return im.currentSrc || im.src; }));
  }

  async function grab() {
    var im = largestNew(job && job.before);
    if (!im) {
      status('No generated image found on the page yet.', 'error');
      return;
    }
    if (await sendBack(im)) job = null;
  }

  function stop() {
    job = null;
  }

  // A small bar on top of the site with the one button the user needs.
  function bar(text) {
    var el = document.getElementById('airs-bar');
    if (!el) {
      el = document.createElement('div');
      el.id = 'airs-bar';
      el.setAttribute('style', 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:2147483647;display:flex;gap:10px;align-items:center;padding:8px 10px 8px 14px;border-radius:10px;background:#15161a;color:#e9e6e1;font:13px/1.3 system-ui,Segoe UI,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.45);border:1px solid #2c2e34;max-width:90vw');
      var msg = document.createElement('span');
      msg.id = 'airs-bar-text';
      var b = document.createElement('button');
      b.textContent = 'Bring result back';
      b.setAttribute('style', 'border:0;border-radius:7px;padding:7px 12px;background:#f0a24a;color:#1b1206;font-weight:700;cursor:pointer');
      b.onclick = grab;
      var x = document.createElement('button');
      x.textContent = '×';
      x.title = 'Hide';
      x.setAttribute('style', 'border:0;background:none;color:#8a8780;font-size:18px;cursor:pointer');
      x.onclick = function () { el.remove(); };
      el.appendChild(msg);
      el.appendChild(b);
      el.appendChild(x);
      document.body.appendChild(el);
    }
    document.getElementById('airs-bar-text').textContent = text;
  }

  window.__airsAgent = {
    run: function (cmd, data) {
      if (cmd === 'fill') return fill(data);
      if (cmd === 'grab') return grab();
      if (cmd === 'stop') return stop();
    },
  };
})();
