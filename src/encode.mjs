// All exports in this file are exposed on - and absorbed by - the Producer class. No exports that
// don't belong on Producer should be added to this module.

import { countRunes, runeLookupDurable } from './code-strings.mjs';
import { getSizeDurable, map, padHex } from './utils.mjs';
import { encodeVint } from './code-ints.mjs';

function _fraction(numerator, denominator, error) {
  if (!(numerator >= 0 && numerator < denominator)) {
    throw new RangeError(error);
  }
  return [numerator, denominator];
}

export function* fraction(numerator, denominator) {
  yield _fraction(numerator, denominator, 'fraction out of allowed range');
}

export function* bit(value) {
  yield [value ? 1 : 0, 2];
}

export { bit as bool };

export function* sign(value) {
  yield [value >= 0, 2];
}

export function* consumeSign(value, fn) {
  yield* sign(value);
  yield* fn(value >= 0 ? value : -value);
}

export function* int(value, bits) {
  const max = 1n << BigInt(bits);
  yield _fraction(value, max, 'integer out of specified range');
}

export const sint = (value, bits) => consumeSign(value, (abs) => int(abs, bits));

/**
 * Encode the given signed integer.
 */
export const svint = (value) => consumeSign(value, encodeVint);

/**
 * Encode the given integer.
 */
export function vint(value) {
  if (!(value >= 0)) {
    throw new RangeError('cannot encode negative integers with without sign support');
  }
  return encodeVint(value);
}

export function* index(value, values) {
  yield* fraction(values.indexOf(value), values.length);
}

export function* string(string, validRunes) {
  const lookup = runeLookupDurable(validRunes),
    numValidRunes = getSizeDurable(lookup);
  if (numValidRunes < 1) throw new Error('no valid runes provided');
  // TODO: use string.length if lookup didn't find any valid astral runes?
  string = String(string);
  yield* vint(countRunes(string));
  if (numValidRunes > 1) {
    yield* map((rune) => {
      const idx = lookup[rune];
      if (idx === void 0) throw new Error(`cannot find rune '${rune}' in lookup`);
      return [idx, numValidRunes];
    }, string);
  }
}

export function* buffer(buffer) {
  yield [BigInt('0x' + padHex(buffer.toString('hex'))), 1n << (BigInt(buffer.length) << 3n)];
}

export function* vbuffer(buffer) {
  yield* vint(buffer.length);
  yield* buffer(buffer);
}

// Might be a little inefficient for odd-length hex strings...
export function* hex(string) {
  const len = string.length;
  yield* vint(len);
  yield [BigInt('0x' + string), 1n << (BigInt(len) << 2n)];
  // yield *this.buffer(Buffer.from(padHex(string), 'hex'));
  // return this.string(string.toLowerCase(), HEX_RUNES);
}

export const uuid = (string) => {
  const buf = Buffer.from(string.replace(/-/g, ''), 'hex');
  if (buf.length !== 16) throw new Error('not a valid uuid');
  return buffer(buf);
};
