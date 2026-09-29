import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  buildProgressCheckDoneTool,
  buildProgressReadTool,
  buildProgressStatusTool,
  buildProgressWriteTool
} from '../index.js';

const write = buildProgressWriteTool();
const read = buildProgressReadTool();
const status = buildProgressStatusTool();
const checkDone = buildProgressCheckDoneTool();

/** A throwaway session id, so a test never touches a real session's document. */
function makeSession() {
  const sessionId = `session-progress-selftest-${randomUUID()}`;
  return {
    sessionId,
    exec: { agent: { session: { id: sessionId } } },
    cleanup() {
      const key = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
      for (const name of fs.existsSync(os.tmpdir()) ? fs.readdirSync(os.tmpdir()) : []) {
        if (name.startsWith(`dsh-progress-${key}-`)) {
          try {
            fs.unlinkSync(path.join(os.tmpdir(), name));
          } catch (e) {}
        }
      }
    }
  };
}

/** The document's on-disk file, found the way the plugin names it. */
function documentFile(sessionId) {
  const key = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  const name = fs.readdirSync(os.tmpdir()).find((entry) => entry.startsWith(`dsh-progress-${key}-`));
  return name ? path.join(os.tmpdir(), name) : null;
}

test('the whole lifecycle runs on one JSON file', async (t) => {
  const session = makeSession();
  t.after(() => session.cleanup());

  // Nothing yet.
  assert.equal(status.execute({}, session.exec).exists, false);
  assert.equal(read.execute({}, session.exec).exists, false);

  // Create with one call.
  const created = write.execute(
    {
      content: {
        title: 'Ship the JSON progress format',
        overview: 'Rewriting storage.',
        current_activity: 'Designing the schema',
        checklist: [
          { text: 'Design the schema', weight: 20 },
          { text: 'Rewrite the host', weight: 30 },
          {
            text: 'Ship the panel',
            weight: 50,
            children: [
              { text: 'Render the tree', weight: 25 },
              { text: 'Show the weights', weight: 25 }
            ]
          }
        ],
        next_steps: '1. Rewrite client.js',
        notes: 'schema = v2'
      }
    },
    session.exec
  );
  assert.equal(created.mode, 'full');
  assert.equal(created.percent, 0);
  assert.equal(created.tasksTotal, 4, 'leaves only');
  assert.equal(created.status, 'starting');

  // The file on disk is JSON of the documented shape.
  const file = documentFile(session.sessionId);
  assert.ok(file?.endsWith('.json'), `expected a .json document, got ${file}`);
  const stored = JSON.parse(fs.readFileSync(file, 'utf-8'));
  assert.equal(stored.version, 2);
  assert.equal(stored.checklist.length, 3);
  assert.equal(stored.checklist[2].children.length, 2);
  assert.equal(stored.sessionId, session.sessionId);

  // Where am I?
  const before = status.execute({}, session.exec);
  assert.equal(before.current.text, 'Design the schema');
  assert.equal(before.current.box, '[ ]');
  assert.equal(before.current.weightPercent, 20);
  assert.equal(before.upcoming[0].text, 'Rewrite the host');

  // Finish the first step: the percentage follows the boxes, by itself. The step it promotes to
  // running counts as half of its own share, which is the documented rule for a started step.
  const first = checkDone.execute({ item: '#1', activity: 'Rewriting the host' }, session.exec);
  assert.equal(first.checked, 'Design the schema');
  assert.equal(first.percent, 35, '20 done + (30 running × ½)');
  assert.equal(first.promoted, 'Rewrite the host');
  assert.equal(first.status, 'in_progress');
  assert.equal(first.tasksDone, 1);
  assert.equal(first.currentActivity, 'Rewriting the host');

  // Finish a sub-step: it moves the total by its weighted share only.
  const sub = checkDone.execute({ item: 'Render the tree', advance: false }, session.exec);
  assert.equal(sub.checkedPath, '3.1');
  assert.equal(sub.percent, 60, '20 + 15 running + 25 for that sub-step');

  // Checking a group off cascades into its subtree.
  const group = checkDone.execute({ item: 'Ship the panel', advance: false }, session.exec);
  assert.equal(group.percent, 85);

  const last = checkDone.execute({ item: 'Rewrite the host' }, session.exec);
  assert.equal(last.percent, 100);
  assert.equal(last.status, 'completed');
  assert.equal(last.tasksDone, 4);
  assert.equal(last.tasksPending, 0);

  // Reading back: sections are addressable, and unmatched names are reported.
  const section = read.execute({ sections: ['Checklist', 'nope'] }, session.exec);
  assert.deepEqual(section.missing, ['nope']);
  assert.match(section.sections[0].content, /- \[x\] Design the schema \(20%\)/);
  assert.equal(section.corrupted, false);

  const full = read.execute({}, session.exec);
  assert.match(full.content, /^# Ship the JSON progress format/m);
  assert.match(full.content, /4\/4 items done · 100% weighted/);
});

test('matchers refuse an unknown or ambiguous item and write nothing', async (t) => {
  const session = makeSession();
  t.after(() => session.cleanup());

  write.execute(
    {
      content: {
        title: 'Ambiguity',
        checklist: [
          { text: 'test alpha', weight: 50 },
          { text: 'test beta', weight: 50 }
        ]
      }
    },
    session.exec
  );

  assert.throws(() => checkDone.execute({ item: 'test' }, session.exec), /matches 2 items/);
  assert.throws(() => checkDone.execute({ item: 'nothing like this' }, session.exec), /no checklist item matches/);

  const after = status.execute({}, session.exec);
  assert.equal(after.percent, 0, 'a refused matcher left every box alone');

  // Paths disambiguate.
  const hit = checkDone.execute({ item: '#1', advance: false }, session.exec);
  assert.equal(hit.checked, 'test alpha');
  assert.equal(hit.percent, 50);
  assert.equal(hit.tasksDone, 1);

  // `advance` is what credits the next step with half of its own share.
  const started = checkDone.execute({ item: 'test beta' }, session.exec);
  assert.equal(started.percent, 100);
});

test('patches move boxes and weights without a whole document', async (t) => {
  const session = makeSession();
  t.after(() => session.cleanup());

  write.execute(
    {
      content: {
        title: 'Patch me',
        checklist: [
          { text: 'First', weight: 50 },
          { text: 'Second', weight: 50 }
        ]
      }
    },
    session.exec
  );

  const patched = write.execute(
    {
      check: ['First'],
      update: [{ match: 'Second', weight: 25, text: 'Second (25%)' }],
      add: [{ text: 'Third', weight: 25 }],
      current_activity: 'Patching'
    },
    session.exec
  );
  assert.deepEqual(patched.checked, ['First']);
  assert.deepEqual(patched.added, ['Third']);
  assert.equal(patched.percent, 50, '50 of (50 + 25 + 25)');

  const summary = status.execute({}, session.exec);
  assert.equal(summary.current.text, 'Second', 'no step is running, so the first pending one is the step in progress');
  assert.deepEqual(
    summary.upcoming.map((item) => [item.text, item.weightPercent]),
    [['Third', 25]]
  );

  // Removing a group takes its subtree with it.
  const nested = write.execute(
    { add: [{ text: 'Group', weight: 1, children: [{ text: 'Child', weight: 1 }] }], parent: '' },
    session.exec
  );
  assert.deepEqual(nested.added, ['Group']);
  const removed = write.execute({ remove: ['Group'] }, session.exec);
  assert.deepEqual(removed.removed, ['Group']);
  assert.equal(removed.percent, 50);
});

test('a patch cannot carry a percentage, and refuses to mix shapes', async (t) => {
  const session = makeSession();
  t.after(() => session.cleanup());

  assert.throws(() => write.execute({}, session.exec), /needs either `content`/);
  write.execute({ content: { title: 'T', checklist: [{ text: 'a', weight: 1 }] } }, session.exec);
  assert.throws(
    () => write.execute({ content: { title: 'T' }, current_activity: 'x' }, session.exec),
    /never both/
  );
});

test('a legacy Markdown progress file is migrated to JSON on first read', async (t) => {
  const session = makeSession();
  t.after(() => session.cleanup());

  const key = session.sessionId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  const legacy = path.join(os.tmpdir(), `dsh-progress-${key}-${randomUUID()}.md`);
  fs.writeFileSync(
    legacy,
    `---
progress: 40%
status: in_progress
current_activity: "Đang viết"
---

# Việc cũ

## Overview
Tóm tắt cũ.

## Checklist
- [x] Việc một
- [ ] Việc hai
  - [ ] Việc hai - một

## Current Activity
Đang viết

## Next Steps
Xong

## Key Findings / Notes
ghi chú
`,
    'utf-8'
  );

  const migrated = status.execute({}, session.exec);
  assert.equal(migrated.exists, true);
  assert.equal(migrated.title, 'Việc cũ');
  assert.equal(migrated.tasksTotal, 2, 'the group itself is not a task, its child is');
  assert.equal(migrated.percent, 50, 'one of two equally weighted leaves');
  assert.equal(migrated.currentActivity, 'Đang viết');

  const file = documentFile(session.sessionId);
  assert.ok(file?.endsWith('.json'), 'the JSON sibling is written');
  const stored = JSON.parse(fs.readFileSync(file, 'utf-8'));
  assert.equal(stored.checklist.length, 2);
  assert.equal(stored.checklist[1].children.length, 1);

  const written = write.execute({ check: ['Việc hai'] }, session.exec);
  assert.equal(written.percent, 100);
  assert.equal(written.migrated, false, 'the document is JSON by now');
});

test('a broken JSON document is reported instead of throwing on read', async (t) => {
  const session = makeSession();
  t.after(() => session.cleanup());

  write.execute({ content: { title: 'Broken soon', checklist: [{ text: 'a', weight: 1 }] } }, session.exec);
  const file = documentFile(session.sessionId);
  fs.writeFileSync(file, '{ not json', 'utf-8');

  assert.throws(() => status.execute({}, session.exec), /could not read the stored progress document/);

  // The recovery path the error names actually works.
  const repaired = write.execute({ content: { title: 'Repaired', checklist: [{ text: 'a', weight: 1 }] } }, session.exec);
  assert.equal(repaired.replaced, true);
  assert.equal(status.execute({}, session.exec).title, 'Repaired');
});
