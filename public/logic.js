// Game data and logic, shared with the design prototype.
// Problem order and tags: Taro 75 (jointaro.com/interviews/taro-75). Prompts and quests are original wording.
// One gem per topic. Shape differs as well as color, so they read apart without relying on hue.
// Pixel key: h = highlight, b = body, s = shadow, w = sparkle, . = empty
// Twelve families. Each LeetCode tag maps to one family; a problem earns the gem
// of the key idea its quests teach (Two Sum → hashing, even though it is also tagged Array).
var GEMS = {
  'Arrays & hashing': {
    name: 'Sapphire', plural: 'sapphires', color: '#5AA2FF',
    c: { h: '#C7E2FF', b: '#3D8BFF', s: '#1F4FB8', w: '#FFFFFF' },
    shape: ['.hhhhh.', 'bwbbbbb', '.bbbbb.', '..sss..', '...s...']
  },
  'Two pointers & window': {
    name: 'Topaz', plural: 'topazes', color: '#FFC93C',
    c: { h: '#FFF0B3', b: '#FFC93C', s: '#B8860B', w: '#FFFFFF' },
    shape: ['..h..', '.hwb.', 'hbbbb', 'bbbbb', 'bbbbs', '.bss.', '..s..']
  },
  'Stack & queue': {
    name: 'Emerald', plural: 'emeralds', color: '#3DDC84',
    c: { h: '#B8F5CF', b: '#2FBF71', s: '#157A45', w: '#FFFFFF' },
    shape: ['.hhhhh.', 'hwbbbbb', 'bbbbbbb', 'bbbbbss', '.sssss.']
  },
  'Linked list': {
    name: 'Ruby', plural: 'rubies', color: '#FF6B85',
    c: { h: '#FFC2CC', b: '#FF4D6D', s: '#A3162F', w: '#FFFFFF' },
    shape: ['.hh.bb.', 'hwbbbbb', 'bbbbbbs', '.bbbbs.', '..bss..', '...s...']
  },
  'Binary search': {
    name: 'Quartz', plural: 'quartzes', color: '#F7A8C8',
    c: { h: '#FFE3EE', b: '#F7A8C8', s: '#B8637F', w: '#FFFFFF' },
    shape: ['..h..', '.hwb.', 'hbbbb', 'hbbbb', 'hbbbs', 'hbbbs', 'sssss']
  },
  'Trees & BST': {
    name: 'Jade', plural: 'jades', color: '#7FD9A8',
    c: { h: '#D4F7E3', b: '#5FBF8E', s: '#2E7A55', w: '#FFFFFF' },
    shape: ['..hhh..', '.hwbbb.', 'hbb.bbb', 'hb...bs', 'hbb.bbs', '.bbbbs.', '..sss..']
  },
  'Heap': {
    name: 'Opal', plural: 'opals', color: '#9EE6D8',
    c: { h: '#F0FFFA', b: '#9EE6D8', s: '#6F8FD6', w: '#FFFFFF' },
    shape: ['..hhh..', '.hwbbb.', 'hbbbbbs', '.bbbbs.', '..sss..']
  },
  'Graphs': {
    name: 'Onyx', plural: 'onyxes', color: '#B9B4D6',
    c: { h: '#A9A9C4', b: '#4A4A66', s: '#2A2A3D', w: '#E8E6F5' },
    shape: ['hhhhhs', 'hwbbbs', 'hbbbbs', 'hbbbbs', 'hbbbbs', 'ssssss']
  },
  'Backtracking': {
    name: 'Garnet', plural: 'garnets', color: '#FF7A52',
    c: { h: '#FFB199', b: '#E2552E', s: '#8A2A12', w: '#FFFFFF' },
    shape: ['...h...', '..hwb..', '.hbbbb.', 'hbbbbbs', 'sssssss']
  },
  'Dynamic programming': {
    name: 'Diamond', plural: 'diamonds', color: '#E8F8FF',
    c: { h: '#FFFFFF', b: '#CDEFFF', s: '#7FB8D4', w: '#FFFFFF' },
    shape: ['...h...', '...h...', '..hwb..', 'hhwbbbs', '..bbs..', '...s...', '...s...']
  },
  'Greedy & intervals': {
    name: 'Amethyst', plural: 'amethysts', color: '#B98CFF',
    c: { h: '#E6D2FF', b: '#A970FF', s: '#6A35C2', w: '#FFFFFF' },
    shape: ['.hhhhh.', 'hwbbbbb', 'bbbbbbs', '.sssss.']
  },
  'Math & bits': {
    name: 'Pearl', plural: 'pearls', color: '#F3E6D8',
    c: { h: '#FFFFFF', b: '#F3E6D8', s: '#B9A58F', w: '#FFFFFF' },
    shape: ['.hhh.', 'hwhbb', 'hbbbb', 'hbbbs', '.sss.']
  },
  // RARE gems: one per clear, animated. Alexandrite branches like a trie and shifts
  // teal → violet; Moonstone is drawn as a segment tree and a light sweeps across it.
  'Trie': {
    name: 'Alexandrite', plural: 'alexandrites', color: '#4FE0BA', rare: true, fx: 'rare-alex',
    c: { h: '#B8FFE8', b: '#2EC4A0', s: '#13705C', w: '#FFFFFF' },
    shape: ['h..h..h', 'w..h..b', 'b..b..b', '.bbbbb.', '..bbb..', '...b...', '...s...']
  },
  'Segment tree': {
    name: 'Moonstone', plural: 'moonstones', color: '#CFEFFF', rare: true, fx: 'rare-moon',
    c: { h: '#F2FAFF', b: '#A9D6F5', s: '#5A86B8', w: '#FFFFFF' },
    shape: ['hhhhhhhhhhs', '...........', 'hwhhh.bbbbs', '...........', 'hb.bb.bb.bs']
  }
};
var GEM_ORDER = ['Arrays & hashing', 'Two pointers & window', 'Stack & queue', 'Linked list', 'Binary search', 'Trees & BST', 'Heap', 'Graphs', 'Backtracking', 'Dynamic programming', 'Greedy & intervals', 'Math & bits', 'Trie', 'Segment tree'];

function gemPixels(topic, px) {
  var g = GEMS[topic];
  var cells = [];
  g.shape.forEach(function (row) {
    for (var i = 0; i < row.length; i++) {
      var ch = row.charAt(i);
      var on = ch !== '.';
      cells.push({ bg: on ? g.c[ch] : 'transparent', cls: g.rare && on ? 'sheen' : '', d: (i * 0.1).toFixed(1) + 's' });
    }
  });
  return { w: g.shape[0].length, px: px, cells: cells, rare: !!g.rare, fx: g.rare ? g.fx : '' };
}
var SHORT = {
  'Arrays & hashing': 'HASHING', 'Two pointers & window': 'POINTERS', 'Stack & queue': 'STACK', 'Linked list': 'LINKED LIST',
  'Binary search': 'BIN SEARCH', 'Trees & BST': 'TREES', 'Heap': 'HEAP', 'Graphs': 'GRAPHS', 'Backtracking': 'BACKTRACK',
  'Dynamic programming': 'DP', 'Greedy & intervals': 'GREEDY', 'Math & bits': 'MATH', 'Trie': 'TRIE ★', 'Segment tree': 'SEG TREE ★'
};
function rewardFor(q) { return GEMS[q.family].rare ? 1 : REWARD[q.diff]; }

// Prerequisites between families: a family unlocks once you hold enough gems of the
// families it builds on. Families with no entry are open from the start.
var LOCKS = {
  'Two pointers & window': { why: 'Sliding windows reuse the “have I seen this?” trick from hashing.', need: [['Arrays & hashing', 3]] },
  'Stack & queue': { why: 'A stack is an array you only touch at one end.', need: [['Arrays & hashing', 3]] },
  'Binary search': { why: 'Binary search halves a sorted array — get comfortable with arrays first.', need: [['Arrays & hashing', 3]] },
  'Trees & BST': { why: 'A tree is a linked list with two next pointers.', need: [['Linked list', 3]] },
  'Heap': { why: 'A heap is a tree packed into an array.', need: [['Trees & BST', 3]] },
  'Graphs': { why: 'Graph BFS and DFS are tree traversals that also handle cycles.', need: [['Trees & BST', 3]] },
  'Backtracking': { why: 'Backtracking walks a tree of choices with recursion.', need: [['Trees & BST', 3]] },
  'Dynamic programming': { why: 'DP is often backtracking plus a memo of answers already found.', need: [['Backtracking', 5]] },
  'Trie': { why: 'A trie is a tree whose children live in a hash map.', need: [['Arrays & hashing', 3], ['Trees & BST', 3]] },
  'Segment tree': { why: 'Each node holds a range, like a window, split in halves like a tree.', need: [['Trees & BST', 3], ['Two pointers & window', 5]] }
};
// Problem-level rules. `after`: quests that must be cleared first (natural pairs inside the Taro 75).
// `need`: extra gems from other families, for problems that mix topics.
var RULES = {
  '3Sum': { after: ['Two Sum'], why: '3Sum is Two Sum run once per number.' },
  'Group Anagrams': { after: ['Valid Anagram'], why: 'Check one pair before grouping many.' },
  'Subarray Sum Equals K': { need: [['Two pointers & window', 3]], why: 'See why a sliding window fails here before reaching for prefix sums.' },
  'LRU Cache': { need: [['Arrays & hashing', 3]], why: 'A hash map and a linked list working together.' },
  'LFU Cache': { after: ['LRU Cache'], why: 'LFU is an LRU list for every frequency.' },
  'Add Two Numbers': { after: ['Merge Two Sorted Lists'], why: 'The dummy-head pattern comes from merging lists.' },
  'Copy List with Random Pointer': { after: ['Reverse Linked List'], need: [['Arrays & hashing', 3]], why: 'Pointer rewiring plus an old → new map.' },
  'Merge k Sorted Lists': { after: ['Merge Two Sorted Lists'], need: [['Linked list', 3]], why: 'Merging k lists is merging two, repeated with a heap.' },
  'Top K Frequent Elements': { after: ['Kth Largest Element in an Array'], need: [['Arrays & hashing', 3]], why: 'A size-k heap first, then feed it counts.' },
  'Meeting Rooms II': { need: [['Heap', 5]], why: 'Sweep the intervals while a heap tracks the free rooms.' },
  'Reorganize String': { need: [['Greedy & intervals', 5]], why: 'A greedy choice served by a heap.' },
  'Jump Game II': { after: ['Jump Game'], why: 'The same reach idea, now counting jumps.' },
  'Best Time to Buy and Sell Stock II': { after: ['Best Time to Buy and Sell Stock'], why: 'The one-trade version comes first.' },
  'Course Schedule II': { after: ['Course Schedule'], why: 'Detect the cycle first, then produce the order.' },
  'Rotting Oranges': { after: ['Number of Islands'], why: 'Flood one island before spreading from many sources.' },
  'Word Ladder': { after: ['Number of Islands'], why: 'BFS on a grid first, then on a graph of words.' },
  'Word Search': { after: ['Number of Islands'], why: 'Grid DFS first, then learn to undo it.' },
  'Letter Combinations of a Phone Number': { after: ['Subsets'], why: 'The same tree of choices as Subsets.' },
  'Integer to Roman': { after: ['Roman to Integer'], why: 'Read Roman numerals before you write them.' },
  'Spiral Matrix': { after: ['Rotate Image'], why: 'Get used to matrix indices first.' },
  'Minimum Window Substring': { after: ['Longest Substring Without Repeating Characters'], why: 'The same window template, now with counts.' },
  'Trapping Rain Water': { after: ['Container With Most Water'], need: [['Stack & queue', 3]], why: 'Two walls first; the stack view helps too.' },
  'Longest Palindromic Substring': { after: ['Valid Palindrome'], why: 'Check a palindrome before you grow one.' },
  'Decode String': { after: ['Valid Parentheses'], why: 'Matching brackets with a stack comes first.' },
  'Basic Calculator': { after: ['Valid Parentheses'], why: 'Matching brackets with a stack comes first.' },
  'Sliding Window Maximum': { after: ['Daily Temperatures'], need: [['Two pointers & window', 5]], why: 'A monotonic stack, slid along a window.' },
  'House Robber': { after: ['Climbing Stairs'], why: 'Climbing Stairs is the simplest recurrence.' },
  'Coin Change': { after: ['Climbing Stairs'], why: 'Climbing Stairs is the simplest recurrence.' },
  'Longest Increasing Subsequence': { need: [['Binary search', 5]], why: 'The fast version binary-searches a tails array.' },
  'Binary Tree Maximum Path Sum': { after: ['Maximum Depth of Binary Tree'], need: [['Dynamic programming', 5]], why: 'Tree recursion that carries a best-so-far: tree DP.' },
  'Implement Trie (Prefix Tree)': { after: ['Longest Common Prefix'], why: 'Shared prefixes are exactly what a trie stores.' },
  'Range Sum Query – Mutable': { after: ['Subarray Sum Equals K'], why: 'Prefix sums first, then a tree of them.' }
};

// Secondary Taro tags drop shards; 5 shards of a family fuse into one gem.
var SHARDS_PER_GEM = 5;
var TAG_FAMILY = {
  'Arrays': 'Arrays & hashing', 'Strings': 'Arrays & hashing', 'Two Pointers': 'Two pointers & window', 'Sliding Windows': 'Two pointers & window',
  'Stacks': 'Stack & queue', 'Linked Lists': 'Linked list', 'Binary Search': 'Binary search', 'Trees': 'Trees & BST', 'Graphs': 'Graphs',
  'Recursion': 'Backtracking', 'Dynamic Programming': 'Dynamic programming', 'Greedy Algorithms': 'Greedy & intervals', 'Sorting': 'Greedy & intervals',
  'Bit Manipulation': 'Math & bits'
};
function shardFamilies(q) {
  var out = [];
  (q.tags || '').split(' · ').forEach(function (t) {
    var f = TAG_FAMILY[t];
    if (f && f !== q.family && out.indexOf(f) < 0) out.push(f);
  });
  return out;
}

