// TODO: benchmarks
// Also:
// https://github.com/bnoordhuis/random-bigint/blob/30bd1ba08864721e7280d465549daa43651f089b/index.js#L59-L81

import { NIL_BUF, padHex } from './utils.mjs';

/**
 * @param {number|BigInt} bigint The value to encode.
 * @return {Buffer} The encoded value.
 */
export function encode(bigint) {
  // We could fairly easily add support for negative bigints, but that support isn't required for
  // our use-case so it doesn't matter.
  if (bigint < 0) {
    throw new RangeError('no support for negative bigints');
  }

  if ([0n, 0].includes(bigint)) {
    return NIL_BUF;
  }

  // BigInt#toString(16) can result in an odd number of characters.
  return Buffer.from(padHex(bigint.toString(16)), 'hex');
  //   offset = encoded.length & 1,
  //   bytes = (encoded.length + 1) >> 1,
  //   out = new Uint8Array(bytes);

  // out[0] = parseInt(encoded.slice(0, 2 - offset), 16);
  // for (let i = 0; i < bytes; ) {
  //   const next = i + 1;
  //   out[i] = parseInt(encoded.slice((i << 1) - offset, (next << 1) - offset), 16);
  //   i = next;
  // }

  // return out.buffer;
}

// function encodeBigIntReverse(bigint) {
//   // We could fairly easily add support for negative bigints, but that support isn't required for
//   // our use-case so it doesn't matter.
//   if (bigint < 0) {
//     throw new RangeError('no support for negative bigints');
//   }

//   if ([0n, 0].includes(bigint)) {
//     return new ArrayBuffer();
//   }

//   // This can result in an odd number of characters.
//   const encoded = bigint.toString(16),
//     offset = encoded.length & 1,
//     bytes = (encoded.length + 1) >> 1,
//     out = new Uint8Array(bytes);

//   out[0] = parseInt(encoded.slice(encoded.length - offset - 1), 16);
//   for (let i = 0; i < bytes; ) {
//     const next = i + 1;
//     out[i] = parseInt(encoded.slice((i << 1) - offset, (next << 1) - offset), 16);
//     i = next;
//   }

//   return out.buffer;
// }

// Understands '0x10' syntax in the constructor btw.
// function decodeBigInt(buffer) {
//   const input = new Uint8Array(buffer),
//     bytes = input.length;
//   let value = 0n;
//   for (let i = 0; i < bytes; ++i) {
//     value |= BigInt(input[i]) << (BigInt(bytes - i - 1) << 3n);
//   }
//   return value;
// }

export function decode(buffer) {
  return buffer.length ? BigInt('0x' + buffer.toString('hex')) : 0n;
}
