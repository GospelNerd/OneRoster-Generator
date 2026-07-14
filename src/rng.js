// Deterministic PRNG so a given seed + params always yields the same roster.
// Useful for QA regression: same request, byte-identical output.

'use strict';

// mulberry32: tiny, fast, good enough for test data.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash an arbitrary string into a 32-bit seed (so seeds can be words, not just ints).
function hashSeed(input) {
  const str = String(input);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

class Rng {
  constructor(seed) {
    const s = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
    this._next = mulberry32(s);
  }

  // float in [0, 1)
  float() {
    return this._next();
  }

  // int in [min, max] inclusive
  int(min, max) {
    return min + Math.floor(this._next() * (max - min + 1));
  }

  bool(pTrue = 0.5) {
    return this._next() < pTrue;
  }

  pick(arr) {
    return arr[Math.floor(this._next() * arr.length)];
  }

  // Fisher-Yates, returns a new shuffled array (does not mutate input).
  shuffle(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this._next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // RFC-4122 v4 UUID built from this RNG so output stays deterministic.
  uuid() {
    const b = new Array(16);
    for (let i = 0; i < 16; i++) b[i] = Math.floor(this._next() * 256);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const hex = b.map((x) => x.toString(16).padStart(2, '0'));
    return (
      hex.slice(0, 4).join('') +
      '-' +
      hex.slice(4, 6).join('') +
      '-' +
      hex.slice(6, 8).join('') +
      '-' +
      hex.slice(8, 10).join('') +
      '-' +
      hex.slice(10, 16).join('')
    );
  }
}

module.exports = { Rng, hashSeed };
