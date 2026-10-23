// Renders the game (logic.js) plus the account screens, and syncs progress with the server.
(function () {
  var CACHE_KEY = 'stepwise:v1';
  var TZ = (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';
  var app = document.getElementById('app');
  var game = new Component();
  var actions = [];
  var scrollMemory = {};

  // App-level view state (the game's own screens live in game.state).
  var ui = {
    view: 'boot',            // boot | auth | game | log | attempt
    user: null,
    auth: { mode: 'login', error: '', busy: false, inviteRequired: true },
    log: { loading: false, stats: null, attempts: [], error: '' },
    attempt: null,           // detail of one past attempt
    notice: '',
    syncState: 'idle'        // idle | saving | saved | offline
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
  function progressSnapshot() {
    var s = game.state || {};
    return { solved: s.solved || {}, gems: s.gems || {}, shards: s.shards || {}, saved: s.saved || {}, fresh: s.fresh || {}, questDone: s.questDone || {} };
  }
  function applyProgress(saved) {
    // Always open on the full feed, whatever filter was last used on another device.
    game.state = Object.assign({}, game.state, saved || {}, {
      screen: 'feed', reviewed: false, unlocks: [], shardGain: [], fused: [], gain: 0, filter: 'all', judging: false, report: null
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

  // Record every boss run (passed or failed), with the answer typed for every question.
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

  // ---------------- boss stage: run the tests in a sandboxed worker ----------------
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
            fail: fail || { index: done, input: '', expected: '', got: '—', error: 'Time limit: test ' + (done + 1) + ' ran for over ' + CASE_TIME_LIMIT / 1000 + ' seconds. An infinite loop, or a much slower algorithm than needed?' }
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
  function logout() {
    api('/logout', { method: 'POST' }).then(signedOut);
  }

  // ---------------- log ----------------
  function openLog() {
    ui.view = 'log';
    ui.log.loading = true; ui.log.error = '';
    render();
    Promise.all([api('/stats?tz=' + encodeURIComponent(TZ)), api('/attempts?limit=50')]).then(function (rs) {
      ui.log.loading = false;
      if (rs[0].status === 401) return signedOut();
      if (!rs[0].ok || !rs[1].ok) { ui.log.error = (rs[0].data.error || rs[1].data.error || 'Couldn’t load your log.'); render(); return; }
      ui.log.stats = rs[0].data;
      ui.log.attempts = rs[1].data.attempts;
      render();
    });
  }
  function openAttempt(id) {
    ui.view = 'attempt'; ui.attempt = null; render();
    api('/attempts/' + id).then(function (r) {
      if (!r.ok) { notify(r.data.error || 'Couldn’t open that attempt.'); ui.view = 'log'; render(); return; }
      ui.attempt = r.data; render();
    });
  }

  // ---------------- helpers ----------------
  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function act(fn) { actions.push(fn); return actions.length - 1; }
  function gem(g, extraClass) {
    if (!g || !g.cells || !g.cells.length) return '';
    var cells = g.cells.map(function (c) {
      return '<i class="' + (c.cls || '') + '" style="background:' + c.bg + ';animation-delay:' + (c.d || '0s') + '"></i>';
    }).join('');
    return '<div class="gem ' + (g.fx || '') + ' ' + (extraClass || '') + '" aria-hidden="true" style="grid-template-columns:repeat(' + g.w + ',' + g.px + 'px);grid-auto-rows:' + g.px + 'px">' +
      cells + (g.rare ? '<span class="twinkle"></span>' : '') + '</div>';
  }
  function when(iso) {
    try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso; }
  }
  var ICON = {
    back: '<svg width="15" height="15" viewBox="0 0 5 5" shape-rendering="crispEdges" aria-hidden="true"><rect x="2" y="0" width="1" height="1" fill="#F4F1E8"/><rect x="1" y="1" width="1" height="1" fill="#F4F1E8"/><rect x="0" y="2" width="5" height="1" fill="#F4F1E8"/><rect x="1" y="3" width="1" height="1" fill="#F4F1E8"/><rect x="2" y="4" width="1" height="1" fill="#F4F1E8"/></svg>',
    check: '<svg width="15" height="12" viewBox="0 0 5 4" shape-rendering="crispEdges" aria-hidden="true"><rect x="4" y="0" width="1" height="1" fill="#3DDC84"/><rect x="3" y="1" width="1" height="1" fill="#3DDC84"/><rect x="0" y="1" width="1" height="1" fill="#3DDC84"/><rect x="1" y="2" width="2" height="1" fill="#3DDC84"/><rect x="2" y="3" width="1" height="1" fill="#3DDC84"/></svg>',
    lock: '<svg width="15" height="18" viewBox="0 0 5 6" shape-rendering="crispEdges" aria-hidden="true"><rect x="1" y="0" width="3" height="1" fill="#FFD23F"/><rect x="1" y="1" width="1" height="2" fill="#FFD23F"/><rect x="3" y="1" width="1" height="2" fill="#FFD23F"/><rect x="0" y="3" width="5" height="3" fill="#FFD23F"/><rect x="2" y="4" width="1" height="1" fill="#12112A"/></svg>',
    open: '<svg width="15" height="18" viewBox="0 0 5 6" shape-rendering="crispEdges" aria-hidden="true"><rect x="3" y="0" width="2" height="1" fill="#FFD23F"/><rect x="4" y="1" width="1" height="2" fill="#FFD23F"/><rect x="0" y="3" width="5" height="3" fill="#FFD23F"/><rect x="2" y="4" width="1" height="1" fill="#2A2150"/></svg>',
    bulb: '<svg width="12" height="18" viewBox="0 0 4 6" shape-rendering="crispEdges" aria-hidden="true"><rect x="1" y="0" width="2" height="1" fill="#FFB347"/><rect x="0" y="1" width="4" height="2" fill="#FFB347"/><rect x="1" y="3" width="2" height="1" fill="#FFB347"/><rect x="1" y="5" width="2" height="1" fill="#FFB347"/></svg>',
    feed: '<svg width="18" height="18" viewBox="0 0 6 6" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="0" width="6" height="2" fill="currentColor"/><rect x="0" y="3" width="6" height="3" fill="currentColor"/></svg>',
    log: '<svg width="18" height="18" viewBox="0 0 6 6" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="4" width="1" height="2" fill="currentColor"/><rect x="2" y="2" width="1" height="4" fill="currentColor"/><rect x="4" y="0" width="1" height="6" fill="currentColor"/></svg>',
    flame: '<svg width="18" height="21" viewBox="0 0 6 7" shape-rendering="crispEdges" aria-hidden="true"><rect x="2" y="0" width="1" height="1" fill="#FFB347"/><rect x="2" y="1" width="2" height="1" fill="#FFB347"/><rect x="1" y="2" width="3" height="1" fill="#FFB347"/><rect x="1" y="3" width="4" height="1" fill="#FF7A52"/><rect x="0" y="4" width="6" height="2" fill="#FF7A52"/><rect x="2" y="4" width="2" height="2" fill="#FFD23F"/><rect x="1" y="6" width="4" height="1" fill="#E2552E"/></svg>'
  };
  function bookmark(fill) {
    return '<svg width="16" height="20" viewBox="0 0 4 5" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="0" width="4" height="4" fill="' + fill + '"/><rect x="0" y="4" width="1" height="1" fill="' + fill + '"/><rect x="3" y="4" width="1" height="1" fill="' + fill + '"/></svg>';
  }
  function quest(color) {
    return '<svg width="14" height="16" viewBox="0 0 7 8" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="0" width="7" height="8" fill="' + color + '"/><rect x="1" y="1" width="5" height="6" fill="#12112A"/><rect x="2" y="2" width="3" height="1" fill="' + color + '"/><rect x="2" y="4" width="3" height="1" fill="' + color + '"/></svg>';
  }

  // ---------------- screens ----------------
  function nav(active) {
    var s = game.state || {};
    var savedOn = active === 'game' && s.filter === 'saved';
    var feedOn = active === 'game' && !savedOn;
    return '<nav class="nav" aria-label="Main">' +
      '<button class="' + (feedOn ? 'on' : '') + '" data-act="' + act(function () { ui.view = 'game'; if (game.state.filter === 'saved') game.setState({ filter: 'all' }); else render(); }) + '">' + ICON.feed + 'FEED</button>' +
      '<button class="' + (savedOn ? 'on' : '') + '" data-act="' + act(function () { ui.view = 'game'; game.setState({ filter: 'saved' }); }) + '">' + bookmark('currentColor') + 'SAVED</button>' +
      '<button class="' + (active === 'log' ? 'on' : '') + '" data-act="' + act(openLog) + '">' + ICON.log + 'LOG</button>' +
      '</nav>';
  }

  function bootScreen() {
    return '<div class="screen center"><span class="brand">STEPWISE</span><span class="tag blink">LOADING…</span>' +
      '<span class="tag" style="text-align:center;padding:0 24px">The server naps when idle — the first load can take up to a minute.</span></div>';
  }

  function authScreen() {
    var a = ui.auth, signup = a.mode === 'signup';
    return '<div class="screen"><main class="scroll"><div class="auth">' +
      '<span class="brand">STEPWISE</span><span class="tag">Think first. Code second.</span>' +
      '<div class="tabs" role="tablist">' +
        '<button role="tab" aria-selected="' + !signup + '" class="chip' + (!signup ? ' on' : '') + '" data-act="' + act(function () { a.mode = 'login'; a.error = ''; render(); }) + '">SIGN IN</button>' +
        '<button role="tab" aria-selected="' + signup + '" class="chip' + (signup ? ' on' : '') + '" data-act="' + act(function () { a.mode = 'signup'; a.error = ''; render(); }) + '">NEW ACCOUNT</button>' +
      '</div>' +
      '<form class="auth-form" id="auth-form" novalidate>' +
        '<div class="field"><label for="username">USERNAME</label><input id="username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required></div>' +
        '<div class="field"><label for="password">PASSWORD</label><input id="password" name="password" type="password" autocomplete="' + (signup ? 'new-password' : 'current-password') + '" required minlength="8"></div>' +
        (signup && a.inviteRequired ? '<div class="field"><label for="invite">INVITE CODE</label><input id="invite" name="invite" autocomplete="off" spellcheck="false"></div>' : '') +
        (signup && !a.inviteRequired ? '<p class="tag">You’re the first player — this account becomes the owner.</p>' : '') +
        (a.error ? '<p class="error" role="alert">' + esc(a.error) + '</p>' : '') +
        '<button class="btn big" type="submit"' + (a.busy ? ' disabled' : '') + '>' + (a.busy ? '…' : signup ? 'CREATE ACCOUNT ▶' : 'SIGN IN ▶') + '</button>' +
      '</form>' +
      '<p class="tag">Your gems, cleared quests, answers and code are saved to your account, so they follow you between devices.</p>' +
    '</div></main></div>';
  }

  function feed(v) {
    var vault = v.vault.map(function (g) {
      return '<div class="vault-item' + (g.gem.rare ? ' rare' : '') + '" role="img" aria-label="' + esc(g.label) + '" style="opacity:' + g.dim + '">' +
        '<div class="vault-gem">' + gem(g.gem) + '</div>' +
        '<span class="vault-count" style="color:' + g.color + '">' + g.count + '</span>' +
        '<span class="vault-name">' + esc(g.name) + '</span>' +
        '<span class="vault-shard" style="color:' + g.color + '">' + esc(g.shardLabel) + '</span></div>';
    }).join('');
    var chips = v.chips.map(function (c) {
      return '<button class="chip' + (c.on ? ' on' : '') + '" aria-pressed="' + c.on + '" data-act="' + act(c.pick) + '">' + esc(c.label) + '</button>';
    }).join('');
    var posts = v.posts.map(card).join('');
    var empty = v.posts.length ? '' : '<p class="end">Nothing here yet. Tap the bookmark on a quest to save it for later.</p>';
    return '<div class="screen">' +
      '<header class="feed-head">' +
        '<div class="brand-row"><div style="display:flex;flex-direction:column;gap:6px"><span class="brand">STEPWISE</span><span class="tag">Think first. Code second.</span></div>' +
        '<span class="px muted" style="font-size:9px;padding-bottom:4px">TOTAL ' + v.totalGems + '</span></div>' +
        '<div class="vault" aria-label="Gem vault">' + vault + '</div>' +
        '<div class="chips" aria-label="Filter by gem family">' + chips + '</div>' +
        '<span class="tag">' + esc(v.feedCount) + '</span>' +
      '</header>' +
      '<main class="scroll" data-scroll="feed"><div class="feed">' + posts + empty +
        (v.posts.length ? '<p class="end">— END OF FEED —</p>' : '') + '</div></main>' +
      nav('game') +
    '</div>';
  }

  function card(p) {
    var cls = 'card' + (p.solved ? ' solved' : (p.fresh ? ' fresh' : '')) + (p.locked ? ' locked' : '');
    var top = '<div class="card-top">' +
      '<div class="avatar" aria-hidden="true" style="border-color:' + p.gemColor + ';color:' + p.gemColor + '">' + esc(p.mono) + '</div>' +
      '<div class="card-meta"><span class="t">' + esc(p.topic) + '</span><span class="m">' + esc(p.meta) + '</span></div>' +
      (p.fresh ? '<span class="badge new blink">NEW</span>' : '') +
      '<span class="badge" style="background:' + p.badgeBg + ';color:' + p.badgeFg + '">' + esc(p.diff) + '</span></div>';
    var body;
    if (p.locked) {
      var reqs = p.reqs.map(function (r) {
        return '<div class="req"><div class="req-icon">' + (r.isGem ? gem(r.gem) : quest(r.color)) + '</div>' +
          '<div class="req-body"><span class="req-label" style="color:' + r.textColor + '">' + esc(r.label) + '</span>' +
          '<div class="bar"><div style="width:' + r.pct + ';background:' + r.color + '"></div></div></div></div>';
      }).join('');
      body = '<div class="lock"><div class="lock-title">' + ICON.lock + 'LOCKED QUEST</div><p>' + esc(p.lockWhy) + ' To unlock:</p>' + reqs + '</div>';
    } else {
      body = '<p class="prompt">' + esc(p.prompt) + '</p>' +
        (p.hasBuilds ? '<span class="builds">✓ Builds on ' + esc(p.buildsOn) + '</span>' : '') +
        '<pre class="example">' + esc(p.example) + '</pre>' +
        (p.solved ? '<div class="cleared">' + ICON.check + 'CLEARED · GEMS COLLECTED</div>' : '') +
        '<div class="actions">' +
          '<button class="icon-btn" aria-label="' + esc(p.saveLabel) + '" data-act="' + act(p.toggleSave) + '">' + bookmark(p.saveFill) + '</button>' +
          '<div class="reward" style="color:' + p.gemColor + '">' + gem(p.gem) + esc(p.rewardLabel) + '</div>' +
          '<button class="btn" data-act="' + act(p.open) + '">' + esc(p.cta) + '</button>' +
        '</div>' +
        (p.hasShards ? '<span class="drops">◆ Also drops shards: ' + esc(p.shardNames) + '</span>' : '');
    }
    return '<article class="' + cls + '">' + top + '<h2>' + esc(p.title) + '</h2>' + body + '</article>';
  }

  function walk(v) {
    var head = '<header class="walk-head"><div class="walk-row">' +
      '<button class="icon-btn" aria-label="Back to feed" data-act="' + act(v.backToFeed) + '">' + ICON.back + '</button>' +
      '<div class="walk-title"><span class="px">' + esc(v.cur.title) + '</span><span class="muted">' + esc(v.phaseLabel) + '</span></div>' +
      '<div class="gem-chip" role="img" aria-label="' + esc(v.cur.gemLabel) + '" style="border-color:' + v.cur.gemColor + '">' + gem(v.cur.gem) + v.cur.gemCount + '</div>' +
      '</div><div class="segs" aria-hidden="true">' + v.segs.map(function (s) { return '<div style="background:' + s.bg + '"></div>'; }).join('') + '</div></header>';
    var main, foot;
    if (v.isStep) {
      main = '<span class="kicker">QUEST ' + v.stepNum + '/' + v.stepTotal + '</span>' +
        '<div class="question"><h1>' + esc(v.question) + '</h1></div>';
      if (v.notRevealed) {
        main += '<button class="hint-btn" aria-expanded="' + v.tipOpen + '" data-act="' + act(v.toggleTip) + '">' + ICON.bulb + esc(v.tipLabel) + '</button>' +
          (v.tipOpen ? '<p class="hint">' + esc(v.tip) + '</p>' : '') +
          '<div class="field"><label for="answer">YOUR ANSWER</label>' +
          '<textarea id="answer" class="answer" data-field="draft" placeholder="Type your reasoning...">' + esc(v.draft) + '</textarea>' +
          '<span class="muted" style="font-size:18px">No wrong answers. Commit to unlock another angle.</span></div>';
        foot = '<button class="btn big" id="commit" data-act="' + act(v.submitAnswer) + '"' + (v.noDraft ? ' disabled' : '') + '>COMMIT ▶</button>';
      } else {
        main += '<div class="mine">' + esc(v.myAnswer) + '</div>' +
          '<div class="angle"><span class="px" style="font-size:9px;color:#4FD6FF">ANOTHER ANGLE</span><p>' + esc(v.insight) + '</p></div>' +
          '<p class="muted" style="margin:0;font-size:19px">Match your thinking? If not, sit with the difference before moving on.</p>';
        foot = '<button class="btn big go" data-act="' + act(v.nextStep) + '">' + esc(v.continueLabel) + '</button>';
      }
    } else if (v.isCode) {
      main = '<h1 class="boss">BOSS STAGE: CODE IT</h1>' +
        (v.hasQuestGain ? '<section class="quest-gain"><div class="burst small" aria-hidden="true">' + gem(v.cur.gem) + '</div>' +
          '<span class="px" style="font-size:9px;line-height:1.6;color:' + v.cur.gemColor + '">' + esc(v.questLine) + '</span>' +
          (v.hasQuestUnlocks ? '<span class="tag">Unlocked: ' + esc(v.questUnlocks.map(function (u) { return u.title; }).join(', ')) + '</span>' : '') +
          '</section>' : '') +
        '<p class="tag" style="margin:0">' + esc(v.bossPrize) + '</p>' +
        '<details><summary>YOUR REASONING SO FAR</summary><ol>' +
        v.plan.map(function (it) { return '<li><span class="muted">' + esc(it.q) + '</span><br><span style="color:#FFD23F">' + esc(it.a) + '</span></li>'; }).join('') +
        '</ol></details>' +
        '<div class="field"><div style="display:flex;justify-content:space-between;align-items:center"><label for="code">SOLUTION.TS</label><span class="muted" style="font-size:18px">TypeScript</span></div>' +
        '<textarea id="code" class="code" data-field="code" spellcheck="false"' + (v.judging ? ' readonly' : '') + '>' + esc(v.code) + '</textarea></div>' +
        (v.hasReport ? reportPanel(v.report, v.bossTries) : '');
      foot = '<button class="btn big" data-act="' + act(v.submitCode) + '"' + (v.judging ? ' disabled' : '') + '>' + esc(v.bossLabel) + '</button>';
    } else {
      var burst = v.burst.map(function (g) { return '<div class="gem-pop">' + gem(g) + '</div>'; }).join('');
      main = '<section class="clear" style="border-color:' + v.cur.gemColor + '">' +
          '<span class="title">STAGE CLEAR!</span><span style="color:#3DDC84">' + esc(v.rv.tests) + '</span>' +
          '<span class="tag">' + esc(v.bossTriesLine) + '</span>' +
          (v.rareDrop ? '<span class="rare-drop blink">★ RARE DROP ★</span>' : '') +
          '<div class="burst" aria-hidden="true">' + burst + '</div>' +
          '<span class="px" style="font-size:11px;line-height:1.6;color:' + v.cur.gemColor + '">' + esc(v.gainLabel) + '</span>' +
          (v.hasSplit ? '<span style="font-size:19px;color:#E2DEF5">' + esc(v.splitLine) + '</span>' : '') +
          '<span class="muted" style="font-size:19px">' + esc(v.cur.gemSummary) + '</span>' +
          (v.hasShardGain ? '<span style="font-size:19px;color:#E2DEF5">◆ +1 shard each: ' + esc(v.shardLine) + '</span>' : '') +
          (v.hasFused ? '<span class="px blink" style="font-size:9px;line-height:1.6;color:#FFD23F">5 SHARDS FUSED → +1 ' + esc(v.fusedLine) + '</span>' : '') +
          '<span class="tag">Saved to your log ✓</span>' +
        '</section>' +
        (v.hasUnlocks ? '<section class="unlocked"><div class="lock-title">' + ICON.open + 'NEW QUEST UNLOCKED</div>' +
          v.unlocks.map(function (u) { return '<div class="row">' + gem(u.gem) + esc(u.title) + '</div>'; }).join('') + '</section>' : '') +
        '<div class="stats"><div class="stat"><span class="px">TIME</span><span>' + esc(v.rv.time) + '</span></div>' +
          '<div class="stat"><span class="px">SPACE</span><span>' + esc(v.rv.space) + '</span></div></div>' +
        '<section class="notes"><h2>REVIEWER NOTES</h2>' +
          v.rv.notes.map(function (n) { return '<div class="note"><span class="tagpill" style="background:' + n.tagBg + '">' + esc(n.tag) + '</span><p>' + esc(n.text) + '</p></div>'; }).join('') +
        '</section>' +
        '<section class="side"><span class="px muted" style="font-size:8px;line-height:1.6">SIDE QUEST</span><p>' + esc(v.rv.followup) + '</p></section>';
      foot = '<button class="btn ghost big" style="flex:1" data-act="' + act(v.backToFeed) + '">FEED</button>' +
        '<button class="btn big" style="flex:1.6" data-act="' + act(v.goNext) + '">NEXT QUEST <span class="blink">▶</span></button>';
    }
    return '<div class="screen">' + head + '<main class="scroll" data-scroll="walk"><div class="body">' + main + '</div></main>' +
      '<div class="foot">' + foot + '</div></div>';
  }

  function reportPanel(rep, tries) {
    if (rep.fatal) {
      return '<section class="fail" role="alert"><span class="px fail-title">✗ YOUR CODE DIDN’T RUN</span><p>' + esc(rep.fatal) + '</p>' + logsBlock(rep.logs) + '</section>';
    }
    var f = rep.fail || {};
    return '<section class="fail" role="alert">' +
      '<span class="px fail-title">✗ ' + rep.passed + ' OF ' + rep.total + ' TESTS PASSED</span>' +
      '<span class="tag">Failed test ' + ((f.index || 0) + 1) + (tries > 1 ? ' · try ' + tries : '') + '</span>' +
      (f.error ? '<p>' + esc(f.error) + '</p>' : '') +
      (f.input ? '<div class="io"><span class="px">INPUT</span><pre>' + esc(f.input) + '</pre></div>' : '') +
      (f.expected ? '<div class="io"><span class="px">EXPECTED</span><pre>' + esc(f.expected) + '</pre></div>' : '') +
      '<div class="io"><span class="px">GOT</span><pre>' + esc(f.got) + '</pre></div>' +
      logsBlock(rep.logs) +
      '<span class="tag">Fix it and run again — your quest gems are safe, the boss gems wait for a full clear.</span>' +
    '</section>';
  }
  function logsBlock(logs) {
    if (!logs || !logs.length) return '';
    return '<div class="io"><span class="px">CONSOLE</span><pre>' + esc(logs.join('\n')) + '</pre></div>';
  }

  function familyColor(fam) { return (GEMS[fam] && GEMS[fam].color) || '#B9B4D6'; }

  function logScreen() {
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
            (a.passed === false ? 'FAIL ' + (a.testsTotal ? a.testsPassed + '/' + a.testsTotal : '') : a.firstClear ? '+' + a.gemsEarned : 'REPLAY') + '</span>' +
          '</button>';
      }).join('') : '<p class="tag">No attempts yet. Clear a quest and it will show up here.</p>';
      body =
        '<section class="streak">' + ICON.flame +
          '<div><span class="px" style="font-size:16px;color:#FFD23F">' + s.streak + '</span> <span class="tag">day streak</span></div>' +
          '<span class="tag">best ' + s.bestStreak + ' · ' + s.totals.clears + ' cleared · ' + s.totals.attempts + ' attempts</span>' +
        '</section>' +
        '<section class="panel"><h2 class="px small">LAST 30 DAYS</h2><div class="grid30" role="img" aria-label="Activity over the last 30 days">' + grid + '</div>' +
          '<div class="legend tag"><span>less</span><div class="cell l0"></div><div class="cell l1"></div><div class="cell l2"></div><div class="cell l3"></div><span>more</span></div></section>' +
        '<section class="panel"><h2 class="px small">RECENT ATTEMPTS</h2>' + rows + '</section>';
    }
    return '<div class="screen">' +
      '<header class="feed-head"><div class="brand-row"><span class="brand">LOG</span>' +
        '<span class="tag">' + esc(ui.user || '') + ' · ' + esc(syncLabel()) + '</span></div></header>' +
      '<main class="scroll" data-scroll="log"><div class="body">' + body +
        '<button class="btn ghost big" data-act="' + act(logout) + '">SIGN OUT</button></div></main>' +
      nav('log') +
    '</div>';
  }

  function syncLabel() {
    return { idle: 'synced', saving: 'saving…', saved: 'saved to account', offline: 'offline — will retry' }[ui.syncState];
  }

  function attemptScreen() {
    var a = ui.attempt;
    var head = '<header class="walk-head"><div class="walk-row">' +
      '<button class="icon-btn" aria-label="Back to log" data-act="' + act(function () { ui.view = 'log'; render(); }) + '">' + ICON.back + '</button>' +
      '<div class="walk-title"><span class="px">' + esc(a ? a.title : 'Attempt') + '</span><span class="muted">' + esc(a ? when(a.createdAt) : '') + '</span></div></div></header>';
    var body;
    if (!a) body = '<p class="tag blink">LOADING…</p>';
    else {
      var problem = PROBLEMS.filter(function (p) { return p.title === a.title; })[0];
      var qa = (a.answers || []).map(function (ans, i) {
        var q = problem && problem.steps[i] ? problem.steps[i].q : 'Question ' + (i + 1);
        return '<div class="note"><span class="px muted" style="font-size:8px">QUEST ' + (i + 1) + '</span><p class="muted">' + esc(q) + '</p><p>' + esc(ans || '—') + '</p></div>';
      }).join('');
      var result = a.passed === false ? 'Failed' + (a.testsTotal ? ' ' + a.testsPassed + '/' + a.testsTotal : '') : a.firstClear ? '+' + a.gemsEarned + ' gems' : 'Passed';
      body = '<div class="stats"><div class="stat"><span class="px">RESULT</span><span>' + esc(result) + '</span></div>' +
        '<div class="stat"><span class="px">LEVEL</span><span>' + esc(a.difficulty) + '</span></div></div>' +
        (a.failure ? '<section class="fail"><span class="px fail-title">WHAT FAILED</span><p>' + esc(a.failure) + '</p></section>' : '') +
        '<section class="notes"><h2>YOUR ANSWERS</h2>' + qa + '</section>' +
        '<section class="notes"><h2>YOUR CODE</h2><pre class="example code-view">' + esc(a.code || '(empty)') + '</pre></section>';
    }
    return '<div class="screen">' + head + '<main class="scroll"><div class="body">' + body + '</div></main></div>';
  }

  // ---------------- render loop ----------------
  var lastScreen = null;
  var shownReport = null;
  function screenHtml() {
    if (ui.view === 'boot') return { html: bootScreen(), key: 'boot' };
    if (ui.view === 'auth') return { html: authScreen(), key: 'auth' };
    if (ui.view === 'log') return { html: logScreen(), key: 'log' };
    if (ui.view === 'attempt') return { html: attemptScreen(), key: 'attempt' };
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
      if (key === 'feed' || key === 'log') el.scrollTop = scrollMemory[key] || 0;
      else if (out.key === lastScreen) el.scrollTop = scrollMemory.walk || 0;
      else el.scrollTop = 0;
    }
    // After a failed boss run, bring the failing test into view (it sits below the editor).
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
    runBossIfNeeded();
    recordAttemptIfNew();
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
  });
  // Typing updates state without re-rendering, so the cursor and keyboard stay put.
  app.addEventListener('input', function (e) {
    var field = e.target.getAttribute('data-field');
    if (!field) return;
    var patch = {}; patch[field] = e.target.value;
    game.state = Object.assign({}, game.state, patch);
    if (field === 'draft') {
      var btn = document.getElementById('commit');
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
