// Test inputs and reference solutions for every quest. Expected outputs are NOT written here:
// build.mjs computes them by running the reference solution, so no expected value is typed by hand.
// `in`/`out`: how arguments and results are converted (list, tree, listArray, randomList).
// `mutate`: the answer is that argument after the call. `prefix`: answer = that argument sliced to the returned length.
// `compare`: exact (default) | unordered | unorderedDeep | float | peak | topo | palindrome | reorganize.

const board = [
  ['5', '3', '.', '.', '7', '.', '.', '.', '.'],
  ['6', '.', '.', '1', '9', '5', '.', '.', '.'],
  ['.', '9', '8', '.', '.', '.', '.', '6', '.'],
  ['8', '.', '.', '.', '6', '.', '.', '.', '3'],
  ['4', '.', '.', '8', '.', '3', '.', '.', '1'],
  ['7', '.', '.', '.', '2', '.', '.', '.', '6'],
  ['.', '6', '.', '.', '.', '.', '2', '8', '.'],
  ['.', '.', '.', '4', '1', '9', '.', '.', '5'],
  ['.', '.', '.', '.', '8', '.', '.', '7', '9']
];
const badBoard = board.map((r) => r.slice()); badBoard[0][0] = '8';
const colBoard = board.map((r) => r.slice()); colBoard[8][0] = '5';
const emptyBoard = Array.from({ length: 9 }, () => Array(9).fill('.'));
const wordGrid = [['A', 'B', 'C', 'E'], ['S', 'F', 'C', 'S'], ['A', 'D', 'E', 'E']];

