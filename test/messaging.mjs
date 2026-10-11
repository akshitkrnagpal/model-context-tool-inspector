import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the actual badge error-reporting callback with a missing content
// script and no side-panel receiver, as after a renderer crash/navigation.
const missingReceiver = 'Could not establish connection. Receiving end does not exist.';
const errors = [];
const capture = (error) => errors.push(error.message);
process.on('unhandledRejection', capture);
let onActivated;
let reports = 0;
const context = vm.createContext({
  chrome: {
    sidePanel: { setPanelBehavior() {} },
    runtime: {
      onInstalled: { addListener() {} },
      onMessage: { addListener() {} },
      sendMessage() { reports++; return Promise.reject(new Error(missingReceiver)); },
    },
    tabs: {
      onActivated: { addListener(fn) { onActivated = fn; } },
      onUpdated: { addListener() {} },
      query: async () => [{ id: 1 }],
      sendMessage: async () => { throw new Error(missingReceiver); },
    },
    webNavigation: { onCompleted: { addListener() {} } },
    action: { setBadgeText() {}, setBadgeBackgroundColor() {} },
  },
  getAllFrameOrigins: async () => ['http://localhost'],
});
const source = fs.readFileSync(new URL('../background.js', import.meta.url), 'utf8')
  .replace("import { getAllFrameOrigins } from './utils.js';", '');
vm.runInContext(source, context);
onActivated({ tabId: 1 });
await new Promise(resolve => setTimeout(resolve, 50));
process.off('unhandledRejection', capture);
assert.equal(reports, 1, 'the original error should still be forwarded');
assert.deepEqual(errors, [], 'a closed side panel must not cause an unhandled rejection');
console.log('PASS missing content-script and side-panel receivers are handled');
