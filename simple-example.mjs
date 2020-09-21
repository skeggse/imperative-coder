import { getProducer, getReader } from './src/code-sequence.mjs';

const p = getProducer();

p.fraction(2, 3);
p.fraction(2, 3);
p.fraction(2, 3);
p.fraction(2, 3);
p.fraction(2, 3);


console.log(p.serialize());


// p.fraction(1, 3);
// p.fraction(0, 3);
// p.fraction(2, 3);
// p.fraction(0, 3);
// p.fraction(12, 61);

const r = getReader(p.serialize());

console.log('fraction', r.fraction(3));
console.log('fraction', r.fraction(3));
console.log('fraction', r.fraction(3));
console.log('fraction', r.fraction(3));
console.log('fraction', r.fraction(3));
console.log('fraction', r.fraction(3));
console.log('fraction', r.fraction(3));
console.log('fraction', r.fraction(61));