export default [
  {
    title: 'Two Sum', fn: 'twoSum', compare: 'unordered',
    cases: [[[2, 7, 11, 15], 9], [[3, 2, 4], 6], [[3, 3], 6], [[-1, -2, -3, -4, -5], -8], [[0, 4, 3, 0], 0]],
    ref: function twoSum(nums, target) { const m = new Map(); for (let i = 0; i < nums.length; i++) { const need = target - nums[i]; if (m.has(need)) return [m.get(need), i]; m.set(nums[i], i); } return []; }
  },
  {
    title: 'LRU Cache', fn: 'LRUCache', kind: 'design',
    cases: [
      { ops: ['LRUCache', 'put', 'put', 'get', 'put', 'get', 'put', 'get', 'get', 'get'], args: [[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]] },
      { ops: ['LRUCache', 'put', 'get', 'put', 'get', 'get'], args: [[1], [2, 1], [2], [3, 2], [2], [3]] },
      { ops: ['LRUCache', 'put', 'put', 'put', 'put', 'get', 'get'], args: [[2], [2, 1], [1, 1], [2, 3], [4, 1], [1], [2]] }
    ],
    ref: class LRUCache { constructor(c) { this.c = c; this.m = new Map(); } get(k) { if (!this.m.has(k)) return -1; const v = this.m.get(k); this.m.delete(k); this.m.set(k, v); return v; } put(k, v) { this.m.delete(k); this.m.set(k, v); if (this.m.size > this.c) this.m.delete(this.m.keys().next().value); } }
  },
  {
    title: 'Merge Intervals', fn: 'merge', compare: 'unordered',
    cases: [[[[1, 3], [2, 6], [8, 10], [15, 18]]], [[[1, 4], [4, 5]]], [[[1, 10], [2, 3]]], [[[5, 6], [1, 2]]], [[[1, 4]]], [[[2, 3], [4, 5], [6, 7], [1, 10]]]],
    ref: function merge(intervals) { const s = intervals.slice().sort((a, b) => a[0] - b[0]); const out = []; for (const [a, b] of s) { if (out.length && a <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], b); else out.push([a, b]); } return out; }
  },
  {
    title: 'Best Time to Buy and Sell Stock', fn: 'maxProfit',
    cases: [[[7, 1, 5, 3, 6, 4]], [[7, 6, 4, 3, 1]], [[2, 4, 1]], [[1]], [[3, 3, 5, 0, 0, 3, 1, 4]]],
    ref: function maxProfit(p) { let lo = Infinity, best = 0; for (const x of p) { lo = Math.min(lo, x); best = Math.max(best, x - lo); } return best; }
  },
  {
    title: 'Longest Substring Without Repeating Characters', fn: 'lengthOfLongestSubstring',
    cases: [['abcabcbb'], ['bbbbb'], ['pwwkew'], [''], ['abba'], [' '], ['dvdf']],
    ref: function lengthOfLongestSubstring(s) { const last = new Map(); let l = 0, best = 0; for (let r = 0; r < s.length; r++) { if (last.has(s[r])) l = Math.max(l, last.get(s[r]) + 1); last.set(s[r], r); best = Math.max(best, r - l + 1); } return best; }
  },
  {
    title: 'Valid Parentheses', fn: 'isValid',
    cases: [['()'], ['()[]{}'], ['(]'], ['([)]'], ['{[]}'], ['(('], [']']],
    ref: function isValid(s) { const st = [], pairs = { ')': '(', ']': '[', '}': '{' }; for (const c of s) { if (pairs[c]) { if (st.pop() !== pairs[c]) return false; } else st.push(c); } return st.length === 0; }
  },
  {
    title: 'Number of Islands', fn: 'numIslands',
    cases: [
      [[['1', '1', '1', '1', '0'], ['1', '1', '0', '1', '0'], ['1', '1', '0', '0', '0'], ['0', '0', '0', '0', '0']]],
      [[['1', '1', '0', '0', '0'], ['1', '1', '0', '0', '0'], ['0', '0', '1', '0', '0'], ['0', '0', '0', '1', '1']]],
      [[['0']]], [[['1']]], [[['1', '0', '1'], ['0', '1', '0'], ['1', '0', '1']]]
    ],
    ref: function numIslands(grid) { const g = grid.map((r) => r.slice()); let n = 0; const sink = (r, c) => { const st = [[r, c]]; while (st.length) { const [i, j] = st.pop(); if (i < 0 || j < 0 || i >= g.length || j >= g[0].length || g[i][j] !== '1') continue; g[i][j] = '0'; st.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]); } }; for (let i = 0; i < g.length; i++) for (let j = 0; j < g[0].length; j++) if (g[i][j] === '1') { n++; sink(i, j); } return n; }
  },
  {
    title: 'Group Anagrams', fn: 'groupAnagrams', compare: 'unorderedDeep',
    cases: [[['eat', 'tea', 'tan', 'ate', 'nat', 'bat']], [['']], [['a']], [['abc', 'bca', 'cab', 'xyz', 'zyx', 'q']]],
    ref: function groupAnagrams(strs) { const m = new Map(); for (const s of strs) { const k = s.split('').sort().join(''); if (!m.has(k)) m.set(k, []); m.get(k).push(s); } return [...m.values()]; }
  },
  {
    title: 'Trapping Rain Water', fn: 'trap',
    cases: [[[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]], [[4, 2, 0, 3, 2, 5]], [[]], [[5]], [[3, 0, 3]], [[5, 4, 1, 2]]],
    ref: function trap(h) { let l = 0, r = h.length - 1, lm = 0, rm = 0, w = 0; while (l < r) { if (h[l] < h[r]) { lm = Math.max(lm, h[l]); w += lm - h[l]; l++; } else { rm = Math.max(rm, h[r]); w += rm - h[r]; r--; } } return w; }
  },
  {
    title: 'Longest Palindromic Substring', fn: 'longestPalindrome', compare: 'palindrome',
    cases: [['babad'], ['cbbd'], ['a'], ['ac'], ['forgeeksskeegfor'], ['aaaa']],
    ref: function longestPalindrome(s) { let best = ''; for (let c = 0; c < s.length; c++) for (const [a, b] of [[c, c], [c, c + 1]]) { let l = a, r = b; while (l >= 0 && r < s.length && s[l] === s[r]) { l--; r++; } if (r - l - 1 > best.length) best = s.slice(l + 1, r); } return best; }
  },
  {
    title: 'Top K Frequent Elements', fn: 'topKFrequent', compare: 'unordered',
    cases: [[[1, 1, 1, 2, 2, 3], 2], [[1], 1], [[4, 4, 4, 5, 5, 6, 6, 6, 6], 2], [[-1, -1, 2], 1], [[3, 0, 1, 0], 1]],
    ref: function topKFrequent(nums, k) { const c = new Map(); for (const x of nums) c.set(x, (c.get(x) || 0) + 1); return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map((e) => e[0]); }
  },
  {
    title: 'Median of Two Sorted Arrays', fn: 'findMedianSortedArrays', compare: 'float',
    cases: [[[1, 3], [2]], [[1, 2], [3, 4]], [[], [1]], [[2], []], [[1, 2, 3], [4, 5, 6, 7, 8]], [[0, 0], [0, 0]], [[1, 5], [2, 3, 4, 6]]],
    ref: function findMedianSortedArrays(a, b) { const m = a.concat(b).sort((x, y) => x - y); const n = m.length; return n % 2 ? m[(n - 1) / 2] : (m[n / 2 - 1] + m[n / 2]) / 2; }
  },
  {
    title: '3Sum', fn: 'threeSum', compare: 'unorderedDeep',
    cases: [[[-1, 0, 1, 2, -1, -4]], [[0, 1, 1]], [[0, 0, 0]], [[-2, 0, 1, 1, 2]], [[0, 0, 0, 0]]],
    ref: function threeSum(nums) { const a = nums.slice().sort((x, y) => x - y), out = []; for (let i = 0; i < a.length - 2; i++) { if (i && a[i] === a[i - 1]) continue; let l = i + 1, r = a.length - 1; while (l < r) { const s = a[i] + a[l] + a[r]; if (s < 0) l++; else if (s > 0) r--; else { out.push([a[i], a[l], a[r]]); while (l < r && a[l] === a[l + 1]) l++; while (l < r && a[r] === a[r - 1]) r--; l++; r--; } } } return out; }
  },
  {
    title: 'Subarray Sum Equals K', fn: 'subarraySum',
    cases: [[[1, 1, 1], 2], [[1, 2, 3], 3], [[1, -1, 0], 0], [[1], 0], [[-1, -1, 1], 0]],
    ref: function subarraySum(nums, k) { const m = new Map([[0, 1]]); let p = 0, n = 0; for (const x of nums) { p += x; n += m.get(p - k) || 0; m.set(p, (m.get(p) || 0) + 1); } return n; }
  },
  {
    title: 'Merge k Sorted Lists', fn: 'mergeKLists', in: ['listArray'], out: 'list',
    cases: [[[[1, 4, 5], [1, 3, 4], [2, 6]]], [[]], [[[]]], [[[], [1]]], [[[5], [1, 2], [3, 9]]]],
    ref: function mergeKLists(lists) { const vals = []; for (let n of lists) while (n) { vals.push(n.val); n = n.next; } vals.sort((a, b) => a - b); let head = null; for (let i = vals.length - 1; i >= 0; i--) head = { val: vals[i], next: head }; return head; }
  },
  {
    title: 'Longest Common Prefix', fn: 'longestCommonPrefix',
    cases: [[['flower', 'flow', 'flight']], [['dog', 'racecar', 'car']], [['a']], [['', '']], [['ab', 'a']], [['same', 'same']]],
    ref: function longestCommonPrefix(strs) { let p = strs[0]; for (const s of strs) while (!s.startsWith(p)) p = p.slice(0, -1); return p; }
  },
  {
    title: 'Search in Rotated Sorted Array', fn: 'search',
    cases: [[[4, 5, 6, 7, 0, 1, 2], 0], [[4, 5, 6, 7, 0, 1, 2], 3], [[1], 0], [[1], 1], [[3, 1], 1], [[5, 1, 3], 5], [[6, 7, 1, 2, 3, 4, 5], 6]],
    ref: function search(nums, t) { return nums.indexOf(t); }
  },
  {
    title: 'Maximum Subarray', fn: 'maxSubArray',
    cases: [[[-2, 1, -3, 4, -1, 2, 1, -5, 4]], [[1]], [[5, 4, -1, 7, 8]], [[-3, -1, -2]]],
    ref: function maxSubArray(nums) { let cur = nums[0], best = nums[0]; for (let i = 1; i < nums.length; i++) { cur = Math.max(nums[i], cur + nums[i]); best = Math.max(best, cur); } return best; }
  },
  {
    title: 'Rotate Image', fn: 'rotate', mutate: 0,
    cases: [[[[1, 2, 3], [4, 5, 6], [7, 8, 9]]], [[[5, 1, 9, 11], [2, 4, 8, 10], [13, 3, 6, 7], [15, 14, 12, 16]]], [[[1]]], [[[1, 2], [3, 4]]]],
    ref: function rotate(m) { const n = m.length; for (let r = 0; r < n; r++) for (let c = r + 1; c < n; c++) [m[r][c], m[c][r]] = [m[c][r], m[r][c]]; for (const row of m) row.reverse(); }
  },
  {
    title: 'Spiral Matrix', fn: 'spiralOrder',
    cases: [[[[1, 2, 3], [4, 5, 6], [7, 8, 9]]], [[[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]], [[[1]]], [[[1, 2, 3]]], [[[1], [2], [3]]], [[[1, 2], [3, 4], [5, 6]]]],
    ref: function spiralOrder(m) { const out = []; let t = 0, b = m.length - 1, l = 0, r = m[0].length - 1; while (t <= b && l <= r) { for (let c = l; c <= r; c++) out.push(m[t][c]); t++; for (let i = t; i <= b; i++) out.push(m[i][r]); r--; if (t <= b) { for (let c = r; c >= l; c--) out.push(m[b][c]); b--; } if (l <= r) { for (let i = b; i >= t; i--) out.push(m[i][l]); l++; } } return out; }
  },
  {
    title: 'Add Two Numbers', fn: 'addTwoNumbers', in: ['list', 'list'], out: 'list',
    cases: [[[2, 4, 3], [5, 6, 4]], [[0], [0]], [[9, 9, 9, 9, 9, 9, 9], [9, 9, 9, 9]], [[1], [9, 9]]],
    ref: function addTwoNumbers(a, b) { const d = { val: 0, next: null }; let t = d, c = 0; while (a || b || c) { const s = (a ? a.val : 0) + (b ? b.val : 0) + c; c = Math.floor(s / 10); t.next = { val: s % 10, next: null }; t = t.next; a = a && a.next; b = b && b.next; } return d.next; }
  },
  {
    title: 'Kth Largest Element in an Array', fn: 'findKthLargest',
    cases: [[[3, 2, 1, 5, 6, 4], 2], [[3, 2, 3, 1, 2, 4, 5, 5, 6], 4], [[1], 1], [[2, 1], 2], [[-1, -1], 2]],
    ref: function findKthLargest(nums, k) { return nums.slice().sort((a, b) => b - a)[k - 1]; }
  },
  {
    title: 'Generate Parentheses', fn: 'generateParenthesis', compare: 'unordered',
    cases: [[1], [2], [3], [4]],
    ref: function generateParenthesis(n) { const out = []; const go = (s, o, c) => { if (s.length === 2 * n) { out.push(s); return; } if (o < n) go(s + '(', o + 1, c); if (c < o) go(s + ')', o, c + 1); }; go('', 0, 0); return out; }
  },
  {
    title: 'Rotting Oranges', fn: 'orangesRotting',
    cases: [[[[2, 1, 1], [1, 1, 0], [0, 1, 1]]], [[[2, 1, 1], [0, 1, 1], [1, 0, 1]]], [[[0, 2]]], [[[0]]], [[[1]]], [[[2, 2], [1, 1], [0, 0], [2, 0]]]],
    ref: function orangesRotting(grid) { const g = grid.map((r) => r.slice()); let q = [], fresh = 0, t = 0; g.forEach((r, i) => r.forEach((v, j) => { if (v === 2) q.push([i, j]); if (v === 1) fresh++; })); while (q.length && fresh) { const nq = []; for (const [i, j] of q) for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) if (g[a] && g[a][b] === 1) { g[a][b] = 2; fresh--; nq.push([a, b]); } q = nq; t++; } return fresh ? -1 : t; }
  },
  {
    title: 'Find First and Last Position of Element in Sorted Array', fn: 'searchRange',
    cases: [[[5, 7, 7, 8, 8, 10], 8], [[5, 7, 7, 8, 8, 10], 6], [[], 0], [[1], 1], [[2, 2, 2, 2], 2]],
    ref: function searchRange(nums, t) { return [nums.indexOf(t), nums.lastIndexOf(t)]; }
  },
  {
    title: 'Merge Sorted Array', fn: 'merge', mutate: 0,
    cases: [[[1, 2, 3, 0, 0, 0], 3, [2, 5, 6], 3], [[1], 1, [], 0], [[0], 0, [1], 1], [[4, 5, 6, 0, 0, 0], 3, [1, 2, 3], 3]],
    ref: function merge(a, m, b, n) { let i = m - 1, j = n - 1, k = m + n - 1; while (j >= 0) a[k--] = i >= 0 && a[i] > b[j] ? a[i--] : b[j--]; }
  },
  {
    title: 'Roman to Integer', fn: 'romanToInt',
    cases: [['III'], ['LVIII'], ['MCMXCIV'], ['IV'], ['MMMCMXCIX']],
    ref: function romanToInt(s) { const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }; let n = 0; for (let i = 0; i < s.length; i++) n += v[s[i]] < (v[s[i + 1]] || 0) ? -v[s[i]] : v[s[i]]; return n; }
  },
  {
    title: 'House Robber', fn: 'rob',
    cases: [[[1, 2, 3, 1]], [[2, 7, 9, 3, 1]], [[2, 1, 1, 2]], [[5]], [[0, 0]]],
    ref: function rob(nums) { let a = 0, b = 0; for (const x of nums) [a, b] = [b, Math.max(b, a + x)]; return b; }
  },
  {
    title: 'Palindrome Number', fn: 'isPalindrome',
    cases: [[121], [-121], [10], [0], [12321], [1221], [123]],
    ref: function isPalindrome(x) { return x >= 0 && String(x) === String(x).split('').reverse().join(''); }
  },
  {
    title: 'Move Zeroes', fn: 'moveZeroes', mutate: 0,
    cases: [[[0, 1, 0, 3, 12]], [[0]], [[1, 2]], [[0, 0, 1]]],
    ref: function moveZeroes(a) { let w = 0; for (let r = 0; r < a.length; r++) if (a[r] !== 0) [a[w++], a[r]] = [a[r], a[w]]; }
  },
  {
    title: 'Container With Most Water', fn: 'maxArea',
    cases: [[[1, 8, 6, 2, 5, 4, 8, 3, 7]], [[1, 1]], [[4, 3, 2, 1, 4]], [[1, 2, 1]]],
    ref: function maxArea(h) { let l = 0, r = h.length - 1, best = 0; while (l < r) { best = Math.max(best, (r - l) * Math.min(h[l], h[r])); if (h[l] < h[r]) l++; else r--; } return best; }
  },
  {
    title: 'Meeting Rooms II', fn: 'minMeetingRooms',
    cases: [[[[0, 30], [5, 10], [15, 20]]], [[[7, 10], [2, 4]]], [[[1, 5], [5, 10]]], [[[1, 10], [2, 9], [3, 8]]], [[]]],
    ref: function minMeetingRooms(iv) { const s = iv.map((x) => x[0]).sort((a, b) => a - b), e = iv.map((x) => x[1]).sort((a, b) => a - b); let rooms = 0, j = 0; for (let i = 0; i < s.length; i++) { if (s[i] >= e[j]) j++; else rooms++; } return rooms; }
  },
  {
    title: 'Coin Change', fn: 'coinChange',
    cases: [[[1, 2, 5], 11], [[2], 3], [[1], 0], [[1, 3, 4], 6], [[186, 419, 83, 408], 6249]],
    ref: function coinChange(coins, amount) { const dp = Array(amount + 1).fill(Infinity); dp[0] = 0; for (let a = 1; a <= amount; a++) for (const c of coins) if (c <= a) dp[a] = Math.min(dp[a], dp[a - c] + 1); return dp[amount] === Infinity ? -1 : dp[amount]; }
  },
  {
    title: 'Valid Anagram', fn: 'isAnagram',
    cases: [['anagram', 'nagaram'], ['rat', 'car'], ['a', 'ab'], ['', '']],
    ref: function isAnagram(s, t) { return s.split('').sort().join('') === t.split('').sort().join(''); }
  },
  {
    title: 'Product of Array Except Self', fn: 'productExceptSelf',
    cases: [[[1, 2, 3, 4]], [[-1, 1, 0, -3, 3]], [[2, 3]], [[0, 0]]],
    ref: function productExceptSelf(nums) { return nums.map((_, i) => nums.reduce((p, x, j) => (j === i ? p : p * x), 1)); }
  },
  {
    title: 'Longest Consecutive Sequence', fn: 'longestConsecutive',
    cases: [[[100, 4, 200, 1, 3, 2]], [[0, 3, 7, 2, 5, 8, 4, 6, 0, 1]], [[]], [[1, 2, 0, 1]]],
    ref: function longestConsecutive(nums) { const s = new Set(nums); let best = 0; for (const x of s) if (!s.has(x - 1)) { let y = x; while (s.has(y + 1)) y++; best = Math.max(best, y - x + 1); } return best; }
  },
  {
    title: 'Koko Eating Bananas', fn: 'minEatingSpeed',
    cases: [[[3, 6, 7, 11], 8], [[30, 11, 23, 4, 20], 5], [[30, 11, 23, 4, 20], 6], [[1], 1], [[1000000000], 2]],
    ref: function minEatingSpeed(piles, h) { let lo = 1, hi = Math.max(...piles); while (lo < hi) { const k = Math.floor((lo + hi) / 2); const hours = piles.reduce((s, p) => s + Math.ceil(p / k), 0); if (hours <= h) hi = k; else lo = k + 1; } return lo; }
  },
  {
    title: 'Jump Game', fn: 'canJump',
    cases: [[[2, 3, 1, 1, 4]], [[3, 2, 1, 0, 4]], [[0]], [[2, 0, 0]], [[1, 0, 1]]],
    ref: function canJump(nums) { let reach = 0; for (let i = 0; i < nums.length; i++) { if (i > reach) return false; reach = Math.max(reach, i + nums[i]); } return true; }
  },
  {
    title: 'Integer to Roman', fn: 'intToRoman',
    cases: [[3], [58], [1994], [4], [3999]],
    ref: function intToRoman(num) { const t = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, r] of t) while (num >= v) { s += r; num -= v; } return s; }
  },
  {
    title: 'Course Schedule', fn: 'canFinish',
    cases: [[2, [[1, 0]]], [2, [[1, 0], [0, 1]]], [1, []], [3, [[1, 0], [2, 1]]], [4, [[1, 0], [2, 1], [3, 2], [1, 3]]]],
    ref: function canFinish(n, pre) { const indeg = Array(n).fill(0), adj = Array.from({ length: n }, () => []); for (const [a, b] of pre) { adj[b].push(a); indeg[a]++; } const q = []; indeg.forEach((d, i) => d || q.push(i)); let seen = 0; while (q.length) { const x = q.pop(); seen++; for (const y of adj[x]) if (--indeg[y] === 0) q.push(y); } return seen === n; }
  },
  {
    title: 'Minimum Window Substring', fn: 'minWindow',
    cases: [['ADOBECODEBANC', 'ABC'], ['a', 'a'], ['a', 'aa'], ['ab', 'b'], ['cabwefgewcwaefgcf', 'cae']],
    ref: function minWindow(s, t) { const need = new Map(); for (const c of t) need.set(c, (need.get(c) || 0) + 1); let missing = t.length, l = 0, best = ''; for (let r = 0; r < s.length; r++) { if ((need.get(s[r]) || 0) > 0) missing--; need.set(s[r], (need.get(s[r]) || 0) - 1); while (missing === 0) { if (!best || r - l + 1 < best.length) best = s.slice(l, r + 1); need.set(s[l], need.get(s[l]) + 1); if (need.get(s[l]) > 0) missing++; l++; } } return best; }
  },
  {
    title: 'Reverse Linked List', fn: 'reverseList', in: ['list'], out: 'list',
    cases: [[[1, 2, 3, 4, 5]], [[1, 2]], [[]], [[7]]],
    ref: function reverseList(h) { let p = null; while (h) { const n = h.next; h.next = p; p = h; h = n; } return p; }
  },
  {
    title: 'Next Permutation', fn: 'nextPermutation', mutate: 0,
    cases: [[[1, 2, 3]], [[3, 2, 1]], [[1, 1, 5]], [[1, 3, 2]], [[2, 3, 1]], [[1]]],
    ref: function nextPermutation(a) { let i = a.length - 2; while (i >= 0 && a[i] >= a[i + 1]) i--; if (i >= 0) { let j = a.length - 1; while (a[j] <= a[i]) j--; [a[i], a[j]] = [a[j], a[i]]; } let l = i + 1, r = a.length - 1; while (l < r) { [a[l], a[r]] = [a[r], a[l]]; l++; r--; } }
  },
  {
    title: 'Sliding Window Maximum', fn: 'maxSlidingWindow',
    cases: [[[1, 3, -1, -3, 5, 3, 6, 7], 3], [[1], 1], [[9, 8, 7, 6], 2], [[1, 3, 1, 2, 0, 5], 3]],
    ref: function maxSlidingWindow(nums, k) { const out = []; for (let i = 0; i + k <= nums.length; i++) out.push(Math.max(...nums.slice(i, i + k))); return out; }
  },
  {
    title: 'Course Schedule II', fn: 'findOrder', compare: 'topo',
    cases: [[2, [[1, 0]]], [4, [[1, 0], [2, 0], [3, 1], [3, 2]]], [1, []], [2, [[1, 0], [0, 1]]], [3, []]],
    ref: function findOrder(n, pre) { const indeg = Array(n).fill(0), adj = Array.from({ length: n }, () => []); for (const [a, b] of pre) { adj[b].push(a); indeg[a]++; } const q = [], out = []; indeg.forEach((d, i) => d || q.push(i)); while (q.length) { const x = q.shift(); out.push(x); for (const y of adj[x]) if (--indeg[y] === 0) q.push(y); } return out.length === n ? out : []; }
  },
  {
    title: 'Merge Two Sorted Lists', fn: 'mergeTwoLists', in: ['list', 'list'], out: 'list',
    cases: [[[1, 2, 4], [1, 3, 4]], [[], []], [[], [0]], [[5], [1, 2, 3]]],
    ref: function mergeTwoLists(a, b) { const d = { next: null }; let t = d; while (a && b) { if (a.val <= b.val) { t.next = a; a = a.next; } else { t.next = b; b = b.next; } t = t.next; } t.next = a || b; return d.next; }
  },
  {
    title: 'Valid Palindrome', fn: 'isPalindrome',
    cases: [['A man, a plan, a canal: Panama'], ['race a car'], [' '], ['0P'], ['ab_a']],
    ref: function isPalindrome(s) { const c = s.toLowerCase().replace(/[^a-z0-9]/g, ''); return c === c.split('').reverse().join(''); }
  },
  {
    title: 'Remove Duplicates from Sorted Array', fn: 'removeDuplicates', prefix: 0,
    cases: [[[1, 1, 2]], [[0, 0, 1, 1, 1, 2, 2, 3, 3, 4]], [[1]], [[1, 2, 3]]],
    ref: function removeDuplicates(a) { let w = 0; for (let r = 0; r < a.length; r++) if (r === 0 || a[r] !== a[w - 1]) a[w++] = a[r]; return w; }
  },
  {
    title: 'Find Peak Element', fn: 'findPeakElement', compare: 'peak',
    cases: [[[1, 2, 3, 1]], [[1, 2, 1, 3, 5, 6, 4]], [[1]], [[2, 1]], [[1, 2]]],
    ref: function findPeakElement(nums) { let lo = 0, hi = nums.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (nums[m] < nums[m + 1]) lo = m + 1; else hi = m; } return lo; }
  },
  {
    title: 'Word Ladder', fn: 'ladderLength',
    cases: [['hit', 'cog', ['hot', 'dot', 'dog', 'lot', 'log', 'cog']], ['hit', 'cog', ['hot', 'dot', 'dog', 'lot', 'log']], ['a', 'c', ['a', 'b', 'c']], ['hot', 'dog', ['hot', 'dog']]],
    ref: function ladderLength(b, e, list) { const words = new Set(list); if (!words.has(e)) return 0; let q = [b], d = 1; const seen = new Set([b]); while (q.length) { const nq = []; for (const w of q) { if (w === e) return d; for (let i = 0; i < w.length; i++) for (let c = 97; c < 123; c++) { const x = w.slice(0, i) + String.fromCharCode(c) + w.slice(i + 1); if (words.has(x) && !seen.has(x)) { seen.add(x); nq.push(x); } } } q = nq; d++; } return 0; }
  },
  {
    title: 'Best Time to Buy and Sell Stock II', fn: 'maxProfit',
    cases: [[[7, 1, 5, 3, 6, 4]], [[1, 2, 3, 4, 5]], [[7, 6, 4, 3, 1]], [[1]]],
    ref: function maxProfit(p) { let s = 0; for (let i = 1; i < p.length; i++) s += Math.max(0, p[i] - p[i - 1]); return s; }
  },
  {
    title: 'Subsets', fn: 'subsets', compare: 'unorderedDeep',
    cases: [[[1, 2, 3]], [[0]], [[4, 1]]],
    ref: function subsets(nums) { const out = [[]]; for (const x of nums) for (const s of out.slice()) out.push(s.concat(x)); return out; }
  },
  {
    title: 'Rotate Array', fn: 'rotate', mutate: 0,
    cases: [[[1, 2, 3, 4, 5, 6, 7], 3], [[-1, -100, 3, 99], 2], [[1, 2], 3], [[1], 0]],
    ref: function rotate(a, k) { k %= a.length; const c = a.slice(); for (let i = 0; i < a.length; i++) a[(i + k) % a.length] = c[i]; }
  },
  {
    title: 'Min Stack', fn: 'MinStack', kind: 'design',
    cases: [
      { ops: ['MinStack', 'push', 'push', 'push', 'getMin', 'pop', 'top', 'getMin'], args: [[], [-2], [0], [-3], [], [], [], []] },
      { ops: ['MinStack', 'push', 'push', 'push', 'getMin', 'pop', 'getMin', 'pop', 'getMin'], args: [[], [1], [1], [2], [], [], [], [], []] },
      { ops: ['MinStack', 'push', 'push', 'getMin', 'pop', 'getMin'], args: [[], [5], [3], [], [], []] }
    ],
    ref: class MinStack { constructor() { this.s = []; } push(v) { this.s.push([v, this.s.length ? Math.min(v, this.s[this.s.length - 1][1]) : v]); } pop() { this.s.pop(); } top() { return this.s[this.s.length - 1][0]; } getMin() { return this.s[this.s.length - 1][1]; } }
  },
  {
    title: 'Word Break', fn: 'wordBreak',
    cases: [['leetcode', ['leet', 'code']], ['applepenapple', ['apple', 'pen']], ['catsandog', ['cats', 'dog', 'sand', 'and', 'cat']], ['aaab', ['a', 'aab']], ['aaaaaaa', ['aaaa', 'aaa']], ['ab', ['a']]],
    ref: function wordBreak(s, dict) { const d = new Set(dict), ok = Array(s.length + 1).fill(false); ok[0] = true; for (let i = 1; i <= s.length; i++) for (let j = 0; j < i; j++) if (ok[j] && d.has(s.slice(j, i))) { ok[i] = true; break; } return ok[s.length]; }
  },
  {
    title: 'Word Search', fn: 'exist',
    cases: [[wordGrid, 'ABCCED'], [wordGrid, 'SEE'], [wordGrid, 'ABCB'], [[['a']], 'a'], [[['a', 'b'], ['c', 'd']], 'abdc'], [[['a', 'a']], 'aaa']],
    ref: function exist(board, word) { const b = board.map((r) => r.slice()); const go = (i, j, k) => { if (k === word.length) return true; if (i < 0 || j < 0 || i >= b.length || j >= b[0].length || b[i][j] !== word[k]) return false; const c = b[i][j]; b[i][j] = '#'; const r = go(i + 1, j, k + 1) || go(i - 1, j, k + 1) || go(i, j + 1, k + 1) || go(i, j - 1, k + 1); b[i][j] = c; return r; }; for (let i = 0; i < b.length; i++) for (let j = 0; j < b[0].length; j++) if (go(i, j, 0)) return true; return false; }
  },
  {
    title: 'Contains Duplicate', fn: 'containsDuplicate',
    cases: [[[1, 2, 3, 1]], [[1, 2, 3, 4]], [[1, 1, 1, 3, 3, 4, 3, 2, 4, 2]], [[]]],
    ref: function containsDuplicate(nums) { return new Set(nums).size !== nums.length; }
  },
  {
    title: 'Longest Increasing Subsequence', fn: 'lengthOfLIS',
    cases: [[[10, 9, 2, 5, 3, 7, 101, 18]], [[0, 1, 0, 3, 2, 3]], [[7, 7, 7, 7]], [[1]], [[4, 10, 4, 3, 8, 9]]],
    ref: function lengthOfLIS(nums) { const len = nums.map(() => 1); for (let i = 0; i < nums.length; i++) for (let j = 0; j < i; j++) if (nums[j] < nums[i]) len[i] = Math.max(len[i], len[j] + 1); return Math.max(0, ...len); }
  },
  {
    title: 'Reorganize String', fn: 'reorganizeString', compare: 'reorganize',
    cases: [['aab'], ['aaab'], ['vvvlo'], ['a'], ['aabb'], ['baaba']],
    ref: function reorganizeString(s) { const c = {}; for (const x of s) c[x] = (c[x] || 0) + 1; const order = Object.keys(c).sort((a, b) => c[b] - c[a]); if (c[order[0]] > Math.ceil(s.length / 2)) return ''; const out = Array(s.length); let i = 0; for (const ch of order) for (let k = 0; k < c[ch]; k++) { if (i >= s.length) i = 1; out[i] = ch; i += 2; } return out.join(''); }
  },
  {
    title: 'Climbing Stairs', fn: 'climbStairs',
    cases: [[1], [2], [3], [5], [10], [45]],
    ref: function climbStairs(n) { let a = 1, b = 1; for (let i = 0; i < n; i++) [a, b] = [b, a + b]; return a; }
  },
  {
    title: 'String Compression', fn: 'compress', prefix: 0,
    cases: [[['a', 'a', 'b', 'b', 'c', 'c', 'c']], [['a']], [['a', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b']], [['a', 'a', 'a', 'b', 'b', 'a', 'a']]],
    ref: function compress(chars) { let w = 0, r = 0; while (r < chars.length) { const c = chars[r]; let n = 0; while (r < chars.length && chars[r] === c) { r++; n++; } chars[w++] = c; if (n > 1) for (const d of String(n)) chars[w++] = d; } return w; }
  },
  {
    title: 'Sort Colors', fn: 'sortColors', mutate: 0,
    cases: [[[2, 0, 2, 1, 1, 0]], [[2, 0, 1]], [[0]], [[1, 2, 0, 0, 2, 1]]],
    ref: function sortColors(a) { a.sort((x, y) => x - y); }
  },
  {
    title: 'Jump Game II', fn: 'jump',
    cases: [[[2, 3, 1, 1, 4]], [[2, 3, 0, 1, 4]], [[0]], [[1, 2]], [[1, 1, 1, 1]]],
    ref: function jump(nums) { let jumps = 0, end = 0, far = 0; for (let i = 0; i < nums.length - 1; i++) { far = Math.max(far, i + nums[i]); if (i === end) { jumps++; end = far; } } return jumps; }
  },
  {
    title: 'Decode String', fn: 'decodeString',
    cases: [['3[a]2[bc]'], ['3[a2[c]]'], ['2[abc]3[cd]ef'], ['abc'], ['10[a]']],
    ref: function decodeString(s) { const st = []; let cur = '', num = 0; for (const c of s) { if (c >= '0' && c <= '9') num = num * 10 + Number(c); else if (c === '[') { st.push([cur, num]); cur = ''; num = 0; } else if (c === ']') { const [prev, k] = st.pop(); cur = prev + cur.repeat(k); } else cur += c; } return cur; }
  },
  {
    title: 'Binary Tree Maximum Path Sum', fn: 'maxPathSum', in: ['tree'],
    cases: [[[1, 2, 3]], [[-10, 9, 20, null, null, 15, 7]], [[-3]], [[2, -1]], [[5, 4, 8, 11, null, 13, 4, 7, 2, null, null, null, 1]]],
    ref: function maxPathSum(root) { let best = -Infinity; const go = (n) => { if (!n) return 0; const l = Math.max(0, go(n.left)), r = Math.max(0, go(n.right)); best = Math.max(best, n.val + l + r); return n.val + Math.max(l, r); }; go(root); return best; }
  },
  {
    title: 'Copy List with Random Pointer', fn: 'copyRandomList', in: ['randomList'], out: 'randomList',
    cases: [[[[7, null], [13, 0], [11, 4], [10, 2], [1, 0]]], [[[1, 1], [2, 1]]], [[[3, null], [3, 0], [3, null]]], [[]]],
    ref: function copyRandomList(head) { const m = new Map(); for (let n = head; n; n = n.next) m.set(n, { val: n.val, next: null, random: null }); for (let n = head; n; n = n.next) { m.get(n).next = n.next ? m.get(n.next) : null; m.get(n).random = n.random ? m.get(n.random) : null; } return head ? m.get(head) : null; }
  },
  {
    title: 'Valid Sudoku', fn: 'isValidSudoku',
    cases: [[board], [badBoard], [colBoard], [emptyBoard]],
    ref: function isValidSudoku(b) { const seen = new Set(); for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) { const v = b[r][c]; if (v === '.') continue; const keys = ['r' + r + v, 'c' + c + v, 'b' + Math.floor(r / 3) + Math.floor(c / 3) + v]; if (keys.some((k) => seen.has(k))) return false; keys.forEach((k) => seen.add(k)); } return true; }
  },
  {
    title: 'Letter Combinations of a Phone Number', fn: 'letterCombinations', compare: 'unordered',
    cases: [['23'], [''], ['2'], ['79']],
    ref: function letterCombinations(d) { if (!d) return []; const m = { 2: 'abc', 3: 'def', 4: 'ghi', 5: 'jkl', 6: 'mno', 7: 'pqrs', 8: 'tuv', 9: 'wxyz' }; let out = ['']; for (const x of d) out = out.flatMap((p) => m[x].split('').map((c) => p + c)); return out; }
  },
  {
    title: 'Daily Temperatures', fn: 'dailyTemperatures',
    cases: [[[73, 74, 75, 71, 69, 72, 76, 73]], [[30, 40, 50, 60]], [[30, 60, 90]], [[90, 80, 70]]],
    ref: function dailyTemperatures(t) { const out = t.map(() => 0), st = []; t.forEach((x, i) => { while (st.length && t[st[st.length - 1]] < x) { const j = st.pop(); out[j] = i - j; } st.push(i); }); return out; }
  },
  {
    title: 'Candy', fn: 'candy',
    cases: [[[1, 0, 2]], [[1, 2, 2]], [[1, 3, 2, 2, 1]], [[1]], [[1, 2, 87, 87, 87, 2, 1]]],
    ref: function candy(r) { const c = r.map(() => 1); for (let i = 1; i < r.length; i++) if (r[i] > r[i - 1]) c[i] = c[i - 1] + 1; for (let i = r.length - 2; i >= 0; i--) if (r[i] > r[i + 1]) c[i] = Math.max(c[i], c[i + 1] + 1); return c.reduce((a, b) => a + b, 0); }
  },
  {
    title: 'Pow(x, n)', fn: 'myPow', compare: 'float',
    cases: [[2, 10], [2.1, 3], [2, -2], [1, -2147483648], [0.5, 0], [-2, 3]],
    ref: function myPow(x, n) { return Math.pow(x, n); }
  },
  {
    title: 'LFU Cache', fn: 'LFUCache', kind: 'design',
    cases: [
      { ops: ['LFUCache', 'put', 'put', 'get', 'put', 'get', 'get', 'put', 'get', 'get', 'get'], args: [[2], [1, 1], [2, 2], [1], [3, 3], [2], [3], [4, 4], [1], [3], [4]] },
      { ops: ['LFUCache', 'put', 'get'], args: [[0], [0, 0], [0]] },
      { ops: ['LFUCache', 'put', 'put', 'put', 'get', 'put', 'get', 'get'], args: [[2], [1, 1], [2, 2], [1, 10], [1], [3, 3], [2], [1]] }
    ],
    ref: class LFUCache { constructor(c) { this.c = c; this.m = new Map(); this.t = 0; } get(k) { const e = this.m.get(k); if (!e) return -1; e.f++; e.t = ++this.t; return e.v; } put(k, v) { if (this.c === 0) return; const e = this.m.get(k); if (e) { e.v = v; e.f++; e.t = ++this.t; return; } if (this.m.size >= this.c) { let worst = null; for (const [key, x] of this.m) if (!worst || x.f < worst[1].f || (x.f === worst[1].f && x.t < worst[1].t)) worst = [key, x]; this.m.delete(worst[0]); } this.m.set(k, { v, f: 1, t: ++this.t }); } }
  },
  {
    title: 'Simplify Path', fn: 'simplifyPath',
    cases: [['/home/'], ['/../'], ['/home//foo/'], ['/a/./b/../../c/'], ['/.../a/../b/c/../d/./']],
    ref: function simplifyPath(p) { const st = []; for (const part of p.split('/')) { if (!part || part === '.') continue; if (part === '..') st.pop(); else st.push(part); } return '/' + st.join('/'); }
  },
  {
    title: 'Basic Calculator', fn: 'calculate',
    cases: [['1 + 1'], [' 2-1 + 2 '], ['(1+(4+5+2)-3)+(6+8)'], ['-(2+3)'], ['1-(     -2)'], ['2147483647']],
    ref: function calculate(s) { let res = 0, sign = 1, num = 0; const st = []; for (const c of s) { if (c >= '0' && c <= '9') num = num * 10 + Number(c); else if (c === '+' || c === '-') { res += sign * num; num = 0; sign = c === '+' ? 1 : -1; } else if (c === '(') { st.push(res, sign); res = 0; sign = 1; } else if (c === ')') { res += sign * num; num = 0; const sg = st.pop(); res = st.pop() + sg * res; } } return res + sign * num; }
  },
  {
    title: 'Majority Element', fn: 'majorityElement',
    cases: [[[3, 2, 3]], [[2, 2, 1, 1, 1, 2, 2]], [[1]], [[6, 5, 5]]],
    ref: function majorityElement(nums) { let c = null, n = 0; for (const x of nums) { if (n === 0) c = x; n += x === c ? 1 : -1; } return c; }
  },
  {
    title: 'Maximum Depth of Binary Tree', fn: 'maxDepth', in: ['tree'],
    cases: [[[3, 9, 20, null, null, 15, 7]], [[1, null, 2]], [[]], [[0]]],
    ref: function maxDepth(n) { return n ? 1 + Math.max(maxDepth(n.left), maxDepth(n.right)) : 0; }
  },
  {
    title: 'Implement Trie (Prefix Tree)', fn: 'Trie', kind: 'design',
    cases: [
      { ops: ['Trie', 'insert', 'search', 'search', 'startsWith', 'insert', 'search'], args: [[], ['apple'], ['apple'], ['app'], ['app'], ['app'], ['app']] },
      { ops: ['Trie', 'insert', 'insert', 'search', 'startsWith', 'startsWith', 'search'], args: [[], ['car'], ['cart'], ['ca'], ['ca'], ['cb'], ['cart']] }
    ],
    ref: class Trie { constructor() { this.words = new Set(); } insert(w) { this.words.add(w); } search(w) { return this.words.has(w); } startsWith(p) { for (const w of this.words) if (w.startsWith(p)) return true; return false; } }
  },
  {
    title: 'Range Sum Query – Mutable', fn: 'NumArray', kind: 'design',
    cases: [
      { ops: ['NumArray', 'sumRange', 'update', 'sumRange'], args: [[[1, 3, 5]], [0, 2], [1, 2], [0, 2]] },
      { ops: ['NumArray', 'sumRange', 'update', 'update', 'sumRange', 'sumRange'], args: [[[-2, 0, 3, -5, 2, -1]], [2, 5], [3, 1], [0, 4], [0, 5], [3, 3]] }
    ],
    ref: class NumArray { constructor(a) { this.a = a.slice(); } update(i, v) { this.a[i] = v; } sumRange(l, r) { let s = 0; for (let i = l; i <= r; i++) s += this.a[i]; return s; } }
  }
];
