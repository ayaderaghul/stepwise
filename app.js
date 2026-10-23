// Renders the Component from logic.js into the page. Plain DOM, no build step.
(function () {
  var STORE_KEY = 'stepwise:v1';
  var app = document.getElementById('app');
  var game = new Component();
  var actions = [];
  var scrollMemory = {};

  // ---- persistence: keep progress between visits ----
  try {
    var saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved) game.state = Object.assign({}, saved, { screen: 'feed', reviewed: false, unlocks: [], shardGain: [], fused: [], gain: 0 });
  } catch (e) { /* storage unavailable: start fresh */ }
  function persist() {
    try {
      var s = game.state || {};
      localStorage.setItem(STORE_KEY, JSON.stringify({
        solved: s.solved, gems: s.gems, shards: s.shards, saved: s.saved, fresh: s.fresh, filter: s.filter
      }));
    } catch (e) { /* ignore */ }
  }

  // ---- helpers ----
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
  var ICON = {
    back: '<svg width="15" height="15" viewBox="0 0 5 5" shape-rendering="crispEdges" aria-hidden="true"><rect x="2" y="0" width="1" height="1" fill="#F4F1E8"/><rect x="1" y="1" width="1" height="1" fill="#F4F1E8"/><rect x="0" y="2" width="5" height="1" fill="#F4F1E8"/><rect x="1" y="3" width="1" height="1" fill="#F4F1E8"/><rect x="2" y="4" width="1" height="1" fill="#F4F1E8"/></svg>',
    check: '<svg width="15" height="12" viewBox="0 0 5 4" shape-rendering="crispEdges" aria-hidden="true"><rect x="4" y="0" width="1" height="1" fill="#3DDC84"/><rect x="3" y="1" width="1" height="1" fill="#3DDC84"/><rect x="0" y="1" width="1" height="1" fill="#3DDC84"/><rect x="1" y="2" width="2" height="1" fill="#3DDC84"/><rect x="2" y="3" width="1" height="1" fill="#3DDC84"/></svg>',
    lock: '<svg width="15" height="18" viewBox="0 0 5 6" shape-rendering="crispEdges" aria-hidden="true"><rect x="1" y="0" width="3" height="1" fill="#FFD23F"/><rect x="1" y="1" width="1" height="2" fill="#FFD23F"/><rect x="3" y="1" width="1" height="2" fill="#FFD23F"/><rect x="0" y="3" width="5" height="3" fill="#FFD23F"/><rect x="2" y="4" width="1" height="1" fill="#12112A"/></svg>',
    open: '<svg width="15" height="18" viewBox="0 0 5 6" shape-rendering="crispEdges" aria-hidden="true"><rect x="3" y="0" width="2" height="1" fill="#FFD23F"/><rect x="4" y="1" width="1" height="2" fill="#FFD23F"/><rect x="0" y="3" width="5" height="3" fill="#FFD23F"/><rect x="2" y="4" width="1" height="1" fill="#2A2150"/></svg>',
    bulb: '<svg width="12" height="18" viewBox="0 0 4 6" shape-rendering="crispEdges" aria-hidden="true"><rect x="1" y="0" width="2" height="1" fill="#FFB347"/><rect x="0" y="1" width="4" height="2" fill="#FFB347"/><rect x="1" y="3" width="2" height="1" fill="#FFB347"/><rect x="1" y="5" width="2" height="1" fill="#FFB347"/></svg>',
    feed: '<svg width="18" height="18" viewBox="0 0 6 6" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="0" width="6" height="2" fill="currentColor"/><rect x="0" y="3" width="6" height="3" fill="currentColor"/></svg>',
    gems: '<svg width="21" height="15" viewBox="0 0 7 5" shape-rendering="crispEdges" aria-hidden="true"><rect x="1" y="0" width="5" height="1" fill="currentColor"/><rect x="0" y="1" width="7" height="2" fill="currentColor"/><rect x="2" y="3" width="3" height="1" fill="currentColor"/><rect x="3" y="4" width="1" height="1" fill="currentColor"/></svg>'
  };
  function bookmark(fill) {
    return '<svg width="16" height="20" viewBox="0 0 4 5" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="0" width="4" height="4" fill="' + fill + '"/><rect x="0" y="4" width="1" height="1" fill="' + fill + '"/><rect x="3" y="4" width="1" height="1" fill="' + fill + '"/></svg>';
  }
  function quest(color) {
    return '<svg width="14" height="16" viewBox="0 0 7 8" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="0" width="7" height="8" fill="' + color + '"/><rect x="1" y="1" width="5" height="6" fill="#12112A"/><rect x="2" y="2" width="3" height="1" fill="' + color + '"/><rect x="2" y="4" width="3" height="1" fill="' + color + '"/></svg>';
  }

  // ---- feed ----
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
    return '<div class="screen">' +
      '<header class="feed-head">' +
        '<div class="brand-row"><div style="display:flex;flex-direction:column;gap:6px"><span class="brand">STEPWISE</span><span class="tag">Think first. Code second.</span></div>' +
        '<span class="px muted" style="font-size:9px;padding-bottom:4px">TOTAL ' + v.totalGems + '</span></div>' +
        '<div class="vault" aria-label="Gem vault">' + vault + '</div>' +
        '<div class="chips" aria-label="Filter by gem family">' + chips + '</div>' +
        '<span class="tag">' + esc(v.feedCount) + '</span>' +
      '</header>' +
      '<main class="scroll" data-scroll="feed"><div class="feed">' + posts +
        '<p class="end">— END OF FEED —</p></div></main>' +
      '<nav class="nav" aria-label="Main"><button class="on">' + ICON.feed + 'FEED</button><button>' + bookmark('currentColor') + 'SAVED</button><button>' + ICON.gems + 'VAULT</button></nav>' +
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

  // ---- walkthrough ----
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
        '<details><summary>YOUR REASONING SO FAR</summary><ol>' +
        v.plan.map(function (it) { return '<li><span class="muted">' + esc(it.q) + '</span><br><span style="color:#FFD23F">' + esc(it.a) + '</span></li>'; }).join('') +
        '</ol></details>' +
        '<div class="field"><div style="display:flex;justify-content:space-between;align-items:center"><label for="code">SOLUTION.TS</label><span class="muted" style="font-size:18px">TypeScript</span></div>' +
        '<textarea id="code" class="code" data-field="code" spellcheck="false">' + esc(v.code) + '</textarea></div>';
      foot = '<button class="btn big" data-act="' + act(v.submitCode) + '">SUBMIT FOR REVIEW ▶</button>';
    } else {
      var burst = v.burst.map(function (g) { return '<div class="gem-pop">' + gem(g) + '</div>'; }).join('');
      main = '<section class="clear" style="border-color:' + v.cur.gemColor + '">' +
          '<span class="title">STAGE CLEAR!</span><span style="color:#3DDC84">' + esc(v.rv.tests) + '</span>' +
          (v.rareDrop ? '<span class="rare-drop blink">★ RARE DROP ★</span>' : '') +
          '<div class="burst" aria-hidden="true">' + burst + '</div>' +
          '<span class="px" style="font-size:11px;line-height:1.6;color:' + v.cur.gemColor + '">' + esc(v.gainLabel) + '</span>' +
          '<span class="muted" style="font-size:19px">' + esc(v.cur.gemSummary) + '</span>' +
          (v.hasShardGain ? '<span style="font-size:19px;color:#E2DEF5">◆ +1 shard each: ' + esc(v.shardLine) + '</span>' : '') +
          (v.hasFused ? '<span class="px blink" style="font-size:9px;line-height:1.6;color:#FFD23F">5 SHARDS FUSED → +1 ' + esc(v.fusedLine) + '</span>' : '') +
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

  // ---- render loop ----
  var lastScreen = null;
  function render() {
    var v = game.renderVals();
    var screenKey = v.isFeed ? 'feed' : 'walk:' + (v.isStep ? 's' : v.isCode ? 'c' : 'r');
    document.querySelectorAll('[data-scroll]').forEach(function (el) { scrollMemory[el.getAttribute('data-scroll')] = el.scrollTop; });
    var focused = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-field');
    actions = [];
    app.innerHTML = v.isFeed ? feed(v) : walk(v);
    var el = app.querySelector('[data-scroll]');
    if (el) {
      var key = el.getAttribute('data-scroll');
      if (key === 'feed') el.scrollTop = scrollMemory.feed || 0;
      else if (screenKey === lastScreen) el.scrollTop = scrollMemory.walk || 0;
      else el.scrollTop = 0;
    }
    if (focused) {
      var f = app.querySelector('[data-field="' + focused + '"]');
      if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
    }
    lastScreen = screenKey;
    persist();
  }
  game.onChange = function () { render(); };

  app.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    // Typing changes state without a re-render, so rebuild the handlers from current state first.
    // The markup is deterministic, so action indices line up with what is on screen.
    actions = [];
    var v = game.renderVals();
    if (v.isFeed) feed(v); else walk(v);
    var fn = actions[+t.getAttribute('data-act')];
    if (fn) fn();
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

  render();
})();
