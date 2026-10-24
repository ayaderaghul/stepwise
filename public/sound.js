// 8-bit sound effects and jungle ambience, synthesized with the Web Audio API (no audio files).
// Sound on/off and ambience on/off are remembered per device.
var Sfx = (function () {
  var KEY = 'stepwise:sound', AMB_KEY = 'stepwise:ambience';
  var ac = null, master = null, amb = null, birdTimer = null;
  function read(key, fallback) { try { var v = localStorage.getItem(key); return v === null ? fallback : v === '1'; } catch (e) { return fallback; } }
  function write(key, on) { try { localStorage.setItem(key, on ? '1' : '0'); } catch (e) { /* ignore */ } }
  var enabled = read(KEY, true);
  var ambienceWanted = read(AMB_KEY, false);

  function ctx() {
    if (!ac) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ac = new C();
      master = ac.createGain();
      master.gain.value = 0.55;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, at, dur, type, vol, slideTo) {
    var a = ctx(); if (!a) return;
    var t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(at, dur, filterType, freq, vol, q) {
    var a = ctx(); if (!a) return;
    var t = a.currentTime + at, len = Math.max(1, Math.floor(a.sampleRate * dur));
    var buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = a.createBufferSource(); src.buffer = buf;
    var f = a.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q || 1;
    var g = a.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur);
  }
  function notes(list, gap, type, vol) { list.forEach(function (f, i) { tone(f, i * gap, gap * 1.6, type, vol); }); }

  var SOUNDS = {
    rustle: function () { noise(0, 0.1, 'bandpass', 3200, 0.16, 0.8); noise(0.07, 0.12, 'bandpass', 2400, 0.1, 0.8); },
    carve: function () { tone(190, 0, 0.12, 'triangle', 0.35, 90); tone(140, 0.09, 0.1, 'triangle', 0.25, 70); noise(0, 0.05, 'highpass', 2000, 0.08); },
    toucan: function () { tone(1400, 0, 0.07, 'square', 0.08, 2000); tone(1700, 0.1, 0.09, 'square', 0.08, 2500); },
    gem: function () { notes([988, 1319, 1568, 1976], 0.07, 'square', 0.07); },
    shard: function () { tone(2093, 0, 0.06, 'triangle', 0.18); tone(2637, 0.06, 0.08, 'triangle', 0.14); },
    rare: function () {
      notes([523, 659, 784, 1047, 1319, 1568], 0.07, 'square', 0.07);
      [1047, 1319, 1568].forEach(function (f) { tone(f, 0.45, 0.6, 'triangle', 0.08); });
    },
    block: function () { tone(220, 0, 0.35, 'square', 0.12, 55); noise(0, 0.25, 'lowpass', 300, 0.3); },
    rune: function () { tone(660, 0, 0.7, 'sine', 0.12); tone(663, 0.02, 0.7, 'sine', 0.1); tone(990, 0.15, 0.6, 'sine', 0.07); },
    door: function () { noise(0, 0.6, 'lowpass', 380, 0.4); tone(70, 0, 0.6, 'triangle', 0.3, 50); tone(523, 0.55, 0.15, 'square', 0.06); tone(784, 0.65, 0.2, 'square', 0.06); }
  };

  var lastPlayed = {};
  function play(name) {
    if (!enabled || !SOUNDS[name]) return;
    var now = Date.now();
    if (lastPlayed[name] && now - lastPlayed[name] < 60) return; // avoid stacking the same cue
    lastPlayed[name] = now;
    try { SOUNDS[name](); } catch (e) { /* audio unavailable */ }
  }

  function chirp() {
    if (!amb) return;
    var base = 1800 + Math.random() * 1600;
    tone(base, 0, 0.05, 'sine', 0.04, base * 1.3);
    tone(base * 1.1, 0.08, 0.05, 'sine', 0.03, base * 1.4);
    birdTimer = setTimeout(chirp, 1400 + Math.random() * 2800);
  }
  function startAmbience() {
    if (amb || !enabled) return;
    var a = ctx(); if (!a) return;
    var len = a.sampleRate * 2, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    var src = a.createBufferSource(); src.buffer = buf; src.loop = true;
    var f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
    var g = a.createGain(); g.gain.value = 0.14;
    src.connect(f); f.connect(g); g.connect(master); src.start();
    amb = src;
    chirp();
  }
  function stopAmbience() {
    if (amb) { try { amb.stop(); } catch (e) { /* ignore */ } }
    amb = null;
    clearTimeout(birdTimer);
  }
  // Browsers only allow audio after a tap, so ambience starts on the first interaction.
  document.addEventListener('pointerdown', function () { if (enabled && ambienceWanted && !amb) startAmbience(); }, { passive: true });

  return {
    play: play,
    isOn: function () { return enabled; },
    ambienceOn: function () { return ambienceWanted; },
    setOn: function (on) { enabled = on; write(KEY, on); if (!on) stopAmbience(); else if (ambienceWanted) startAmbience(); },
    setAmbience: function (on) { ambienceWanted = on; write(AMB_KEY, on); if (on) startAmbience(); else stopAmbience(); }
  };
})();
