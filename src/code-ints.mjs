export const intSizes = [4n, 8n, 32n],
  intScales = intSizes.map((bits) => 1n << bits);

export function* encodeVint(value) {
  const scale = intScales.findIndex((ref) => value < ref);
  if (scale < 0) throw new RangeError('only integers up to 32 bits are permitted');
  yield [scale, intScales.length];
  yield [value, intScales[scale]];
}
