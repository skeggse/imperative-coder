import { lookup } from './utils.mjs';

export function countRunes(string) {
  const length = string.length;
  let count = length;
  for (let i = 0; i < length; ++i) {
    const code = string.charCodeAt(i);
    // Exclude the high surrogates from the count.
    count -= code >= 0xd800 && code <= 0xdbff;
  }
  return count;
}

function _makeRuneLookup(validRunes, inverse) {
  const orderedRunes = Array.from(validRunes).sort();
  return inverse
    ? orderedRunes
    : lookup(Object.fromEntries(orderedRunes.map((char, i) => [char, i])));
}

const runeLookups = Object.create(null),
  runeLookupsInverse = Object.create(null),
  weakRuneLookups = new WeakSet(),
  weakRuneLookupsInverse = new WeakSet();
export function runeLookupDurable(validRunes, { inverse = false } = {}) {
  let lookup;
  if (typeof validRunes === 'string') {
    const cache = inverse ? runeLookupsInverse : runeLookups;
    lookup = cache[validRunes] || (cache[validRunes] = _makeRuneLookup(validRunes, inverse));
  } else if (validRunes && typeof validRunes === 'object') {
    const cache = inverse ? weakRuneLookupsInverse : weakRuneLookups;
    lookup =
      cache.get(validRunes) ||
      ((lookup = _makeRuneLookup(validRunes, inverse)), cache.set(validRunes, lookup), lookup);
  } else {
    throw new TypeError('unable to interpret rune lookup');
  }
  return lookup;
}
