# Stepwise

Socratic, 8-bit LeetCode practice. Scroll the Taro 75 like a social feed; each post is one problem.
Opening a post walks you through guiding questions — you type an answer before each reveal — then you
write the code and get a review. Clearing problems earns gems that unlock the next topics.

## How it works

- **Feed**: the Taro 75 in ranking order, plus three bonus quests (Max Depth of Binary Tree, Implement Trie, Range Sum Query).
- **Quests**: three or four Socratic questions per problem, each with an optional hint and an "another angle" reveal.
- **Gems**: one family per problem (chosen by the key idea it teaches), 12 common gems and 2 animated rare gems.
- **Unlocks**:
  - family prerequisites (e.g. linked lists → trees → graphs),
  - quest prerequisites (e.g. Two Sum → 3Sum, LRU Cache → LFU Cache),
  - mixed gem requirements for cross-topic problems,
  - tiers inside a family (Easy → Medium → Hard).
- **Shards**: secondary topic tags drop shards; five shards fuse into a gem.
- Progress is saved in the browser (localStorage).

The code review is a fixed mock per problem; there is no backend.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | Page shell and fonts |
| `styles.css` | 8-bit theme, phone-first layout |
| `runtime.js` | Tiny component base class (`setState` → re-render) |
| `logic.js` | Problems, gems, unlock rules and screen state |
| `app.js` | Renders the state to the DOM and wires up events |

No build step. Run locally with any static server, for example `python3 -m http.server`.

## Deploy

Render static site: publish directory `.`, no build command (see `render.yaml`).

Problem list and order from [Taro 75](https://www.jointaro.com/interviews/taro-75). Prompts and quests are original wording.