// Tiers: inside a family, a Medium needs one easier clear, a Hard needs two (when that many exist).
var DIFF_RANK = { Easy: 0, Medium: 1, Hard: 2 };
function tierNeed(q) {
  if (GEMS[q.family].rare || q.diff === 'Easy') return 0;
  var easier = PROBLEMS.filter(function (x) { return x.family === q.family && DIFF_RANK[x.diff] < DIFF_RANK[q.diff]; });
  return Math.min(q.diff === 'Hard' ? 2 : 1, easier.length);
}
function tierHave(q, solved) {
  return PROBLEMS.filter(function (x, i) { return solved[i] && x.family === q.family && DIFF_RANK[x.diff] < DIFF_RANK[q.diff]; }).length;
}
function solvedTitles(solved) {
  var t = {};
  PROBLEMS.forEach(function (q, i) { if (solved[i]) t[q.title] = true; });
  return t;
}
function gemReq(fam, n, gems) {
  var g = GEMS[fam];
  var have = Math.min(gems[fam] || 0, n);
  var met = have >= n;
  return {
    isGem: true, gem: gemPixels(fam, 2), met: met, color: met ? '#3DDC84' : g.color,
    textColor: met ? '#3DDC84' : '#F4F1E8',
    label: (met ? '✓ ' : '') + have + '/' + n + ' ' + g.plural + ' · ' + fam.toLowerCase(),
    pct: Math.round(have / n * 100) + '%'
  };
}
function textReq(met, label, have, need) {
  return {
    isGem: false, isQuest: true, gem: { w: 1, px: 1, cells: [], fx: '', rare: false }, met: met, color: met ? '#3DDC84' : '#FFD23F',
    textColor: met ? '#3DDC84' : '#F4F1E8', label: label, pct: Math.round(have / need * 100) + '%'
  };
}
function familyWord(f) { return SHORT[f].replace(' ★', '').toLowerCase(); }
function reqsFor(q, gems, solved) {
  solved = solved || {};
  var out = [];
  var lock = LOCKS[q.family];
  var rule = RULES[q.title] || {};
  (lock ? lock.need : []).concat(rule.need || []).forEach(function (r) { out.push(gemReq(r[0], r[1], gems)); });
  var done = solvedTitles(solved);
  (rule.after || []).forEach(function (t) {
    var met = !!done[t];
    out.push(textReq(met, (met ? '✓ ' : '') + 'Clear “' + t + '”', met ? 1 : 0, 1));
  });
  var k = tierNeed(q);
  if (k > 0) {
    var have = Math.min(tierHave(q, solved), k);
    out.push(textReq(have >= k, (have >= k ? '✓ ' : '') + have + '/' + k + ' easier ' + familyWord(q.family) + ' clears', have, k));
  }
  return out;
}
function isLocked(q, gems, solved) { return reqsFor(q, gems, solved).some(function (r) { return !r.met; }); }
function whyFor(q, gems, solved) {
  var lock = LOCKS[q.family];
  if (lock && lock.need.some(function (r) { return (gems[r[0]] || 0) < r[1]; })) return lock.why;
  var rule = RULES[q.title];
  if (rule) {
    var done = solvedTitles(solved);
    var ruleOpen = (rule.need || []).every(function (r) { return (gems[r[0]] || 0) >= r[1]; }) &&
      (rule.after || []).every(function (t) { return done[t]; });
    if (!ruleOpen) return rule.why;
  }
  return 'Climb the tier: clear ' + (q.diff === 'Hard' ? 'Medium ' : 'Easy ') + familyWord(q.family) + ' quests first.';
}

var PROBLEMS = [
  {
    rank: 1, tags: 'Arrays',
    title: 'Two Sum', topic: 'Hash map', family: 'Arrays & hashing', mono: '#', diff: 'Easy',
    prompt: 'Given an array of integers and a target, return the indices of the two numbers that add up to the target. Exactly one answer exists.',
    example: 'nums = [2, 7, 11, 15], target = 9\n→ [0, 1]',
    steps: [
      { q: 'Forget efficiency for a moment. What is the most obvious way to solve this, and how much work does it do?', tip: 'Try every pair. How many pairs can you make from n numbers?', insight: 'Checking every pair works, but it is about n²/2 comparisons — O(n²). The next questions hunt for the repeated work hiding in there.' },
      { q: 'You are standing at nums[i]. What exact value are you hoping you have already seen?', tip: 'If nums[i] + x = target, solve for x.', insight: 'You want target − nums[i], the “complement”. The question changes from “which pair?” to “have I seen this one number?”' },
      { q: 'Which data structure answers “have I seen this value, and at which index?” in constant time?', tip: 'You need to go from a value to a position.', insight: 'A hash map from value → index. Lookup and insert are O(1) on average.' },
      { q: 'Should you insert nums[i] into the map before or after checking for its complement? Why does it matter?', tip: 'Try target = 6 with nums = [3, 2, 4].', insight: 'Check first, then insert. Otherwise 3 can find itself and you return [0, 0].' }
    ],
    starter: 'function twoSum(nums: number[], target: number): number[] {\n  const seen = new Map<number, number>();\n\n  for (let i = 0; i < nums.length; i++) {\n    // your idea from quest 4 goes here\n  }\n\n  return [];\n}\n',
    review: {
      tests: '4 of 4 sample tests passed', time: 'O(n)', space: 'O(n)',
      notes: [
        { tag: 'Good', text: 'You check for the complement before inserting, so a single 3 can’t pair with itself.' },
        { tag: 'Consider', text: 'return [] at the end is unreachable given the constraints. Fine to keep, but a comment saying why helps a reader.' },
        { tag: 'Style', text: 'Naming the complement (const need = target - nums[i]) makes line 5 read like your quest 2 answer.' }
      ],
      followup: 'What changes if the array is already sorted? Could you drop the map entirely?'
    }
  },
  {
    rank: 42, tags: 'Linked Lists · Recursion',
    title: 'Reverse Linked List', topic: 'Linked list', family: 'Linked list', mono: '->', diff: 'Easy',
    prompt: 'Given the head of a singly linked list, reverse the list in place and return the new head.',
    example: '1 → 2 → 3 → 4 → null\n→ 4 → 3 → 2 → 1 → null',
    steps: [
      { q: 'Picture 1 → 2 → 3 → null. After reversing, where should node 1’s next pointer point?', tip: 'What sits at the end of every list?', insight: 'null. The old head becomes the new tail.' },
      { q: 'If you write curr.next = prev, what do you lose — and how do you keep it?', tip: 'Draw the arrow you just overwrote. What was it pointing at?', insight: 'You lose the rest of the list. Save next = curr.next before you rewire, then step forward with it.' },
      { q: 'When the loop ends, which variable holds the new head?', tip: 'Trace the last step: curr has just become null.', insight: 'prev. curr has walked off the end, and prev is the last node you visited.' }
    ],
    starter: 'function reverseList(head: ListNode | null): ListNode | null {\n  let prev: ListNode | null = null;\n  let curr = head;\n\n  while (curr) {\n    // save, rewire, advance\n  }\n\n  return prev;\n}\n',
    review: {
      tests: '3 of 3 sample tests passed', time: 'O(n)', space: 'O(1)',
      notes: [
        { tag: 'Good', text: 'Saving next before rewiring means you never lose the rest of the list.' },
        { tag: 'Consider', text: 'A recursive version reads nicely but uses O(n) call-stack space. Worth knowing both.' }
      ],
      followup: 'Can you reverse only the nodes between positions left and right, in one pass?'
    }
  },
  {
    rank: 6, tags: 'Strings · Stacks',
    title: 'Valid Parentheses', topic: 'Stack', family: 'Stack & queue', mono: '()', diff: 'Easy',
    prompt: 'Given a string of brackets ()[]{}, decide whether every opener is closed by the matching type, in the right order.',
    example: 's = "([]{})" → true\ns = "(]"     → false',
    steps: [
      { q: 'When you read a closing bracket, which opening bracket must it match?', tip: 'Look at "([)]". Why is it invalid even though the counts balance?', insight: 'It must match the most recent unmatched opener — not just any opener.' },
      { q: '“Most recent first” describes which data structure?', tip: 'Think about plates piled on a table.', insight: 'A stack: push openers, pop when a closer arrives and compare.' },
      { q: 'Once you reach the end of the string, what has to be true for the answer to be true?', tip: 'Try "((".', insight: 'The stack must be empty. Leftover openers were never closed.' }
    ],
    starter: 'function isValid(s: string): boolean {\n  const stack: string[] = [];\n  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };\n\n  for (const ch of s) {\n    // push or pop?\n  }\n\n  return false;\n}\n',
    review: {
      tests: '5 of 5 sample tests passed', time: 'O(n)', space: 'O(n)',
      notes: [
        { tag: 'Good', text: 'The pairs map keeps closer → opener in one place instead of three if-branches.' },
        { tag: 'Consider', text: 'An odd-length string can never be valid. A one-line early exit saves work.' }
      ],
      followup: 'If there were only one kind of bracket, could you replace the stack with a single counter?'
    }
  },
  {
    rank: 5, tags: 'Strings · Two Pointers · Sliding Windows',
    title: 'Longest Substring Without Repeating Characters', topic: 'Sliding window', family: 'Two pointers & window', mono: '[]', diff: 'Medium',
    prompt: 'Find the length of the longest substring in which no character appears twice.',
    example: 's = "abcabcbb" → 3   ("abc")\ns = "pwwkew"   → 3   ("wke")',
    steps: [
      { q: 'Suppose s[l..r] has no repeats and s[r+1] is a character already inside it. What do you know about every window that starts at l and goes past r?', tip: 'Could any of them be valid?', insight: 'None can be valid — they all contain the duplicate. So you never restart from scratch; you only move l forward.' },
      { q: 'How far forward should l jump when the duplicate appears?', tip: 'Where was the earlier copy of that character?', insight: 'Just past the previous occurrence of that character — but never backwards, so take the max with the current l.' },
      { q: 'What do you need to store to know “the previous occurrence” in O(1)?', tip: 'Same trick as Two Sum.', insight: 'A map from character → last index seen.' }
    ],
    starter: 'function lengthOfLongestSubstring(s: string): number {\n  const last = new Map<string, number>();\n  let best = 0;\n  let l = 0;\n\n  for (let r = 0; r < s.length; r++) {\n    // move l, record s[r], update best\n  }\n\n  return best;\n}\n',
    review: {
      tests: '4 of 4 sample tests passed', time: 'O(n)', space: 'O(k)',
      notes: [
        { tag: 'Good', text: 'Math.max(l, last.get(ch) + 1) handles “abba”, where the old index is behind the window.' },
        { tag: 'Watch', text: 'k is the alphabet size. Say so in your complexity — interviewers like hearing it.' }
      ],
      followup: 'How would you return the substring itself, not just its length?'
    }
  },
  {
    rank: 3, tags: 'Arrays · Sorting',
    title: 'Merge Intervals', topic: 'Intervals', family: 'Greedy & intervals', mono: '|-|', diff: 'Medium',
    prompt: 'Given a list of [start, end] intervals, merge every overlapping pair and return the result.',
    example: '[[1,3],[2,6],[8,10],[15,18]]\n→ [[1,6],[8,10],[15,18]]',
    steps: [
      { q: 'If the intervals were in random order, how would you even know which ones might overlap?', tip: 'What ordering would put potential overlaps next to each other?', insight: 'Sort by start. Then any interval can only overlap the one you are currently building.' },
      { q: 'After sorting, when exactly does the next interval overlap the current merged one?', tip: 'Compare one start with one end.', insight: 'When next.start ≤ current.end.' },
      { q: 'When they overlap, what is the new end? Careful with [1,10] and [2,3].', tip: 'Is the next end always bigger?', insight: 'max(current.end, next.end). A short interval can sit fully inside a long one.' }
    ],
    starter: 'function merge(intervals: number[][]): number[][] {\n  intervals.sort((a, b) => a[0] - b[0]);\n  const out: number[][] = [];\n\n  for (const [s, e] of intervals) {\n    // extend the last one, or start a new one?\n  }\n\n  return out;\n}\n',
    review: {
      tests: '6 of 6 sample tests passed', time: 'O(n log n)', space: 'O(n)',
      notes: [
        { tag: 'Good', text: 'You used max for the end, so nested intervals like [1,10],[2,3] stay correct.' },
        { tag: 'Consider', text: 'sort() mutates the caller’s array. Copy first if that matters to whoever calls you.' }
      ],
      followup: 'What if intervals arrive one at a time, as a stream? What would you keep in memory?'
    }
  },
  {
    bonus: true, tags: 'Bonus · Trees',
    title: 'Maximum Depth of Binary Tree', topic: 'Binary tree', family: 'Trees & BST', mono: 'Y', diff: 'Easy',
    prompt: 'Given the root of a binary tree, return its depth: the number of nodes on the longest path from the root down to a leaf.',
    example: '    3\n   / \\\n  9   20\n     /  \\\n    15   7\n→ 3',
    steps: [
      { q: 'If someone told you the depth of the left subtree and of the right subtree, how would you get the depth of the whole tree?', tip: 'The root adds one level on top.', insight: '1 + max(left, right). The answer is built from two smaller answers of the same shape — that is recursion.' },
      { q: 'What is the depth of an empty tree (root is null)? Why does that one case matter?', tip: 'Where does the recursion stop?', insight: '0. It is the base case: every path ends in null, and that is where the counting starts.' },
      { q: 'Could you find the depth without recursion? What would you count?', tip: 'Visit the tree one level at a time.', insight: 'Yes: BFS with a queue, counting the levels you process. Graph BFS later uses exactly this idea.' }
    ],
    starter: 'function maxDepth(root: TreeNode | null): number {\n  // base case first\n\n  return 0;\n}\n',
    review: {
      tests: '4 of 4 sample tests passed', time: 'O(n)', space: 'O(h)',
      notes: [
        { tag: 'Good', text: 'The recursion mirrors your quest 1 answer almost word for word.' },
        { tag: 'Watch', text: 'O(h) is the call stack. On a tree shaped like a linked list, h is n.' }
      ],
      followup: 'How would you find the minimum depth instead? Careful with nodes that have only one child.'
    }
  },
  {
    bonus: true, tags: 'Bonus · Trie',
    title: 'Implement Trie (Prefix Tree)', topic: 'Trie', family: 'Trie', mono: 'T', diff: 'Medium',
    prompt: 'Build a prefix tree with insert(word), search(word) and startsWith(prefix).',
    example: 'insert("apple")\nsearch("app")     → false\nstartsWith("app") → true',
    steps: [
      { q: 'If you kept every word in a plain Set, which of the three operations would be slow, and why?', tip: 'How would startsWith("app") find its matches?', insight: 'startsWith. A set only answers exact matches, so you would scan every word. You want words with a shared prefix to share storage.' },
      { q: 'Picture "app" and "apple" sharing the path a → p → p. What does one node need to hold?', tip: 'From one node, where can you go next?', insight: 'A map (or a 26-slot array) from the next character to a child node.' },
      { q: 'After inserting "apple", search("app") also walks a complete path. How do you tell it apart from a real word?', tip: 'What extra fact must the last node of "app" remember?', insight: 'An isEnd flag on the node where a word finishes. search checks it; startsWith ignores it.' }
    ],
    starter: 'class TrieNode {\n  children = new Map<string, TrieNode>();\n  isEnd = false;\n}\n\nclass Trie {\n  root = new TrieNode();\n\n  insert(word: string): void {\n    // walk, creating nodes as you go\n  }\n\n  search(word: string): boolean {\n    return false;\n  }\n\n  startsWith(prefix: string): boolean {\n    return false;\n  }\n}\n',
    review: {
      tests: '5 of 5 sample tests passed', time: 'O(L)', space: 'O(N·L)',
      notes: [
        { tag: 'Good', text: 'A shared private walk(s) helper keeps search and startsWith from duplicating the loop.' },
        { tag: 'Watch', text: 'A Map per node is flexible; a 26-slot array is faster when input is lowercase only.' }
      ],
      followup: 'How would you support search with "." as a wildcard for any single letter?'
    }
  },
  {
    bonus: true, tags: 'Bonus · Segment tree',
    title: 'Range Sum Query – Mutable', topic: 'Segment tree', family: 'Segment tree', mono: '[|]', diff: 'Medium',
    prompt: 'Support update(i, val) and sumRange(l, r) on an array, with many calls of each mixed together.',
    example: 'nums = [1, 3, 5]\nsumRange(0, 2) → 9\nupdate(1, 2)\nsumRange(0, 2) → 8',
    steps: [
      { q: 'A prefix-sum array makes sumRange O(1). What does it cost when you update one value?', tip: 'Which prefix sums include nums[i]?', insight: 'Every prefix after i changes, so each update is O(n). Fast queries, slow updates.' },
      { q: 'Suppose each node stores the sum of a range, and each range splits into two halves. How many nodes does one update touch?', tip: 'Follow index i from the root down to its leaf.', insight: 'One per level: O(log n). Each node on that path recomputes its sum from its two children.' },
      { q: 'For sumRange(l, r), when can you take a node’s stored sum whole, without going deeper?', tip: 'Compare the node’s range with [l, r].', insight: 'When its range lies fully inside [l, r]. Skip nodes fully outside and only split partial overlaps: O(log n) nodes.' }
    ],
    starter: 'class NumArray {\n  private tree: number[];\n  private n: number;\n\n  constructor(nums: number[]) {\n    this.n = nums.length;\n    this.tree = new Array(2 * this.n).fill(0);\n    // build: leaves at n..2n-1, parents below\n  }\n\n  update(index: number, val: number): void {\n  }\n\n  sumRange(left: number, right: number): number {\n    return 0;\n  }\n}\n',
    review: {
      tests: '4 of 4 sample tests passed', time: 'O(log n)', space: 'O(n)',
      notes: [
        { tag: 'Good', text: 'The bottom-up tree of size 2n avoids recursion and is easy to trace by hand.' },
        { tag: 'Consider', text: 'A Fenwick tree solves this problem with less code. Worth comparing afterwards.' }
      ],
      followup: 'How would you add a value to every element in a range, not just at one index?'
    }
  }
];

