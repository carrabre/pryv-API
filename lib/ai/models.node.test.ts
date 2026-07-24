import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_CHAT_MODEL,
  chatModels,
  getModel,
  resolveModelId,
  supportsPdf,
  supportsWebSearch,
} from './models'

test('canonical API model catalog matches the Pryv backend contract', () => {
  assert.deepEqual(
    chatModels.map((model) => model.id).sort(),
    [
      'gpt-5.5',
      'gpt-5.4',
      'gemini-3.1-pro-preview',
      'claude-sonnet-4-6',
      'claude-opus-4-7',
      'grok-4-1-fast-reasoning',
    ].sort(),
  )

  assert.equal(DEFAULT_CHAT_MODEL, 'gpt-5.5')
  assert.equal(getModel('gpt-5.5').name, 'GPT 5.5')
  assert.equal(getModel('claude-opus-4-7').name, 'Claude Opus 4.7')
  assert.equal(supportsWebSearch('gpt-5.5'), true)
  assert.equal(supportsWebSearch('claude-sonnet-4-6'), false)
  assert.equal(supportsWebSearch('claude-opus-4-7'), false)
  assert.equal(supportsPdf('grok-4-1-fast-reasoning'), true)
})

test('legacy model ids normalize to the canonical API catalog', () => {
  assert.equal(resolveModelId('gpt-5.1'), 'gpt-5.5')
  assert.equal(resolveModelId('gpt-5.2'), 'gpt-5.5')
  assert.equal(resolveModelId('gpt-5.3'), 'gpt-5.5')
  assert.equal(resolveModelId('gpt-5.4-pro'), 'gpt-5.4')
  assert.equal(resolveModelId('gemini-2.5-pro'), 'gemini-3.1-pro-preview')
  assert.equal(resolveModelId('claude-sonnet-4-5'), 'claude-sonnet-4-6')
  assert.equal(resolveModelId('claude-opus-4-6'), 'claude-opus-4-7')
  assert.equal(resolveModelId('grok-4'), 'grok-4-1-fast-reasoning')
})
