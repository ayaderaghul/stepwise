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
    'SssssssS', 'dSSSSSSd', 'dddddddd'] }
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
