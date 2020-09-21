import * as utils from './src/utils.mjs';
// import * as encodings from './src/encode.mjs';
import assert from 'assert';
import { getProducer, getReader } from './src/code-sequence.mjs';
import { types } from 'util';
import { isIPv4 } from 'net';

function coder(definition) {
  if (definition.embed) {
    const { embed, embedDefault, ...restDefinition } = definition,
      embedEntries = Object.entries(embed);
    // TODO: model embedDefault as a wrapper around this definition, maybe.
    return coder({
      ...restDefinition,

      encode(producer, value) {
        // TODO: strict mode where all entries are required, maybe?
        // TODO: stricter mode where no other fields are permitted?
        for (const [field, entry] of embedEntries) {
          entry.encode(producer, hasOwnProperty.call(value, field) ? value[field] : void 0, value);
        }
      },
      decode(reader) {
        const obj = {};
        // TODO: allow default embeddings.
        if (false && embedDefault && !reader.bit()) {
          // Just the default embedding.
          obj[embedDefault] = embed[embedDefault].decode(reader);
        } else {
          // All embeddings.
          for (const [field, entry] of embedEntries) {
            obj[field] = entry.decode(reader);
          }
        }
        return obj;
      },
    });
  }

  assert(definition.encode && definition.decode);
  return definition;
}

coder.string = (...validRuneSpans) => coder.string.raw(utils.span(...validRuneSpans));

coder.string.raw = (validRunes) => {
  return {
    encode: (producer, value) => producer.string(value, validRunes),
    decode: (reader) => reader.string(validRunes),
  };
};

coder.vint = () => {
  return {
    encode: (producer, value) => producer.vint(value),
    decode: (reader) => reader.vint(),
  };
};

function getMatcher(match) {
  if (types.isRegExp(match)) {
    return [void 0, match.test.bind(match)];
  }
  const type = typeof match;
  switch (type) {
    // Primitives:
    case 'string':
    case 'number':
    case 'boolean':
      return [() => match, (v) => v === match];
    case 'function':
      return [void 0, match];
  }
  throw new Error('unable to infer matcher behavior');
}

function select(...cases) {
  cases = cases.map((option) => {
    const [decode, match] = getMatcher(option.match);
    return { decode, ...option, match };
  });

  return {
    encode(producer, value) {
      producer.withFind(
        cases,
        (option) => option.match(value),
        (option) => option.encode && option.encode(producer, value)
      );
    },
    decode(reader) {
      return reader.index(cases).decode(reader);
    },
  };
}

coder.literalDefault = function literalDefault(literal, fallback) {
  return coder({
    encode(producer, value) {
      const isOther = value !== literal;
      producer.bit(isOther);
      if (isOther) {
        fallback.encode(producer, value);
      }
    },
    decode: (reader) => (reader.bit() ? fallback.decode(reader) : literal),
  });
  // return select(
  //   (reader) => reader.bit(),
  //   matcher((bit) => bit, coder({
  //     decode: () => literal,
  //   }),
  //   matcher.default(fallback)
  // );
};

coder.ipv4 = () => ({
  encode(producer, addr) {
    producer.buffer(Buffer.from(addr.split('.')));
  },
  decode: (reader) => Array.from(reader.buffer(4)).join('.'),
});

const rHostname = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?$/;

const rUUIDLocal = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.local$/;
const addressCoder = select(
  { match: '127.0.0.1' },
  {
    match: rUUIDLocal,
    encode(producer, addr) {
      producer.uuid(addr.slice(0, 36));
    },
    decode: (reader) => `${reader.uuid()}.local`,
  },
  {
    match: isIPv4,
    ...coder.ipv4(),
  },
  {
    match: (addr) => addr.length <= 256 && rHostname.test(addr),
    // TODO: consider context-aware mechanism for encoding hostnames even smaller
    ...coder.string('09', 'AZ', 'az', '.', '-'),
  }
);

const STATIC_UFRAG = '0000';

// const candidateCoder = ({ override = { ufrag } } = {}) => coder({

// });

const enc = coder({
  embed: {
    sdpMid: coder.literalDefault('0', coder.string('!', "#'", '*+', '-.', '09', 'AZ', '^~')),
    sdpMLineIndex: coder.literalDefault(0, coder.vint()),
    // TODO: theoretically, make configurable.
    candidate: coder({
      encode(producer, _, candidate) {
        console.log({ candidate });
        producer.index(candidate.protocol, ['tcp', 'udp']);
        producer.index(candidate.component, ['rtp', 'rtcp']);
        producer.int(candidate.port, 16);
        addressCoder.encode(producer, candidate.address);
      },
      decode(reader) {
        const protocol = reader.index(['tcp', 'udp']),
          component = reader.index(['1', '2']),
          port = reader.int(16),
          address = addressCoder.decode(reader);
        return `candidate:0 ${component} ${protocol} 1 ${address} ${port} typ host ufrag ${STATIC_UFRAG}`;
      },
    }),
  },
  // TODO: auto-compact entire object?
  // embedDefault: 'candidate',
});

console.log(
  getProducer()
    .string('yesseyesy', 'yes')
    .serialize()
);

const producer = getProducer();
const candidateJSON = {
  sdpMid: '0',
  sdpMLineIndex: 0,
  candidate: 'candidate:0 1 udp stun.l.google.com 8734 typ host ufrag 0000',
};
enc.encode(producer, {
  ...candidateJSON,

  protocol: 'udp',
  component: 'rtp',
  port: 8734,
  address: 'stun.l.google.com',
});
import mp from 'msgpack-lite';
import cbor from 'cbor';
const jsonEncoded = Buffer.from(JSON.stringify(candidateJSON)),
  mEncoded = mp.encode(candidateJSON),
  cEncoded = cbor.encode(candidateJSON),
  encoded = producer.serialize();
console.log('json', jsonEncoded);
console.log('msgpack', mEncoded);
console.log('cbor', cEncoded);
console.log('encoded', encoded);
console.log('decoded', enc.decode(getReader(encoded)));
