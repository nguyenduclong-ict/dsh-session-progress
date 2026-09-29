/**
 * The plugin's tool schemas must be accepted by the harness's own JSON-Schema subset, and the
 * argument shapes the prompt tells the model to send must validate against them. This is the one
 * check a sandboxed unit test cannot otherwise reach: `ctx.tools.register()` calls
 * `assertSupportedJsonSchema()` on both schemas and throws a `JsonSchemaError` at load time.
 *
 * The harness is not a dependency of this plugin, so the test skips when it cannot be found.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { apply } from '../index.js';

/** Likely DSH installs, newest first. `DSH_UNPACKED` wins so any layout can be pointed at. */
function findHarnessTypes() {
  const candidates = [
    process.env.DSH_UNPACKED,
    process.env.DSH_TOOLS_PATH,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'DSH Desktop', 'resources', 'app.asar.unpacked'),
    '/Applications/DSH Desktop.app/Contents/Resources/app.asar.unpacked',
    process.env.HOME && path.join(process.env.HOME, '.local', 'share', 'dsh-desktop', 'resources', 'app.asar.unpacked')
  ].filter(Boolean);

  for (const root of candidates) {
    const suite = path.join(root, 'node_modules', '@deepseek-ai', 'dsh-tools', 'lib', 'types');
    if (fs.existsSync(path.join(suite, 'json-schema.js'))) return suite;
  }
  return null;
}

const suiteDir = findHarnessTypes();

/** Collect the tool definitions the plugin registers, without a running harness. */
function collectTools() {
  const tools = [];
  const ctx = {
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    inject: (deps, callback) => {
      if (deps[0] === 'tools') callback({ tools: { register: (definition) => tools.push(definition) }, on: () => {} });
    },
    webServer: { register: () => {} }
  };
  apply(ctx, {});
  return tools;
}

test('every tool schema fits the harness-supported JSON Schema subset', async (t) => {
  if (!suiteDir) {
    t.skip(`no DSH install found under ${os.homedir()} — set DSH_UNPACKED to check the schemas`);
    return;
  }

  const { assertSupportedJsonSchema, validateJsonSchemaValue } = await import(pathToFileURL(path.join(suiteDir, 'json-schema.js')).href);
  const tools = collectTools();
  assert.equal(tools.length, 4);

  for (const tool of tools) {
    // `ctx.tools.register()` enforces exactly these two calls, plus a render function.
    assert.doesNotThrow(() => assertSupportedJsonSchema(tool.parameters), `${tool.name} parameters`);
    assert.doesNotThrow(() => assertSupportedJsonSchema(tool.output.schema), `${tool.name} output`);
    assert.equal(typeof tool.output.render, 'function', `${tool.name} declares output.render`);
  }

  // The shapes the injected prompt documents must actually validate.
  const write = tools.find((tool) => tool.name === 'session_progress_write');
  const samples = [
    { content: { title: 'Ship it', checklist: [{ text: 'one', weight: 20, children: [{ text: 'a' }] }] } },
    { check: ['one'], update: [{ match: '#1.1', weight: 2 }], status: 'blocked', current_activity: 'x' },
    { add: [{ text: 'group', children: [{ text: 'leaf', weight: 3 }] }], parent: '#1', checklist_mode: 'append' },
    { notes: 'k = v', next_steps: '1. go', overview: 'why', title: 'T' }
  ];
  for (const sample of samples) {
    const violations = validateJsonSchemaValue(write.parameters, sample, '');
    assert.deepEqual(violations, [], `sample ${JSON.stringify(sample)} must validate`);
  }

  // A percentage is not merely ignored — the parameter does not exist.
  assert.equal(Object.hasOwn(write.parameters.properties, 'progress'), false, 'there is no progress parameter');
  assert.equal(Object.hasOwn(write.parameters.properties, 'percent'), false, 'there is no percent parameter');
});
