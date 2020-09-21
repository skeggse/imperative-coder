import test from 'ava';

import { encode, decode } from './code-bigint.mjs';
import { randomBytes } from 'crypto';

async function rangeBigInt(max) {
  // The dumb way.
  const bytes = await randomBytes((max.toString(16).length + 1) >> 1);
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }
  return value > max ? rangeBigInt(max) : value;
}

// Arbitrary.
const LARGE_NUMBER = 23489576384756123904823048n;

test('produces zero', (t) => {
  t.is(decode(encode(0n)), 0n);
  t.is(decode(encode(0)), 0n);
});

test('fails on negative numbers', (t) => {
  t.throws(() => encode(-1n));
});

test('produces the same value', async (t) =>
  Promise.all(
    Array.from({ length: 128 }, () =>
      rangeBigInt(LARGE_NUMBER).then((int) => t.is(decode(encode(int)), int))
    )
  ));
