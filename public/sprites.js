// Original 8-bit sprites for the jungle theme (animals, plants, temple objects).
// Each row is a string; each letter maps to a colour; '.' is transparent.
var SPRITES = {
  leaf: { c: { g: '#3E8E4E', l: '#7BC96F', v: '#A8E08F', d: '#1F5E35' }, s: [
    '....gg......', '...gllg.....', '..glllgg....', '.gllvlllg...', '.glllvlllg..', 'gllllvllllg.',
    'gllllvlllllg', '.gllllvllllg', '..ggllvlllg.', '....ggvggg..', '......d.....', '......d.....'] },
  vine: { c: { g: '#3E8E4E', l: '#7BC96F' }, s: [
    '..g..', '..g..', '.lg..', '.gg..', '..g..', '..gl.', '..gg.', '.lg..', 'gggl.', '.lg..',
    '..g..', '..gl.', '..ggl', '..g..', '.lg..', '..g..'] },
  flower: { c: { p: '#E85A8A', c: '#F2C14E', g: '#3E8E4E' }, s: [
    '..ppp..', '.ppcpp.', '..ppp..', '...g...', '.g.g...', '..gg...', '...g...'] },
  firefly: { c: { y: '#C8F25A', Y: '#F4FFB0' }, s: ['.y.', 'yYy', '.y.'] },
  toucan: { c: { K: '#4A5266', k: '#2B2F3A', e: '#F2EBD3', w: '#F2EBD3', o: '#F28C28', y: '#F2C14E', r: '#D9412B', g: '#6B4A2B' }, s: [
    '....KKKK......', '...KkkkkK.....', '..Kkkkekkoooo.', '..kkkkkkooyyyr', '..kwwwkk.oyyy.', '..kwwwkkk.....',
    '..kwwkkkk.....', '...kkkkkkk....', '....kkk.kkk...', '....y.y.......', '..gggggggg....'] },
  jaguar: { c: { y: '#E3A13B', Y: '#F2C878', s: '#4A2A12', w: '#F2EBD3', n: '#3A1E10', e: '#7BC96F', k: '#1A120A' }, s: [
    '.yy......yy.', 'yYYy....yYYy', 'yyyyyyyyyyyy', 'yysyyyyyysyy', 'ysyeyyyyeysy', 'yyykyyyykyyy',
    'yyyywwwwyyyy', '.yywwnnwwyy.', '..ywwwwwwy..', '...ywwwwy...', '....yyyy....'] },
  frog: { c: { G: '#9BE07A', g: '#4FA35A', w: '#F2EBD3', e: '#111111', r: '#1F5E35', d: '#2E7A35' }, s: [
    '..GG....GG..', '.GweG..GweG.', '.GGGGGGGGGG.', 'gGGGGGGGGGGg', 'ggrrrrrrrrgg', 'gggggggggggg',
    '.gGGGGGGGGg.', 'dgg.gggg.ggd', 'dd...dd...dd'] },
  monkey: { c: { b: '#8A5A33', B: '#C08A55', f: '#E8C49A', e: '#1A1A1A', k: '#6B3A1E' }, s: [
    '...bbbbb...', '..bbbbbbb..', 'BBbfffffbBB', 'BBfefffefBB', '.bfffffffb.', '.bffkkkffb.',
    '..bfffffb..', '...bbbbb...', '..bbbbbbb..', '.bb.bbb.bb.', '.b...b...b.'] },
  idol: { c: { S: '#B8B5A2', s: '#8C8A7A', d: '#4E4C42', e: '#6FE3D2', m: '#3E8E4E' }, s: [
    '...SSSSSSSS...', '..SssssssssS..', '.Sssddssddsss.', '.Ssdeedsdeeds.', '.Sssddssddsss.', '.msssssssssss.',
    '.mssdssssdssm.', '.Sssddddddssm.', '.Ssdsdsdsdssm.', '.Sssddddddsss.', '..Ssssssssss..', '..mSssssssSm..',
    '.mmdddddddddm.', 'mmm........mmm'] },
  chest: { c: { w: '#8A5A33', W: '#B07A45', g: '#F2C14E', G: '#FFE08A', d: '#4E2E14' }, s: [
    '..wwwwwwww..', '.wWWWWWWWWw.', 'wWWWWWWWWWWw', 'gggggGGggggg', 'wwwwwgGwwwww', 'wWWWWgGWWWWw',
    'wWWWWWWWWWWw', 'gwwwwwwwwwwg', 'dddddddddddd'] },
  chestOpen: { c: { w: '#8A5A33', W: '#B07A45', g: '#F2C14E', G: '#FFE08A', d: '#4E2E14' }, s: [
    '.wwwwwwwwww.', 'wWWWWWWWWWWw', 'dddddddddddd', '.GgGgGgGgGg.', 'GgGgGgGgGgGg', 'gggggGGggggg',
    'wwwwwgGwwwww', 'wWWWWWWWWWWw', 'gwwwwwwwwwwg', 'dddddddddddd'] },
  torch: { c: { f: '#F2C14E', F: '#F28C28', r: '#D9412B', w: '#8A5A33' }, s: [
    '..f..', '.fFf.', '.FrF.', 'fFrFf', '.FFF.', '.www.', '..w..', '..w..', '..w..', '.www.'] },
  runestone: { c: { S: '#B8B5A2', s: '#8C8A7A', r: '#6FE3D2', d: '#4E4C42' }, s: [
    '..SSSS..', '.SssssS.', 'SssrsssS', 'SssrrssS', 'SssrsrsS', 'SssrrssS', 'SssrsrsS', 'SssrssrS',
    'SssssssS', 'dSSSSSSd', 'dddddddd'] },
  // ---- atlas: temples by difficulty, curiosities, weather, coins ----
  hut: { c: { P: '#8A6A3A', p: '#C8A96A', w: '#8C8A7A', d: '#1A120A', m: '#3E8E4E' }, s: [
    '.....PP.....', '....PppP....', '...PppppP...', '..PppppppP..', '.PppppppppP.', '..wwwwwwww..',
    '..wwwddwww..', '..wmwddwmw..', '..wwwddwww..', '.mmmmmmmmmm.'] },
  shrine: { c: { g: '#F2C14E', S: '#B8B5A2', s: '#8C8A7A', d: '#2A2A24', m: '#3E8E4E' }, s: [
    '.......gg.......', '......SSSS......', '.....SssssS.....', '....SSSSSSSS....', '....sdsddsds....', '...SSSSSSSSSS...',
    '...ssssddssss...', '..SSSSSddSSSSS..', '..sssssddsssss..', '.SSSmSSddSSmSSS.', '.ssssssddssssss.', 'SSSSSSSddSSSSSSS',
    'mssssssddssssssm', 'mmmmmmmmmmmmmmmm'] },
  ziggurat: { c: { y: '#F2C14E', Y: '#FFE08A', S: '#B8B5A2', s: '#8C8A7A', d: '#2A2A24', e: '#6FE3D2', f: '#F2C14E', F: '#F28C28', w: '#8A5A33', m: '#3E8E4E', v: '#2E7A35' }, s: [
    '.........yy.........', '........yYYy........', '........SeeS........', '.......SSSSSS.......', '...f...sdssds...f...',
    '...F..SSSSSSSS..F...', '...w..sseesees..w...', '...w.SSSSSSSSSS.w...', '...w.ssssddssss.w...', '...SSSSSSddSSSSSS...',
    '...vsssssddsssssv...', '..SSSSSSSddSSSSSSS..', '..vsyssssddssssysv..', '.SSSSSSSSddSSSSSSSS.', 'mssssssssddssssssssm',
    'mmmmmmmmmmmmmmmmmmmm'] },
  spire: { c: { c: '#2EC4A0', C: '#B8FFE8', w: '#FFFFFF', S: '#B8B5A2', s: '#8C8A7A', d: '#2A2A24', m: '#3E8E4E' }, s: [
    '......cc......', '.....cCCc.....', '.....cCCc.....', '....cCCCCc....', '....cCwCCc....', '...cCCCCCCc...',
    '...cCCCCCCc...', '..SSSSSSSSSS..', '..ssssddssss..', '.SSSSSddSSSSS.', '.sssssddsssss.', 'SSSSSSddSSSSSS',
    'msssssddsssssm', 'mmmmmmmmmmmmmm'] },
  wolf: { c: { g: '#8C93A6', G: '#C9CFDB', d: '#4A5266', e: '#F2C14E', n: '#111111' }, s: [
    '........gg..', '.......gGgg.', '......gGeggn', '.....gGGggg.', '....ggGGg...', '...gggGGg...',
    '..ggggGGg...', '.gggggggg...', 'gg.ggggggg..', 'dd.dd..dd...'] },
  moon: { c: { m: '#F2EBD3', M: '#C9CFDB' }, s: ['..mmmm..', '.mmMmmm.', 'mmmmmMmm', 'mMmmmmmm', 'mmmmMmmm', 'mmMmmmmm', '.mmmmmm.', '..mmmm..'] },
  totem: { c: { g: '#3E8E4E', w: '#8A5A33', y: '#F2C14E', r: '#D9412B', m: '#2E7A35' }, s: [
    '.gggggg.', 'gwwwwwwg', 'wyywwyyw', 'wwwwwwww', 'wwrrrrww', '.wwwwww.', 'gwwwwwwg', 'wywwwwyw', 'wwwrrwww',
    '.wwwwww.', '..wwww..', '..mmmm..'] },
  mist: { c: { a: '#A9C2A6', A: '#DDE8D8' }, s: ['...AAA....AA..', '.AAaaaA..AaaA.', 'AaaaaaaAAaaaaA', '.aaaaaaaaaaaa.', '...aa..aaa....'] },
  flag: { c: { w: '#8A5A33', r: '#D9412B' }, s: ['wrrrr.', 'wrrrrr', 'wrrrr.', 'w.....', 'w.....', 'w.....', 'w.....', 'w.....'] },
  ember: { c: { k: '#3A2A24', o: '#F28C28' }, s: ['.kkk.', 'kkokk', 'kokkk', '.kkk.'] },
  sun: { c: { y: '#F2C14E', Y: '#FFE08A' }, s: ['....y....', '.y..y..y.', '..yYYYy..', '..YYYYY..', 'yyYYYYYyy', '..YYYYY..', '..yYYYy..', '.y..y..y.', '....y....'] },
  rain: { c: { c: '#A9C2C9', C: '#DDE8EE', r: '#6FA8E3' }, s: ['...CCC....', '.CCcccCC..', 'CcccccccC.', '.cccccccc.', '..r..r..r.', '.r..r..r..', 'r..r..r...'] },
  storm: { c: { c: '#6E7480', C: '#A9AEB8', y: '#F2C14E' }, s: ['...CCC....', '.CCcccCC..', 'CcccccccC.', '.cccccccc.', '....yy....', '...yy.....', '....y.....'] },
  coin: { c: { y: '#F2C14E', Y: '#FFE08A', o: '#B8860B' }, s: ['.yyyy.', 'yYYyyo', 'yYyyyo', 'yyyyyo', 'yyyyoo', '.oooo.'] },
  // ---- explorers by rank (gear gets nerdier with coins) ----
  wanderer: { c: { h: '#4A2A12', s: '#E8B48A', e: '#1A120A', t: '#8C8A7A', p: '#4A3B2A', b: '#2A1D10' }, s: [
    '....hhhh....', '...hhhhhh...', '...hssssh...', '...sesses...', '....ssss....', '...tttttt...', '..tttttttt..', '..stttttts..',
    '..stttttts..', '..s.tttt.s..', '....pppp....', '....pppp....', '....p..p....', '....p..p....', '...bb..bb...', '............'] },
  scout: { c: { g: '#6B8E3A', h: '#4A2A12', s: '#E8B48A', e: '#1A120A', t: '#7B9E5A', k: '#8A5A33', p: '#4A3B2A', b: '#2A1D10' }, s: [
    '...gggggg...', '..gggggggg..', '...hssssh...', '...sesses...', '....ssss....', '...tttttt...', 'kktttttttt..', 'kkstttttts..',
    'kkstttttts..', '..s.tttt.s..', '....pppp....', '....pppp....', '....p..p....', '....p..p....', '...bb..bb...', '............'] },
  pathfinder: { c: { w: '#E8DCC0', W: '#8A5A33', h: '#4A2A12', s: '#E8B48A', e: '#1A120A', t: '#C8A96A', c: '#F2C14E', p: '#4A3B2A', b: '#2A1D10' }, s: [
    '....wwww....', '..wwwWWwww..', '...hssssh...', '...sesses...', '....ssss....', '...ttcctt...', '..tttttttt..', '..stttttts..',
    '..stttttts..', '..s.tttt.s..', '....pppp....', '....pppp....', '....p..p....', '....p..p....', '...bb..bb...', '............'] },
  cartographer: { c: { h: '#4A2A12', k: '#2B2F3A', G: '#6FE3D2', s: '#E8B48A', e: '#1A120A', t: '#3D6E9E', m: '#F2EBD3', p: '#2A2F45', b: '#2A1D10' }, s: [
    '....hhhh....', '...kGGkGGk..', '...hssssh...', '...sesses...', '....ssss....', '...tttttt...', '..tttttttt..', '..ststtttsmm',
    '..ststtttsmm', '..s.tttt.sm.', '....pppp....', '....pppp....', '....p..p....', '....p..p....', '...bb..bb...', '............'] },
  archivist: { c: { h: '#4A2A12', q: '#2B2F3A', s: '#E8B48A', e: '#1A120A', t: '#6A35C2', L: '#6FE3D2', l: '#B8B5A2', b: '#2A1D10' }, s: [
    '....hhhh....', '..qhhhhhhq..', '..qhsssshq..', '...sesses...', '....ssss....', '...tttttt...', '..tttttttt..', '..sLLLLLLs..',
    '..stllllts..', '..tttttttt..', '..tttttttt..', '..tttttttt..', '..tttttttt..', '...tttttt...', '...bb..bb...', '............'] },
  runesage: { c: { r: '#6FE3D2', h: '#DDE8D8', s: '#E8B48A', e: '#1A120A', t: '#13705C', y: '#F2C14E', d: '#F2C14E', D: '#F28C28', b: '#2A1D10' }, s: [
    '.r..r..r..r.', '...hhhhhh...', '...hssssh...', '...sesses...', '...hhsshh...', '...tyyyyt...', '..tttttttt..', '..sttttttsdd',
    '..stttttsDdd', '..tttyyttt..', '..tttttttt..', '..tttttttt..', '..tttttttt..', '...tttttt...', '...bb..bb...', '............'] },
  monarch: { c: { y: '#F2C14E', R: '#FF4D6D', h: '#4A2A12', s: '#E8B48A', e: '#1A120A', z: '#3D8BFF', Z: '#C7E2FF', w: '#8A5A33', c: '#A3162F', t: '#F2C14E', p: '#6A35C2' }, s: [
    '...y.yy.y...', '...yRyyRy...', '...hssssh..z', '...sesses..Z', '....ssss...w', '..cttyyttc.w', '.ccttttttccw', '.csttttttssw',
    '.csttttttc.w', '.cc.tttt.ccw', '.cc.pppp.ccw', '.c..pppp..cw', '....p..p...w', '....p..p...w', '...yy..yy..w', '...........w'] },
  // ---- the rest of the gems, for the treasury ----,
  fairy: { c: { w: '#CFF7FF', W: '#8FE3F5', y: '#FFF6B0', Y: '#F2C14E', s: '#F2D7B8', h: '#E8A0D8', d: '#7A4FA0' }, s: [
    '....y.y....', '.....Y.....', 'WW..hhh..WW', 'wWW.hsh.WWw', 'wwWW.s.WWww', '.wwW.d.Www.', '..wW.dd.Ww.', '...W.dd.W..', '....d..d...', '...y.....y.', '.y.........'] }
};

function spritePixels(kind, px, flip) {
  var sp = SPRITES[kind];
  var cells = [];
  sp.s.forEach(function (row) {
    var r = flip ? row.split('').reverse().join('') : row;
    for (var i = 0; i < r.length; i++) {
      var ch = r.charAt(i);
      cells.push({ bg: ch === '.' ? 'transparent' : sp.c[ch] });
    }
  });
  return { w: sp.s[0].length, px: px, cells: cells };
}
