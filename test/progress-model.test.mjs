import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkItems,
  computeProgress,
  createEmptyProgress,
  currentItem,
  advanceToNext,
  deriveStatus,
  matchChecklistItem,
  migrateLegacyMarkdown,
  normalizeProgress,
  parseProgressFileText,
  renderChecklistLines,
  serializeProgress,
  updateChecklistItems
} from '../progress-model.js';

/** Build a document from a raw checklist and return its computed summary. */
function build(checklist, patch = {}) {
  const { progress, warnings } = normalizeProgress({ title: 'T', checklist, ...patch }, null, { sessionId: 's1' });
  return { progress, warnings, summary: computeProgress(progress) };
}

test('flat weights are the percent of the whole job', () => {
  const { progress, summary } = build([
    { text: 'item 1', weight: 20 },
    { text: 'item 2', weight: 30 },
    { text: 'item 3', weight: 50 }
  ]);
  assert.equal(summary.percent, 0);
  assert.deepEqual(
    summary.flat.map((node) => node.weightPercent),
    [20, 30, 50]
  );

  checkItems(progress, ['item 1']);
  assert.equal(computeProgress(progress).percent, 20);

  checkItems(progress, ['item 2']);
  assert.equal(computeProgress(progress).percent, 50);

  checkItems(progress, ['item 3']);
  const done = computeProgress(progress);
  assert.equal(done.percent, 100);
  assert.equal(deriveStatus(progress, done).status, 'completed');
});

test('inline "(20%)" in the text declares the weight', () => {
  const { summary } = build(['Viết parser (20%)', 'Chạy lint (80%)']);
  assert.deepEqual(
    summary.flat.map((node) => [node.text, node.weight, node.weightPercent]),
    [
      ['Viết parser', 20, 20],
      ['Chạy lint', 80, 80]
    ]
  );
});

test('sub-items share the parent share and are normalized among siblings', () => {
  const { summary } = build([
    { text: 'a', weight: 20 },
    {
      text: 'b',
      weight: 50,
      children: [
        { text: 'b1', weight: 25 },
        { text: 'b2', weight: 15 },
        { text: 'b3', weight: 10 }
      ]
    },
    { text: 'c', weight: 30 }
  ]);
  const b = summary.flat.find((node) => node.text === 'b');
  assert.equal(b.weightPercent, 50);
  assert.deepEqual(
    b.children.map((child) => child.weightPercent),
    [25, 15, 10]
  );
  assert.equal(summary.tasksTotal, 5, 'only leaves count as tasks');
});

test('checking a sub-item moves the total by its weighted share', () => {
  const { progress } = build([
    { text: 'a', weight: 50 },
    { text: 'b', weight: 50, children: [{ text: 'b1', weight: 25 }, { text: 'b2', weight: 25 }] }
  ]);
  assert.equal(computeProgress(progress).percent, 0);
  checkItems(progress, ['b1']);
  assert.equal(computeProgress(progress).percent, 25, 'b1 is 50% of b, and b is 50% of the job');
  checkItems(progress, ['b2']);
  assert.equal(computeProgress(progress).percent, 50);
  checkItems(progress, ['a']);
  assert.equal(computeProgress(progress).percent, 100);
});

test('checking a group cascades into its whole subtree', () => {
  const { progress } = build([
    { text: 'a', weight: 40 },
    { text: 'b', weight: 60, children: [{ text: 'b1', weight: 1 }, { text: 'b2', weight: 1, children: [{ text: 'b2x', weight: 1 }] }] }
  ]);
  const { ticked } = checkItems(progress, ['b']);
  assert.equal(ticked.length, 1);
  const summary = computeProgress(progress);
  assert.equal(summary.percent, 60);
  assert.ok(summary.flat.filter((node) => node.isGroup).every((node) => node.state === 'done'));
});

test('matchers: text, row number and dotted path', () => {
  const { summary } = build([
    { text: 'alpha', weight: 50, children: [{ text: 'alpha one', weight: 1 }, { text: 'alpha two', weight: 1 }] },
    { text: 'beta', weight: 50 }
  ]);
  assert.equal(matchChecklistItem(summary, 'beta').node.path, '2');
  assert.equal(matchChecklistItem(summary, '#1.1').node.path, '1.1');
  assert.equal(matchChecklistItem(summary, 'alpha two').node.path, '1.2');
  assert.equal(matchChecklistItem(summary, '#3').node.path, '1.2', 'row 3 is depth-first');
  assert.throws(() => matchChecklistItem(summary, 'zzz'), /no checklist item matches/);
});

test('ambiguous text is refused with both candidates', () => {
  const { summary } = build([{ text: 'test A', weight: 1 }, { text: 'test B', weight: 1 }]);
  assert.throws(() => matchChecklistItem(summary, 'test'), /matches 2 items/);
});

