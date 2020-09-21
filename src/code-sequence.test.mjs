import test from 'ava';

import { decode as decodeBigInt } from './code-bigint.mjs';
import { encode, getReader, getProducer as produce } from './code-sequence.mjs';
import { randomBytes } from 'crypto';

const encoded = (fn) => getReader(encode(fn));
const consume = (producer) => getReader(producer.serialize());

test('produces a zero value at end of sequence', (t) => {
  const reader = getReader(encode([]));
  t.is(reader.get(2), 0);
  t.is(reader.get(123), 0);
  t.is(reader.get(1), 0);
});

test('encodes and produces a variable-length integer', (t) => {
  t.is(consume(produce().vint(6)).vint(), 6);
  t.is(consume(produce().svint(-6)).svint(), -6);

  t.is(encoded((writer) => writer.vint(6)).vint(), 6);
  t.is(encoded((writer) => writer.svint(-6)).svint(), -6);
  t.is(encoded((writer) => writer.vint(181)).vint(), 181);
  t.is(encoded((writer) => writer.svint(-181)).svint(), -181);
});

test('encodes and produces a monotonous string', (t) => {
  const value = 'aaaaaaaaaaaaaaa',
    reader = encoded((writer) => writer.string(value, 'a'));
  t.is(reader.string('a'), value);
});

test('encodes and produces a hex string', async (t) => {
  const value = (await randomBytes(43)).toString('hex');
  t.is(encoded((writer) => writer.hex(value)).hex(), value);
  t.is(encoded((writer) => writer.hex(value.slice(0, -1))).hex(), value.slice(0, -1));
});

test('encodes and produces fractions', async (t) => {
  const reader = consume(
    produce()
      .fraction(1, 300)
      .fraction(0, 300)
  );
  t.is(reader.get(300), 1);
  t.is(reader.get(300), 0);
});