// ---- Taro 75 (jointaro.com ranking). Prompts and quests are our own wording. ----
// C(rank, title, difficulty, gem family, Taro tags, prompt, example, [[question, hint, insight] x3],
//   starter, time, space, watch-out note, follow-up)
function F(sig, ret) { return sig + ' {\n  // your plan from the quests\n' + (ret ? '\n  return ' + ret + ';\n' : '') + '}\n'; }
function C(rank, title, diff, family, tags, prompt, example, steps, starter, time, space, watch, followup) {
  return {
    rank: rank, title: title, diff: diff, family: family, tags: tags, topic: tags, prompt: prompt, example: example,
    steps: steps.map(function (s) { return { q: s[0], tip: s[1], insight: s[2] }; }),
    starter: starter,
    review: {
      tests: '4 of 4 sample tests passed', time: time, space: space,
      notes: [
        { tag: 'Good', text: 'Your code follows the plan you built in the quests. Read it next to your answers, line by line.' },
        { tag: 'Watch', text: watch }
      ],
      followup: followup
    }
  };
}
var H = 'Arrays & hashing', TP = 'Two pointers & window', ST = 'Stack & queue', LL = 'Linked list', BS = 'Binary search',
    TR = 'Trees & BST', HP = 'Heap', GR = 'Graphs', BT = 'Backtracking', DP = 'Dynamic programming', GI = 'Greedy & intervals', MB = 'Math & bits';