test('advance promotes the next pending leaf as the single running step', () => {
  const { progress } = build([
    { text: 'one', weight: 1 },
    { text: 'two', weight: 1 },
    { text: 'three', weight: 1 }
  ]);
  checkItems(progress, ['one']);
  const { promoted } = advanceToNext(progress, '1');
  assert.equal(promoted.text, 'two');
  const summary = computeProgress(progress);
  assert.equal(currentItem(summary).text, 'two');
  assert.equal(summary.percent, 50, '1 done + 0.5 running of 3');
});

test('check_done computes the percent itself — no manual number', () => {
  const { progress } = build([{ text: 'a', weight: 100 }], { status: 'starting' });
  checkItems(progress, ['a']);
  const summary = computeProgress(progress);
  const derived = deriveStatus(progress, summary);
  assert.equal(derived.status, 'completed');
});

test('an explicit completed status the boxes deny is corrected', () => {
  const { progress, summary } = build([{ text: 'a', weight: 1 }], { status: 'completed' });
  const derived = deriveStatus(progress, summary);
  assert.equal(derived.status, 'in_progress');
  assert.match(derived.warning, /checklist still has unfinished items/);
});

test('mixed declared/default weights are flagged', () => {
  const { warnings } = build([{ text: 'a', weight: 20, children: [{ text: 'a1', weight: 10 }, { text: 'a2' }] }]);
  assert.ok(warnings.some((warning) => /mix declared and defaulted weights/.test(warning)));
});

test('update can retext and reweight without moving boxes', () => {
  const { progress } = build([{ text: 'old name', weight: 10 }, { text: 'rest', weight: 90 }]);
  updateChecklistItems(progress, [{ match: 'old name', text: 'new name (40%)' }]);
  const summary = computeProgress(progress);
  assert.equal(summary.flat[0].text, 'new name');
  assert.equal(summary.flat[0].weight, 40);
  assert.equal(summary.flat[0].weightPercent, 30.8, 'shares are normalized: 40 / (40 + 90)');
  assert.equal(summary.percent, 0, 'editing text/weight never ticks a box');
});

test('reweighting a whole group keeps declared percentages when they sum alike', () => {
  const { progress } = build([{ text: 'a', weight: 10 }, { text: 'b', weight: 90 }]);
  updateChecklistItems(progress, [
    { match: 'a', weight: 60 },
    { match: 'b', weight: 40 }
  ]);
  const summary = computeProgress(progress);
  assert.deepEqual(
    summary.flat.map((node) => node.weightPercent),
    [60, 40]
  );
});

test('JSON round-trip through the file format', () => {
  const { progress } = build([{ text: 'a', weight: 100 }]);
  const text = serializeProgress(progress);
  const { progress: again, migrated } = parseProgressFileText(text, 's1');
  assert.equal(migrated, false);
  assert.equal(again.sessionId, 's1');
  assert.equal(computeProgress(again).flat[0].text, 'a');
});

test('a v1 markdown document migrates with equal weights per level', () => {
  const md = `---
progress: 30%
status: in_progress
current_activity: "Viết parser"
---

# Mục tiêu

## Overview
Tóm tắt.

## Checklist
- [x] Việc một
- [/] Việc hai
- [ ] Việc ba
  - [ ] Việc ba - một
  - [x] Việc ba - hai

## Current Activity
Viết parser

## Next Steps
1. Xong

## Key Findings / Notes
ghi chú
`;
  const progress = migrateLegacyMarkdown(md, 'session-1');
  assert.equal(progress.title, 'Mục tiêu');
  assert.equal(progress.currentActivity, 'Viết parser');
  assert.equal(progress.nextSteps, '1. Xong');
  assert.equal(progress.notes, 'ghi chú');
  assert.equal(progress.checklist.length, 3);
  assert.equal(progress.checklist[2].children.length, 2);
  const summary = computeProgress(progress);
  assert.equal(summary.tasksTotal, 4, '3 top-level where one is a group of 2 = 4 leaves');
  assert.equal(summary.flat.find((node) => node.text === 'Việc ba - một').weightPercent, 25, 'every leaf weighs the same after migration');
});

test('renderChecklistLines shows the nested boxes with their share', () => {
  const { progress } = build([
    { text: 'a', weight: 50, children: [{ text: 'a1', weight: 1 }] },
    { text: 'b', weight: 50 }
  ]);
  const lines = renderChecklistLines(progress).split('\n');
  assert.deepEqual(lines, ['- [ ] a (50%)', '  - [ ] a1 (50%)', '- [ ] b (50%)']);
});

test('an empty document serializes and computes to zero', () => {
  const progress = createEmptyProgress('s1');
  const summary = computeProgress(progress);
  assert.equal(summary.percent, 0);
  assert.equal(summary.tasksTotal, 0);
  assert.equal(deriveStatus(progress, summary).status, 'starting');
});
