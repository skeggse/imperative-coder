export const lookup = (obj) => Object.assign(Object.create(null), obj);

const HEX_PAD = ['', '0'];
export const padHex = (str) => HEX_PAD[str.length & 1] + str;

export const NIL_BUF = Buffer.alloc(0);

// Assumes the spans defined aren't astral.
export function span(...spans) {
  let out = '';
  for (const span of spans) {
    const firstCode = span.charCodeAt(0),
      secondRune = 1 + (firstCode >= 0xd800 && firstCode <= 0xdbff);
    if (span.length === secondRune) {
      out += span;
      continue;
    }
    for (let i = span.codePointAt(0); i <= span.codePointAt(secondRune); ++i) {
      out += String.fromCharCode(i);
    }
  }
  return out;
}

export function* map(fn, iter) {
  let i = 0;
  for (const value of iter) {
    yield fn(value, i++);
  }
}

const sizeLookups = new WeakMap();
const getObjSize = (obj) => Object.keys(obj).length;

export function getSizeDurable(obj) {
  if ('size' in obj) return obj.size;
  if (Array.isArray(obj)) return obj.length;
  // TODO: is this safe? What if the object has been resized?
  if (sizeLookups.has(obj)) return sizeLookups.get(obj);
  const size = getObjSize(obj);
  sizeLookups.set(obj, size);
  return size;
}

export function* entries(obj) {
  for (const key in obj) {
    if (hasOwnProperty.call(obj, key)) {
      yield [key, obj[key]];
    }
  }
}

export function assignFrom(obj, iter) {
  for (const [key, value] of iter) {
    obj[key] = value;
  }
  return obj;
}