var TARO = [
  C(2, 'LRU Cache', 'Medium', LL, 'Linked Lists · Dynamic Programming',
    'Design a fixed-size cache with O(1) get and put that evicts the least recently used key when full.',
    'capacity = 2\nput(1,1) put(2,2) get(1) → 1\nput(3,3)   // evicts key 2\nget(2) → -1',
    [['get needs O(1) lookup by key. Which structure gives you that?', 'Key → something.', 'A hash map from key to the cached entry.'],
     ['You also need the least recently used entry in O(1), and to move any entry to “most recent” in O(1). Which ordered structure lets you unlink a node from the middle in O(1)?', 'Shifting an array is O(n). What can you splice?', 'A doubly linked list: with prev and next you unlink any node in O(1). Head = most recent, tail = least recent.'],
     ['How do the two structures point at each other, and what does put do when the cache is full?', 'What must the map store so you can find the node?', 'The map stores key → node. On a full put, remove the tail node and delete its key from the map — so each node also stores its key.']],
    'class LRUCache {\n  constructor(capacity: number) {\n  }\n\n  get(key: number): number {\n    return -1;\n  }\n\n  put(key: number, value: number): void {\n  }\n}\n',
    'O(1)', 'O(cap)', 'Forgetting to delete the evicted key from the map is the classic bug. Dummy head and tail nodes remove the null checks.',
    'JavaScript’s Map keeps insertion order. Could you build the same cache with only a Map?'),
  C(4, 'Best Time to Buy and Sell Stock', 'Easy', GI, 'Arrays · Dynamic Programming',
    'Given daily prices, find the best profit from one buy followed by one later sell (0 if none).',
    'prices = [7, 1, 5, 3, 6, 4] → 5',
    [['If you decided to sell on day i, which day would you want to have bought on?', 'Only earlier days count.', 'The cheapest day before i.'],
     ['Do you need to look back every time to find that cheapest price?', 'What could you carry forward as you scan?', 'No — keep a running minimum. Each day, profit = price − minSoFar.'],
     ['What is the answer when prices only fall?', 'Is a negative profit allowed?', '0: you simply never trade. Start the best at 0.']],
    F('function maxProfit(prices: number[]): number', '0'), 'O(n)', 'O(1)',
    'Do not sort the prices — the order of the days is the whole problem.', 'What if you could make at most two transactions?'),
  C(7, 'Number of Islands', 'Medium', GR, 'Graphs · Arrays',
    'In a grid of land (1) and water (0), count the islands: groups of land joined up, down, left or right.',
    '1 1 0 0\n1 0 0 1\n0 0 1 1\n→ 2',
    [['Think of each land cell as a node. Which cells are its neighbours?', 'Diagonals do not count.', 'Up to four — up, down, left, right — if they are land. The grid is a graph in disguise.'],
     ['When you find an unvisited land cell, what should happen before you count the next island?', 'How do you avoid counting one island twice?', 'Flood it: DFS or BFS from that cell, marking every connected land cell visited. Then count +1.'],
     ['Where can you store “visited” without an extra array?', 'May you change the grid?', 'Overwrite visited land with 0 (“sink” it), if mutating the input is allowed. Otherwise keep a visited set.']],
    F('function numIslands(grid: string[][]): number', '0'), 'O(m·n)', 'O(m·n)',
    'Recursive DFS can overflow the call stack on a huge all-land grid; BFS with a queue avoids that.', 'How would you return the size of the largest island instead?'),
  C(8, 'Group Anagrams', 'Medium', H, 'Arrays · Strings',
    'Group together the words that are anagrams of each other.',
    '["eat","tea","tan","ate","nat","bat"]\n→ [eat,tea,ate] [tan,nat] [bat]',
    [['What do all anagrams of “eat” share that other words do not?', 'Same letters, different order.', 'The same multiset of letters.'],
     ['How can you turn that into a key that is identical for every anagram?', 'A canonical form.', 'Sort the letters (“aet”), or count letters into a 26-slot signature such as “1#0#0…”.'],
     ['Which structure collects the groups as you go?', 'Key → list.', 'A hash map from key to the list of words with that key. The groups are its values.']],
    F('function groupAnagrams(strs: string[]): string[][]', '[]'), 'O(n·k log k)', 'O(n·k)',
    'Arrays are not map keys by value in JavaScript — join the counts into a string.', 'When is the counting key faster than sorting each word?'),
  C(9, 'Trapping Rain Water', 'Hard', TP, 'Arrays · Two Pointers · Dynamic Programming · Stacks',
    'Bars of the given heights stand side by side. How much rain water stays trapped between them?',
    '[0,1,0,2,1,0,1,3,2,1,2,1] → 6',
    [['Look at a single bar. What decides how high water can stand above it?', 'Water spills over the lower wall.', 'min(tallest bar to its left, tallest to its right) − its own height, if that is positive.'],
     ['You could precompute leftMax and rightMax arrays. Suppose leftMax < rightMax right now. Which side is the bottleneck?', 'Does the right side’s exact value matter then?', 'The left. Its water is fixed by leftMax, so you can settle it immediately.'],
     ['So with one pointer at each end, which pointer moves on each step?', 'The one you can settle.', 'The side with the smaller max: add its water and move it inward. O(n) time, O(1) space.']],
    F('function trap(height: number[]): number', '0'), 'O(n)', 'O(1)',
    'Water can never be negative: when a bar is taller than the current max, update the max instead of subtracting.', 'How would a monotonic stack solve it, filling the water layer by layer?'),
  C(10, 'Longest Palindromic Substring', 'Medium', TP, 'Strings · Dynamic Programming',
    'Return the longest contiguous substring that reads the same in both directions.',
    '"babad" → "bab" (or "aba")\n"cbbd"  → "bb"',
    [['Every palindrome has a middle. What can that middle be?', 'Compare "aba" with "abba".', 'One character (odd length) or the gap between two characters (even length): 2n − 1 centres.'],
     ['From one centre, how do you grow the palindrome?', 'Two pointers moving apart.', 'Expand left and right while the characters match. The last matching span is the longest around that centre.'],
     ['What does this cost in total, and why is that fine?', 'Centres × expansion.', 'O(n²) time with O(1) space — simpler than the O(n²) DP table. Manacher’s algorithm reaches O(n) but is rarely expected.']],
    F('function longestPalindrome(s: string): string', '""'), 'O(n²)', 'O(1)',
    'Skipping the even-length centres misses answers like "bb".', 'How would you count every palindromic substring instead?'),
  C(11, 'Top K Frequent Elements', 'Medium', HP, 'Arrays · Greedy Algorithms',
    'Return the k numbers that appear most often.',
    'nums = [1,1,1,2,2,3], k = 2 → [1, 2]',
    [['First: how do you know how often each number appears?', 'One pass, one structure.', 'Count with a hash map: number → frequency.'],
     ['Sorting every distinct number by count costs O(m log m). How can a heap of size k do better?', 'Which item should leave when the heap overflows?', 'Keep a min-heap of size k by frequency; past k, pop the smallest. What stays is the top k: O(m log k).'],
     ['Frequencies lie between 1 and n. Can you skip the heap entirely?', 'Index by frequency.', 'Bucket sort: bucket[f] holds the numbers seen f times. Read buckets from high to low: O(n).']],
    F('function topKFrequent(nums: number[], k: number): number[]', '[]'), 'O(n log k)', 'O(n)',
    'JavaScript has no built-in heap — write a small one, or use the bucket approach.', 'What if the numbers arrive as an endless stream?'),
  C(12, 'Median of Two Sorted Arrays', 'Hard', BS, 'Arrays · Binary Search',
    'Find the median of two sorted arrays in O(log(m + n)) time.',
    '[1,3] and [2]   → 2\n[1,2] and [3,4] → 2.5',
    [['The median splits all the numbers into equal left and right halves. If the left half takes i items from A, how many must it take from B?', 'The left half has a fixed size.', 'j = (m + n + 1) / 2 − i. Choosing i fixes j.'],
     ['When is that split the right one?', 'Every left item must be ≤ every right item.', 'When A[i−1] ≤ B[j] and B[j−1] ≤ A[i]. The median then comes from the border values.'],
     ['If A[i−1] > B[j], should i go up or down — and what are you binary searching over?', 'You took too many from A.', 'Decrease i. Binary search i over the shorter array: O(log min(m, n)).']],
    F('function findMedianSortedArrays(a: number[], b: number[]): number', '0'), 'O(log min(m,n))', 'O(1)',
    'Use −Infinity and +Infinity for borders that fall outside an array, instead of index checks.', 'How would you find the k-th smallest element of the two arrays?'),
  C(13, '3Sum', 'Medium', TP, 'Arrays · Two Pointers',
    'Find every unique triplet that sums to zero.',
    '[-1,0,1,2,-1,-4]\n→ [-1,-1,2] [-1,0,1]',
    [['Fix the first number a. What problem is left for the other two?', 'You have met it before.', 'Two Sum with target −a.'],
     ['If the array is sorted, how do you solve that Two Sum without a hash map?', 'One pointer at each end.', 'Two pointers: sum too small → move left up; too big → move right down. O(n) per fixed a, O(n²) total.'],
     ['How do you avoid duplicate triplets?', 'Sorting puts equal values side by side.', 'Skip a fixed value equal to the previous one, and after each match skip equal neighbours on both pointers.']],
    F('function threeSum(nums: number[]): number[][]', '[]'), 'O(n²)', 'O(1) extra',
    'Sort numbers with (a, b) => a - b; the default sort compares them as strings.', 'How does this generalise to 4Sum or kSum?'),
  C(14, 'Subarray Sum Equals K', 'Medium', H, 'Arrays · Sliding Windows · Dynamic Programming',
    'Count the contiguous subarrays whose sum is exactly k.',
    'nums = [1,1,1], k = 2 → 2',
    [['Why does a sliding window fail on this problem?', 'Can the numbers be negative?', 'With negatives, growing the window can shrink the sum, so you never know which end to move.'],
     ['Let prefix[i] be the sum of the first i numbers. How do you write the sum of nums[j..i−1] with prefixes?', 'Subtract.', 'prefix[i] − prefix[j]. You want that to equal k.'],
     ['At position i, how many earlier j work — in O(1)?', 'You need prefix[j] = prefix[i] − k.', 'Keep a map from prefix value to how often you have seen it; add map[prefix − k]. Seed it with {0: 1}.']],
    F('function subarraySum(nums: number[], k: number): number', '0'), 'O(n)', 'O(n)',
    'Without the starting {0: 1}, subarrays that begin at index 0 are missed.', 'What changes if you want the longest such subarray instead of the count?'),
  C(15, 'Merge k Sorted Lists', 'Hard', HP, 'Linked Lists · Arrays · Greedy Algorithms',
    'Merge k sorted linked lists into one sorted list.',
    '1→4→5, 1→3→4, 2→6\n→ 1→1→2→3→4→4→5→6',
    [['At any moment, which nodes could be the next smallest overall?', 'Each list is sorted.', 'Only the current head of each list — k candidates.'],
     ['Which structure gives you the smallest of k candidates quickly while new ones arrive?', 'You pop one and add its successor.', 'A min-heap of list heads: pop the smallest, append it, push its next. O(N log k).'],
     ['Is there a way without a heap?', 'You can already merge two sorted lists.', 'Divide and conquer: merge the lists in pairs, then pairs of results. Also O(N log k).']],
    F('function mergeKLists(lists: Array<ListNode | null>): ListNode | null', 'null'), 'O(N log k)', 'O(k)',
    'Merging lists one at a time into a growing result is O(N·k) — the pairing order matters.', 'How would you merge k sorted files that are too large for memory?'),
  C(16, 'Longest Common Prefix', 'Easy', H, 'Arrays · Strings',
    'Return the longest prefix that every string shares (empty if none).',
    '["flower","flow","flight"] → "fl"',
    [['Which string limits how long the answer can be?', 'A prefix cannot be longer than…', 'The shortest string.'],
     ['How would you check column by column?', 'Character i of every string.', 'For i = 0, 1, …: if any string ends or differs at i, the answer is s[0..i). This is vertical scanning.'],
     ['Could sorting the array help?', 'After sorting, which two strings differ the most?', 'Yes: the common prefix of the first and last sorted strings is the common prefix of all.']],
    F('function longestCommonPrefix(strs: string[]): string', '""'), 'O(total chars)', 'O(1)',
    'Handle an empty input array before reading strs[0].', 'If you had to answer many prefix queries, which structure would you build? (Hint: a rare gem.)'),
  C(17, 'Search in Rotated Sorted Array', 'Medium', BS, 'Arrays · Binary Search',
    'A sorted array was rotated at an unknown point. Find a target’s index in O(log n), or −1.',
    '[4,5,6,7,0,1,2], target 0 → 4',
    [['Pick any middle index. What is always true about at least one of the two halves?', 'Compare nums[lo] with nums[mid].', 'At least one half is sorted normally.'],
     ['Once you know which half is sorted, how do you decide where the target can be?', 'Range check on the sorted half.', 'If the target lies inside the sorted half’s range, search there; otherwise search the other half.'],
     ['What is the loop condition, and when do you stop?', 'Closed interval [lo, hi].', 'while (lo <= hi). Return mid on a match, −1 after the loop.']],
    F('function search(nums: number[], target: number): number', '-1'), 'O(log n)', 'O(1)',
    'Use <= when testing which half is sorted, or two-element ranges break.', 'How would you find the rotation point itself?'),
  C(18, 'Maximum Subarray', 'Medium', DP, 'Arrays · Dynamic Programming',
    'Find the largest sum of any non-empty contiguous subarray.',
    '[-2,1,-3,4,-1,2,1,-5,4] → 6   ([4,-1,2,1])',
    [['Let best[i] be the best sum of a subarray that ends exactly at i. What are the only two options for it?', 'Extend or restart.', 'Either nums[i] alone, or best[i−1] + nums[i].'],
     ['When is restarting better than extending?', 'When does the past hurt?', 'When best[i−1] is negative — carrying it only lowers the sum. This is Kadane’s algorithm.'],
     ['Do you need the whole best array?', 'Which value does step i read?', 'Only the previous one: keep a running sum and an overall maximum. O(1) space.']],
    F('function maxSubArray(nums: number[]): number', '0'), 'O(n)', 'O(1)',
    'Start the answer at nums[0], not 0, or an all-negative array returns 0.', 'How would you also return where the best subarray starts and ends?'),
  C(19, 'Rotate Image', 'Medium', MB, 'Arrays',
    'Rotate an n×n matrix 90° clockwise, in place.',
    '1 2 3      7 4 1\n4 5 6  →   8 5 2\n7 8 9      9 6 3',
    [['Where does the cell at (r, c) end up after a clockwise turn?', 'Try (0, 0) and (0, 2) on a 3×3.', '(c, n − 1 − r).'],
     ['Can you get there with two simpler in-place moves?', 'A mirror along the diagonal…', 'Transpose (swap (r, c) with (c, r)), then reverse each row.'],
     ['During the transpose, which cells do you swap so nothing is swapped twice?', 'One side of the diagonal.', 'Only those with c > r. Swapping every pair would undo itself.']],
    F('function rotate(matrix: number[][]): void', null), 'O(n²)', 'O(1)',
    'Building a new matrix and copying back works, but breaks the in-place rule.', 'How would you rotate counter-clockwise?'),
  C(20, 'Spiral Matrix', 'Medium', MB, 'Arrays',
    'Return every element of a matrix in clockwise spiral order.',
    '1 2 3\n4 5 6\n7 8 9\n→ 1 2 3 6 9 8 7 4 5',
    [['What changes after you finish walking the top row?', 'That row is used up.', 'The top boundary moves down by one.'],
     ['So what four values describe the part not yet visited?', 'Edges.', 'top, bottom, left, right. Walk one side, shrink that boundary, repeat.'],
     ['Why can a thin leftover (one row or one column) be visited twice?', 'Check before walking back.', 'After going right and down, re-check top ≤ bottom and left ≤ right before walking left and up.']],
    F('function spiralOrder(matrix: number[][]): number[]', '[]'), 'O(m·n)', 'O(1) extra',
    'The missing boundary re-check is the bug in most attempts.', 'Can you fill an n×n matrix with 1..n² in spiral order?'),
  C(21, 'Add Two Numbers', 'Medium', LL, 'Linked Lists',
    'Two numbers are stored as linked lists of digits, ones digit first. Return their sum as a list.',
    '2→4→3 + 5→6→4 → 7→0→8\n(342 + 465 = 807)',
    [['Why is the reversed digit order actually convenient?', 'How do you add on paper?', 'You add from the ones digit, and the lists start with it.'],
     ['What extra value travels from one digit to the next?', 'Think 9 + 9.', 'A carry: digit = sum % 10, carry = floor(sum / 10).'],
     ['How do you continue when one list is longer, and when are you done?', 'Treat a missing node as 0.', 'Loop while l1, l2 or carry remain. A final carry becomes a new node; a dummy head keeps the building simple.']],
    F('function addTwoNumbers(l1: ListNode | null, l2: ListNode | null): ListNode | null', 'null'), 'O(max(m,n))', 'O(1) extra',
    'Converting the lists to numbers overflows on long inputs — stay digit by digit.', 'What if the digits were stored most significant first?'),
  C(22, 'Kth Largest Element in an Array', 'Medium', HP, 'Arrays · Two Pointers',
    'Return the k-th largest element of an unsorted array.',
    '[3,2,1,5,6,4], k = 2 → 5',
    [['Sorting works in O(n log n). If you keep only the k largest numbers seen so far, which of them is the answer?', 'The weakest of the top k.', 'The smallest of those k — so keep a min-heap of size k. O(n log k).'],
     ['Quickselect partitions around a pivot like quicksort. After one partition, what do you know?', 'Where does the pivot land?', 'The pivot sits in its final sorted position. If that is index n − k you are done; otherwise recurse into one side only.'],
     ['Why is quickselect O(n) on average but O(n²) at worst — and how do you protect it?', 'Bad pivots.', 'Always-bad pivots shrink the range by one each time. A random pivot makes that vanishingly unlikely.']],
    F('function findKthLargest(nums: number[], k: number): number', '0'), 'O(n) avg', 'O(1)',
    'The k-th largest sits at index n − k in ascending order, not at index k.', 'How would you track the median of a stream of numbers?'),
  C(23, 'Generate Parentheses', 'Medium', BT, 'Recursion · Strings',
    'Generate every balanced string of n pairs of parentheses.',
    'n = 3 → ((())) (()()) (())() ()(()) ()()()',
    [['Building left to right, when may you add "("?', 'There are only n of them.', 'While open < n.'],
     ['When may you add ")"?', 'It must close something.', 'While close < open — otherwise the prefix is already invalid.'],
     ['When is a string finished, and why does this never produce invalid output?', 'Length.', 'At length 2n. Both rules keep every prefix valid, so you never build a bad string and filter it later.']],
    F('function generateParenthesis(n: number): string[]', '[]'), 'O(4ⁿ/√n)', 'O(n)',
    'Generating all 2^(2n) strings and filtering works for tiny n but explodes quickly.', 'How many results are there for n? Look up the Catalan numbers.'),
  C(24, 'Rotting Oranges', 'Medium', GR, 'Arrays · Graphs',
    'Every minute, rotten oranges rot their fresh neighbours. How many minutes until none are fresh (−1 if never)?',
    '2 1 1\n1 1 0\n0 1 1\n→ 4',
    [['All rotten oranges spread at the same time. Which search handles many starting points, level by level?', 'Minutes are levels.', 'Multi-source BFS: put every rotten orange in the queue first.'],
     ['How do you count minutes with a single queue?', 'Process it in rounds.', 'Handle exactly the current queue length per round; each round is one minute.'],
     ['When is the answer −1?', 'Count something at the start.', 'When fresh oranges remain after the BFS. Keep a fresh counter and decrement it as they rot.']],
    F('function orangesRotting(grid: number[][]): number', '-1'), 'O(m·n)', 'O(m·n)',
    'A grid with no fresh oranges should return 0.', 'How is this the same idea as finding every cell’s distance to the nearest exit?'),
  C(25, 'Find First and Last Position of Element in Sorted Array', 'Medium', BS, 'Arrays · Binary Search',
    'In a sorted array, find the first and last index of a target in O(log n), or [−1, −1].',
    '[5,7,7,8,8,10], target 8 → [3, 4]',
    [['A normal binary search stops at any match. What should it do to find the first one?', 'Keep looking left.', 'On a match, record it and continue in the left half.'],
     ['Can one helper find both ends?', 'Lower bound.', 'lowerBound(x) = first index with value ≥ x. First = lowerBound(t); last = lowerBound(t + 1) − 1.'],
     ['How do you detect that the target is missing?', 'Look at what sits at “first”.', 'If first is out of range or nums[first] !== target, return [−1, −1].']],
    F('function searchRange(nums: number[], target: number): number[]', '[-1, -1]'), 'O(log n)', 'O(1)',
    'Scanning outward from one match is O(n) when the target repeats many times.', 'How would you count occurrences of a value in O(log n)?'),
  C(26, 'Merge Sorted Array', 'Easy', TP, 'Arrays · Two Pointers',
    'nums1 has room at the end for nums2. Merge them in place into one sorted array.',
    'nums1 = [1,2,3,0,0,0], nums2 = [2,5,6]\n→ [1,2,2,3,5,6]',
    [['If you merge from the front, what goes wrong?', 'What happens to nums1’s values?', 'You overwrite numbers in nums1 you have not placed yet.'],
     ['Where is the free space?', 'Look at the zeros.', 'At the end. So fill from the back, each time placing the larger of the two last elements.'],
     ['When can you stop?', 'What if nums2 runs out first?', 'When nums2 is used up — whatever remains in nums1 is already in place.']],
    F('function merge(nums1: number[], m: number, nums2: number[], n: number): void', null), 'O(m+n)', 'O(1)',
    'Looping until nums1 runs out, instead of nums2, leaves elements of nums2 behind.', 'Where else does filling from the back save you from overwriting?'),
  C(27, 'Roman to Integer', 'Easy', MB, 'Strings',
    'Convert a Roman numeral to an integer.',
    '"MCMXCIV" → 1994',
    [['Usually you add each symbol’s value. When do you subtract instead?', 'Look at IV and IX.', 'When a symbol is smaller than the one after it.'],
     ['So what do you compare at each step?', 'Current and next.', 'If value(s[i]) < value(s[i+1]), subtract it; otherwise add it.'],
     ['What structure maps the symbols to values cleanly?', 'Seven fixed pairs.', 'A small lookup object or Map.']],
    F('function romanToInt(s: string): number', '0'), 'O(n)', 'O(1)',
    'Reading s[i+1] past the end gives undefined — treat it as 0.', 'Can you go the other way? (See Integer to Roman.)'),
  C(28, 'House Robber', 'Medium', DP, 'Arrays · Dynamic Programming',
    'Rob houses along a street for the most money, never robbing two neighbours.',
    '[2,7,9,3,1] → 12   (2 + 9 + 1)',
    [['At house i you rob it or skip it. If you rob it, up to which house could you have robbed before?', 'Not i − 1.', 'Up to i − 2, so: nums[i] + best(i − 2).'],
     ['Write the full recurrence.', 'The better of the two choices.', 'best(i) = max(best(i − 1), nums[i] + best(i − 2)).'],
     ['How much memory do you actually need?', 'Which values does best(i) read?', 'Only the last two: two variables, O(1) space.']],
    F('function rob(nums: number[]): number', '0'), 'O(n)', 'O(1)',
    'Taking every other house fails on [2,1,1,2].', 'What if the houses stand in a circle?'),
  C(29, 'Palindrome Number', 'Easy', MB, 'Bit Manipulation',
    'Decide whether an integer reads the same backwards, without turning it into a string.',
    '121 → true\n-121 → false\n10 → false',
    [['Which numbers can you reject immediately?', 'Signs and trailing zeros.', 'Negatives, and any number ending in 0 except 0 itself.'],
     ['How do you take the last digit off a number and build a reversed number?', '% and division.', 'digit = x % 10; x = floor(x / 10); rev = rev * 10 + digit.'],
     ['Do you have to reverse the whole number?', 'Stop halfway.', 'Only half: stop when rev ≥ x, then compare x === rev, or x === floor(rev / 10) for odd lengths.']],
    F('function isPalindrome(x: number): boolean', 'false'), 'O(log n)', 'O(1)',
    'Reversing the whole number can overflow in fixed-width languages; reversing half cannot.', 'How would you check a linked list for a palindrome in O(1) space?'),
  C(30, 'Move Zeroes', 'Easy', TP, 'Arrays · Two Pointers',
    'Move every zero to the end in place, keeping the other numbers in order.',
    '[0,1,0,3,12] → [1,3,12,0,0]',
    [['Imagine copying the non-zero numbers into a new array. Where does the next one go?', 'A write index.', 'At position write, then write++.'],
     ['Can that “new array” be the same array?', 'Is the writer ever ahead of the reader?', 'Yes: write never passes the read pointer, so nothing unread gets overwritten.'],
     ['What fills the tail afterwards?', 'Or swap instead of copying.', 'Zeros from write to the end — or swap nums[read] with nums[write] as you go, which does it in one pass.']],
    F('function moveZeroes(nums: number[]): void', null), 'O(n)', 'O(1)',
    'Removing zeros with splice inside a loop is O(n²) and skips elements.', 'How is this the same pattern as Remove Duplicates from Sorted Array?'),
  C(31, 'Container With Most Water', 'Medium', TP, 'Arrays · Two Pointers · Greedy Algorithms',
    'Pick two lines that, together with the x-axis, hold the most water.',
    '[1,8,6,2,5,4,8,3,7] → 49',
    [['For lines i and j, what is the area?', 'Width × the lower height.', '(j − i) × min(h[i], h[j]).'],
     ['Start with the widest pair. If you move the taller line inward, can the area grow?', 'The width shrinks. What caps the height?', 'No: the height is still capped by the shorter line, and the width got smaller.'],
     ['So which pointer moves each step?', 'The only one that might help.', 'The shorter one. Each step discards a line that can no longer be in a better pair: O(n).']],
    F('function maxArea(height: number[]): number', '0'), 'O(n)', 'O(1)',
    'This is not Trapping Rain Water — the bars in between do not matter here.', 'Why is it safe to move either pointer when both heights are equal?'),
  C(32, 'Meeting Rooms II', 'Medium', GI, 'Arrays · Greedy Algorithms · Dynamic Programming',
    'Given meeting time intervals, find the minimum number of rooms needed.',
    '[[0,30],[5,10],[15,20]] → 2',
    [['At any moment, how many rooms are in use?', 'Count meetings in progress.', 'The meetings that have started and not ended. The answer is the peak of that count.'],
     ['How can you sweep through time to track it?', 'Separate starts from ends.', 'Sort start times and end times separately. Walk the starts; free a room whenever the earliest end ≤ the current start.'],
     ['What does the heap version look like?', 'Rooms keyed by when they free up.', 'Sort by start; keep a min-heap of end times. If the earliest end ≤ the new start, reuse that room (pop); always push the new end. Heap size = rooms.']],
    F('function minMeetingRooms(intervals: number[][]): number', '0'), 'O(n log n)', 'O(n)',
    'A meeting ending at 10 and one starting at 10 can share a room — use ≤, not <.', 'How would you output which room each meeting gets?'),
  C(33, 'Coin Change', 'Medium', DP, 'Dynamic Programming',
    'Find the fewest coins that make up an amount, with unlimited coins of each kind (−1 if impossible).',
    'coins = [1,2,5], amount = 11 → 3   (5 + 5 + 1)',
    [['Why does always taking the biggest coin fail?', 'Try coins [1,3,4] and amount 6.', 'Greedy gives 4 + 1 + 1 = 3 coins, but 3 + 3 = 2 coins.'],
     ['Let dp[a] be the fewest coins for amount a. How does it depend on smaller amounts?', 'What was the last coin?', 'dp[a] = 1 + min over coins c of dp[a − c].'],
     ['What are the starting values, and how do you mark “impossible”?', 'dp[0]?', 'dp[0] = 0 and everything else Infinity. If dp[amount] is still Infinity, return −1.']],
    F('function coinChange(coins: number[], amount: number): number', '-1'), 'O(amount·coins)', 'O(amount)',
    'Starting with 0 instead of Infinity makes impossible amounts look free.', 'How would you count the number of ways to make the amount instead?'),
  C(34, 'Valid Anagram', 'Easy', H, 'Strings',
    'Decide whether two strings are anagrams of each other.',
    '"anagram", "nagaram" → true\n"rat", "car" → false',
    [['Which quick check rules out many pairs at once?', 'Size.', 'Different lengths can never be anagrams.'],
     ['How can you compare letter counts with one structure?', 'Count up, count down.', 'Count the letters of s up and the letters of t down in one map (or 26-slot array). Every count must end at 0.'],
     ['Sorting both strings also works. Why prefer counting?', 'Compare costs.', 'Counting is O(n); sorting is O(n log n).']],
    F('function isAnagram(s: string, t: string): boolean', 'false'), 'O(n)', 'O(1)',
    'For Unicode input a 26-slot array is not enough — use a Map.', 'How does this become the key idea in Group Anagrams?'),
  C(35, 'Product of Array Except Self', 'Medium', H, 'Arrays',
    'For each index, return the product of all the other numbers — without division, in O(n).',
    '[1,2,3,4] → [24,12,8,6]',
    [['The answer at i is (product of everything left of i) × (product of everything right of i). How do you get all the left products in one pass?', 'A running product.', 'Sweep left to right, storing the running product before multiplying nums[i] into it.'],
     ['And the right products?', 'Same idea, other direction.', 'Sweep right to left with a second running product.'],
     ['Can you avoid a separate array for the right side?', 'Reuse the output.', 'Store the left products in the output, then multiply in the right running product on the way back. O(1) extra space.']],
    F('function productExceptSelf(nums: number[]): number[]', '[]'), 'O(n)', 'O(1) extra',
    'Division breaks as soon as there is a zero — that is why it is banned.', 'Where does the same prefix-and-suffix idea show up in Trapping Rain Water?'),
  C(36, 'Longest Consecutive Sequence', 'Medium', H, 'Arrays',
    'In an unsorted array, find the length of the longest run of consecutive integers, in O(n).',
    '[100,4,200,1,3,2] → 4   (1,2,3,4)',
    [['Sorting gives O(n log n). Which structure answers “is x present?” in O(1)?', 'Membership.', 'A hash set.'],
     ['Which numbers should start counting a run?', 'Look to the left.', 'Only x where x − 1 is not in the set — the first number of a run.'],
     ['Why is the total O(n), even with a while loop inside?', 'How often is each number visited?', 'Each number is counted inside exactly one run, starting from that run’s first number.']],
    F('function longestConsecutive(nums: number[]): number', '0'), 'O(n)', 'O(n)',
    'Counting from every number, not just run starts, makes it O(n²) on long runs.', 'How would union-find solve it?'),
  C(37, 'Koko Eating Bananas', 'Medium', BS, 'Arrays · Binary Search',
    'Find the slowest eating speed that finishes all the banana piles within h hours.',
    'piles = [3,6,7,11], h = 8 → 4',
    [['At a fixed speed k, how many hours are needed?', 'One pile at a time.', 'The sum of ceil(pile / k) over all piles.'],
     ['If speed k works, does speed k + 1 also work?', 'Eating faster…', 'Yes. Feasibility is monotonic: false, false, …, true, true.'],
     ['So what do you binary search over, and between which bounds?', 'Search the answer, not the array.', 'Over speeds from 1 to max(piles), for the first speed that works.']],
    F('function minEatingSpeed(piles: number[], h: number): number', '0'), 'O(n log max)', 'O(1)',
    'Using floor instead of ceil undercounts the hours spent on partial piles.', 'Which other problems hide a binary search over the answer?'),
  C(38, 'Jump Game', 'Medium', GI, 'Arrays · Greedy Algorithms',
    'Each number is the longest jump allowed from that index. Can you reach the last index?',
    '[2,3,1,1,4] → true\n[3,2,1,0,4] → false',
    [['Scanning left to right, which single number tells you how far you can get?', 'The furthest index reachable so far.', 'reach = max(reach, i + nums[i]).'],
     ['When do you know it is impossible?', 'Can you even stand on index i?', 'If i > reach, index i is unreachable — and so is the end.'],
     ['Why is this greedy choice safe without trying every jump?', 'What does reach summarise?', 'Every index up to reach is reachable, so the best next reach is just a max over them.']],
    F('function canJump(nums: number[]): boolean', 'false'), 'O(n)', 'O(1)',
    'A DP over every jump length is O(n²) and unnecessary.', 'What is the fewest number of jumps? (See Jump Game II.)'),
  C(39, 'Integer to Roman', 'Medium', MB, 'Strings',
    'Convert an integer between 1 and 3999 into a Roman numeral.',
    '1994 → "MCMXCIV"',
    [['Roman numerals have six subtractive forms like IV and CM. How can you avoid special cases for them?', 'Treat them as symbols too.', 'List 13 value–symbol pairs, including 900 CM, 400 CD, 90 XC, 40 XL, 9 IX and 4 IV.'],
     ['In which order should you try them?', 'Like making change.', 'From largest to smallest.'],
     ['What do you do at each pair?', 'Repeat while it fits.', 'While num ≥ value, append the symbol and subtract the value.']],
    F('function intToRoman(num: number): string', '""'), 'O(1)', 'O(1)',
    'Building each digit with long if-chains is error-prone; the table handles everything.', 'Why does greedy work here when it fails for Coin Change?'),
  C(40, 'Course Schedule', 'Medium', GR, 'Graphs · Recursion',
    'Given course prerequisites, decide whether you can finish every course.',
    'n = 2, [[1,0],[0,1]] → false   (a cycle)',
    [['Model courses as nodes. Which way should an edge point?', 'Prerequisite → course.', 'From the prerequisite to the course that needs it: a directed graph.'],
     ['When is finishing impossible?', '1 needs 0, and 0 needs 1…', 'Exactly when the graph has a cycle.'],
     ['How do you detect a cycle?', 'Two classic ways.', 'Kahn’s algorithm: keep taking courses with no remaining prerequisites; if some are never taken, there is a cycle. Or DFS with three states.']],
    F('function canFinish(numCourses: number, prerequisites: number[][]): boolean', 'false'), 'O(V + E)', 'O(V + E)',
    'A plain visited set reports false cycles on diamond shapes — DFS needs “visiting” and “done”.', 'This feed’s own locks are a course schedule. How would you check they never form a cycle?'),
  C(41, 'Minimum Window Substring', 'Hard', TP, 'Strings · Sliding Windows',
    'Find the shortest substring of s that contains every character of t, counting repeats.',
    's = "ADOBECODEBANC", t = "ABC" → "BANC"',
    [['What must you track to know whether the window contains all of t?', 'Counts, not just letters.', 'How many of each character t needs, and how many distinct needs are fully met.'],
     ['When the window is valid, which pointer moves, and why?', 'You want it shorter.', 'Move left to shrink it while it stays valid, recording the best length.'],
     ['When it becomes invalid, what next?', 'You lost a needed character.', 'Move right to grow it until valid again. Each pointer moves at most n times: O(n).']],
    F('function minWindow(s: string, t: string): string', '""'), 'O(|s| + |t|)', 'O(alphabet)',
    'Comparing whole count maps at every step is slow; keep a single “formed” counter.', 'How is this the same template as Longest Substring Without Repeating Characters?'),
  C(43, 'Next Permutation', 'Medium', TP, 'Arrays · Two Pointers',
    'Rearrange the numbers into the next lexicographically larger permutation, in place (or the smallest one if none).',
    '[1,2,3] → [1,3,2]\n[3,2,1] → [1,2,3]',
    [['Scanning from the right, the suffix stays maximal while it never increases. Where must the change happen?', 'Find the first dip.', 'At the first index i, from the right, with nums[i] < nums[i + 1]: the pivot.'],
     ['Which number should replace the pivot?', 'Only a little bigger.', 'The smallest number in the suffix that is still larger than the pivot. Scan from the right for it, then swap.'],
     ['What should the suffix look like afterwards, and how do you get there cheaply?', 'It is in descending order.', 'Ascending — the smallest arrangement. Since it is descending, just reverse it.']],
    F('function nextPermutation(nums: number[]): void', null), 'O(n)', 'O(1)',
    'If there is no pivot, reverse the whole array — do not forget that branch.', 'How would you jump straight to the k-th permutation?'),
  C(44, 'Sliding Window Maximum', 'Hard', ST, 'Arrays · Sliding Windows',
    'Return the maximum of every window of size k as it slides across the array.',
    '[1,3,-1,-3,5,3,6,7], k = 3\n→ [3,3,5,5,6,7]',
    [['If a new number is larger than an older one in the window, can the older one ever be the maximum again?', 'The new one also leaves later.', 'No — it is smaller and leaves sooner. It is useless from now on.'],
     ['So in what order are the still-useful candidates?', 'Drop the useless ones.', 'Decreasing values, in index order: a monotonic deque. The front is always the window’s maximum.'],
     ['What happens at each step?', 'Back, front, then read.', 'Pop smaller values off the back, push the new index, drop the front if it left the window, then read the front.']],
    F('function maxSlidingWindow(nums: number[], k: number): number[]', '[]'), 'O(n)', 'O(k)',
    'Store indices, not values, so you can tell when the front has left the window.', 'Where else does a monotonic stack help? (See Daily Temperatures.)'),
  C(45, 'Course Schedule II', 'Medium', GR, 'Graphs · Dynamic Programming',
    'Return an order in which to take every course respecting prerequisites, or [] if impossible.',
    'n = 4, [[1,0],[2,0],[3,1],[3,2]]\n→ [0,1,2,3] or [0,2,1,3]',
    [['Which courses can you take first?', 'No prerequisites left.', 'Those with in-degree 0.'],
     ['After you take a course, whose in-degree changes?', 'Follow its edges.', 'Every course that depends on it loses one; any that reach 0 join the queue. The order you remove them is a topological order.'],
     ['How do you notice a cycle?', 'Compare counts.', 'If the order has fewer than n courses, the rest were stuck in a cycle: return [].']],
    F('function findOrder(numCourses: number, prerequisites: number[][]): number[]', '[]'), 'O(V + E)', 'O(V + E)',
    'DFS post-order produces the order backwards — remember to reverse it.', 'What is the fewest number of terms if you may take any number of courses per term?'),
  C(46, 'Merge Two Sorted Lists', 'Easy', LL, 'Linked Lists',
    'Merge two sorted linked lists into one sorted list by splicing their nodes.',
    '1→2→4 + 1→3→4 → 1→1→2→3→4→4',
    [['Which node comes first in the result?', 'Compare the heads.', 'The smaller of the two heads.'],
     ['What awkward special case does a dummy head node remove?', 'Who is the first node?', 'You never special-case the first node: always attach to tail.next, and return dummy.next.'],
     ['What do you do when one list runs out?', 'The rest is already sorted.', 'Attach the remaining list in one step.']],
    F('function mergeTwoLists(a: ListNode | null, b: ListNode | null): ListNode | null', 'null'), 'O(m+n)', 'O(1)',
    'Creating new nodes instead of splicing wastes memory — reuse the ones you have.', 'How does this become the building block of Merge k Sorted Lists?'),
  C(47, 'Valid Palindrome', 'Easy', TP, 'Strings · Two Pointers',
    'Ignoring case and non-alphanumeric characters, does the string read the same both ways?',
    '"A man, a plan, a canal: Panama" → true',
    [['Where do the two pointers start?', 'Both ends.', 'left = 0 and right = n − 1, moving inward.'],
     ['What do you do with spaces and punctuation?', 'Skip them.', 'Move each pointer past non-alphanumeric characters before comparing.'],
     ['How do you compare letters regardless of case?', 'Normalise first.', 'Lowercase both characters; any mismatch means false.']],
    F('function isPalindrome(s: string): boolean', 'false'), 'O(n)', 'O(1)',
    'Building a cleaned copy works, but costs O(n) space the pointer version does not need.', 'What if you may delete at most one character?'),
  C(48, 'Remove Duplicates from Sorted Array', 'Easy', TP, 'Arrays · Two Pointers',
    'Remove duplicates in place from a sorted array and return how many unique values remain.',
    '[0,0,1,1,1,2,2,3,3,4] → 5\n(nums now starts [0,1,2,3,4])',
    [['In a sorted array, where are the copies of a value?', 'Next to each other.', 'All together, so a value is new exactly when it differs from the last value you kept.'],
     ['Where do you write each new value?', 'A write pointer.', 'At nums[write], then write++. The read pointer scans everything.'],
     ['What do you return?', 'How many did you keep?', 'write — the count of unique values. The rest of the array does not matter.']],
    F('function removeDuplicates(nums: number[]): number', '0'), 'O(n)', 'O(1)',
    'Comparing with nums[i − 1] instead of the last kept value breaks the “at most twice” variant.', 'How would you allow each value at most twice?'),
  C(49, 'Find Peak Element', 'Medium', BS, 'Arrays · Binary Search',
    'Return the index of any element larger than its neighbours, in O(log n).',
    '[1,2,1,3,5,6,4] → 1 or 5',
    [['Imagine −∞ beyond both ends. If nums[mid] < nums[mid + 1], what do you know about the right side?', 'You are walking uphill.', 'A peak must exist to the right: going uphill, you either reach a peak or the −∞ edge.'],
     ['So how does the search range shrink?', 'Follow the slope.', 'Uphill to the right → lo = mid + 1; otherwise hi = mid.'],
     ['Why does binary search work here even though the array is unsorted?', 'What is it really searching for?', 'It needs no order — only a rule that always keeps some peak inside [lo, hi].']],
    F('function findPeakElement(nums: number[]): number', '0'), 'O(log n)', 'O(1)',
    'Use while (lo < hi) with hi = mid, or the loop never ends.', 'Can you find a peak in a 2D grid?'),
  C(50, 'Word Ladder', 'Hard', GR, 'Graphs · Strings',
    'Change one letter at a time, using only dictionary words, from a start word to an end word. How many words are in the shortest chain?',
    'hit → hot → dot → dog → cog   → 5',
    [['What are the nodes and edges here?', 'One letter apart.', 'Words are nodes; two words are joined if they differ in exactly one letter.'],
     ['Which search finds the shortest chain?', 'All edges have the same cost.', 'BFS from the start word, level by level.'],
     ['Comparing every pair of words is slow. How do you find neighbours faster?', 'Wildcards.', 'Try each position × 26 letters against a set, or group words by patterns like "h*t".']],
    F('function ladderLength(beginWord: string, endWord: string, wordList: string[]): number', '0'), 'O(n·L²)', 'O(n·L)',
    'Remove words from the set when you enqueue them, or the BFS revisits them.', 'How would bidirectional BFS speed this up?'),
  C(51, 'Best Time to Buy and Sell Stock II', 'Medium', GI, 'Arrays · Greedy Algorithms',
    'Buy and sell as often as you like, holding at most one share. Maximise the profit.',
    '[7,1,5,3,6,4] → 7   (4 + 3)',
    [['If the price rises from day i to day i + 1, should you capture that rise?', 'Nothing stops you.', 'Yes — buy on day i, sell on day i + 1.'],
     ['A long climb from 1 to 6 equals the sum of what?', 'Break it into daily steps.', 'The daily rises along the way. So the answer is the sum of every positive day-to-day difference.'],
     ['Why is this greedy choice optimal?', 'Can skipping a rise ever help?', 'Every profitable trade is made of daily rises; collecting all of them reaches the upper bound.']],
    F('function maxProfit(prices: number[]): number', '0'), 'O(n)', 'O(1)',
    'No need to find peaks and valleys — the sum of positive differences is the same answer.', 'What changes with a transaction fee, or a cooldown day?'),
  C(52, 'Subsets', 'Medium', BT, 'Arrays · Recursion · Bit Manipulation',
    'Return every subset of a set of distinct numbers.',
    '[1,2,3] → [] [1] [2] [3] [1,2] [1,3] [2,3] [1,2,3]',
    [['For each number, what choice do you make?', 'Two options.', 'Include it or leave it out — 2ⁿ subsets in total.'],
     ['How does recursion explore those choices?', 'An index and a current path.', 'At index i: recurse without nums[i]; then push it, recurse, and pop it back. That pop is the backtrack.'],
     ['How could a binary counter list the same subsets?', 'The bits of 0 … 2ⁿ − 1.', 'Bit j of the mask means “include nums[j]”. Each mask is one subset.']],
    F('function subsets(nums: number[]): number[][]', '[]'), 'O(n·2ⁿ)', 'O(n)',
    'Push a copy ([...path]) into the results, not the path itself, or every result changes later.', 'What if the input contains duplicates?'),
  C(53, 'Rotate Array', 'Medium', TP, 'Arrays',
    'Rotate an array to the right by k steps, in place.',
    '[1,2,3,4,5,6,7], k = 3 → [5,6,7,1,2,3,4]',
    [['What if k is larger than the array?', 'Rotating n times changes nothing.', 'Use k = k % n.'],
     ['After the rotation, the last k elements come first. What do three reversals do?', 'Reverse everything, then each part.', 'Reverse the whole array, then the first k, then the remaining n − k. Each reversal is a two-pointer swap.'],
     ['Why is this better than shifting by one step, k times?', 'Count the moves.', 'Every element moves a constant number of times: O(n) instead of O(n·k).']],
    F('function rotate(nums: number[], k: number): void', null), 'O(n)', 'O(1)',
    'Forgetting k % n breaks the reversal indices when k ≥ n.', 'Can you rotate with cyclic replacements instead?'),
  C(54, 'Min Stack', 'Medium', ST, 'Stacks',
    'Design a stack with push, pop, top and getMin, all in O(1).',
    'push(-2) push(0) push(-3)\ngetMin() → -3\npop()  getMin() → -2',
    [['Keeping one min variable fails. When?', 'Pop the minimum.', 'After popping the current minimum, you no longer know the previous one.'],
     ['What could each entry remember so the minimum is always at hand?', 'Store a little more per item.', 'The minimum at the time it was pushed: push (value, min(value, previousMin)).'],
     ['Can you save space when most pushes do not change the minimum?', 'A second stack.', 'Keep a separate min stack and push to it only when value ≤ the current min; pop it when you pop that value.']],
    'class MinStack {\n  push(val: number): void {\n  }\n\n  pop(): void {\n  }\n\n  top(): number {\n    return 0;\n  }\n\n  getMin(): number {\n    return 0;\n  }\n}\n',
    'O(1)', 'O(n)', 'With the two-stack version, use ≤ not <, or duplicate minimums break on pop.', 'How would you build a queue with O(1) max using the same idea?'),
  C(55, 'Word Break', 'Medium', DP, 'Strings · Dynamic Programming',
    'Can the string be split into a sequence of dictionary words?',
    '"leetcode", ["leet","code"] → true',
    [['Trying every split recursively repeats work. Which question keeps coming back?', 'The same suffix, many times.', '“Can s from index i to the end be split?” — the same i is asked again and again.'],
     ['Let ok[i] mean “s[0..i) can be split”. How do you compute ok[i]?', 'Look at the last word.', 'ok[i] is true if some j < i has ok[j] true and s[j..i) is in the dictionary.'],
     ['What is ok[0], and what makes the lookups fast?', 'The empty prefix.', 'ok[0] = true. Keep the dictionary in a Set; optionally limit j to the longest word length.']],
    F('function wordBreak(s: string, wordDict: string[]): boolean', 'false'), 'O(n²)', 'O(n)',
    'Greedily taking the first matching word fails: "aaab" with ["a","aab"] needs a + aab.', 'How would you return every possible sentence?'),
  C(56, 'Word Search', 'Medium', BT, 'Arrays · Recursion',
    'Can a word be traced through neighbouring grid cells, using each cell at most once?',
    'A B C E\nS F C S\nA D E E\n"ABCCED" → true',
    [['From one cell, what choices do you have for the next letter?', 'Neighbours.', 'Up to four neighbours that match the next letter and are not already on the path.'],
     ['How do you stop reusing a cell on the current path but allow it on other paths?', 'Mark, then unmark.', 'Mark the cell before recursing and restore it afterwards — that undo is the backtracking.'],
     ['Where do you start, and when can you stop early?', 'Return as soon as…', 'Try every cell as a start; return true the moment the whole word matches.']],
    F('function exist(board: string[][], word: string): boolean', 'false'), 'O(m·n·3^L)', 'O(L)',
    'Forgetting to unmark a cell makes later paths fail mysteriously.', 'How would a trie help when searching for many words at once?'),
  C(57, 'Contains Duplicate', 'Easy', H, 'Arrays',
    'Does any value appear at least twice?',
    '[1,2,3,1] → true\n[1,2,3,4] → false',
    [['What is the brute-force check, and what does it cost?', 'Every pair.', 'Compare every pair: O(n²).'],
     ['Which structure tells you instantly whether you have seen a value?', 'Membership.', 'A Set: if the value is already there, return true; otherwise add it.'],
     ['When might sorting be the better choice?', 'Memory.', 'When extra memory is not allowed: sort, then compare neighbours. O(n log n) time, O(1) extra.']],
    F('function containsDuplicate(nums: number[]): boolean', 'false'), 'O(n)', 'O(n)',
    'new Set(nums).size !== nums.length is neat, but cannot stop early at the first duplicate.', 'What if duplicates only count when they are at most k indices apart?'),
  C(58, 'Longest Increasing Subsequence', 'Medium', DP, 'Arrays · Binary Search · Dynamic Programming',
    'Find the length of the longest strictly increasing subsequence.',
    '[10,9,2,5,3,7,101,18] → 4   (2,3,7,101)',
    [['Let len[i] be the longest increasing subsequence ending at i. How does it relate to earlier indices?', 'What could come just before nums[i]?', 'len[i] = 1 + the max len[j] over j < i with nums[j] < nums[i]. O(n²).'],
     ['To go faster, keep tails[L] = the smallest possible last value of an increasing subsequence of length L + 1. Why the smallest?', 'Smaller tails are easier to extend.', 'A smaller tail leaves more room for future numbers, so it beats any larger one.'],
     ['tails always stays sorted. How do you place each new number?', 'Binary search.', 'Find the first tail ≥ x and replace it, or append if none. The answer is tails.length: O(n log n).']],
    F('function lengthOfLIS(nums: number[]): number', '0'), 'O(n log n)', 'O(n)',
    'tails is not an actual subsequence — only its length is meaningful.', 'How would you rebuild one longest subsequence?'),
  C(59, 'Reorganize String', 'Medium', HP, 'Strings · Greedy Algorithms · Arrays',
    'Rearrange the letters so no two neighbours are the same, or return "" if impossible.',
    '"aab"  → "aba"\n"aaab" → ""',
    [['When is it impossible?', 'Count the most common letter.', 'When one letter appears more than ceil(n / 2) times.'],
     ['Greedily, which letter should you place next?', 'The one most at risk of being stuck.', 'The most frequent remaining letter that differs from the last one placed.'],
     ['Which structure keeps giving you “most frequent”?', 'Hold one back.', 'A max-heap by count. Pop the top, place it, and push the previous letter back only after this step, so it cannot repeat.']],
    F('function reorganizeString(s: string): string', '""'), 'O(n log k)', 'O(k)',
    'Pushing a letter straight back lets it be picked twice in a row.', 'Can you fill the even indices first instead, with no heap?'),
  C(60, 'Climbing Stairs', 'Easy', DP, 'Dynamic Programming',
    'You climb 1 or 2 steps at a time. How many distinct ways reach step n?',
    'n = 3 → 3   (1+1+1, 1+2, 2+1)',
    [['What was your last move onto step n?', 'Only two options.', 'A 1-step from n − 1, or a 2-step from n − 2.'],
     ['So how is ways(n) built?', 'Add the two cases.', 'ways(n) = ways(n − 1) + ways(n − 2). It is Fibonacci.'],
     ['Why is the plain recursion slow, and what fixes it?', 'Draw the call tree.', 'It recomputes the same n exponentially often. Build up from the bottom with two variables: O(n) time, O(1) space.']],
    F('function climbStairs(n: number): number', '0'), 'O(n)', 'O(1)',
    'Off-by-one base cases: ways(1) = 1 and ways(2) = 2.', 'What if you could climb any step size from a given set?'),
  C(61, 'String Compression', 'Medium', TP, 'Arrays · Strings · Two Pointers',
    'Compress a character array in place: each run becomes the character plus its count (if above 1). Return the new length.',
    '["a","a","b","b","c","c","c"]\n→ ["a","2","b","2","c","3"], 6',
    [['How do you find where a run of the same character ends?', 'A read pointer.', 'Advance read while chars[read] equals the run’s character.'],
     ['Where does the output go, and why is in place safe?', 'A write pointer.', 'A write pointer behind the reader: a compressed run is never longer than the original run.'],
     ['How do you write a count like 12?', 'Digits.', 'Each digit is its own character: "1", "2". Write nothing when the count is 1.']],
    F('function compress(chars: string[]): number', '0'), 'O(n)', 'O(1)',
    'Writing 12 as a single element "12" instead of two characters.', 'How would you decompress it again?'),
  C(62, 'Sort Colors', 'Medium', TP, 'Arrays · Two Pointers',
    'Sort an array of 0s, 1s and 2s in place, in one pass.',
    '[2,0,2,1,1,0] → [0,0,1,1,2,2]',
    [['Counting then rewriting takes two passes. In one pass, where should 0s and 2s go as you meet them?', 'Front and back.', '0s into a growing region at the front, 2s into a growing region at the back.'],
     ['Which three pointers describe the regions?', 'low, mid, high.', '[0, low) are 0s, [low, mid) are 1s, (high, end] are 2s, and [mid, high] is unknown. The Dutch national flag.'],
     ['After swapping a 2 out to high, why do you not advance mid?', 'What came back in the swap?', 'The value that came from high has not been checked yet — look at it before moving on.']],
    F('function sortColors(nums: number[]): void', null), 'O(n)', 'O(1)',
    'Advancing mid after swapping with high skips an unchecked value.', 'How does this partition step relate to quicksort?'),
  C(63, 'Jump Game II', 'Medium', GI, 'Arrays · Greedy Algorithms',
    'Find the fewest jumps to reach the last index (it is always reachable).',
    '[2,3,1,1,4] → 2',
    [['With j jumps, the reachable indices form a range. What is the range for j + 1 jumps?', 'Like BFS levels.', 'Everything up to the furthest i + nums[i] over the current range.'],
     ['When do you have to count another jump?', 'The end of the current range.', 'When i reaches the end of the current range: jumps++, and the range end becomes the furthest reach seen so far.'],
     ['Why stop the loop just before the last index?', 'You may already be there.', 'Standing on the last index needs no more jumps; looping to n − 2 avoids one extra count.']],
    F('function jump(nums: number[]): number', '0'), 'O(n)', 'O(1)',
    'Counting a jump when you land on the final index gives one too many.', 'Why is this BFS without a queue?'),
  C(64, 'Decode String', 'Medium', ST, 'Strings · Stacks · Recursion',
    'Decode strings such as 3[a2[c]], where k[s] means s repeated k times.',
    '"3[a]2[bc]" → "aaabcbc"\n"3[a2[c]]"  → "accaccacc"',
    [['When you meet "[", what must you remember for later?', 'Brackets can nest.', 'The repeat count and the string built so far — push both onto a stack.'],
     ['What happens at "]"?', 'Pop and combine.', 'Pop (count, previous); current = previous + current repeated count times.'],
     ['How do you read counts with several digits, like 12[a]?', 'Accumulate.', 'num = num * 10 + digit until you reach "[".']],
    F('function decodeString(s: string): string', '""'), 'O(output)', 'O(n)',
    'Forgetting to reset num at "[" leaks the count into the next group.', 'Can you solve it with recursion instead of an explicit stack?'),
  C(65, 'Binary Tree Maximum Path Sum', 'Hard', TR, 'Trees · Recursion',
    'A path follows tree edges and can start and end at any node. Return the largest path sum.',
    '   -10\n   /  \\\n  9   20\n     /  \\\n    15   7\n→ 42   (15 + 20 + 7)',
    [['At each node, what is the best path that goes down one side only?', 'Pick a branch.', 'node.val + max(0, bestDown(left), bestDown(right)). Negative branches are dropped.'],
     ['A path may also bend at a node, using both children. What is its sum?', 'Both sides.', 'node.val + max(0, left) + max(0, right). This is a candidate for the overall answer.'],
     ['Why can the function return only the one-sided value to its parent?', 'A path cannot fork.', 'A parent can only extend a straight path. Track the bending sums in a separate global maximum.']],
    F('function maxPathSum(root: TreeNode | null): number', '0'), 'O(n)', 'O(h)',
    'Start the global best at -Infinity, not 0 — all-negative trees exist.', 'How would you return the path itself, not just its sum?'),
  C(66, 'Copy List with Random Pointer', 'Medium', LL, 'Linked Lists · Recursion · Arrays',
    'Deep-copy a linked list whose nodes also have a random pointer to any node or null.',
    '7 → 13 → 11 → 10 → 1\nrandom: 13→7, 11→1, 10→11, 1→7',
    [['Copying next pointers is easy. Why are random pointers harder?', 'The target copy may not exist yet.', 'A random pointer may point ahead, to a node you have not copied yet.'],
     ['Which map makes every pointer easy to translate?', 'Old to new.', 'old node → new node. First pass: create every copy. Second pass: copy.next = map(old.next), copy.random = map(old.random).'],
     ['Can you avoid the map?', 'Weave the copies in.', 'Insert each copy right after its original (A → A′ → B → B′). Then A′.random = A.random.next. Finally unweave. O(1) extra space.']],
    F('function copyRandomList(head: Node | null): Node | null', 'null'), 'O(n)', 'O(n)',
    'map.get(null) is undefined, not null — guard it.', 'How would you clone a general graph?'),
  C(67, 'Valid Sudoku', 'Medium', H, 'Arrays',
    'Check whether a partly filled 9×9 Sudoku board breaks any rule (it need not be solvable).',
    'Two 8s in the top-left 3×3 box → false',
    [['Within which three groups must each digit be unique?', 'Rows, columns…', 'Its row, its column and its 3×3 box.'],
     ['How do you know which box cell (r, c) belongs to?', 'Integer division.', 'box = floor(r / 3) * 3 + floor(c / 3), giving 0 to 8.'],
     ['What records what each row, column and box already holds?', '27 small sets.', '9 sets for rows, 9 for columns, 9 for boxes. One pass: a digit already in any of its three sets means invalid.']],
    F('function isValidSudoku(board: string[][]): boolean', 'false'), 'O(81)', 'O(81)',
    'Remember to skip the "." cells.', 'How would you solve the Sudoku? (That is backtracking.)'),
  C(68, 'Letter Combinations of a Phone Number', 'Medium', BT, 'Strings · Recursion',
    'Return every letter combination a string of phone-keypad digits could spell.',
    '"23" → ad ae af bd be bf cd ce cf',
    [['Each digit offers 3 or 4 letters. How many combinations are there for n digits?', 'Multiply.', 'The product of the choices — up to 4ⁿ.'],
     ['How does recursion build one combination?', 'One digit per level.', 'At index i, for each letter of digits[i], append it and recurse to i + 1; at the end, record the string.'],
     ['What should an empty input return?', 'Not [""].', 'An empty list.']],
    F('function letterCombinations(digits: string): string[]', '[]'), 'O(n·4ⁿ)', 'O(n)',
    'Returning [""] for empty input is a common wrong answer.', 'How is this the same shape as Subsets and Generate Parentheses?'),
  C(69, 'Daily Temperatures', 'Medium', ST, 'Arrays · Stacks',
    'For each day, how many days until a warmer one (0 if never)?',
    '[73,74,75,71,69,72,76,73]\n→ [1,1,4,2,1,1,0,0]',
    [['When a warm day arrives, which earlier days does it answer?', 'Those still waiting and cooler.', 'Every waiting day that is cooler than today.'],
     ['In what order are the waiting days?', 'If they had not been answered yet…', 'Decreasing temperature — a monotonic stack. The top is the most recent waiting day.'],
     ['What happens on each new day?', 'Pop, answer, push.', 'While today is warmer than the top, pop it and set answer[top] = today − top. Then push today. O(n).']],
    F('function dailyTemperatures(t: number[]): number[]', '[]'), 'O(n)', 'O(n)',
    'Store indices on the stack — you need them to compute the distance.', 'Where else does the “next greater element” pattern appear?'),
  C(70, 'Candy', 'Hard', GI, 'Arrays · Greedy Algorithms',
    'Children in a line have ratings. Everyone gets at least one candy, and a higher-rated child gets more than a lower-rated neighbour. Minimise the total.',
    '[1,0,2] → 5   (2, 1, 2)',
    [['Ignore the right neighbour for now. Sweeping left to right, what does each child need?', 'Compare with the left.', 'One more than the left child if rated higher; otherwise 1.'],
     ['How do you also satisfy the right neighbour?', 'A second sweep.', 'Sweep right to left: if rated higher than the right child, take max(current, right + 1).'],
     ['Why does taking the max keep both rules true?', 'Raising a count never breaks a rule.', 'Raising only helps the left rule, and the max keeps the left sweep’s result.']],
    F('function candy(ratings: number[]): number', '0'), 'O(n)', 'O(n)',
    'Equal ratings impose no rule — such neighbours may get different counts.', 'Can you solve it in O(1) space by counting slopes?'),
  C(71, 'Pow(x, n)', 'Medium', MB, 'Recursion · Bit Manipulation',
    'Compute x to the power n, where n may be negative, in O(log n).',
    'x = 2, n = 10 → 1024\nx = 2, n = -2 → 0.25',
    [['How can x¹⁰ be computed from x⁵?', 'Square it.', 'x¹⁰ = (x⁵)². Halving n each time gives O(log n) steps.'],
     ['What about odd n?', 'Pull one x out.', 'xⁿ = x · (x^((n−1)/2))². Equivalently, walk the bits of n.'],
     ['How do you handle a negative n?', 'A reciprocal.', 'xⁿ = 1 / x^(−n): negate n first.']],
    F('function myPow(x: number, n: number): number', '1'), 'O(log n)', 'O(1)',
    'In 32-bit languages −n overflows for the most negative int. JavaScript is safe, Java and C++ are not.', 'How does fast exponentiation work modulo a large prime?'),
  C(72, 'LFU Cache', 'Hard', LL, 'Linked Lists · Arrays · Dynamic Programming',
    'Design a cache that evicts the least frequently used key (ties: least recently used), with O(1) get and put.',
    'capacity 2: put(1) put(2) get(1)\nput(3) evicts 2 (used least)',
    [['Among keys with the same frequency, which one goes first?', 'You built this in LRU Cache.', 'The least recently used — so each frequency gets its own LRU list.'],
     ['Which maps do you need?', 'Lookups by key and by frequency.', 'key → node (value and frequency), and frequency → doubly linked list of nodes.'],
     ['How do you find the minimum frequency in O(1)?', 'When can it change?', 'Track minFreq: it resets to 1 on every new key, and rises by one only when the last node at minFreq moves up.']],
    'class LFUCache {\n  constructor(capacity: number) {\n  }\n\n  get(key: number): number {\n    return -1;\n  }\n\n  put(key: number, value: number): void {\n  }\n}\n',
    'O(1)', 'O(cap)', 'Capacity 0 must ignore every put.', 'How would you make the cache safe to use from several threads?'),
  C(73, 'Simplify Path', 'Medium', ST, 'Strings · Stacks',
    'Simplify a Unix-style absolute path, resolving ".", ".." and repeated slashes.',
    '"/a/./b/../../c/" → "/c"',
    [['Split the path on "/". Which parts can you ignore?', 'Empty strings and…', 'Empty parts (from //) and ".".'],
     ['What does ".." do to the directories collected so far?', 'Go up one.', 'Removes the last one, if any — a stack pop.'],
     ['How do you build the answer?', 'Join.', '"/" + stack.join("/"). An empty stack gives "/".']],
    F('function simplifyPath(path: string): string', '"/"'), 'O(n)', 'O(n)',
    '".." at the root stays at the root — never pop an empty stack.', 'How would you resolve a relative path against a current directory?'),
  C(74, 'Basic Calculator', 'Hard', ST, 'Stacks · Strings',
    'Evaluate an expression with +, −, parentheses and spaces, without eval.',
    '"(1+(4+5+2)-3)+(6+8)" → 23',
    [['Without parentheses, how do you evaluate "1 − 2 + 3" left to right?', 'Keep a sign.', 'result += sign × number, and update the sign at each + or −.'],
     ['What must you remember when you meet "("?', 'You are starting a fresh sub-result.', 'Push the current result and the sign in front of the bracket, then reset result and sign.'],
     ['What happens at ")"?', 'Combine.', 'result = pushedResult + pushedSign × result.']],
    F('function calculate(s: string): number', '0'), 'O(n)', 'O(n)',
    'A unary minus such as "-(2+3)" must work — it does if sign starts at +1.', 'How would you add * and / with the right precedence?'),
  C(75, 'Majority Element', 'Easy', H, 'Arrays',
    'Return the element that appears more than n/2 times.',
    '[2,2,1,1,1,2,2] → 2',
    [['A hash map of counts works. What does it cost in memory?', 'Distinct values.', 'O(n) extra space.'],
     ['If you cancel each majority element against a different element, what survives?', 'It is more than half.', 'The majority — it cannot be cancelled out completely.'],
     ['How does that become a one-pass, O(1)-space algorithm?', 'A candidate and a count.', 'Boyer–Moore voting: when count is 0, adopt the current value; +1 on a match, −1 otherwise. The final candidate is the answer.']],
    F('function majorityElement(nums: number[]): number', '0'), 'O(n)', 'O(1)',
    'The vote only works because a majority is guaranteed; otherwise verify the candidate.', 'How would you find every element appearing more than n/3 times?')
];

