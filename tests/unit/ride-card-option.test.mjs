import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../../src/lib/ride-card-option.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports });
const { rideCardOption } = exports;
const card = { cardId: 'card-1', brand: 'Visa', last4: '4242', expMonth: 12, expYear: 2029,
  holderName: 'Test Rider', isDefault: true, createdAt: '2026-10-01T00:00:00Z' };

test('shows the saved card with its existing display details', () => {
  const option = rideCardOption([card], null);
  assert.equal(option.kind, 'saved');
  assert.equal(option.card, card);
});

test('prefers the default card, falling back to the first sorted card', () => {
  const other = { ...card, cardId: 'card-2', isDefault: false, holderName: null };
  assert.equal(rideCardOption([other, card], null).card, card);
  assert.equal(rideCardOption([other], null).card, other);
});

test('offers Add a card only after a successful empty response', () => {
  assert.equal(rideCardOption([], null).kind, 'add');
  assert.equal(rideCardOption(null, null).kind, 'loading');
});

test('keeps a skeleton while refreshing stale cards, errors, or an empty list', () => {
  for (const cards of [null, [], [card]]) {
    assert.equal(rideCardOption(cards, null, true).kind, 'loading');
    assert.equal(rideCardOption(cards, 'Previous failure', true).kind, 'loading');
  }
});

test('falls back to plain Card on error, even if a previous list remains cached', () => {
  for (const cards of [null, [], [card]]) {
    assert.equal(rideCardOption(cards, 'Unable to load cards').kind, 'fallback');
  }
});
