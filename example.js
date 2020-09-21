const size = Symbol();

function *map(fn, iter) {
  let i = 0;
  for (const item of iter) {
    yield fn(item, i);
    ++i;
  }
}

function *objEntries(obj) {
  for (const key in obj) {
    if (hasOwnProperty.call(obj, key)) {
      yield [key, obj[key]];
    }
  }
}

function *chain(...iterables) {
  for (const iter of iterables) {
    yield *iter;
  }
}

const entries = (obj) => Array.isArray(obj) ? obj.entries() : objEntries(obj);

const _getSize = (obj) => Object.keys(obj).length;
const setSize = (obj) => ((Object.defineProperty(obj, size, { value: _getSize(obj), configurable: true })), obj);
const getSize = (obj) => size in obj ? obj[size] : setSize(obj);

const isObject = (v) => !!v && typeof v === 'object';
const lookupObj = (obj) => Object.assign(Object.create(null), obj);
const lookupStr = (str) => lookupObj(Object.fromEntries(map((s, i) => [s, i], str)));
const lookup = (value) => setSize(typeof value === 'string' ? lookupStr(value) : lookupObj(value));

const invert = (obj) => Object.fromEntries(map(([key, value]) => [value, key], entries(obj)));

const octetMap = Array.from({ length: 0x100 }, (_, i) => i.toString(16).padStart(2, '0'));

// The dumbest possible way to do this. Might be also worth collapsing the 272 cases into a single
// lookup.
// const highByteTable = Array.from({ length: 0x100 }, (_, i) => parseInt(i.toString(2).replace('1', '0'), 2));
// const encodeHighByte = (str) => highByteTable[parseInt(str, 16)];

function encodeBigInt(bigint, { ignoreHigh = false } = {}) {
  if ([0n, 0].includes(bigint)) {
    if (ignoreHigh) throw new Error('no available high bit');
    return new ArrayBuffer();
  }

  // This can result in an odd number of characters.
  const encoded = bigint.toString(16),
    offset = encoded.length & 1,
    highOffset = 0,
    bytes = ((encoded.length + 1) >> 1) - highOffset,
    out = new Uint8Array(bytes);

  out[0] = parseInt(encoded.slice(0, 2 - offset), 16);
  for (let i = highOffset ^ 1; i < bytes; ) {
    const next = i + 1;
    out[i] = parseInt(encoded.slice((i << 1) - offset, (next << 1) - offset), 16);
    i = next;
  }

  return out.buffer;
}

function decodeBigInt(buffer) {
  const input = new Uint8Array(buffer),
    bytes = input.length;
  let value = 0n;
  for (let i = 0; i < bytes; ++i) {
    value |= BigInt(input[i]) << (BigInt(bytes - i - 1) << 3n);
  }
  return value;
}

function encodeProvisioned(src) {
  // High bit set? We might have to encode it to locate the end of the sequence, but it's minimal
  // overhead.
  let value = 0n;
  // Assumption: total > 1
  for (const [index, total] of src) {
    // assert(index < total)
    value = (value * BigInt(total)) + BigInt(index);
  }
  return encodeBigInt(value);
}

// function *decodeProvisioned(input, partitions) {
//   let value = decodeBigInt(input);
//   for (const total of partitions) {
//     const divisor = BigInt(total),
//       index = Number(value % divisor);
//     value /= divisor;
//     yield index;
//   }
// }

function getReader(input) {
  let value = decodeBigInt(input);
  function get(total) {
    const divisor = BigInt(total),
      index = Number(value % divisor);
    value /= divisor;
    return index;
  }
  return {
    bit: () => get(2),
    bool: () => !!get(2),
    deref: (array) => array[get(array.length)],
    get,
  };
}

// Assumes the spans defined aren't astral.
function span(...spans) {
  let out = '';
  for (const span of spans) {
    if (span.length === 1) {
      out += span;
      continue;
    }
    for (let i = span.charCodeAt(0); i <= span.charCodeAt(1); ++i) {
      out += String.fromCharCode(i);
    }
  }
  return out;
}

const bit = (v) => [+v, 2];

const scales = [1n << 4n, 1n << 8n, 1n << 32n];
// Max 32-bit.
function *encodeInt(value) {
  const scale = scales.findIndex((ref) => value < ref);
  yield [value, scales[scale]];
  yield [scale, scales.length];
}

function decodeInt(reader) {
  return reader.get(reader.deref(scales));
}

// Assumes string does not contain astral characters, and handles them inconsistently.
function compress(string, mapping) {
  const size = BigInt(getSize(mapping)),
    lengthIter = encodeInt(string.length);
  if (size === 1n) return lengthIter;
  if (size > 1n) return chain(map((chr) => [mapping[chr], size], string), lengthIter);
  throw new Error('cannot compress a sequence with zero mappings');
}

function decompress(reader, iMapping) {
  const size = BigInt(getSize(iMapping)),
    length = decodeInt(reader);
  if (size === 1n) return Object.values(iMapping)[0].repeat(length);
  if (!(size > 1n)) throw new Error('cannot decompress a sequence with zero mappings');
  let out = '';
  for (let i = 0; i < length; ++i) {
    out = iMapping[reader.get(size)] + out;
  }
  return out;
}
// Per `token-char` defined in https://tools.ietf.org/html/rfc4566#section-9.
const midMapping = lookup(span('!', "#'", '*+', '-.', '09', 'AZ', '^~')),
  iMidMapping = setSize(invert(midMapping));

debugger;
console.log(decompress(getReader(encodeProvisioned(compress('yes', midMapping))), iMidMapping));

return;
const literalEncoder = (lit, encode) => new Encoder({
  encodeMatch: (value) => value === lit,
  encode,
  decode: () => lit,
});

const definedMid = new Encoder({
  decodeMatch: bit(true),
  *encode(sdpMid) {
    yield *compress(sdpMid, midMapping);
    yield bit(true);
  },
  // decode: (reader) => ,
});

const midMatcher = new Matcher([
  literalEncoder('0', bit(false)),
  definedMid,
]);

const definedMLine = new Encoder({
  *encode(sdpMLineIndex) {
    yield bit(true);
    // yield compress(
  },
  // decode: () => ,
});

const mlineMatcher = new Matcher([
  literalEncoder(0, bit(false)),

]);

const protocolEncoder = new Encoder({
  name: 'candidate:protocol',
  *encode(candidate) {
    this.assert(isObject(candidate));
    const candidateObj = candidate.toJSON();
    this.assert(Object.keys(candidateObj).sort().join(',') === 'candidate,sdpMid,sdpMLineIndex');
    yield *midMatcher.encode(candidate.sdpMid);
    yield *mlineMatcher.encode(candidate.sdpMLineIndex);
    yield *candidateEncoder.encode(candidate.candidate);
  },
  decode: (reader) => ({
    sdpMid: midMatcher.decode(reader),
    sdpMLineIndex: mlineMatcher.decode(reader),
    candidate: candidateEncoder.decode(reader),
  }),
});

const candidateEncoder = new Encoder({
  name: 'candidate',

});

const sdpEncoder = new Encoder({
  name: 'sdp',

});

new Matcher();
