import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// Point the settings store at a throwaway file BEFORE the plugin loads, so a test never writes into
// the real `~/.dsh-session-progress-settings.json`.
const SETTINGS_FILE = path.join(os.tmpdir(), `dsh-sp-settings-${randomUUID()}.json`);
process.env.DSH_SESSION_PROGRESS_SETTINGS = SETTINGS_FILE;

const { apply, DEFAULT_SCOPE, isSessionDisabled, setSessionEnabled, buildProgressStatusTool, renderProgressStatusResult } = await import('../index.js');

/** A context that records what the plugin does, without a running harness. */
function makeContext() {
  const registrations = { injected: [], tools: [], routes: [], sections: [], events: [] };
  const ctx = {
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    inject: (deps, callback) => registrations.injected.push({ deps, callback }),
    webServer: { register: (route) => registrations.routes.push(route) }
  };
  const services = {
    systemPrompt: {
      getSectionOrder: () => 500,
      section: (definition) => registrations.sections.push(definition)
    },
    tools: { register: (definition) => registrations.tools.push(definition), get: () => undefined },
    agents: {
      on: (name, handler) => registrations.events.push({ name, handler }),
      list: () => []
    }
  };
  return { ctx, registrations, services };
}

/**
 * Run every `ctx.inject([...], callback)` the way cordis does: the callback receives a context that
 * carries both the requested services as properties and the event API (`on`).
 */
function runInjections(registrations, services) {
  for (const { deps, callback } of registrations.injected) {
    const scoped = Object.assign({}, services, ...deps.map((dep) => ({ [dep]: services[dep] })), {
      on: (name, handler) => registrations.events.push({ name, handler })
    });
    callback(scoped);
  }
}

test('apply() registers the prompt section, the four tools and the HTTP routes', () => {
  const { ctx, registrations, services } = makeContext();
  apply(ctx, {});

  // Every injection was requested.
  assert.deepEqual(
    registrations.injected.map((entry) => entry.deps[0]),
    ['systemPrompt', 'tools', 'agents']
  );

  // Run them the way the harness would.
  runInjections(registrations, services);

  assert.equal(registrations.sections.length, 1);
  assert.equal(registrations.sections[0].name, 'session:progress');
  assert.equal(typeof registrations.sections[0].text, 'function');

  assert.deepEqual(
    registrations.tools.map((tool) => tool.name),
    ['session_progress_read', 'session_progress_write', 'session_progress_status', 'session_progress_check_done']
  );
  for (const tool of registrations.tools) {
    assert.equal(typeof tool.execute, 'function', `${tool.name} has an execute`);
    assert.equal(typeof tool.output?.render, 'function', `${tool.name} has a renderer`);
    assert.equal(tool.parameters?.type, 'object');
  }

  assert.deepEqual(
    registrations.routes.map((route) => route.path).sort(),
    [
      '/api/session-progress/content',
      '/api/session-progress/open',
      '/api/session-progress/toggle',
      '/api/task-progress/content',
      '/api/task-progress/open',
      '/api/task-progress/toggle'
    ].sort()
  );

  assert.deepEqual(
    registrations.events.map((entry) => entry.name).sort(),
    ['agent/created', 'agent/disposed']
  );
});

test('the injected prompt documents the tools and forbids a manual percentage', (t) => {
  t.after(() => {
    try {
      fs.unlinkSync(SETTINGS_FILE);
    } catch (e) {}
    delete process.env.DSH_SESSION_PROGRESS_SETTINGS;
  });
  const { ctx, registrations, services } = makeContext();
  apply(ctx, {});
  runInjections(registrations, services);
  const section = registrations.sections[0];
  const sessionId = `session-smoke-${randomUUID()}`;
  const text = section.text({ agent: { session: { id: sessionId } } });

  assert.ok(text.length > 500, 'the prompt section has substance');
  for (const name of ['session_progress_write', 'session_progress_read', 'session_progress_status', 'session_progress_check_done']) {
    assert.ok(text.includes(name), `the prompt names ${name}`);
  }
  assert.match(text, /THE PERCENTAGE IS COMPUTED, NEVER WRITTEN/);
  assert.match(text, /TEMPLATE/);
  assert.match(text, /are rendered as \*\*Markdown\*\*/, 'the prompt tells the agent the prose sections are Markdown');
  assert.match(text, /prose fields are Markdown/, 'the template says the prose fields are Markdown');
  assert.ok(!text.includes('__'), 'no unsubstituted placeholder survived');

  // A session with tracking switched off gets no prompt section at all.
  setSessionEnabled(sessionId, false);
  assert.equal(section.text({ agent: { session: { id: sessionId } } }), '');
  assert.equal(isSessionDisabled(sessionId), true);

  // ...and the empty-document hint says so, instead of asking for a document the panel will not show.
  const offHint = renderProgressStatusResult(buildProgressStatusTool().execute({}, { agent: { session: { id: sessionId } } }));
  assert.match(offHint, /^No progress document yet for this session\./);
  assert.match(offHint, /\[plugin\] progress tracking is switched OFF for this session/);
  assert.match(offHint, /will not show a document created now/);

  setSessionEnabled(sessionId, true);
  assert.ok(section.text({ agent: { session: { id: sessionId } } }).length > 500);
  assert.equal(isSessionDisabled(DEFAULT_SCOPE), false);
});
