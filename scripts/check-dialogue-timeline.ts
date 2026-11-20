import assert from 'node:assert/strict'
import {
  activeDialogue,
  appliedSeekSeconds,
  classifyDialogue,
  contractDialogueItems,
  nextSeek,
  openEpisode,
  placeDialogue,
  silentRanges,
  speakerLabel,
  switchEpisode,
  timelineDurationMs,
} from '../src/features/dialogue/timeline.ts'

const lines = classifyDialogue(contractDialogueItems())
assert.equal(lines.length, 3)
assert.deepEqual(silentRanges(lines, 20000), [[0, 1200], [3100, 5000], [7550, 20000]])

const overlap = activeDialogue(lines, 7100).map((line) => line.segmentIndex)
assert.deepEqual(overlap, [2, 3])
assert.deepEqual(activeDialogue(lines, 1200).map((line) => line.segmentIndex), [1])
assert.deepEqual(activeDialogue(lines, 3100), [])
assert.deepEqual(activeDialogue(lines, 7200).map((line) => line.segmentIndex), [3])
assert.deepEqual(activeDialogue(lines, 7550), [])
assert.deepEqual(activeDialogue(lines, 20000), [])

const placed = placeDialogue(lines, 20000)
assert.equal(placed[0]?.lane, 0)
assert.equal(placed[1]?.lane, 0)
assert.equal(placed[2]?.lane, 1)
assert.equal(placed[0]?.leftPercent, 6)
assert.equal(placed[0]?.widthPercent, 9.5)
assert.ok((placed[2]?.leftPercent ?? 0) < (placed[1]?.leftPercent ?? 0) + (placed[1]?.widthPercent ?? 0))

const first = lines[0]
const second = lines[1]
const third = lines[2]
assert.ok(first && second && third)
assert.equal(nextSeek(null, '135', first).seconds, 1.2)
assert.equal(nextSeek(null, '135', second).seconds, 5)
assert.equal(nextSeek(null, '135', third).seconds, 7)
const pending = nextSeek(null, '135', first)
assert.equal(appliedSeekSeconds(pending, '135', false), null)
assert.equal(appliedSeekSeconds(pending, '135', true), 1.2)

assert.equal(speakerLabel('speaker-1'), '说话人 1')
assert.equal(speakerLabel('speaker-2'), '说话人 2')
assert.equal(speakerLabel(null), '未知说话人')
assert.equal(speakerLabel('林夏'), '未知说话人')
assert.equal(third.speakerId, null)

assert.deepEqual(classifyDialogue([]), [])
assert.equal(classifyDialogue([{
  assetId: '1',
  assetType: 'DIALOGUE',
  sourceTaskId: '9',
  details: { segmentIndex: 1, startMs: 0, endMs: 0, text: '空', speakerId: null },
}]).length, 0)

const opened = openEpisode('135')
assert.equal(opened.selectedId, null)
assert.equal(opened.seek, null)
assert.equal(opened.timeMs, 0)
const moved = switchEpisode({ ...opened, selectedId: '816', seek: pending, timeMs: 4000 }, '136')
assert.equal(moved.episodeId, '136')
assert.equal(moved.selectedId, null)
assert.equal(moved.seek, null)
assert.equal(moved.timeMs, 0)
assert.equal(timelineDurationMs(lines, 120000), 120000)
assert.equal(timelineDurationMs(lines, null), 7550)

console.log('dialogue timeline checks passed')