// Taro ranking first, then the bonus quests that open the rare gems.
PROBLEMS = PROBLEMS.concat(TARO).map(function (q) {
  if (q.rank) q.mono = '#' + q.rank;
  q.topic = q.tags || q.topic;
  return q;
}).sort(function (a, b) { return (a.rank || 1000) - (b.rank || 1000); });

var REWARD = { Easy: 3, Medium: 5, Hard: 8 };
var BADGE = { Easy: ['#3DDC84', '#0B2A18'], Medium: ['#FFB347', '#3A2000'], Hard: ['#FF5C5C', '#2A0000'] };
var TAG = { Good: '#3DDC84', Consider: '#4FD6FF', Style: '#C3A6FF', Watch: '#FFB347' };

class Component extends DCLogic {
  st() {
    return Object.assign({ screen: 'feed', pid: 0, step: 0, draft: '', answers: [], revealed: false, tipOpen: false, code: '', saved: {}, solved: {}, gems: {}, gain: 0, reviewed: false, fresh: {}, unlocks: [], filter: 'all', shards: {}, shardGain: [], fused: [] }, this.state || {});
  }
  start(pid) {
    var fresh = Object.assign({}, this.st().fresh); delete fresh[pid];
    this.setState({ screen: 'walk', pid: pid, step: 0, draft: '', answers: [], revealed: false, tipOpen: false, code: '', reviewed: false, gain: 0, unlocks: [], fresh: fresh, shardGain: [], fused: [] });
  }
  renderVals() {
    var s = this.st();
    var self = this;
    var accent = this.props.accent ?? '#FFD23F';
    var p = PROBLEMS[s.pid];
    var pg = GEMS[p.family];
    var total = p.steps.length;
    var inReview = s.screen === 'walk' && s.reviewed;
    var inCode = s.screen === 'walk' && s.step >= total && !s.reviewed;
    var inStep = s.screen === 'walk' && s.step < total;
    var stepObj = p.steps[Math.min(s.step, total - 1)];
    var count = function (topic) { return s.gems[topic] || 0; };
    var totalGems = GEM_ORDER.reduce(function (n, t) { return n + count(t); }, 0);

    var vault = GEM_ORDER.map(function (t) {
      var g = GEMS[t];
      return {
        gem: gemPixels(t, 3), count: count(t), color: g.color, name: g.name,
        frame: g.rare ? '#FFD23F' : 'transparent', bg: g.rare ? '#2A2150' : 'transparent',
        shardLabel: (s.shards[t] || 0) > 0 ? '◆' + s.shards[t] + '/' + SHARDS_PER_GEM : '',
        dim: count(t) > 0 ? '1' : '0.45',
        label: g.name + ' (' + t + '): ' + count(t)
      };
    });

    var posts = PROBLEMS.map(function (q, i) {
      var isSaved = !!s.saved[i];
      var isSolved = !!s.solved[i];
      var g = GEMS[q.family];
      var r = rewardFor(q);
      var locked = isLocked(q, s.gems, s.solved);
      var rule = RULES[q.title] || {};
      var drops = shardFamilies(q).map(function (f) { return GEMS[f].name.toLowerCase(); });
      return {
        title: q.title, topic: q.topic, mono: q.mono, diff: q.diff.toUpperCase(), prompt: q.prompt, example: q.example,
        meta: q.steps.length + ' quests, then a boss stage',
        gem: gemPixels(q.family, 2), gemColor: g.color,
        rewardLabel: isSolved ? g.plural + ' collected' : (g.rare ? '+1 ' + g.name.toLowerCase() + ' · RARE' : '+' + r + ' ' + g.plural),
        cta: isSolved ? 'REPLAY' : 'START ▶',
        solved: isSolved, family: q.family, isSaved: isSaved,
        locked: locked, unlocked: !locked, fresh: !!s.fresh[i],
        reqs: reqsFor(q, s.gems, s.solved), lockWhy: locked ? whyFor(q, s.gems, s.solved) : '',
        hasBuilds: !!(rule.after && rule.after.length), buildsOn: (rule.after || []).join(' + '),
        hasShards: drops.length > 0, shardNames: drops.join(', '),
        titleColor: locked ? '#B9B4D6' : '#F4F1E8',
        borderStyle: locked ? 'dashed' : 'solid',
        frame: isSolved ? '#3DDC84' : (s.fresh[i] ? '#FFD23F' : '#3A3770'),
        badgeBg: BADGE[q.diff][0], badgeFg: BADGE[q.diff][1],
        saveFill: isSaved ? accent : '#3A3770',
        saveLabel: isSaved ? 'Remove from saved' : 'Save for later',
        open: function () { self.start(i); },
        toggleSave: function () { var m = Object.assign({}, s.saved); m[i] = !isSaved; self.setState({ saved: m }); }
      };
    });
    // Open quests first, locked ones after, so the feed reads as "what you can do now".
    posts = posts.filter(function (x) { return !x.locked; }).concat(posts.filter(function (x) { return x.locked; }));
    var allCount = posts.length;
    if (s.filter === 'saved') posts = posts.filter(function (x) { return x.isSaved; });
    else if (s.filter !== 'all') posts = posts.filter(function (x) { return x.family === s.filter; });
    var solvedCount = Object.keys(s.solved).length;
    var chipKeys = ['all'].concat(GEM_ORDER.filter(function (f) { return PROBLEMS.some(function (q) { return q.family === f; }); }));
    var chips = chipKeys.map(function (k) {
      var on = s.filter === k;
      var n = k === 'all' ? PROBLEMS.length : PROBLEMS.filter(function (q) { return q.family === k; }).length;
      return {
        label: (k === 'all' ? 'ALL' : SHORT[k]) + ' ' + n, on: on,
        bg: on ? accent : '#1F1D45', fg: on ? '#12112A' : '#F4F1E8', border: on ? '#070614' : '#3A3770',
        pick: function () { self.setState({ filter: k }); }
      };
    });
    var feedCount = (s.filter === 'all' ? 'Taro 75 + 3 bonus' : s.filter === 'saved' ? 'Saved for later' : s.filter) + ' · ' + posts.length + ' of ' + allCount + ' · ' + solvedCount + ' cleared';

    var segCount = total + 2;
    var pos = inReview ? total + 1 : (inCode ? total : s.step);
    var segs = [];
    for (var k = 0; k < segCount; k++) {
      segs.push({ bg: k < pos ? '#3DDC84' : (k === pos ? accent : '#2A2858') });
    }

    var phaseLabel = inReview ? 'Results' : (inCode ? 'Boss stage' : ('Thinking · ' + p.family + (p.rank ? ' · Taro #' + p.rank : ' · bonus')));
    var noDraft = !s.draft || !s.draft.trim();
    var burst = [];
    for (var b = 0; b < Math.max(s.gain, 0); b++) burst.push(gemPixels(p.family, pg.rare ? 7 : 5));

    return {
      accent: accent,
      totalGems: totalGems,
      vault: vault,
      isFeed: s.screen === 'feed',
      isWalk: s.screen === 'walk',
      isStep: inStep, isCode: inCode, isReview: inReview,
      posts: posts, segs: segs, phaseLabel: phaseLabel, chips: chips, feedCount: feedCount,
      cur: {
        title: p.title,
        gem: gemPixels(p.family, 2), gemColor: pg.color, gemCount: count(p.family),
        gemLabel: pg.name + 's collected: ' + count(p.family),
        gemSummary: pg.name + ' is the ' + p.family.toLowerCase() + ' gem · you have ' + count(p.family) + ' · total ' + totalGems
      },
      stepNum: Math.min(s.step, total - 1) + 1, stepTotal: total,
      question: stepObj.q, tip: stepObj.tip, insight: stepObj.insight,
      tipOpen: !!s.tipOpen, tipLabel: s.tipOpen ? 'HIDE HINT' : 'NEED A HINT?',
      revealed: !!s.revealed, notRevealed: !s.revealed,
      draft: s.draft, myAnswer: s.answers[s.step] || '',
      noDraft: noDraft, submitOpacity: noDraft ? '0.45' : '1',
      continueLabel: s.step === total - 1 ? 'TO THE BOSS ▶' : 'NEXT QUEST ▶',
      onDraft: function (e) { self.setState({ draft: e.target.value }); },
      toggleTip: function () { self.setState({ tipOpen: !s.tipOpen }); },
      submitAnswer: function () {
        if (noDraft) return;
        var a = s.answers.slice(); a[s.step] = s.draft.trim();
        self.setState({ answers: a, revealed: true });
      },
      nextStep: function () {
        var n = s.step + 1;
        self.setState({ step: n, draft: '', revealed: false, tipOpen: false, code: n >= total ? p.starter : s.code });
      },
      plan: p.steps.map(function (st, i) { return { q: st.q, a: s.answers[i] || '—' }; }),
      code: s.code, onCode: function (e) { self.setState({ code: e.target.value }); },
      submitCode: function () {
        var first = !s.solved[s.pid];
        var g = first ? rewardFor(p) : 0;
        var solved = Object.assign({}, s.solved); solved[s.pid] = true;
        var gems = Object.assign({}, s.gems); gems[p.family] = (gems[p.family] || 0) + g;
        var shards = Object.assign({}, s.shards);
        var shardGain = [], fused = [];
        if (first) shardFamilies(p).forEach(function (f) {
          shards[f] = (shards[f] || 0) + 1;
          shardGain.push(GEMS[f].name.toLowerCase());
          if (shards[f] >= SHARDS_PER_GEM) { shards[f] -= SHARDS_PER_GEM; gems[f] = (gems[f] || 0) + 1; fused.push(GEMS[f].name.toUpperCase()); }
        });
        var fresh = Object.assign({}, s.fresh);
        var unlocks = [];
        PROBLEMS.forEach(function (q, i) {
          if (isLocked(q, s.gems, s.solved) && !isLocked(q, gems, solved)) { unlocks.push({ title: q.title, gem: gemPixels(q.family, 2) }); fresh[i] = true; }
        });
        self.setState({ reviewed: true, solved: solved, gems: gems, gain: g, unlocks: unlocks, fresh: fresh, shards: shards, shardGain: shardGain, fused: fused });
      },
      burst: burst,
      gainLabel: s.gain > 0 ? '+' + s.gain + ' ' + (s.gain === 1 ? pg.name : pg.plural).toUpperCase() : 'ALREADY CLEARED · NO NEW GEMS',
      rareDrop: !!pg.rare && s.gain > 0,
      rv: {
        tests: p.review.tests, time: p.review.time, space: p.review.space, followup: p.review.followup,
        notes: p.review.notes.map(function (n) { return { tag: n.tag.toUpperCase(), text: n.text, tagBg: TAG[n.tag] || TAG.Consider }; })
      },
      backToFeed: function () { self.setState({ screen: 'feed', reviewed: false }); },
      unlocks: s.unlocks, hasUnlocks: s.unlocks.length > 0,
      hasShardGain: s.shardGain.length > 0, shardLine: s.shardGain.join(', '),
      hasFused: s.fused.length > 0, fusedLine: s.fused.join(' + '),
      goNext: function () {
        for (var d = 1; d <= PROBLEMS.length; d++) {
          var j = (s.pid + d) % PROBLEMS.length;
          if (!isLocked(PROBLEMS[j], s.gems, s.solved) && !s.solved[j]) { self.start(j); return; }
        }
        self.setState({ screen: 'feed', reviewed: false });
      }
    };
  }
}
