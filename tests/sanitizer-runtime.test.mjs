import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('sanitizer works without require(ESM) and removes executable markup', () => {
  const result = spawnSync(process.execPath, ['--no-experimental-require-module', '--input-type=module', '-e', `
    import sanitize from './server/generated/sanitize-html.mjs';
    import assert from 'node:assert/strict';
    const options = { allowedTags: ['p', 'strong', 'a'], allowedAttributes: { a: ['href'] }, allowedSchemes: ['https', 'http'] };
    assert.equal(sanitize('<p>Hello <strong>world</strong><script>alert(1)</script></p>', options), '<p>Hello <strong>world</strong></p>');
    assert.equal(sanitize('<a href="javascript:alert(1)" onclick="alert(1)">click</a>', options), '<a>click</a>');
    assert.ok(!sanitize('<textarea></textarea/><img src=x onerror=alert(1)>', options).includes('<img'));
  `], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
});
