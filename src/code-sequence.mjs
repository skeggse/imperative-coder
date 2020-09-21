import { assignFrom, entries, map, NIL_BUF } from './utils.mjs';
import { decode as decodeBigInt, encode as encodeBigInt } from './code-bigint.mjs';
import { runeLookupDurable } from './code-strings.mjs';
import * as encodings from './encode.mjs';
import { intSizes } from './code-ints.mjs';

const FORCE_BIT_ALIGNMENT = false;

class Encoder {
  constructor() {
    this._value = 0n;
    this._mul = FORCE_BIT_ALIGNMENT ? 0n : 1n;
  }

  add(numerator, denominator) {
    // assert numerator < denominator
    if (FORCE_BIT_ALIGNMENT) {
      const shift = this._mul;
      this._value |= BigInt(numerator) << shift;
      // Grossssss.
      this._mul += BigInt((BigInt(denominator) - 1n).toString(2).length);
    } else {
      const mul = this._mul;
      this._value += BigInt(numerator) * mul;
      this._mul = mul * BigInt(denominator);
    }
    return this;
  }

  from(sequence) {
    for (const [numerator, denominator] of sequence) {
      this.add(numerator, denominator);
    }
    return this;
  }

  async _fromAsync(sequence) {
    for await (const [numerator, denominator] of sequence) {
      this.add(numerator, denominator);
    }
    return this;
  }

  fromAsync(sequence) {
    const promise = this._fromAsync(sequence);
    promise.serialize = () => promise.then(() => this.serialize());
    return promise;
  }

  serialize() {
    return encodeBigInt(this._value);
  }
}

class ReversedEncoder extends Encoder {
  add(numerator, denominator) {
    // assert numerator < denominator
    this._value = this._value * BigInt(denominator) + BigInt(numerator);
  }
}

/**
 * @param {Readable} readable
 * @return {Buffer} Buffer-encoded sequence.
 */
export const fromStream = (readable) => new Encoder().fromAsync(readable).serialize();

const Producer = /*#__PURE__*/ (() => {
  class Producer {
    constructor() {
      this._encoder = new Encoder();
    }

    serialize() {
      return this._encoder.serialize();
    }

    withFind(values, predicate, fn) {
      const idx = values.findIndex(predicate);
      if (idx < 0) throw new RangeError('no predicates matched');
      this.fraction(idx, values.length);
      fn(values[idx]);
    }
  }

  assignFrom(
    Producer.prototype,
    map(
      ([key, fn]) => [
        key,
        function(...args) {
          this._encoder.from(fn(...args));
          return this;
        },
      ],
      entries(encodings)
    )
  );

  return Producer;
})();

// const HEX_RUNES = span('09', 'af');

// TODO: support reading from an asynchronous fraction stream.
class Reader {
  constructor(value) {
    this._value = value;
  }

  get(numerator) {
    if (FORCE_BIT_ALIGNMENT) {
      return this.getBits(BigInt((BigInt(numerator) - 1n).toString(2).length));
    }
    const divisor = BigInt(numerator),
      value = this._value,
      denominator = Number(value % divisor);
    this._value = value / divisor;
    return denominator;
  }

  fraction(numerator) {
    return this.get(numerator);
  }

  getBits(bits) {
    const mask = (1n << bits) - 1n,
      value = this._value,
      denominator = value & mask;
    this._value = value >> bits;
    return denominator;
  }

  index(array) {
    return array[this.get(array.length)];
  }

  bit() {
    return Number(this.get(2));
  }

  bool() {
    return !!this.get(2);
  }

  sign() {
    return (this.bit() << 1) - 1;
  }

  int(bits) {
    return this.get(1n << BigInt(bits));
  }

  sint(bits) {
    return this.sign() * this.int(bits);
  }

  svint() {
    return this.sign() * this.vint();
  }

  vint() {
    return Number(this.getBits(this.index(intSizes)));
  }

  string(validRunes) {
    const lookup = runeLookupDurable(validRunes, { inverse: true }),
      numValidRunes = lookup.length,
      length = this.vint();

    if (!(numValidRunes >= 1)) {
      throw new Error('cannot decompress a sequence without rune definitions');
    }
    if (numValidRunes === 1) {
      const rune =
        typeof validRunes === 'string' ? validRunes : validRunes[Symbol.iterator]().next().value;
      return rune.repeat(length);
    }
    let out = '';
    for (let i = 0; i < length; ++i) {
      out += this.index(lookup);
    }
    return out;
  }

  hex() {
    const hexLength = this.vint();
    return this.getBits(BigInt(hexLength) << 2n)
      .toString(16)
      .padStart(hexLength, '0');
  }

  buffer(length) {
    if (!(length >= 0)) throw new RangeError('must provide a non-zero length');
    return length
      ? Buffer.from(
          this.getBits(BigInt(length) << 3n)
            .toString(16)
            .padStart(length << 1, '0'),
          'hex'
        )
      : NIL_BUF;
    // TODO: perf
    // const buf = Buffer.alloc(length),
    //   numInts = i << 3;
    // for (let i = 0; i < numInts; i += 8) {
    //   buf.writeBigUInt64BE(this.getBits(64), i);
    // }
    // return buf;
  }

  vbuffer() {
    return this.buffer(this.vint());
  }

  uuid() {
    const buf = this.buffer(16),
      hex = buf.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
      16,
      20
    )}-${hex.slice(20)}`;
  }
}

export function getReader(encodedSequence) {
  return new Reader(decodeBigInt(encodedSequence));
}

export function getProducer() {
  return new Producer();
}

function encodeSequence(sequence) {
  return new Encoder().from(sequence).serialize();
}

// TODO: avoid passing encodings in like this - it'll completely bork conditional tree-shaking.
export const encode = (src) =>
  typeof src === 'function' ? encodeSequence(src(encodings)) : encodeSequence(src);
