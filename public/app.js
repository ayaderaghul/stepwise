// Renders the game (logic.js) as a jungle expedition, handles accounts, sync, sounds and the test runner.
(function () {
  var CACHE_KEY = 'stepwise:v1';
  var TZ = (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';
  var app = document.getElementById('app');
  var game = new Component();
  var actions = [];
  var scrollMemory = {};

  // App-level view state (the game's own screens live in game.state).
  var ui = {
    view: 'boot',            // boot | auth | game | satchel | journal | attempt
    user: null,
    streak: 0,
    auth: { mode: 'login', error: '', busy: false, inviteRequired: true },
    log: { loading: false, stats: null, attempts: [], error: '' },
    attempt: null,
    notice: '',
    syncState: 'idle',
    loc: { open: false, results: [], busy: false, error: '', q: '' },
    locSkipped: (function () { try { return localStorage.getItem('stepwise:locskip') === '1'; } catch (e) { return false; } })(),
    wxError: '',
    notices: [],
    hall: { period: 'all', data: null, loading: false, error: '' },
    atlasFresh: false
  };

  // ---------------- server calls ----------------
  function api(path, options) {
    options = options || {};
    var init = { method: options.method || 'GET', credentials: 'same-origin', headers: {} };
    if (options.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }
    return fetch('/api' + path, init).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    }, function () {
      return { ok: false, status: 0, data: { error: 'Can’t reach the server. Check your connection.' } };
    });
  }

  function notify(text) {
    ui.notice = text;
    render();
    clearTimeout(notify.t);
    notify.t = setTimeout(function () { ui.notice = ''; render(); }, 4000);
  }

  // ---------------- progress sync ----------------
  var SAVED_KEYS = ['solved', 'gems', 'shards', 'saved', 'fresh', 'questDone', 'runes', 'review', 'dare', 'peek', 'place', 'bonusGold', 'curio', 'hail', 'sayings'];
  function progressSnapshot() {
    var s = game.state || {}, out = {};
    SAVED_KEYS.forEach(function (k) { if (s[k] !== undefined) out[k] = s[k]; });
    return out;
  }
  function applyProgress(saved) {
    // Always open on the full trail, whatever filter was last used on another device.
    game.state = Object.assign({}, game.state, saved || {}, {
      screen: 'feed', reviewed: false, unlocks: [], shardGain: [], fused: [], gain: 0, filter: 'all', judging: false, report: null,
      encounter: null, practice: false, ruinOpen: null, ruinResult: null, atlasRegion: null, templePick: null, curioOpen: null, curioDraft: ''
    });
  }
  var lastSaved = '';
  var saveTimer = null;
  function persist() {
    if (!ui.user) return;
    var snap = JSON.stringify(progressSnapshot());
    try { localStorage.setItem(CACHE_KEY + ':' + ui.user, snap); } catch (e) { /* ignore */ }
    if (snap === lastSaved) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      ui.syncState = 'saving';
      api('/progress', { method: 'PUT', body: { state: JSON.parse(snap) } }).then(function (r) {
        if (r.ok) { lastSaved = snap; ui.syncState = 'saved'; }
        else if (r.status === 401) { signedOut(); }
        else { ui.syncState = 'offline'; }
      });
    }, 800);
  }

  // Record every guardian run (passed or failed), with the answer carved for every marker.
  var lastReport = null;
  function recordAttemptIfNew() {
    var s = game.state || {};
    var rep = s.report;
    if (rep && rep !== lastReport && s.screen === 'walk') {
      var p = PROBLEMS[s.pid];
      var passed = !rep.fatal && rep.total > 0 && rep.passed === rep.total;
      api('/attempts', {
        method: 'POST',
        body: {
          title: p.title, rank: p.rank || null, family: p.family, difficulty: p.diff,
          answers: (s.answers || []).map(function (a) { return a || ''; }),
          code: s.code || '', firstClear: passed && (s.gain || 0) > 0, gemsEarned: passed ? (s.gain || 0) + (s.questShare || 0) : 0,
          passed: passed, testsPassed: rep.passed, testsTotal: rep.total, failure: passed ? null : failureText(rep)
        }
      }).then(function (r) {
        if (!r.ok) notify(r.status === 401 ? 'Signed out — sign in again to keep saving.' : 'Couldn’t save this attempt: ' + (r.data.error || 'server error'));
      });
    }
    lastReport = rep || null;
  }
  function failureText(rep) {
    if (rep.fatal) return rep.fatal;
    var f = rep.fail || {};
    return 'Test ' + ((f.index || 0) + 1) + ': ' + (f.error ? f.error + ' ' : '') + 'input ' + (f.input || '') + ' · expected ' + (f.expected || '') + ' · got ' + (f.got || '');
  }

  // ---------------- the guardian: run the tests in a sandboxed worker ----------------
  var judgingNow = false;
  var CASE_TIME_LIMIT = 3000;
  function runBossIfNeeded() {
    var s = game.state || {};
    if (!s.judging || judgingNow) return;
    judgingNow = true;
    var p = PROBLEMS[s.pid];
    var finish = function (report) { judgingNow = false; game.bossResult(report); };
    api('/transpile', { method: 'POST', body: { code: s.code || '' } }).then(function (r) {
      if (!r.ok) return finish({ passed: 0, total: 0, ms: 0, fatal: r.status === 401 ? 'You were signed out — sign in again, then rerun.' : (r.data.error || 'Couldn’t prepare your code.') });
      if (r.data.error) return finish({ passed: 0, total: 0, ms: 0, fatal: 'Syntax error — ' + r.data.error });
      runInWorker(p.title, r.data.js).then(finish);
    });
  }
  function runInWorker(title, js) {
    return new Promise(function (resolve) {
      var worker = new Worker('/runner.js');
      var total = 0, passed = 0, done = 0, ms = 0, fail = null, timer = null, over = false;
      function end(extra) {
        if (over) return; over = true;
        clearTimeout(timer); worker.terminate();
        resolve(Object.assign({ passed: passed, total: total, ms: Math.round(ms), fail: fail }, extra));
      }
      function arm() {
        clearTimeout(timer);
        timer = setTimeout(function () {
          end({
            total: total || 1, timedOut: true,
            fail: fail || { index: done, input: '', expected: '', got: '—', error: 'Time limit: trial ' + (done + 1) + ' ran for over ' + CASE_TIME_LIMIT / 1000 + ' seconds. An infinite loop, or a much slower algorithm than needed?' }
          });
        }, CASE_TIME_LIMIT);
      }
      worker.onmessage = function (e) {
        var m = e.data;
        if (m.type === 'fatal') end({ fatal: m.error, logs: m.logs });
        else if (m.type === 'start') { total = m.total; arm(); }
        else if (m.type === 'case') { done++; ms += m.result.ms; if (m.result.ok) passed++; else if (!fail) fail = m.result; arm(); }
        else if (m.type === 'done') end({ logs: m.logs });
      };
      worker.onerror = function (e) { e.preventDefault(); end({ fatal: e.message || 'The test runner crashed.' }); };
      arm();
      worker.postMessage({ title: title, js: js });
    });
  }

  // ---------------- boot & auth ----------------
  function boot() {
    render();
    api('/me').then(function (r) {
      if (r.ok) return startSession(r.data.username);
      if (r.status === 0) { ui.view = 'auth'; ui.auth.error = r.data.error; render(); return; }
      return showAuth();
    });
  }
  function showAuth() {
    ui.view = 'auth';
    render();
    api('/signup-info').then(function (r) {
      if (r.ok) { ui.auth.inviteRequired = r.data.inviteRequired; render(); }
    });
  }
  function loadStreak() {
    api('/stats?tz=' + encodeURIComponent(TZ)).then(function (r) {
      if (r.ok) { ui.streak = r.data.streak || 0; ui.log.stats = r.data; render(); }
    });
  }
  function startSession(username) {
    ui.user = username;
    ui.view = 'boot';
    render();
    return api('/progress').then(function (r) {
      var server = r.ok ? r.data.state : null;
      var local = null;
      try { local = JSON.parse(localStorage.getItem(CACHE_KEY + ':' + username) || localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { /* ignore */ }
      // First sign-in on an account with no saved progress: bring over what this browser already has.
      var useLocal = !server && local && local.solved && Object.keys(local.solved).length > 0;
      applyProgress(server || local || {});
      lastSaved = server ? JSON.stringify(progressSnapshot()) : '';
      ui.view = 'game';
      render();
      loadStreak();
      lastWeatherAt = Date.now(); loadWeather();
      if (useLocal) notify('Brought over the progress saved in this browser.');
    });
  }
  function signedOut() {
    ui.user = null;
    game.state = null;
    showAuth();
  }
  function submitAuth(form) {
    var mode = ui.auth.mode;
    var body = {
      username: form.username.value.trim(),
      password: form.password.value,
      invite: form.invite ? form.invite.value.trim() : ''
    };
    ui.auth.busy = true; ui.auth.error = ''; render();
    api(mode === 'login' ? '/login' : '/signup', { method: 'POST', body: body }).then(function (r) {
      ui.auth.busy = false;
      if (r.ok) { startSession(r.data.username); return; }
      ui.auth.error = r.data.error || 'Something went wrong.';
      render();
    });
  }
  function logout() { api('/logout', { method: 'POST' }).then(signedOut); }

  // ---------------- journal (log) ----------------
  function openJournal() {
    Sfx.play('rustle');
    ui.view = 'journal';
    ui.log.loading = true; ui.log.error = '';
    render();
    Promise.all([api('/stats?tz=' + encodeURIComponent(TZ)), api('/attempts?limit=50')]).then(function (rs) {
      ui.log.loading = false;
      if (rs[0].status === 401) return signedOut();
      if (!rs[0].ok || !rs[1].ok) { ui.log.error = (rs[0].data.error || rs[1].data.error || 'Couldn’t load your journal.'); render(); return; }
      ui.log.stats = rs[0].data;
      ui.streak = rs[0].data.streak || 0;
      ui.log.attempts = rs[1].data.attempts;
      render();
    });
  }
  function openAttempt(id) {
    ui.view = 'attempt'; ui.attempt = null; render();
    api('/attempts/' + id).then(function (r) {
      if (!r.ok) { notify(r.data.error || 'Couldn’t open that attempt.'); ui.view = 'journal'; render(); return; }
      ui.attempt = r.data; render();
    });
  }
  function openSatchel() { Sfx.play('rustle'); ui.view = 'satchel'; render(); }
  function showFamily(fam) { Sfx.play('rustle'); ui.view = 'game'; game.setState({ screen: 'feed', filter: fam }); }

  // ---------------- helpers ----------------
  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function act(fn) { actions.push(fn); return actions.length - 1; }
  function px(g, extraClass) {
    if (!g || !g.cells || !g.cells.length) return '';
    var cells = g.cells.map(function (c) {
      return '<i class="' + (c.cls || '') + '" style="background:' + c.bg + (c.d ? ';animation-delay:' + c.d : '') + '"></i>';
    }).join('');
    return '<div class="gem ' + (g.fx || '') + ' ' + (extraClass || '') + '" aria-hidden="true" style="grid-template-columns:repeat(' + g.w + ',' + g.px + 'px);grid-auto-rows:' + g.px + 'px">' +
      cells + (g.rare ? '<span class="twinkle"></span>' : '') + '</div>';
  }
  function sp(kind, size, flip, extraClass) { return px(spritePixels(kind, size, flip), extraClass); }
  function deco(kind, size, flip, style) { return '<div class="deco" aria-hidden="true" style="' + style + '">' + sp(kind, size, flip) + '</div>'; }
  function runeStrip(text) { return '<div class="rune-strip" aria-hidden="true">' + text + '</div>'; }
  function when(iso) {
    try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso; }
  }
  var RUNE_ROW = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
  var BADGE_CLASS = { Easy: 'easy', Medium: 'medium', Hard: 'hard' };
  var ICON = {
    back: '<svg width="15" height="15" viewBox="0 0 5 5" shape-rendering="crispEdges" aria-hidden="true"><rect x="2" y="0" width="1" height="1" fill="#F2EBD3"/><rect x="1" y="1" width="1" height="1" fill="#F2EBD3"/><rect x="0" y="2" width="5" height="1" fill="#F2EBD3"/><rect x="1" y="3" width="1" height="1" fill="#F2EBD3"/><rect x="2" y="4" width="1" height="1" fill="#F2EBD3"/></svg>',
    check: '<svg width="15" height="12" viewBox="0 0 5 4" shape-rendering="crispEdges" aria-hidden="true"><rect x="4" y="0" width="1" height="1" fill="#7BC96F"/><rect x="3" y="1" width="1" height="1" fill="#7BC96F"/><rect x="0" y="1" width="1" height="1" fill="#7BC96F"/><rect x="1" y="2" width="2" height="1" fill="#7BC96F"/><rect x="2" y="3" width="1" height="1" fill="#7BC96F"/></svg>',
    trail: '<svg width="18" height="18" viewBox="0 0 6 6" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="3" width="2" height="3" fill="currentColor"/><rect x="3" y="0" width="2" height="3" fill="currentColor"/></svg>',
    mark: '<svg width="15" height="18" viewBox="0 0 4 5" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="0" width="4" height="4" fill="currentColor"/><rect x="0" y="4" width="1" height="1" fill="currentColor"/><rect x="3" y="4" width="1" height="1" fill="currentColor"/></svg>',
    satchel: '<svg width="18" height="18" viewBox="0 0 6 6" shape-rendering="crispEdges" aria-hidden="true"><rect x="2" y="0" width="2" height="1" fill="currentColor"/><rect x="1" y="1" width="4" height="1" fill="currentColor"/><rect x="0" y="2" width="6" height="4" fill="currentColor"/><rect x="2" y="3" width="2" height="1" fill="#132B1F"/></svg>',
    journal: '<svg width="18" height="18" viewBox="0 0 6 6" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="0" width="6" height="6" fill="currentColor"/><rect x="3" y="0" width="1" height="6" fill="#132B1F"/><rect x="1" y="2" width="1" height="1" fill="#132B1F"/><rect x="4" y="2" width="1" height="1" fill="#132B1F"/></svg>',
    soundOn: '<svg width="21" height="18" viewBox="0 0 7 6" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="2" width="1" height="2" fill="#F2EBD3"/><rect x="1" y="1" width="1" height="4" fill="#F2EBD3"/><rect x="2" y="0" width="1" height="6" fill="#F2EBD3"/><rect x="4" y="2" width="1" height="2" fill="#7BC96F"/><rect x="5" y="1" width="1" height="1" fill="#7BC96F"/><rect x="5" y="4" width="1" height="1" fill="#7BC96F"/><rect x="6" y="2" width="1" height="2" fill="#7BC96F"/></svg>',
    soundOff: '<svg width="21" height="18" viewBox="0 0 7 6" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="2" width="1" height="2" fill="#A9C2A6"/><rect x="1" y="1" width="1" height="4" fill="#A9C2A6"/><rect x="2" y="0" width="1" height="6" fill="#A9C2A6"/><rect x="4" y="1" width="1" height="1" fill="#C8643B"/><rect x="5" y="2" width="1" height="2" fill="#C8643B"/><rect x="6" y="1" width="1" height="1" fill="#C8643B"/><rect x="4" y="4" width="1" height="1" fill="#C8643B"/><rect x="6" y="4" width="1" height="1" fill="#C8643B"/></svg>',
    atlas: '<svg width="18" height="18" viewBox="0 0 6 6" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="0" width="2" height="6" fill="currentColor"/><rect x="2" y="1" width="2" height="5" fill="currentColor" opacity=".6"/><rect x="4" y="0" width="2" height="6" fill="currentColor"/><rect x="1" y="2" width="4" height="1" fill="#132B1F"/></svg>',
    hall: '<svg width="18" height="18" viewBox="0 0 6 6" shape-rendering="crispEdges" aria-hidden="true"><rect x="2" y="0" width="2" height="2" fill="currentColor"/><rect x="0" y="2" width="2" height="4" fill="currentColor"/><rect x="2" y="2" width="2" height="4" fill="currentColor"/><rect x="4" y="3" width="2" height="3" fill="currentColor"/></svg>',
    flame: '<svg width="18" height="21" viewBox="0 0 6 7" shape-rendering="crispEdges" aria-hidden="true"><rect x="2" y="0" width="1" height="1" fill="#F2C14E"/><rect x="2" y="1" width="2" height="1" fill="#F2C14E"/><rect x="1" y="2" width="3" height="1" fill="#F28C28"/><rect x="1" y="3" width="4" height="1" fill="#F28C28"/><rect x="0" y="4" width="6" height="2" fill="#D9412B"/><rect x="2" y="4" width="2" height="2" fill="#F2C14E"/><rect x="1" y="6" width="4" height="1" fill="#8A3A12"/></svg>'
  };
  function bookmark(fill) {
    return '<svg width="16" height="20" viewBox="0 0 4 5" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="0" width="4" height="4" fill="' + fill + '"/><rect x="0" y="4" width="1" height="1" fill="' + fill + '"/><rect x="3" y="4" width="1" height="1" fill="' + fill + '"/></svg>';
  }
  function soundButton() {
    var on = Sfx.isOn();
    return '<button class="icon-btn" aria-label="' + (on ? 'Sound is on. Mute' : 'Sound is off. Turn sound on') + '" aria-pressed="' + on + '" data-act="' + act(function () { Sfx.setOn(!Sfx.isOn()); Sfx.play('rustle'); render(); }) + '">' + (on ? ICON.soundOn : ICON.soundOff) + '</button>';
  }
  function canopy() {
    var leaves = '';
    for (var i = 0; i < 13; i++) leaves += sp('leaf', 3, i % 2 === 1);
    return '<div class="canopy" aria-hidden="true">' + leaves + '</div>';
  }

  // ---------------- screens ----------------
  function nav(active) {
    var tab = function (key, icon, label, fn) {
      return '<button class="' + (active === key ? 'on' : '') + '"' + (active === key ? ' aria-current="page"' : '') + ' data-act="' + act(fn) + '">' + icon + label + '</button>';
    };
    return '<nav class="nav" aria-label="Main">' +
      tab('game', ICON.trail, 'TRAIL', function () { Sfx.play('rustle'); ui.view = 'game'; game.setState({ screen: 'feed' }); }) +
      tab('atlas', ICON.atlas, 'ATLAS', openAtlas) +
      tab('satchel', ICON.satchel, 'SATCHEL', openSatchel) +
      tab('hall', ICON.hall, 'HALL', openHall) +
      tab('journal', ICON.journal, 'JOURNAL', openJournal) +
      '</nav>';
  }

  function bootScreen() {
    return '<div class="screen center">' + sp('toucan', 5) +
      '<span class="brand">STEPWISE</span><span class="runes-title">ᛋᛏᛖᛈᚹᛁᛋᛖ</span><span class="tag blink">LOADING…</span>' +
      '<span class="tag" style="text-align:center;padding:0 24px">The jungle naps when idle — the first load can take up to a minute.</span></div>';
  }

  function authScreen() {
    var a = ui.auth, signup = a.mode === 'signup';
    return '<div class="screen"><main class="scroll"><div class="auth">' + canopy() +
      '<div class="auth-brand">' + sp('toucan', 4) + '<div><span class="brand">STEPWISE</span><br><span class="runes-title">ᛋᛏᛖᛈᚹᛁᛋᛖ</span></div></div>' +
      '<span class="tag">Think first. Code second. A jungle of 78 temples awaits.</span>' +
      '<div class="tabs" role="tablist">' +
        '<button role="tab" aria-selected="' + !signup + '" class="chip' + (!signup ? ' on' : '') + '" data-act="' + act(function () { a.mode = 'login'; a.error = ''; render(); }) + '">SIGN IN</button>' +
        '<button role="tab" aria-selected="' + signup + '" class="chip' + (signup ? ' on' : '') + '" data-act="' + act(function () { a.mode = 'signup'; a.error = ''; render(); }) + '">NEW EXPLORER</button>' +
      '</div>' +
      '<form class="auth-form" id="auth-form" novalidate>' +
        '<div class="field"><label for="username">USERNAME</label><input id="username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required></div>' +
        '<div class="field"><label for="password">PASSWORD</label><input id="password" name="password" type="password" autocomplete="' + (signup ? 'new-password' : 'current-password') + '" required minlength="8"></div>' +
        (signup && a.inviteRequired ? '<div class="field"><label for="invite">INVITE CODE</label><input id="invite" name="invite" autocomplete="off" spellcheck="false"></div>' : '') +
        (signup && !a.inviteRequired ? '<p class="tag">You’re the first explorer — this account becomes the owner.</p>' : '') +
        (a.error ? '<p class="error" role="alert">' + esc(a.error) + '</p>' : '') +
        '<button class="btn big" type="submit"' + (a.busy ? ' disabled' : '') + '>' + (a.busy ? '…' : signup ? 'BEGIN THE EXPEDITION ▶' : 'ENTER THE JUNGLE ▶') + '</button>' +
      '</form>' +
      '<p class="tag">Your gems, runes, answers and code are saved to your account, so they follow you between devices.</p>' +
    '</div></main></div>';
  }

  function feed(v) {
    var satchel = v.vault.filter(function (g, i) { return i < 6; }).map(function (g) {
      return '<span class="satchel-item" style="opacity:' + g.dim + '">' + px(g.gem) + '<span class="satchel-count" style="color:' + g.color + '">' + g.count + '</span></span>';
    }).join('');
    var chips = v.chips.map(function (c) {
      return '<button class="chip' + (c.on ? ' on' : '') + '" aria-pressed="' + c.on + '" data-act="' + act(c.pick) + '">' + esc(c.label) + '</button>';
    }).join('');
    var posts = v.posts.map(card).join('');
    var marked = (game.state || {}).filter === 'saved';
    var empty = v.posts.length ? '' : '<p class="end">' + (marked ? 'No marked trails yet. Tap the marker on a trail to keep it here.' : 'Nothing on this trail yet.') + '</p>';
    var wv = game.worldVals();
    var askLoc = !wv.place && !ui.locSkipped;
    var surprises = (askLoc ? locationPanel(false) : '') + weatherBanner(wv) + runeCard(v.dailyRune) +
      (v.ruinResult ? ruinResultCard(v.ruinResult) : '') + v.ruins.map(ruinCard).join('');
    return '<div class="screen">' +
      '<header class="feed-head jungle-head">' + canopy() + skyLayer(wv.weather, wv.moon) +
        deco('vine', 3, false, 'top:20px;left:6px') + deco('vine', 2, false, 'top:18px;right:72px') + deco('firefly', 2, false, 'top:70px;right:130px', '') +
        '<div class="brand-row"><div class="brand-col"><span class="brand">STEPWISE</span><span class="runes-title" aria-label="Stepwise, in runes">ᛋᛏᛖᛈᚹᛁᛋᛖ</span></div>' + soundButton() + '</div>' +
        '<div class="day-line">' + sp('torch', 2) + '<span class="px gold" style="font-size:9px">' + (ui.streak > 0 ? 'DAY ' + ui.streak + ' ON THE TRAIL' : 'A NEW TRAIL BEGINS') + '</span>' +
          '<span class="tag">· ' + v.totalGems + ' gems</span>' + goldChip(wv) + '</div>' +
        '<button class="satchel-strip" aria-label="Satchel: ' + v.totalGems + ' gems. Open the satchel" data-act="' + act(openSatchel) + '"><span class="px muted" style="font-size:8px">SATCHEL</span>' + satchel + '<span class="tag" style="margin-left:auto">+8 more ▶</span></button>' +
        '<div class="chips" aria-label="Filter by gem family">' + chips + '</div>' +
        '<span class="tag">' + esc(v.feedCount) + '</span>' +
      '</header>' +
      '<main class="scroll" data-scroll="feed"><div class="feed">' + (marked ? '' : surprises) + posts + empty +
        (v.posts.length ? '<p class="end">— the trail continues tomorrow —</p>' : '') + '</div></main>' +
      nav('game') +
    '</div>';
  }

  function runeCard(r) {
    if (r.carved) {
      return '<section class="rune-mini"><span class="rune-glyph small" aria-hidden="true">' + esc(r.glyph) + '</span>' +
        '<div><span class="px cyan" style="font-size:9px">TODAY’S RUNE · ' + esc(r.name) + '</span><p>' + esc(r.blessing.replace('Blessing: ', '')) + ' · blessing active</p></div>' +
        '<button class="mini-link" data-act="' + act(openSatchel) + '">' + r.carvedCount + '/24 ▶</button></section>';
    }
    return '<article class="rune-card">' + deco('leaf', 2, true, 'top:-14px;right:-10px') +
      '<span class="px cyan" style="font-size:9px">TODAY’S RUNE</span>' +
      '<div class="rune-head">' + sp('runestone', 5) + '<span class="rune-glyph" aria-hidden="true">' + esc(r.glyph) + '</span>' +
        '<div class="rune-name"><span class="px" style="font-size:12px">' + esc(r.name) + '</span><span class="tag">' + esc(r.meaning) + '</span></div></div>' +
      '<p class="saying">' + esc(r.saying) + '</p>' +
      '<div class="blessing">' + px(r.blessSprite) + '<span>' + esc(r.blessing) + '</span></div>' +
      '<div class="row-between"><span class="tag">' + r.carvedCount + ' of 24 runes carved</span>' +
        '<button class="btn cyan-btn" data-act="' + act(r.carve) + '">CARVE IT ▶</button></div>' +
    '</article>';
  }

  function ruinCard(r) {
    var body;
    if (r.open) {
      body = '<div class="tablet small">' + esc(r.question) + '</div>' +
        '<div class="field"><label for="ruin">FROM MEMORY</label><textarea id="ruin" class="answer short" data-field="ruinDraft" placeholder="What do you remember?">' + esc(r.draft) + '</textarea></div>' +
        '<div class="row-between"><span class="reward" style="color:' + r.gemColor + '">' + px(r.gem) + esc(r.reward) + '</span>' +
          '<button class="btn moss-btn" id="ruin-carve" data-act="' + act(r.carve) + '"' + (r.draft && r.draft.trim() ? '' : ' disabled') + '>CARVE ▶</button></div>';
    } else {
      body = '<p class="prompt">Vines are creeping back over this temple. Answer one marker from memory to clear them.</p>' +
        '<div class="row-between"><span class="reward" style="color:' + r.gemColor + '">' + px(r.gem) + esc(r.reward) + '</span>' +
          '<button class="btn moss-btn" data-act="' + act(r.openIt) + '">CLEAR VINES ▶</button></div>';
    }
    return '<article class="ruin-card">' + deco('vine', 3, false, 'top:-8px;left:22px') + deco('vine', 2, false, 'top:-8px;left:58px') +
      deco('vine', 3, false, 'top:-8px;right:30px') + deco('leaf', 3, true, 'bottom:-14px;right:-12px') +
      '<div class="row-between" style="padding-top:26px"><span class="px moss" style="font-size:9px">OVERGROWN RUINS</span><span class="tag">' + esc(r.ago) + '</span></div>' +
      '<h2>' + esc(r.title) + '</h2>' + body + '</article>';
  }

  function ruinResultCard(r) {
    return '<article class="ruin-card done">' +
      '<div class="row-between"><span class="px moss" style="font-size:9px">VINES CLEARED</span><button class="mini-link" data-act="' + act(r.dismiss) + '">OK ✓</button></div>' +
      '<h2>' + esc(r.title) + '</h2>' +
      '<div class="tablet small">' + esc(r.question) + '</div>' +
      '<div class="mine">' + esc(r.answer) + '</div>' +
      '<div class="angle"><span class="px cyan" style="font-size:9px">ANOTHER ANGLE</span><p>' + esc(r.insight) + '</p></div>' +
      '<span class="tag gold">' + esc(r.line) + '</span></article>';
  }

  function card(p) {
    var cls = 'card' + (p.solved ? ' solved' : (p.fresh ? ' fresh' : '')) + (p.locked ? ' locked' : '') + (p.isDare ? ' dare' : '');
    var top = '<div class="card-top">' +
      '<div class="avatar" aria-hidden="true" style="border-color:' + (p.locked ? '#4E4C42' : p.gemColor) + ';color:' + (p.locked ? '#A9C2A6' : p.gemColor) + '">' + esc(p.mono) + '</div>' +
      '<div class="card-meta"><span class="t">' + esc(p.topic) + '</span><span class="m">' + esc(p.meta) + '</span></div>' +
      (p.fresh ? '<span class="badge new blink">NEW</span>' : '') +
      '<span class="badge ' + BADGE_CLASS[p.diff] + '">' + esc(p.diff.toUpperCase()) + '</span></div>';
    var body;
    if (p.locked) {
      var reqs = p.reqs.map(function (r) {
        return '<div class="req"><div class="req-icon">' + (r.isGem ? px(r.gem) : sp('torch', 2)) + '</div>' +
          '<div class="req-body"><span class="req-label" style="color:' + (r.met ? '#7BC96F' : '#F2EBD3') + '">' + esc(r.label) + '</span>' +
          '<div class="bar"><div style="width:' + r.pct + ';background:' + (r.met ? '#7BC96F' : '#F2C14E') + '"></div></div></div></div>';
      }).join('');
      body = '<div class="lock"><div class="lock-title">' + sp('runestone', 2) + 'SEALED TEMPLE</div><p>' + esc(p.lockWhy) + ' To break the seal:</p>' + reqs +
        (p.canPeek ? '<div class="row-between peek">' + sp('monkey', 2) + '<span class="tag">The monkey’s shortcut is open today.</span><button class="btn monkey-btn" data-act="' + act(p.peek) + '">PEEK ▶</button></div>' : '') +
        '</div>';
    } else {
      body = '<p class="prompt">' + esc(p.prompt) + '</p>' +
        (p.hasBuilds ? '<span class="builds">✓ Builds on ' + esc(p.buildsOn) + '</span>' : '') +
        (p.isDare ? '<div class="dare-tag">' + sp('jaguar', 2) + '<span>JAGUAR DARE · no toucan, double gems</span></div>' : '') +
        '<pre class="example">' + esc(p.example) + '</pre>' +
        (p.solved ? '<div class="cleared">' + ICON.check + 'TEMPLE CLEARED · GEMS COLLECTED</div>' : '') +
        '<div class="actions">' +
          '<button class="icon-btn" aria-label="' + esc(p.saveLabel) + '" aria-pressed="' + p.isSaved + '" data-act="' + act(p.toggleSave) + '">' + bookmark(p.isSaved ? '#F2C14E' : '#2F6146') + '</button>' +
          '<div class="reward" style="color:' + p.gemColor + '">' + px(p.gem) + esc(p.rewardLabel) + '</div>' +
          '<button class="btn" data-act="' + act(p.open) + '">' + esc(p.cta) + '</button>' +
        '</div>' +
        (p.hasShards ? '<span class="drops">◆ Also drops shards: ' + esc(p.shardNames) + '</span>' : '');
    }
    var decor = p.locked ? deco('vine', 2, false, 'top:-10px;left:-8px') : deco('leaf', 2, (p.pid % 2) === 1, 'top:-16px;' + ((p.pid % 2) ? 'right:-14px' : 'left:-14px'));
    return '<article class="' + cls + '">' + decor + (p.locked ? '' : runeStrip(RUNE_ROW)) + top + '<h2>' + esc(p.title) + '</h2>' + body + '</article>';
  }

  function walk(v) {
    var stones = v.stones.map(function (s, i) {
      var isLast = i === v.stones.length - 1;
      var stone = isLast ? '<div class="stone-idol">' + sp('idol', 2) + '</div>' : '<div class="stone ' + s.state + '"></div>';
      return stone + (isLast ? '' : '<div class="stone-path ' + (s.state === 'done' ? 'done' : '') + '"></div>');
    }).join('');
    var head = '<header class="walk-head"><div class="walk-row">' +
      '<button class="icon-btn" aria-label="Back to the trail" data-act="' + act(v.backToFeed) + '">' + ICON.back + '</button>' +
      '<div class="walk-title"><span class="px">' + esc(v.cur.title) + '</span><span class="muted">' + esc(v.phaseLabel) + '</span></div>' +
      '<div class="gem-chip" role="img" aria-label="' + esc(v.cur.gemLabel) + '" style="border-color:' + v.cur.gemColor + '">' + px(v.cur.gem) + v.cur.gemCount + '</div>' +
      '</div><div class="stones" aria-hidden="true">' + stones + '</div></header>';
    var main, foot;
    if (v.isStep) {
      main = '<span class="kicker">TRAIL MARKER ' + v.stepNum + ' / ' + v.stepTotal + '</span>' +
        '<div class="tablet">' + runeStrip('ᛏᚱᚨᛁᛚᛗᚨᚱᚲᛖᚱᛏᚱᚨᛁᛚᛗᚨᚱᚲᛖᚱ') + '<h1>' + esc(v.question) + '</h1></div>';
      if (v.notRevealed) {
        var fairy = v.fairy ? (v.fairy.open
          ? '<div class="fairy-row">' + sp('fairy', 3, false, 'fairy-glow') + '<div class="bubble fairy-bubble"><span class="px">FAIRY LIGHT · NEW MOON</span><p>' + esc(v.fairy.hint) + '</p><p class="saying">“' + esc(v.fairy.proverb) + '”</p></div></div>'
          : '<button class="fairy-btn" data-act="' + act(v.fairy.follow) + '">' + sp('fairy', 2, false, 'fairy-glow') + '<span><span class="px">A FAIRY HOVERS NEARBY</span><br>Follow its light for a hint and a proverb' + (v.dareHere ? ' (ends the jaguar dare)' : '') + '</span></button>') : '';
        main += fairy + (v.tipOpen ? '<div class="toucan-row">' + sp('toucan', 4) + '<div class="bubble"><span class="px">TOUCAN SAYS</span><p>' + esc(v.tip) + '</p></div></div>' : '') +
          (v.dareHere && !v.tipOpen ? '<div class="dare-tag">' + sp('jaguar', 2) + '<span>The jaguar is watching: asking the toucan ends the dare.</span></div>' : '') +
          '<button class="hint-btn" aria-expanded="' + v.tipOpen + '" data-act="' + act(v.toggleTip) + '">' + (v.tipOpen ? '' : sp('toucan', 1)) + esc(v.tipLabel) + '</button>' +
          '<div class="field"><label for="answer">YOUR CARVING</label>' +
          '<textarea id="answer" class="answer" data-field="draft" placeholder="Carve your reasoning…">' + esc(v.draft) + '</textarea>' +
          '<span class="muted" style="font-size:18px">No wrong answers. Carve it to see another angle.</span></div>';
        foot = '<button class="btn big" id="commit" data-act="' + act(v.submitAnswer) + '"' + (v.noDraft ? ' disabled' : '') + '>CARVE IT ▶</button>';
      } else {
        main += '<div class="mine">' + esc(v.myAnswer) + '</div>' +
          '<div class="angle"><span class="px cyan" style="font-size:9px">ANOTHER ANGLE</span><p>' + esc(v.insight) + '</p></div>' +
          '<p class="muted" style="margin:0;font-size:19px">Match your thinking? If not, sit with the difference before moving on.</p>';
        foot = '<button class="btn big go" data-act="' + act(v.nextStep) + '">' + esc(v.continueLabel) + '</button>';
      }
      main = deco('leaf', 4, false, 'bottom:8px;left:-10px') + deco('leaf', 3, true, 'bottom:40px;right:-12px') + main;
    } else if (v.isCode) {
      main = '<section class="guardian">' + deco('vine', 2, false, 'top:-6px;right:10px') + deco('torch', 2, false, 'top:8px;left:8px') +
          '<div class="guardian-art">' + sp('idol', 5) + '</div>' +
          '<div class="guardian-text"><span class="px cyan" style="font-size:10px;line-height:1.5">GUARDIAN OF ' + esc(SHORT[v.cur.family] ? SHORT[v.cur.family].replace(' ★', '') : '') + '</span>' +
            '<span>' + esc(v.bossPrize) + '</span>' +
            (v.hasQuestGain ? '<span class="moss">' + esc(v.questLine) + ' ✓</span>' : '') +
            (v.hasQuestUnlocks ? '<span class="tag">Opened: ' + esc(v.questUnlocks.map(function (u) { return u.title; }).join(', ')) + '</span>' : '') +
          '</div></section>' +
        (v.dareHere ? '<div class="dare-tag">' + sp('jaguar', 2) + '<span>Jaguar dare active: no toucan used, so the guardian pays extra.</span></div>' : '') +
        '<details><summary>YOUR CARVINGS SO FAR</summary><ol>' +
        v.plan.map(function (it) { return '<li><span class="muted">' + esc(it.q) + '</span><br><span class="gold">' + esc(it.a) + '</span></li>'; }).join('') +
        '</ol></details>' +
        '<div class="field"><div class="row-between"><label for="code">SOLUTION.TS</label><span class="muted" style="font-size:18px">TypeScript</span></div>' +
        '<textarea id="code" class="code" data-field="code" spellcheck="false"' + (v.judging ? ' readonly' : '') + '>' + esc(v.code) + '</textarea></div>' +
        (v.hasReport ? reportPanel(v.report, v.bossTries) : '');
      foot = '<button class="btn big" data-act="' + act(v.submitCode) + '"' + (v.judging ? ' disabled' : '') + '>' + esc(v.bossLabel) + '</button>';
    } else {
      main = clearScreen(v);
      foot = '<button class="btn ghost big" style="flex:1" data-act="' + act(v.backToFeed) + '">TRAIL</button>' +
        '<button class="btn big" style="flex:1.6" data-act="' + act(v.goNext) + '">ONWARD <span class="blink">▶</span></button>';
    }
    return '<div class="screen">' + head + '<main class="scroll" data-scroll="walk"><div class="body jungle-body">' + main + '</div></main>' +
      '<div class="foot">' + foot + '</div></div>';
  }

  function clearScreen(v) {
    if (v.isPractice) {
      return '<section class="clear" style="border-color:#C08A55">' + sp('monkey', 5) +
        '<span class="title">PRACTICE RUN COMPLETE</span><span class="moss">' + esc(v.rv.tests) + '</span>' +
        '<span class="tag">' + esc(v.gainLabel) + '. Break the seal on the trail to earn its gems.</span></section>' + notesBlock(v);
    }
    var burst = v.burst.map(function (g) { return '<div class="gem-pop">' + px(g) + '</div>'; }).join('');
    return '<section class="clear" style="border-color:' + v.cur.gemColor + '">' + deco('leaf', 3, false, 'top:-14px;left:-12px') + deco('leaf', 3, true, 'top:-14px;right:-12px') +
        '<span class="title">TEMPLE CLEARED!</span><span class="moss">' + esc(v.rv.tests) + '</span>' +
        '<span class="tag">' + esc(v.bossTriesLine) + '</span>' +
        (v.rareDrop ? '<span class="rare-drop blink">★ RARE DROP ★</span>' : '') +
        '<div class="burst" aria-hidden="true">' + burst + '</div>' + sp('chestOpen', 5) +
        '<span class="px" style="font-size:11px;line-height:1.6;color:' + v.cur.gemColor + '">' + esc(v.gainLabel) + '</span>' +
        (v.hasSplit ? '<span class="soft">' + esc(v.splitLine) + '</span>' : '') +
        (game.worldVals().goldLabel ? '<span class="gold-line big">' + sp('coin', 2) + esc(game.worldVals().goldLabel) + '</span>' : '') +
        (v.dareResult ? '<span class="gold">' + esc(v.dareResult) + '</span>' : '') +
        (v.blessLine ? '<span class="cyan">' + esc(v.blessLine) + '</span>' : '') +
        (v.hasShardGain ? '<span class="soft">◆ Shards: ' + esc(v.shardLine) + '</span>' : '') +
        (v.hasFused ? '<span class="px blink gold" style="font-size:9px;line-height:1.6">5 SHARDS FUSED → +1 ' + esc(v.fusedLine) + '</span>' : '') +
        '<span class="tag">' + esc(v.cur.gemSummary) + '</span>' +
      '</section>' +
      (v.encounter ? encounterCard(v.encounter) : '') +
      (v.hasUnlocks ? '<section class="unlocked"><span class="px cyan" style="font-size:9px">' + (v.unlocks.length > 1 ? 'NEW TRAILS OPENED' : 'NEW TRAIL OPENED') + '</span>' +
        v.unlocks.map(function (u) { return '<div class="row">' + px(u.gem) + esc(u.title) + '</div>'; }).join('') + '</section>' : '') +
      notesBlock(v);
  }

  function notesBlock(v) {
    return '<div class="stats"><div class="stat"><span class="px">TIME</span><span>' + esc(v.rv.time) + '</span></div>' +
        '<div class="stat"><span class="px">SPACE</span><span>' + esc(v.rv.space) + '</span></div></div>' +
      '<section class="notes"><h2>EXPLORER’S NOTES</h2>' +
        v.rv.notes.map(function (n) { return '<div class="note"><span class="tagpill" style="background:' + n.tagBg + '">' + esc(n.tag) + '</span><p>' + esc(n.text) + '</p></div>'; }).join('') +
      '</section>' +
      '<section class="side"><span class="px muted" style="font-size:8px;line-height:1.6">SIDE PATH</span><p>' + esc(v.rv.followup) + '</p></section>';
  }

  function encounterCard(e) {
    var body = '<div class="enc-box"><span>' + esc(e.detail) + '</span>' + (e.reward ? '<span class="gold">' + esc(e.reward) + '</span>' : '') + '</div>';
    var buttons = '';
    if (e.done) {
      body += (e.answer ? '<div class="mine">' + esc(e.answer) + '</div>' : '') +
        (e.insight && e.answer ? '<div class="angle"><span class="px cyan" style="font-size:9px">ANOTHER ANGLE</span><p>' + esc(e.insight) + '</p></div>' : '') +
        '<p class="enc-msg">' + esc(e.msg) + '</p>';
    } else {
      if (e.needsAnswer) body += '<div class="field"><label for="frog">YOUR ANSWER</label><textarea id="frog" class="answer short" data-field="frogDraft" placeholder="Ribbit back…">' + esc(e.draft) + '</textarea></div>';
      buttons = '<div class="enc-buttons">' +
        (e.secondary ? '<button class="btn ghost" style="flex:1;border-color:' + e.color + ';color:' + e.color + '" data-act="' + act(e.secondary.act) + '">' + esc(e.secondary.label) + '</button>' : '') +
        '<button class="btn" id="enc-primary" style="flex:1.4;background:' + e.color + '" data-act="' + act(e.primary.act) + '"' + (e.needsAnswer && !(e.draft && e.draft.trim()) ? ' disabled' : '') + '>' + esc(e.primary.label) + '</button></div>';
    }
    return '<section class="encounter" style="background:' + e.bg + ';border-color:' + e.color + '">' + deco('leaf', 3, true, 'bottom:-12px;right:-10px') +
      '<span class="px" style="font-size:9px;color:' + e.color + '">WILD ENCOUNTER</span>' +
      '<div class="enc-head"><div class="enc-art">' + sp(e.sprite, 5) + '</div><div class="enc-text"><span class="px" style="font-size:11px;line-height:1.5">' + esc(e.title) + '</span><span class="soft">' + esc(e.line) + '</span></div></div>' +
      body + buttons + '</section>';
  }

  function reportPanel(rep, tries) {
    if (rep.fatal) {
      return '<section class="fail" role="alert"><span class="px fail-title">✗ THE GUARDIAN CAN’T READ YOUR CARVING</span><p>' + esc(rep.fatal) + '</p>' + logsBlock(rep.logs) + '</section>';
    }
    var f = rep.fail || {};
    return '<section class="fail" role="alert">' +
      '<span class="px fail-title">✗ THE GUARDIAN BLOCKS YOU · ' + rep.passed + ' OF ' + rep.total + ' TRIALS</span>' +
      '<span class="tag">Failed trial ' + ((f.index || 0) + 1) + (tries > 1 ? ' · try ' + tries : '') + '</span>' +
      (f.error ? '<p>' + esc(f.error) + '</p>' : '') +
      (f.input ? '<div class="io"><span class="px">INPUT</span><pre>' + esc(f.input) + '</pre></div>' : '') +
      (f.expected ? '<div class="io"><span class="px">EXPECTED</span><pre>' + esc(f.expected) + '</pre></div>' : '') +
      '<div class="io"><span class="px">GOT</span><pre>' + esc(f.got) + '</pre></div>' +
      logsBlock(rep.logs) +
      '<span class="tag">Your trail gems are safe. The guardian waits.</span>' +
    '</section>';
  }
  function logsBlock(logs) {
    if (!logs || !logs.length) return '';
    return '<div class="io"><span class="px">CONSOLE</span><pre>' + esc(logs.join('\n')) + '</pre></div>';
  }

  // ---------------- satchel: runestone + gems ----------------
  var RARE_LORE = {
    'Trie': 'Branches like a trie. Shifts teal → violet.',
    'Segment tree': 'A tiny segment tree; light sweeps its levels.'
  };
  function satchelScreen() {
    var v = game.renderVals();
    var s = game.state || {};
    var gems = s.gems || {}, shards = s.shards || {};
    var quests = function (fam) { return PROBLEMS.filter(function (p) { return p.family === fam; }); };
    var cleared = function (fam) { return PROBLEMS.filter(function (p, i) { return p.family === fam && s.solved && s.solved[i]; }).length; };

    var runestone = v.runestone.map(function (a) {
      return '<section class="aett"><div class="row-between"><span class="px muted" style="font-size:8px">' + esc(a.title) + '</span><span class="tag ' + (a.found ? 'cyan' : '') + '">' + a.found + '/8</span></div>' +
        '<div class="rune-grid">' + a.runes.map(function (r) {
          return '<div class="rune-cell' + (r.have ? ' have' : '') + (r.today ? ' today' : '') + '" role="img" aria-label="' + esc(r.label) + '" title="' + esc(r.n) + '">' + esc(r.g) + '</div>';
        }).join('') + '</div>' + (a.found === 8 ? '<span class="tag gold">✓ Ætt complete — carved in full</span>' : '') + '</section>';
    }).join('');
    var today = v.selectedRune
      ? '<section class="rune-card compact"><div class="rune-head"><span class="rune-glyph" aria-hidden="true">' + esc(v.selectedRune.g) + '</span><div class="rune-name"><span class="px" style="font-size:11px">' + esc(v.selectedRune.n.toUpperCase()) + '</span><span class="tag">' + esc(v.selectedRune.m) + ' · carved today</span></div></div><p class="saying">' + esc(v.selectedRune.say) + '</p></section>'
      : '<section class="rune-card compact"><p class="saying">Today’s rune waits on the trail. Carve it to add it to the stone.</p><button class="btn cyan-btn" data-act="' + act(function () { ui.view = 'game'; game.setState({ screen: 'feed', filter: 'all' }); }) + '">GO TO THE TRAIL ▶</button></section>';

    var common = GEM_ORDER.filter(function (f) { return !GEMS[f].rare; }).map(function (f) {
      var g = GEMS[f], have = gems[f] || 0, qs = quests(f);
      return '<button class="codex-cell' + (have ? '' : ' unfound') + '" data-act="' + act(function () { showFamily(f); }) + '" aria-label="' + esc(g.name + ', ' + f + ': ' + have + ' gems, ' + cleared(f) + ' of ' + qs.length + ' temples cleared. Show these trails.') + '">' +
        '<div class="codex-gem">' + px(gemPixels(f, 4)) + '</div>' +
        '<span class="codex-name" style="color:' + g.color + '">' + esc(g.name) + '</span>' +
        '<span class="codex-fam">' + esc(SHORT[f].toLowerCase()) + '</span>' +
        '<span class="codex-count">' + have + (shards[f] ? ' <span style="color:' + g.color + '">◆' + shards[f] + '</span>' : '') + '</span>' +
        '<span class="codex-fam">' + cleared(f) + '/' + qs.length + ' cleared</span>' +
      '</button>';
    }).join('');
    var rare = GEM_ORDER.filter(function (f) { return GEMS[f].rare; }).map(function (f) {
      var g = GEMS[f], have = gems[f] || 0, big = gemPixels(f, g.shape[0].length > 8 ? 8 : 9);
      var q = quests(f)[0];
      return '<button class="rare-card' + (have ? '' : ' unfound') + '" data-act="' + act(function () { showFamily(f); }) + '" aria-label="' + esc(g.name + ', ' + f + ': ' + have + ' found. Show the trail.') + '">' +
        '<div class="rare-art"><div class="bob">' + px(big) + '<span class="twinkle tw2"></span></div></div>' +
        '<div class="rare-text"><span class="px" style="font-size:11px;color:' + g.color + '">' + esc(g.name.toUpperCase()) + '</span>' +
          '<span class="t">' + esc(f) + ' · ' + (have ? have + ' found' : 'not found') + '</span>' +
          '<span class="tag">' + esc(RARE_LORE[f] || '') + '</span>' +
          (q ? '<span class="tag gold">From: ' + esc(q.title.replace(/ \(.*\)$/, '')) + '</span>' : '') +
        '</div></button>';
    }).join('');

    return '<div class="screen">' +
      '<header class="feed-head jungle-head">' + canopy() + '<div class="brand-row"><div class="brand-col"><span class="brand">SATCHEL</span><span class="tag">' + v.totalGems + ' gems · ' + v.dailyRune.carvedCount + '/24 runes</span></div>' + soundButton() + '</div></header>' +
      '<main class="scroll" data-scroll="satchel"><div class="body">' +
        treasuryPanel(game.worldVals()) +
        '<section class="panel"><div class="row-between"><h2 class="px small cyan">' + sp('runestone', 2) + ' RUNESTONE</h2><span class="tag">one rune a day</span></div>' + runestone + today + '</section>' +
        '<section class="panel"><h2 class="px small">GEMS</h2><div class="codex-grid">' + common + '</div></section>' +
        '<section class="panel"><h2 class="px small gold">★ RARE</h2>' + rare + '</section>' +
        sayingsPanel(game.worldVals()) +
        '<section class="side"><span class="px muted" style="font-size:8px;line-height:1.6">HOW THE JUNGLE PAYS</span>' +
          '<p>Trail markers pay half a temple’s gems; the guardian pays the rest when every trial passes (Easy 3, Medium 5, Hard 8). ' +
          'Secondary topics drop shards ◆ — five fuse into a gem. Rare gems drop only from guardians. Nothing in the jungle ever takes gems away.</p></section>' +
      '</div></main>' + nav('satchel') +
    '</div>';
  }

  // ---------------- journal ----------------
  function familyColor(fam) { return (GEMS[fam] && GEMS[fam].color) || '#A9C2A6'; }
  function journalScreen() {
    var L = ui.log, s = L.stats;
    var body;
    if (L.loading && !s) body = '<p class="tag blink">LOADING…</p>';
    else if (L.error) body = '<p class="error" role="alert">' + esc(L.error) + '</p>';
    else {
      var grid = s.days.map(function (d) {
        var level = d.attempts === 0 ? 0 : d.attempts === 1 ? 1 : d.attempts < 4 ? 2 : 3;
        var label = d.day + ': ' + d.attempts + ' attempt' + (d.attempts === 1 ? '' : 's');
        return '<div class="cell l' + level + (d.day === s.today ? ' today' : '') + '" title="' + label + '" aria-label="' + label + '"></div>';
      }).join('');
      var rows = L.attempts.length ? L.attempts.map(function (a) {
        return '<button class="attempt-row" data-act="' + act(function () { openAttempt(a.id); }) + '">' +
          '<span class="dot" style="background:' + familyColor(a.family) + '"></span>' +
          '<span class="attempt-main"><span class="attempt-title">' + esc(a.title) + '</span>' +
          '<span class="tag">' + esc(when(a.createdAt)) + ' · ' + esc(a.difficulty) + '</span></span>' +
          '<span class="attempt-tag ' + (a.passed === false ? 'failed' : a.firstClear ? 'first' : '') + '">' +
            (a.passed === false ? 'BLOCKED ' + (a.testsTotal ? a.testsPassed + '/' + a.testsTotal : '') : a.firstClear ? '+' + a.gemsEarned : 'RETURN') + '</span>' +
          '</button>';
      }).join('') : '<p class="tag">No entries yet. Face a guardian and it will show up here.</p>';
      body =
        '<section class="streak">' + sp('torch', 3) +
          '<div><span class="px gold" style="font-size:16px">' + s.streak + '</span> <span class="tag">day' + (s.streak === 1 ? '' : 's') + ' on the trail</span></div>' +
          '<span class="tag">best ' + s.bestStreak + ' · ' + s.totals.clears + ' temples cleared · ' + s.totals.attempts + ' guardian fights</span>' +
        '</section>' +
        '<section class="panel"><h2 class="px small">LAST 30 DAYS</h2><div class="grid30" role="img" aria-label="Activity over the last 30 days">' + grid + '</div>' +
          '<div class="legend tag"><span>less</span><div class="cell l0"></div><div class="cell l1"></div><div class="cell l2"></div><div class="cell l3"></div><span>more</span></div></section>' +
        '<section class="panel"><h2 class="px small">RECENT ENTRIES</h2>' + rows + '</section>';
    }
    var place = (game.state || {}).place;
    var where = '<section class="panel"><h2 class="px small">WEATHER LOCATION</h2>' +
      (place && !ui.loc.open ? '<div class="row-between"><span class="soft">' + sp('flag', 2) + ' ' + esc(place.name + (place.country ? ', ' + place.country : '')) + '</span>' +
        '<button class="btn" data-act="' + act(function () { ui.loc.open = true; render(); }) + '">CHANGE</button></div>' : locationPanel(true)) + '</section>';
    var soundOn = Sfx.isOn(), ambOn = Sfx.ambienceOn();
    var settings = '<section class="panel"><h2 class="px small">SOUNDS</h2>' +
      '<button class="toggle-row" role="switch" aria-checked="' + soundOn + '" data-act="' + act(function () { Sfx.setOn(!Sfx.isOn()); Sfx.play('gem'); render(); }) + '"><span>Sound effects</span><span class="toggle ' + (soundOn ? 'on' : '') + '">' + (soundOn ? 'ON' : 'OFF') + '</span></button>' +
      '<button class="toggle-row" role="switch" aria-checked="' + ambOn + '" data-act="' + act(function () { Sfx.setAmbience(!Sfx.ambienceOn()); render(); }) + '"' + (soundOn ? '' : ' disabled') + '><span>Jungle ambience (wind and birds)</span><span class="toggle ' + (ambOn ? 'on' : '') + '">' + (ambOn ? 'ON' : 'OFF') + '</span></button>' +
      '</section>';
    return '<div class="screen">' +
      '<header class="feed-head jungle-head">' + canopy() + '<div class="brand-row"><div class="brand-col"><span class="brand">JOURNAL</span>' +
        '<span class="tag">' + esc(ui.user || '') + ' · ' + esc(syncLabel()) + '</span></div>' + soundButton() + '</div></header>' +
      '<main class="scroll" data-scroll="journal"><div class="body">' + body + where + settings +
        '<button class="btn ghost big" data-act="' + act(logout) + '">LEAVE THE JUNGLE (SIGN OUT)</button></div></main>' +
      nav('journal') +
    '</div>';
  }
  function syncLabel() {
    return { idle: 'synced', saving: 'saving…', saved: 'saved to account', offline: 'offline — will retry' }[ui.syncState];
  }

  function attemptScreen() {
    var a = ui.attempt;
    var head = '<header class="walk-head"><div class="walk-row">' +
      '<button class="icon-btn" aria-label="Back to the journal" data-act="' + act(function () { ui.view = 'journal'; render(); }) + '">' + ICON.back + '</button>' +
      '<div class="walk-title"><span class="px">' + esc(a ? a.title : 'Entry') + '</span><span class="muted">' + esc(a ? when(a.createdAt) : '') + '</span></div></div></header>';
    var body;
    if (!a) body = '<p class="tag blink">LOADING…</p>';
    else {
      var problem = PROBLEMS.filter(function (p) { return p.title === a.title; })[0];
      var qa = (a.answers || []).map(function (ans, i) {
        var q = problem && problem.steps[i] ? problem.steps[i].q : 'Marker ' + (i + 1);
        return '<div class="note"><span class="px muted" style="font-size:8px">MARKER ' + (i + 1) + '</span><p class="muted">' + esc(q) + '</p><p>' + esc(ans || '—') + '</p></div>';
      }).join('');
      var result = a.passed === false ? 'Blocked' + (a.testsTotal ? ' ' + a.testsPassed + '/' + a.testsTotal : '') : a.firstClear ? '+' + a.gemsEarned + ' gems' : 'Passed';
      body = '<div class="stats"><div class="stat"><span class="px">RESULT</span><span>' + esc(result) + '</span></div>' +
        '<div class="stat"><span class="px">LEVEL</span><span>' + esc(a.difficulty) + '</span></div></div>' +
        (a.failure ? '<section class="fail"><span class="px fail-title">WHAT FAILED</span><p>' + esc(a.failure) + '</p></section>' : '') +
        '<section class="notes"><h2>YOUR CARVINGS</h2>' + qa + '</section>' +
        '<section class="notes"><h2>YOUR CODE</h2><pre class="example code-view">' + esc(a.code || '(empty)') + '</pre></section>';
    }
    return '<div class="screen">' + head + '<main class="scroll"><div class="body">' + body + '</div></main></div>';
  }

  // ---------------- live weather and the explorer's location ----------------
  var WMO_TEXT = { 0: 'clear sky', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'freezing fog', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
    56: 'freezing drizzle', 57: 'freezing drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain', 66: 'freezing rain', 67: 'freezing rain', 71: 'light snow', 73: 'snow',
    75: 'heavy snow', 77: 'snow grains', 80: 'rain showers', 81: 'rain showers', 82: 'violent showers', 85: 'snow showers', 86: 'snow showers', 95: 'thunderstorm',
    96: 'thunderstorm with hail', 99: 'thunderstorm with heavy hail' };
  function loadWeather() {
    var place = (game.state || {}).place;
    if (!place) { game.setWeather(null); return; }
    api('/weather?lat=' + encodeURIComponent(place.lat) + '&lon=' + encodeURIComponent(place.lon)).then(function (r) {
      ui.notices = r.data.notices || [];
      if (!r.ok) { ui.wxError = r.data.error || 'No weather right now.'; game.setWeather(null); render(); return; }
      ui.wxError = '';
      var w = weatherFromCode(r.data.code, r.data.temp);
      game.setWeather(w ? Object.assign({}, w, { temp: r.data.temp, isDay: r.data.isDay, real: WMO_TEXT[r.data.code] || 'code ' + r.data.code, place: place.name,
        source: r.data.source, stale: !!r.data.stale }) : null);
      render();
    });
  }
  // Refresh every 30 minutes, but only while the page is open and visible (no fetching in the background).
  var lastWeatherAt = 0;
  function refreshWeatherIfDue() {
    if (!ui.user || ui.view === 'auth' || document.visibilityState !== 'visible') return;
    if (Date.now() - lastWeatherAt < 30 * 60 * 1000) return;
    lastWeatherAt = Date.now(); loadWeather();
  }
  setInterval(refreshWeatherIfDue, 60 * 1000);
  document.addEventListener('visibilitychange', refreshWeatherIfDue);

  function choosePlace(place) {
    ui.loc = { open: false, results: [], busy: false, error: '', q: '' };
    game.setPlace(place);
    loadWeather();
  }
  function searchCity(q) {
    q = (q || '').trim();
    if (q.length < 2) { ui.loc.error = 'Type at least two letters of a city.'; render(); return; }
    ui.loc.q = q; ui.loc.busy = true; ui.loc.error = ''; render();
    api('/geocode?q=' + encodeURIComponent(q)).then(function (r) {
      ui.loc.busy = false;
      ui.notices = r.data.notices || [];
      if (!r.ok) { ui.loc.error = r.data.error || 'Couldn’t search right now.'; render(); return; }
      ui.loc.results = r.data.results || [];
      ui.loc.source = r.data.source || '';
      if (!ui.loc.results.length) ui.loc.error = 'No city called “' + q + '” on the map. Try another spelling.';
      render();
    });
  }
  function useMyLocation() {
    if (!navigator.geolocation) { ui.loc.error = 'This browser can’t share its location. Type a city instead.'; render(); return; }
    ui.loc.busy = true; ui.loc.error = ''; render();
    navigator.geolocation.getCurrentPosition(function (pos) {
      ui.loc.busy = false;
      choosePlace({ name: 'Your location', country: '', lat: Math.round(pos.coords.latitude * 100) / 100, lon: Math.round(pos.coords.longitude * 100) / 100 });
    }, function () {
      ui.loc.busy = false; ui.loc.error = 'Location wasn’t shared. Type a city instead.'; render();
    }, { timeout: 10000, maximumAge: 3600000 });
  }
  function locationPanel(inJournal) {
    var L = ui.loc, place = (game.state || {}).place;
    var results = L.results.map(function (p) {
      var label = p.name + (p.region ? ', ' + p.region : '') + (p.country ? ' · ' + p.country : '');
      return '<button class="place-row" data-act="' + act(function () { choosePlace({ name: p.name, country: p.country, lat: p.lat, lon: p.lon }); }) + '">' + sp('flag', 2) + '<span>' + esc(label) + '</span></button>';
    }).join('');
    return '<section class="loc-card' + (inJournal ? ' in-journal' : '') + '">' + (inJournal ? '' : deco('leaf', 2, true, 'top:-12px;right:-10px')) +
      '<div class="row-between"><span class="px gold" style="font-size:9px">' + (place && !inJournal ? 'CHANGE YOUR JUNGLE' : 'WHERE IS YOUR JUNGLE?') + '</span>' +
        (!inJournal ? '<button class="mini-link" data-act="' + act(function () { ui.loc.open = false; ui.locSkipped = true; try { localStorage.setItem('stepwise:locskip', '1'); } catch (e) { /* ignore */ } render(); }) + '">LATER</button>' : '') + '</div>' +
      '<p class="soft" style="margin:0">The jungle’s weather follows the real sky over your city: sunshine pays gold, hail drops volcanic stones. Only the city is used — never an address.</p>' +
      '<button class="btn moss-btn" data-act="' + act(useMyLocation) + '"' + (L.busy ? ' disabled' : '') + '>' + (L.busy ? '…' : 'USE MY LOCATION') + '</button>' +
      '<form class="city-form" id="city-form" novalidate><label for="city-q" class="px muted" style="font-size:8px">OR TYPE ANY CITY IN THE WORLD</label>' +
        '<div class="city-row"><input id="city-q" name="q" autocomplete="off" placeholder="Rome, Hanoi, Lagos…" value="' + esc(L.q) + '"><button class="btn" type="submit"' + (L.busy ? ' disabled' : '') + '>FIND</button></div></form>' +
      (L.error ? '<p class="error" role="alert">' + esc(L.error) + '</p>' : '') +
      (results ? '<div class="place-list">' + results + '</div>' + credit('geo-' + L.source) : '') + noticeLines() +
    '</section>';
  }

  // Credits the data licences ask for, and any "you are blocked" notices from the server.
  var CREDITS = {
    'open-meteo': '<a href="https://open-meteo.com/" target="_blank" rel="noopener">Weather data by Open-Meteo.com</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>',
    'met-norway': '<a href="https://api.met.no/" target="_blank" rel="noopener">Weather data from MET Norway</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>, mapped to jungle weather',
    'geo-open-meteo': 'Places: <a href="https://open-meteo.com/en/docs/geocoding-api" target="_blank" rel="noopener">Open-Meteo</a> / <a href="https://www.geonames.org/" target="_blank" rel="noopener">GeoNames</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>',
    'geo-nominatim': 'Places: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> · ODbL'
  };
  function credit(key) { return CREDITS[key] ? '<p class="credit">' + CREDITS[key] + '</p>' : ''; }
  function noticeLines() {
    return (ui.notices || []).map(function (n) { return '<p class="blocked-notice" role="alert">⚠ ' + esc(n) + '</p>'; }).join('');
  }

  // Animated sky over the header, matched to the live weather.
  function skyLayer(w, moon) {
    if (!w && !(moon && moon.key === 'full')) return '';
    var key = w ? w.key : 'night', bits = '';
    var n = { sunshine: 0, monsoon: 26, thunder: 18, hail: 14, mist: 5, frost: 22, calm: 3 }[key] || 0;
    for (var i = 0; i < n; i++) bits += '<i style="left:' + ((i * 37) % 100) + '%;animation-delay:-' + ((i * 0.23) % 1.6).toFixed(2) + 's;animation-duration:' + (0.9 + (i % 5) * 0.18).toFixed(2) + 's"></i>';
    var art = key === 'sunshine' ? '<div class="sky-sun">' + sp('sun', 3) + '</div>' : key === 'thunder' || key === 'hail' ? '<div class="sky-flash"></div>' : '';
    var moonArt = moon && moon.key === 'full' && !(w && w.isDay) ? '<div class="sky-moon">' + sp('moon', 2) + '</div>' : '';
    return '<div class="sky sky-' + key + '" aria-hidden="true">' + art + moonArt + bits + '</div>';
  }

  function weatherBanner(wv) {
    var w = wv.weather, m = wv.moon;
    var moonLine = m.effect ? '<div class="moon-line">' + sp('moon', 1) + '<span><b class="px" style="font-size:8px">' + esc(m.name.toUpperCase()) + '</b> · ' + esc(m.effect) + (m.key === 'full' && wv.wolfRegion ? ' Tonight it is in ' + esc(wv.wolfRegion.toLowerCase()) + '.' : '') + '</span></div>' : '';
    if (!w) {
      if (!wv.place) return moonLine ? '<section class="weather" style="background:#0E1430;border-color:#C9CFDB">' + moonLine + '</section>' : '';
      return '<section class="weather" style="background:#18382A;border-color:#2F6146">' + sp('mist', 2) + '<div><span class="px muted" style="font-size:9px">' + esc((wv.place.name || '').toUpperCase()) + '</span><p>' + esc(ui.wxError || 'Reading the sky…') + '</p>' + noticeLines() + moonLine + '</div></section>';
    }
    var stones = wv.stones.length ? '<div class="stones-row">' + wv.stones.map(function (s, i) {
      return '<button class="vstone' + (s.taken ? ' taken' : '') + '" aria-label="' + (s.taken ? 'Stone collected' : 'Volcanic stone ' + (i + 1) + ': tap for 5 gold') + '" data-act="' + act(s.tap) + '"' + (s.taken ? ' disabled' : '') + '>' + sp('ember', 3) + '<span>' + (s.taken ? '✓' : '+5') + '</span></button>';
    }).join('') + '</div>' : '';
    return '<section class="weather live" style="background:' + w.bg + ';border-color:' + w.color + '">' + sp(w.sprite, 3) +
      '<div style="flex:1;min-width:0"><span class="px" style="font-size:8px;color:var(--muted)">' + esc((w.place || '').toUpperCase()) + (typeof w.temp === 'number' ? ' · ' + Math.round(w.temp) + '°' : '') + ' · ' + esc(w.real || '') + '</span>' +
      '<span class="px" style="display:block;margin-top:6px;font-size:10px;color:' + w.color + '">' + esc(w.title) + '</span><p>' + esc(w.effect) + '</p>' + stones + moonLine +
      (w.stale ? '<p class="credit">An older reading: the weather services are resting.</p>' : '') + noticeLines() + credit(w.source) + '</div></section>';
  }

  function goldChip(wv) {
    return '<button class="gold-chip" aria-label="' + wv.gold + ' gold, rank ' + esc(wv.rank.title) + '. Open the satchel" data-act="' + act(openSatchel) + '">' + sp('coin', 2) + '<span>' + wv.gold + '</span></button>';
  }

  // ---------------- the atlas ----------------
  function openAtlas() { Sfx.play('rustle'); ui.view = 'atlas'; ui.atlasFresh = true; render(); }
  function atlasScreen() {
    var wv = game.worldVals();
    var postsByPid = {};
    game.renderVals().posts.forEach(function (p) { postsByPid[p.pid] = p; });
    var head = '<header class="feed-head jungle-head">' + canopy() + skyLayer(wv.weather, wv.moon) +
      '<div class="brand-row"><div class="brand-col"><span class="brand">' + (wv.region ? esc(wv.region.name) : 'ATLAS') + '</span><span class="tag">' +
        (wv.region ? wv.region.cleared + '/' + wv.region.total + ' temples · ' + esc(wv.region.fam.toLowerCase()) + (wv.region.fam2 ? ' & ' + esc(wv.region.fam2.toLowerCase()) : '')
          : 'Taro 75 + 3 bonus · 13 regions · tap a region') + '</span></div>' + goldChip(wv) + '</div>' +
      (wv.region ? '<button class="btn ghost" style="align-self:flex-start;position:relative" data-act="' + act(wv.region.back) + '">' + ICON.back + ' ALL REGIONS</button>' : '') +
    '</header>';
    var body = wv.region ? regionView(wv, postsByPid) : atlasOverview(wv);
    var sheet = '';
    if (wv.templePick !== null && postsByPid[wv.templePick]) {
      sheet = '<div class="sheet" role="dialog" aria-label="Temple"><div class="sheet-inner"><button class="mini-link sheet-close" data-act="' + act(wv.closePick) + '">CLOSE ✕</button>' + card(postsByPid[wv.templePick]) + '</div></div>';
    } else if (wv.curioOpen) sheet = curioSheet(wv);
    return '<div class="screen">' + head + '<main class="scroll" data-scroll="atlas' + (wv.regionKey ? ':' + wv.regionKey : '') + '">' + body + '</main>' + sheet + nav('atlas') + '</div>';
  }
  function atlasOverview(wv) {
    var list = wv.regions.slice().reverse().map(function (r, idx) {
      var temples = r.temples.map(function (t) {
        return '<span class="mini-temple' + (t.solved ? ' solved' : t.locked ? ' locked' : '') + '">' + sp(t.kind, 1) + '</span>';
      }).join('');
      var cls = 'region-card' + (r.reached ? '' : ' unreached') + (r.here ? ' here' : '');
      return (idx ? '<div class="region-trail" aria-hidden="true"></div>' : '') +
        '<button class="' + cls + '" style="--rc:' + r.color + ';--rb:' + r.bg + '" data-act="' + act(r.open) + '" aria-label="' + esc(r.name + ': ' + r.cleared + ' of ' + r.total + ' temples cleared' + (r.reached ? '' : ', not reached yet') + (r.curios ? ', ' + r.curios + ' curiosities' : '')) + '">' +
          '<div class="row-between"><span class="px" style="font-size:9px;color:' + r.color + '">' + esc(r.name) + '</span>' +
            '<span class="region-flags">' + (r.wolf ? sp('wolf', 1) : '') + (r.curios ? '<span class="qmark">?' + (r.curios > 1 ? r.curios : '') + '</span>' : '') + (r.here ? '<span class="you">' + sp('flag', 1) + 'YOU</span>' : '') + '</span></div>' +
          '<div class="mini-temples">' + temples + '</div>' +
          '<div class="row-between"><span class="tag">' + esc(r.fam.toLowerCase()) + '</span><span class="tag ' + (r.cleared === r.total ? 'gold' : '') + '">' + r.cleared + '/' + r.total + (r.reached ? '' : ' · beyond the vines') + '</span></div>' +
          '<div class="bar"><div style="width:' + Math.round(r.cleared / r.total * 100) + '%;background:' + r.color + '"></div></div>' +
        '</button>';
    }).join('');
    return '<div class="atlas">' + '<p class="tag" style="margin:0;text-align:center">▲ the crystal spires: hardest temples, rare gems ▲</p>' + list +
      '<p class="tag" style="margin:0;text-align:center">▼ the lowlands: where every expedition begins ▼</p></div>';
  }
  function regionView(wv, postsByPid) {
    var r = wv.region;
    var nodes = r.nodes.map(function (n, k) {
      var seg = k ? '<div class="path-seg" aria-hidden="true" style="left:' + ((n.x + r.nodes[k - 1].x) / 2) + '%"></div>' : '';
      var inner;
      if (n.isGate) {
        inner = '<div class="gate' + (n.sealed ? ' sealed' : '') + '">' + sp('runestone', 2) + '<span class="px" style="font-size:7px;line-height:1.5">' + esc(n.label) + '</span></div>';
      } else if (n.isCurio) {
        inner = '<button class="curio' + (n.taken ? ' taken' : '') + '" data-act="' + act(n.tap) + '" aria-label="' + esc(n.label) + (n.taken ? ' (found today)' : ': tap to look closer') + '">' +
          '<span class="curio-art">' + sp(n.sprite, n.kind === 'mist' ? 2 : 3) + (n.taken ? '' : '<span class="qmark">?</span>') + '</span><span class="curio-label">' + esc(n.label) + '</span></button>';
      } else {
        var size = n.kind === 'ziggurat' ? 4 : n.kind === 'spire' ? 4 : 3;
        inner = '<button class="temple-node' + (n.solved ? ' solved' : n.locked ? ' locked' : ' open') + (n.you ? ' you' : '') + '" style="--tc:' + n.color + '" data-act="' + act(n.tap) + '" aria-label="' + esc(n.title + ', ' + n.diff + (n.solved ? ', cleared' : n.locked ? ', sealed' : ', open')) + '">' +
          (n.you ? '<span class="you">' + sp('flag', 1) + 'YOU</span>' : '') +
          '<span class="temple-art">' + sp(n.kind, size) + (n.kind === 'ziggurat' && !n.locked ? '<span class="torch-glow"></span>' : '') + '</span>' +
          '<span class="temple-name">' + (n.solved ? '✓ ' : n.locked ? '🔒 ' : '') + esc(n.title) + '</span>' +
          '<span class="badge ' + BADGE_CLASS[n.diff] + '">' + esc(n.diff.toUpperCase()) + '</span></button>';
      }
      var flora = ['leaf', 'flower', 'vine', 'leaf'][k % 4];
      var side = n.x > 50 ? 'left:' + (4 + (k * 7) % 14) + '%' : 'right:' + (4 + (k * 5) % 14) + '%';
      return seg + '<div class="node' + (n.you ? ' you' : '') + '" style="--x:' + n.x + '%">' + deco(flora, 2 + (k % 2), k % 2 === 1, 'top:' + (10 + (k * 13) % 40) + 'px;' + side) + '<div class="node-in">' + inner + '</div></div>';
    }).join('');
    var top = '<div class="region-top" style="background:' + r.bg + '">' + px(r.gem) + '<span class="tag">' + (r.reached ? 'The higher you climb, the older and grander the temples.' : esc(r.lockWhy) + ' Curiosities appear once a temple here opens.') + '</span></div>';
    return '<div class="region-map" style="--rc:' + r.color + ';--rb:' + r.bg + '">' + top + '<div class="path">' + nodes + '</div><p class="tag" style="text-align:center;margin:8px 0 20px">▼ trailhead ▼</p></div>';
  }
  function curioSheet(wv) {
    var o = wv.curioOpen, body = '';
    var sprite = { fairy: 'fairy', runestone: 'runestone', mist: 'mist', totem: 'totem', toucan: 'toucan', monkey: 'monkey', frog: 'frog', wolf: 'wolf' }[o.kind] || 'runestone';
    if (o.kind === 'totem' && !o.done) {
      body = '<p class="soft">' + esc(o.text) + '</p><div class="tablet small">' + esc(o.question) + '</div>' +
        '<div class="field"><label for="totem">FROM MEMORY</label><textarea id="totem" class="answer short" data-field="curioDraft" placeholder="What do you remember?">' + esc(wv.curioDraft) + '</textarea></div>' +
        '<div class="row-between"><span class="tag gold">' + esc(o.reward) + '</span><button class="btn" id="totem-go" data-act="' + act(wv.answerTotem) + '"' + (wv.curioDraft.trim() ? '' : ' disabled') + '>ANSWER ▶</button></div>';
    } else {
      body = (o.glyph ? '<div class="rune-head"><span class="rune-glyph" aria-hidden="true">' + esc(o.glyph) + '</span><span class="tag">' + esc(o.text) + '</span></div><p class="saying">' + esc(o.quote) + '</p>' : o.text ? '<p class="soft">' + esc(o.text) + '</p>' : '') +
        (o.question ? '<div class="tablet small">' + esc(o.question) + '</div><div class="mine">' + esc(o.answer) + '</div><div class="angle"><span class="px cyan" style="font-size:9px">ANOTHER ANGLE</span><p>' + esc(o.insight) + '</p></div>' : '') +
        (o.reward ? '<span class="tag gold">' + (o.fresh ? '' : 'Found today · ') + esc(o.reward) + '</span>' : '');
    }
    return '<div class="sheet" role="dialog" aria-label="Curiosity"><div class="sheet-inner curio-sheet"><button class="mini-link sheet-close" data-act="' + act(wv.closeCurio) + '">CLOSE ✕</button>' +
      '<div class="enc-head"><div class="enc-art">' + sp(sprite, 4) + '</div><span class="px" style="font-size:10px;line-height:1.5;color:var(--gold)">' + esc(o.title) + '</span></div>' + body + '</div></div>';
  }

  // ---------------- the Hall of Explorers ----------------
  function openHall() {
    Sfx.play('rustle');
    ui.view = 'hall';
    loadHall();
  }
  function loadHall() {
    ui.hall.loading = true; ui.hall.error = ''; render();
    api('/leaderboard?period=' + ui.hall.period).then(function (r) {
      ui.hall.loading = false;
      if (r.status === 401) return signedOut();
      if (!r.ok) { ui.hall.error = r.data.error || 'The hall is closed right now.'; render(); return; }
      ui.hall.data = r.data; render();
    });
  }
  function hallScreen() {
    var wv = game.worldVals(), H = ui.hall;
    var list = H.data ? H.data.explorers.map(function (e) {
      // Your own row uses the gold on this device, which may be a moment ahead of the last save.
      return e.you ? Object.assign({}, e, { gold: Math.max(e.gold, wv.gold) }) : e;
    }) : [];
    var rankOf = function (gold) { var x = RANKS[0]; RANKS.forEach(function (r) { if (gold >= r.min) x = r; }); return x; };
    var podium = [1, 0, 2].map(function (i) {
      var e = list[i], h = [118, 150, 96][[1, 0, 2].indexOf(i)];
      if (!e) return '<div class="plinth empty" style="--h:' + h + 'px"><div class="plinth-who"><span class="tag">awaiting an explorer</span></div><div class="plinth-base"><span class="px">' + (i + 1) + '</span></div></div>';
      var rk = rankOf(e.gold);
      return '<div class="plinth' + (e.you ? ' you' : '') + '" style="--h:' + h + 'px;--pc:' + rk.color + '"><div class="plinth-who">' + (i === 0 ? '<span class="crown-glow"></span>' : '') + sp(rk.sprite, i === 0 ? 4 : 3) +
        '<span class="px" style="font-size:8px">' + esc(e.username) + (e.you ? ' (YOU)' : '') + '</span><span class="tag" style="color:' + rk.color + '">' + esc(rk.title) + '</span>' +
        '<span class="gold-line">' + sp('coin', 1) + (H.period === 'week' ? e.week : e.gold) + '</span></div><div class="plinth-base"><span class="px">' + (i + 1) + '</span></div></div>';
    }).join('');
    var rows = list.slice(3).map(function (e) {
      var rk = rankOf(e.gold);
      return '<div class="hall-row' + (e.you ? ' you' : '') + '"><span class="px">' + e.place + '</span>' + sp(rk.sprite, 1) + '<span class="hall-name">' + esc(e.username) + '<span class="tag"> · ' + esc(rk.title.toLowerCase()) + '</span></span><span class="gold-line">' + sp('coin', 1) + (H.period === 'week' ? e.week : e.gold) + '</span></div>';
    }).join('');
    var me = list.filter(function (e) { return e.you; })[0];
    var tabs = '<div class="tabs" role="tablist">' + ['all', 'week'].map(function (p) {
      return '<button role="tab" aria-selected="' + (H.period === p) + '" class="chip' + (H.period === p ? ' on' : '') + '" data-act="' + act(function () { ui.hall.period = p; loadHall(); }) + '">' + (p === 'all' ? 'ALL TIME' : 'THIS WEEK') + '</button>';
    }).join('') + '</div>';
    var body = H.loading && !H.data ? '<p class="tag blink">LOADING…</p>' : H.error ? '<p class="error" role="alert">' + esc(H.error) + '</p>' :
      '<section class="podium">' + deco('torch', 2, false, 'top:8px;left:8px') + deco('torch', 2, true, 'top:8px;right:8px') + podium + '</section>' +
      (rows ? '<section class="panel">' + rows + '</section>' : '') +
      (list.length < 2 ? '<p class="tag" style="text-align:center;margin:0">The hall is quiet for now. Every explorer who joins with an invite appears here automatically.</p>' : '') +
      (me ? '<section class="rank-card" style="--pc:' + wv.rank.color + '">' + sp(wv.rank.sprite, 4) + '<div class="rank-text"><span class="px" style="font-size:9px;color:' + wv.rank.color + '">YOU · #' + me.place + ' · ' + esc(wv.rank.title) + '</span>' +
        '<p class="soft" style="margin:4px 0">' + esc(wv.rank.gear) + '</p>' +
        (wv.rank.nextTitle ? '<span class="tag">' + wv.rank.toNext + ' gold to ' + esc(wv.rank.nextTitle) + '</span><div class="bar"><div style="width:' + wv.rank.pct + ';background:' + wv.rank.color + '"></div></div>' : '<span class="tag gold">The highest rank in the jungle.</span>') + '</div></section>' : '') +
      '<section class="panel"><h2 class="px small">RANKS AND GEAR</h2><div class="ranks-row">' + RANKS.map(function (r) {
        var on = wv.gold >= r.min;
        return '<div class="rank-cell' + (on ? '' : ' dim') + '" style="--pc:' + r.color + '">' + sp(r.sprite, 2) + '<span class="px" style="font-size:6px;line-height:1.5;color:' + r.color + '">' + esc(r.title) + '</span><span class="tag" style="font-size:15px">' + r.min + '+</span></div>';
      }).join('') + '</div></section>';
    return '<div class="screen"><header class="feed-head jungle-head hall-head">' + canopy() + '<div class="brand-row"><div class="brand-col"><span class="brand">HALL OF EXPLORERS</span><span class="tag">ranked by gold · updates automatically</span></div>' + goldChip(wv) + '</div>' + tabs + '</header>' +
      '<main class="scroll" data-scroll="hall"><div class="body">' + body + '</div></main>' + nav('hall') + '</div>';
  }

  // ---------------- satchel additions: treasury and collected sayings ----------------
  function treasuryPanel(wv) {
    var rows = wv.treasury.map(function (t) {
      return '<div class="treasure-row">' + px(t.gem) + '<span class="t-name" style="color:' + t.color + '">' + esc(t.name) + '<span class="tag"> · ' + esc(SHORT[t.fam].replace(' ★', '').toLowerCase()) + '</span></span>' +
        '<span class="t-val">' + sp('coin', 1) + t.value + '</span><span class="t-have">' + t.have + (t.shards ? '<span style="color:' + t.color + '"> ◆' + t.shards + '</span>' : '') + '</span><span class="t-sub gold">' + t.subtotal + '</span></div>';
    }).join('');
    return '<section class="panel"><div class="row-between"><h2 class="px small gold">' + sp('coin', 2) + ' TREASURY</h2><span class="px gold" style="font-size:12px">' + wv.gold + '</span></div>' +
      '<section class="rank-card" style="--pc:' + wv.rank.color + '">' + sp(wv.rank.sprite, 4) + '<div class="rank-text"><span class="px" style="font-size:9px;color:' + wv.rank.color + '">' + esc(wv.rank.title) + '</span><p class="soft" style="margin:4px 0">' + esc(wv.rank.gear) + '</p>' +
        (wv.rank.nextTitle ? '<span class="tag">' + wv.rank.toNext + ' gold to ' + esc(wv.rank.nextTitle) + '</span><div class="bar"><div style="width:' + wv.rank.pct + ';background:' + wv.rank.color + '"></div></div>' : '<span class="tag gold">Temple Monarch: nothing above you but the sky.</span>') + '</div></section>' +
      '<div class="treasure-head tag"><span>gem</span><span>value</span><span>yours</span><span>gold</span></div>' + rows +
      '<p class="tag" style="margin:0">Harder ideas take more mental energy, so their gems are worth more gold. A shard ◆ is worth a fifth of its gem. Gold is counted, never spent' + (wv.gold > 0 ? '' : ' — clear a temple to start your hoard') + '.</p></section>';
  }
  function sayingsPanel(wv) {
    if (!wv.sayings.length) return '';
    return '<section class="panel"><h2 class="px small cyan">SAYINGS FROM THE RUNESTONES</h2>' + wv.sayings.slice(0, 12).map(function (x) {
      return '<div class="saying-row"><span class="rune-glyph small" aria-hidden="true">' + esc(x.g) + '</span><p class="saying" style="margin:0">' + esc(x.say) + '</p></div>';
    }).join('') + '</section>';
  }

  // ---------------- render loop ----------------
  var lastScreen = null;
  var shownReport = null;
  function screenHtml() {
    if (ui.view === 'boot') return { html: bootScreen(), key: 'boot' };
    if (ui.view === 'auth') return { html: authScreen(), key: 'auth' };
    if (ui.view === 'journal') return { html: journalScreen(), key: 'journal' };
    if (ui.view === 'satchel') return { html: satchelScreen(), key: 'satchel' };
    if (ui.view === 'attempt') return { html: attemptScreen(), key: 'attempt' };
    if (ui.view === 'atlas') return { html: atlasScreen(), key: 'atlas:' + ((game.state || {}).atlasRegion || '') };
    if (ui.view === 'hall') return { html: hallScreen(), key: 'hall' };
    var v = game.renderVals();
    return { html: v.isFeed ? feed(v) : walk(v), key: v.isFeed ? 'feed' : 'walk:' + (v.isStep ? 's' : v.isCode ? 'c' : 'r') };
  }
  function render() {
    document.querySelectorAll('[data-scroll]').forEach(function (el) { scrollMemory[el.getAttribute('data-scroll')] = el.scrollTop; });
    var focused = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-field');
    actions = [];
    var out = screenHtml();
    app.innerHTML = out.html + (ui.notice ? '<div class="toast" role="status">' + esc(ui.notice) + '</div>' : '');
    var el = app.querySelector('[data-scroll]');
    if (el) {
      var key = el.getAttribute('data-scroll');
      if (key.indexOf('atlas') === 0 && out.key !== lastScreen) {
        // A fresh look at the map starts where you are: at your flag, or at the trailhead.
        var you = el.querySelector('.node.you, .region-card.here');
        if (you) you.scrollIntoView({ block: 'center' }); else el.scrollTop = key === 'atlas' ? 0 : el.scrollHeight;
      } else if (key !== 'walk') el.scrollTop = scrollMemory[key] || 0;
      else if (out.key === lastScreen) el.scrollTop = scrollMemory.walk || 0;
      else el.scrollTop = 0;
    }
    // After a failed guardian fight, bring the failing trial into view (it sits below the editor).
    var rep = game.state && game.state.report;
    if (rep && rep !== shownReport) {
      var panel = app.querySelector('.fail');
      if (panel) { panel.scrollIntoView({ block: 'start' }); focused = null; }
    }
    shownReport = rep || null;
    if (focused) {
      var f = app.querySelector('[data-field="' + focused + '"]');
      if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
    }
    lastScreen = out.key;
  }
  game.onChange = function () {
    if (game.state && game.state.screen === 'walk' && ui.view !== 'game') ui.view = 'game';
    runBossIfNeeded();
    recordAttemptIfNew();
    game.takeCues().forEach(Sfx.play);
    render();
    persist();
  };

  app.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    // Typing changes state without a re-render, so rebuild the handlers from current state first.
    // The markup is deterministic, so action indices line up with what is on screen.
    actions = [];
    screenHtml();
    var fn = actions[+t.getAttribute('data-act')];
    if (fn) fn();
  });
  app.addEventListener('submit', function (e) {
    if (e.target.id === 'auth-form') { e.preventDefault(); submitAuth(e.target); }
    if (e.target.id === 'city-form') { e.preventDefault(); searchCity(e.target.q.value); }
  });
  // Typing updates state without re-rendering, so the cursor and keyboard stay put.
  var ENABLES = { draft: 'commit', ruinDraft: 'ruin-carve', frogDraft: 'enc-primary', curioDraft: 'totem-go' };
  app.addEventListener('input', function (e) {
    var field = e.target.getAttribute('data-field');
    if (!field) return;
    var patch = {}; patch[field] = e.target.value;
    game.state = Object.assign({}, game.state, patch);
    if (ENABLES[field]) {
      var btn = document.getElementById(ENABLES[field]);
      if (btn) btn.disabled = !e.target.value.trim();
    }
  });
  // Tab inserts two spaces in the code editor.
  app.addEventListener('keydown', function (e) {
    if (e.key === 'Tab' && e.target.getAttribute('data-field') === 'code') {
      e.preventDefault();
      var t = e.target, s = t.selectionStart;
      t.value = t.value.slice(0, s) + '  ' + t.value.slice(t.selectionEnd);
      t.selectionStart = t.selectionEnd = s + 2;
      game.state = Object.assign({}, game.state, { code: t.value });
    }
  });
  // Retry a failed save when the connection comes back.
  window.addEventListener('online', function () { lastSaved = ''; persist(); });

  boot();
})();
