// Judge core: shared by the browser test runner (runner.js) and the test generator (tests-src/build.mjs).
// Builds linked lists / trees from plain data, calls the user's code, and compares the result.
(function (root) {
  'use strict';

  // ---- data structures the problems use (names match the starter code) ----
  class ListNode { constructor(val, next) { this.val = val === undefined ? 0 : val; this.next = next === undefined ? null : next; } }
  class TreeNode { constructor(val, left, right) { this.val = val === undefined ? 0 : val; this.left = left === undefined ? null : left; this.right = right === undefined ? null : right; } }
  class Node { constructor(val, next, random) { this.val = val === undefined ? 0 : val; this.next = next === undefined ? null : next; this.random = random === undefined ? null : random; } }

  var LIMIT = 100000; // guards against cycles in returned lists

  function toList(arr) {
    var dummy = new ListNode(0), t = dummy;
    for (var i = 0; i < arr.length; i++) { t.next = new ListNode(arr[i]); t = t.next; }
    return dummy.next;
  }
  function fromList(head) {
    var out = [], n = 0;
    while (head) {
      if (typeof head !== 'object' || !('val' in head)) throw new Error('Returned list contains something that is not a ListNode.');
      out.push(head.val); head = head.next;
      if (++n > LIMIT) throw new Error('Returned list never ends (is there a cycle?).');
    }
    return out;
  }
  // Level-order array with nulls, LeetCode style: [3,9,20,null,null,15,7]
  function toTree(arr) {
    if (!arr.length || arr[0] === null) return null;
    var rootNode = new TreeNode(arr[0]), queue = [rootNode], i = 1;
    while (queue.length && i < arr.length) {
      var node = queue.shift();
      if (i < arr.length && arr[i] !== null) { node.left = new TreeNode(arr[i]); queue.push(node.left); } i++;
      if (i < arr.length && arr[i] !== null) { node.right = new TreeNode(arr[i]); queue.push(node.right); } i++;
    }
    return rootNode;
  }
  function fromTree(rootNode) {
    var out = [], queue = [rootNode];
    while (queue.length) {
      var node = queue.shift();
      if (node) { out.push(node.val); queue.push(node.left, node.right); } else out.push(null);
      if (out.length > LIMIT) throw new Error('Returned tree is too large (is there a cycle?).');
    }
    while (out.length && out[out.length - 1] === null) out.pop();
    return out;
  }
  // [[val, randomIndex|null], ...]
  function toRandomList(pairs) {
    var nodes = pairs.map(function (p) { return new Node(p[0]); });
    nodes.forEach(function (n, i) { n.next = nodes[i + 1] || null; n.random = pairs[i][1] === null ? null : nodes[pairs[i][1]]; });
    return nodes[0] || null;
  }
  function fromRandomList(head) {
    var nodes = [], n = head;
    while (n) { nodes.push(n); n = n.next; if (nodes.length > LIMIT) throw new Error('Returned list never ends.'); }
    return nodes.map(function (x) { return [x.val, x.random === null || x.random === undefined ? null : nodes.indexOf(x.random)]; });
  }

  var IN = {
    list: toList, tree: toTree, randomList: toRandomList,
    listArray: function (a) { return a.map(toList); }
  };
  var OUT = { list: fromList, tree: fromTree, randomList: fromRandomList };

  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

  // Canonical JSON so object key order and -0 do not matter.
  function canon(v) {
    if (v === undefined) return 'null';
    if (typeof v === 'number') return Object.is(v, -0) ? '0' : JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  function sortByCanon(arr) { return arr.slice().sort(function (a, b) { var x = canon(a), y = canon(b); return x < y ? -1 : x > y ? 1 : 0; }); }

  function show(v) {
    var s;
    try { s = canon(v); } catch (e) { s = String(v); }
    return s.length > 300 ? s.slice(0, 300) + '…' : s;
  }

  // ---- comparisons; validators get the original (unconverted) arguments ----
  var VALIDATORS = {
    exact: function (got, exp) { return canon(got) === canon(exp); },
    unordered: function (got, exp) { return Array.isArray(got) && canon(sortByCanon(got)) === canon(sortByCanon(exp)); },
    unorderedDeep: function (got, exp) {
      if (!Array.isArray(got)) return false;
      var norm = function (a) { return sortByCanon(a.map(function (x) { return Array.isArray(x) ? sortByCanon(x) : x; })); };
      return canon(norm(got)) === canon(norm(exp));
    },
    float: function (got, exp) { return typeof got === 'number' && Math.abs(got - exp) < 1e-5; },
    peak: function (got, exp, args) {
      var a = args[0], i = got;
      if (!Number.isInteger(i) || i < 0 || i >= a.length) return false;
      var left = i === 0 ? -Infinity : a[i - 1], right = i === a.length - 1 ? -Infinity : a[i + 1];
      return a[i] > left && a[i] > right;
    },
    topo: function (got, exp, args) {
      var n = args[0], pre = args[1];
      if (!Array.isArray(got)) return false;
      if (exp.length === 0) return got.length === 0;
      if (got.length !== n) return false;
      var pos = {};
      for (var i = 0; i < got.length; i++) { if (!Number.isInteger(got[i]) || got[i] < 0 || got[i] >= n || pos[got[i]] !== undefined) return false; pos[got[i]] = i; }
      return pre.every(function (p) { return pos[p[1]] < pos[p[0]]; });
    },
    palindrome: function (got, exp, args) {
      return typeof got === 'string' && got.length === exp.length && args[0].indexOf(got) !== -1 && got === got.split('').reverse().join('');
    },
    reorganize: function (got, exp, args) {
      if (typeof got !== 'string') return false;
      if (exp === '') return got === '';
      if (got.length !== args[0].length) return false;
      if (got.split('').sort().join('') !== args[0].split('').sort().join('')) return false;
      for (var i = 1; i < got.length; i++) if (got[i] === got[i - 1]) return false;
      return true;
    }
  };

  // Runs one test case. Returns { ok, input, expected, got, error }.
  function runCase(spec, impl, tc) {
    var input = spec.kind === 'design' ? describeOps(tc) : tc.args.map(show).join(', ');
    try {
      if (spec.kind === 'design') return runDesign(spec, impl, tc, input);
      var raw = clone(tc.args);
      var types = spec.in || [];
      var args = raw.map(function (a, i) { return types[i] ? IN[types[i]](a) : a; });
      var originals = types.indexOf('randomList') !== -1 ? collectNodes(args[types.indexOf('randomList')]) : null;
      var ret = impl.apply(null, args);
      var got;
      if (spec.mutate !== undefined && spec.mutate !== null) {
        var t = types[spec.mutate];
        got = t ? OUT[t](args[spec.mutate]) : args[spec.mutate];
      } else if (spec.prefix !== undefined && spec.prefix !== null) {
        if (!Number.isInteger(ret)) return { ok: false, input: input, expected: show(tc.expected), got: show(ret), error: 'Expected the function to return a length (a whole number).' };
        got = args[spec.prefix].slice(0, ret);
      } else {
        got = spec.out ? OUT[spec.out](ret === undefined ? null : ret) : (ret === undefined ? null : ret);
      }
      if (originals) {
        var copied = collectNodes(ret);
        for (var k = 0; k < copied.length; k++) if (originals.indexOf(copied[k]) !== -1) {
          return { ok: false, input: input, expected: show(tc.expected), got: show(got), error: 'The copy reuses nodes from the original list — it must be a deep copy.' };
        }
      }
      var ok = VALIDATORS[spec.compare || 'exact'](got, tc.expected, tc.args);
      return { ok: ok, input: input, expected: show(tc.expected), got: show(got) };
    } catch (e) {
      return { ok: false, input: input, expected: show(tc.expected), got: '—', error: (e && e.name ? e.name + ': ' : '') + (e && e.message ? e.message : String(e)) };
    }
  }

  function collectNodes(head) {
    var out = [], n = head, c = 0;
    while (n && c++ < LIMIT) { out.push(n); n = n.next; }
    return out;
  }

  function describeOps(tc) {
    return tc.ops.map(function (op, i) { return op + '(' + tc.args[i].map(show).join(', ') + ')'; }).join(' → ');
  }

  function runDesign(spec, Ctor, tc, input) {
    if (typeof Ctor !== 'function') throw new Error('Could not find class ' + spec.fn + '.');
    var obj = null, outputs = [];
    for (var i = 0; i < tc.ops.length; i++) {
      var a = clone(tc.args[i]);
      if (i === 0) { obj = new Ctor(...a); outputs.push(null); continue; }
      if (typeof obj[tc.ops[i]] !== 'function') throw new Error('Missing method ' + tc.ops[i] + '().');
      var r = obj[tc.ops[i]].apply(obj, a);
      outputs.push(r === undefined ? null : r);
      if (canon(outputs[i]) !== canon(tc.expected[i])) {
        return { ok: false, input: input, expected: show(tc.expected), got: show(outputs),
          error: 'Step ' + (i + 1) + ', ' + tc.ops[i] + '(' + a.map(show).join(', ') + '): expected ' + show(tc.expected[i]) + ', got ' + show(outputs[i]) + '.' };
      }
    }
    return { ok: true, input: input, expected: show(tc.expected), got: show(outputs) };
  }

  // Used by the generator: compute expected output from a reference implementation.
  function computeExpected(spec, impl, args) {
    var types = spec.in || [];
    var conv = clone(args).map(function (a, i) { return types[i] ? IN[types[i]](a) : a; });
    var ret = impl.apply(null, conv);
    if (spec.mutate !== undefined && spec.mutate !== null) return types[spec.mutate] ? OUT[types[spec.mutate]](conv[spec.mutate]) : conv[spec.mutate];
    if (spec.prefix !== undefined && spec.prefix !== null) return conv[spec.prefix].slice(0, ret);
    return spec.out ? OUT[spec.out](ret) : (ret === undefined ? null : ret);
  }
  function computeDesign(Ctor, ops, args) {
    var obj = null;
    return ops.map(function (op, i) {
      var a = clone(args[i]);
      if (i === 0) { obj = new Ctor(...a); return null; }
      var r = obj[op].apply(obj, a);
      return r === undefined ? null : r;
    });
  }

  root.JudgeCore = {
    ListNode: ListNode, TreeNode: TreeNode, Node: Node,
    runCase: runCase, computeExpected: computeExpected, computeDesign: computeDesign, show: show
  };
})(typeof self !== 'undefined' ? self : globalThis);
