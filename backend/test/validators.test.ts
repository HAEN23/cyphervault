import { test } from 'node:test';
import assert from 'node:assert';
import { isEmail, isUuid, isNumericCode } from '../src/utils/validators.js';
import { getPasswordErrors } from '../src/utils/passwordPolicy.js';
test('validadores sin regex', () => {
  assert(isEmail('a@b.co')); assert(!isEmail('a@b')); assert(!isEmail('a b@c.d')); assert(!isEmail('a@@b.c')); assert(!isEmail('@b.c')); assert(!isEmail('a@.c')); assert(!isEmail('a@b.')); assert(!isEmail(5));
  assert(isUuid('123e4567-e89b-12d3-a456-426614174000')); assert(!isUuid('123e4567-e89b-12d3-a456-42661417400g')); assert(!isUuid('------------------------------------'));
  assert(isNumericCode('012345')); assert(!isNumericCode('12345')); assert(!isNumericCode('12a456'));
  assert.deepEqual(getPasswordErrors('Abcdefghij1!'), []); assert.equal(getPasswordErrors('abc').length, 4);
  assert.deepEqual(getPasswordErrors('A'.repeat(200)), ['128 caracteres máximo']); assert.deepEqual(getPasswordErrors('Aa1!'.repeat(200), 1024), []);
  const t=Date.now(); isEmail('a'.repeat(250)+'@'); getPasswordErrors('!'.repeat(1000000),2e6); assert(Date.now()-t<500);
});
