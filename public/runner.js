// Test runner, executed inside a Web Worker. The server sends this file with a CSP that forbids
// any network access, so user code can compute but cannot call out. The page kills the worker on timeout.
/* global JudgeCore, STEPWISE_TESTS */
importScripts('/judge-core.js', '/tests.js');

// Belt and braces: remove network and script-loading APIs before any user code runs.
self.fetch = undefined;
self.XMLHttpRequest = undefined;
self.WebSocket = undefined;
self.EventSource = undefined;
self.importScripts = function () { throw new Error('importScripts is disabled in the test runner.'); };

var logs = [];
function capture() {
  var parts = Array.prototype.map.call(arguments, function (a) {
    if (typeof a === 'string') return a;
    try { return JSON.stringify(a); } catch (e) { return String(a); }
  });
  if (logs.length < 50) logs.push(parts.join(' ').slice(0, 300));
}
console.log = console.info = console.warn = console.error = capture;

self.onmessage = function (e) {
  var title = e.data.title, js = e.data.js;
  var spec = STEPWISE_TESTS[title];
  if (!spec) { postMessage({ type: 'fatal', error: 'No tests found for this quest.' }); return; }
  if (!/^[A-Za-z_$][\w$]*$/.test(spec.fn)) { postMessage({ type: 'fatal', error: 'Bad test definition.' }); return; }

  var impl;
  try {
    var factory = new Function('exports', 'module', 'ListNode', 'TreeNode', 'Node',
      js + '\n;return (typeof ' + spec.fn + ' !== "undefined") ? ' + spec.fn + ' : (module.exports && module.exports.' + spec.fn + ');');
    var mod = { exports: {} };
    impl = factory(mod.exports, mod, JudgeCore.ListNode, JudgeCore.TreeNode, JudgeCore.Node);
  } catch (err) {
    postMessage({ type: 'fatal', error: (err && err.name ? err.name + ': ' : '') + (err && err.message ? err.message : String(err)), logs: logs });
    return;
  }
  if (typeof impl !== 'function') {
    postMessage({ type: 'fatal', error: 'Could not find ' + (spec.kind === 'design' ? 'class ' : 'function ') + spec.fn + ' in your code. Keep the name from the starter.', logs: logs });
    return;
  }

  postMessage({ type: 'start', total: spec.cases.length });
  for (var i = 0; i < spec.cases.length; i++) {
    var t0 = performance.now();
    var r = JudgeCore.runCase(spec, impl, spec.cases[i]);
    r.ms = Math.round((performance.now() - t0) * 10) / 10;
    r.index = i;
    postMessage({ type: 'case', result: r });
  }
  postMessage({ type: 'done', logs: logs });
};
