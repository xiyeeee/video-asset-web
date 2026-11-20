import assert from 'node:assert/strict'
import {
  appliedBackgroundSeek,
  classifyBackgrounds,
  contractBackgroundItems,
  nextBackgroundSeek,
  openBackgroundEpisode,
  personLabel,
  reviewLabel,
  sameBackgroundVersion,
  signedImageStaleMs,
  subtitleLabel,
  switchBackgroundEpisode,
} from '../src/features/background/cards.ts'

const cards = classifyBackgrounds(contractBackgroundItems())
assert.equal(cards.length, 2)
assert.equal(cards[0]?.shotIndex, 1)
assert.equal(cards[0]?.reviewStatus, 'CLEAN_CANDIDATE')
assert.equal(reviewLabel('CLEAN_CANDIDATE'), '可用候选')
assert.equal(cards[1]?.reviewStatus, 'NEEDS_REVIEW')
assert.equal(reviewLabel('NEEDS_REVIEW'), '待复核')
assert.equal(subtitleLabel('UNKNOWN'), '字幕未知')
assert.equal(personLabel('DETECTED'), '有人物')
assert.equal(cards[1]?.subtitleStatus, 'UNKNOWN')

const mislabeled = classifyBackgrounds([{
  assetId: '1',
  assetType: 'BACKGROUND',
  sourceTaskId: '9',
  expiresInSeconds: 600,
  details: {
    shotIndex: 1,
    startMs: 0,
    endMs: 1000,
    timestampMs: 500,
    method: 'SOURCE_FRAME',
    personStatus: 'NOT_DETECTED',
    subtitleStatus: 'UNKNOWN',
    reviewStatus: 'CLEAN_CANDIDATE',
    imageUrl: 'https://media.example/a.jpg',
  },
}])
assert.equal(mislabeled[0]?.reviewStatus, 'NEEDS_REVIEW')
assert.equal(subtitleLabel(mislabeled[0]?.subtitleStatus ?? 'UNKNOWN'), '字幕未知')

const first = cards[0]
const second = cards[1]
assert.ok(first && second)
assert.equal(nextBackgroundSeek(null, '135', first).seconds, 4)
assert.equal(nextBackgroundSeek(null, '135', second).seconds, 14)
const pending = nextBackgroundSeek(null, '135', first)
assert.equal(appliedBackgroundSeek(pending, '135', false), null)
assert.equal(appliedBackgroundSeek(pending, '135', true), 4)

assert.equal(signedImageStaleMs(600), 585_000)
assert.equal(signedImageStaleMs(10), 0)
assert.equal(classifyBackgrounds([{
  ...contractBackgroundItems()[0],
  expiresInSeconds: 0,
}]).length, 0)

const mixed = sameBackgroundVersion([
  first,
  { ...second, assetId: '821', sourceTaskId: 'old' },
], '925')
assert.deepEqual(mixed.map((card) => card.assetId), ['819'])

const opened = openBackgroundEpisode('135')
const moved = switchBackgroundEpisode({ ...opened, selectedId: '819', seek: pending }, '136')
assert.equal(moved.selectedId, null)
assert.equal(moved.seek, null)
assert.equal(moved.episodeId, '136')
assert.equal(classifyBackgrounds([{
  assetId: '2',
  assetType: 'BACKGROUND',
  sourceTaskId: '9',
  expiresInSeconds: 600,
  details: {
    shotIndex: 1,
    startMs: 0,
    endMs: 8000,
    timestampMs: 8000,
    method: 'SOURCE_FRAME',
    personStatus: 'NOT_DETECTED',
    subtitleStatus: 'NOT_DETECTED',
    reviewStatus: 'CLEAN_CANDIDATE',
    imageUrl: 'https://media.example/edge.jpg',
  },
}]).length, 0)

console.log('background card checks passed')
