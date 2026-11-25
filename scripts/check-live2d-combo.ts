import assert from 'node:assert/strict'
import { catalogItems, filterCatalog } from '../src/services/live2d/motion-catalog.ts'
import {
  acceptComboPreview,
  advanceComboClock,
  comboDraftKey,
  conflictSegmentIds,
  dialogueWindow,
  emptyComboDraft,
  formatComboClock,
  live2dId,
  moveClip,
  overlappingClipIds,
  placeClip,
  sampleMotion3,
  samplePlayback,
  timelineDuration,
  trackForMotion,
  trimClip,
  type ComboClip,
  type MotionSource,
  type PlaybackSegment,
} from '../src/services/live2d/combo-contract.ts'

const hexId = /^[a-f0-9]{32}$/
assert.match(live2dId(), hexId)

const smile: MotionSource = {
  sourceId: 'motion:419:motions/smile.motion3.json',
  sourceVersionId: '419',
  name: '微笑',
  track: 'face',
  trackType: 'MOTION',
  durationMs: 3000,
  group: 'Smile',
}
const nod: MotionSource = {
  sourceId: 'motion:419:motions/nod.motion3.json',
  sourceVersionId: '419',
  name: '点头',
  track: 'head',
  trackType: 'MOTION',
  durationMs: 800,
  group: 'Nod',
}
const speech: MotionSource = {
  sourceId: 'motion:419:motions/speech.motion3.json',
  sourceVersionId: '419',
  name: '说话口型',
  track: 'mouth',
  trackType: 'MOTION',
  durationMs: 2800,
  group: 'Mouth',
}
const line: MotionSource = {
  sourceId: 'dialogue:1',
  sourceVersionId: '88',
  name: '台词',
  track: 'speech',
  trackType: 'DIALOGUE',
  durationMs: 2800,
  group: null,
}

let draft = emptyComboDraft('微笑点头说话', '31', '419')
draft = placeClip(draft, smile, 0)
draft = placeClip(draft, nod, 500)
draft = placeClip(draft, speech, 200)
const mouth = draft.clips.find((clip) => clip.sourceId === speech.sourceId)
assert.ok(mouth)
const audio: ComboClip = {
  segmentId: live2dId(),
  track: 'speech',
  trackType: 'DIALOGUE',
  sourceId: line.sourceId,
  sourceVersionId: line.sourceVersionId,
  label: line.name,
  startMs: 200,
  durationMs: 2800,
  sourceDurationMs: 2800,
}
draft = { ...draft, clips: [...draft.clips, audio], durationMs: timelineDuration([...draft.clips, audio]) }

const smileClip = draft.clips.find((clip) => clip.sourceId === smile.sourceId)
const nodClip = draft.clips.find((clip) => clip.sourceId === nod.sourceId)
assert.ok(smileClip && nodClip)
assert.match(smileClip.segmentId, hexId)
assert.equal(smileClip.startMs, 0)
assert.equal(smileClip.durationMs, 3000)
assert.equal(nodClip.startMs, 500)
assert.equal(nodClip.durationMs, 800)
assert.equal(mouth.startMs, 200)
assert.equal(audio.startMs, 200)
assert.equal(draft.durationMs, 3000)

const active = overlappingClipIds(draft.clips, 1000)
assert.equal(active.length, 4)
assert.ok(active.includes(smileClip.segmentId))
assert.ok(active.includes(nodClip.segmentId))
assert.ok(active.includes(mouth.segmentId))
assert.ok(active.includes(audio.segmentId))

const motion: PlaybackSegment[] = [
  {
    segmentId: smileClip.segmentId,
    trackType: 'MOTION',
    startTimeMs: 0,
    durationMs: 3000,
    sourceStartMs: null,
    resourceUrl: '/motions/smile.motion3.json',
    motion: [{ id: 'ParamMouthForm', segments: [0, 0, 0, 3, 1] }],
  },
  {
    segmentId: nodClip.segmentId,
    trackType: 'MOTION',
    startTimeMs: 500,
    durationMs: 800,
    sourceStartMs: null,
    resourceUrl: '/motions/nod.motion3.json',
    motion: [{ id: 'ParamAngleY', segments: [0, 0, 1, 0, 0.3, 0.2, 0.5, 10, 0.8, 0] }],
  },
  {
    segmentId: mouth.segmentId,
    trackType: 'MOTION',
    startTimeMs: 200,
    durationMs: 2800,
    sourceStartMs: null,
    resourceUrl: '/motions/speech.motion3.json',
    motion: [{ id: 'ParamMouthOpenY', segments: [0, 0, 0, 0.8, 1] }],
  },
]
const sampled = samplePlayback(motion, 1000)
assert.equal(sampled.find((item) => item.id === 'ParamMouthForm')?.value, 1 / 3)
assert.ok((sampled.find((item) => item.id === 'ParamAngleY')?.value ?? 0) > 0)
assert.equal(sampled.find((item) => item.id === 'ParamMouthOpenY')?.value, 1)
assert.equal(sampleMotion3([{ id: 'ParamMouthOpenY', segments: [0, 0, 0, 1, 10] }], 0.5)[0]?.value, 5)

const spoken = dialogueWindow({ startTimeMs: 200, durationMs: 2800, sourceStartMs: 400 }, 1000)
assert.equal(spoken?.offsetSeconds, 1.2)
assert.equal(dialogueWindow({ startTimeMs: 200, durationMs: 2800, sourceStartMs: 0 }, 100)?.offsetSeconds, undefined)

assert.equal(formatComboClock(1000), '00:01.00')
assert.equal(formatComboClock(3000), '00:03.00')
const wrapped = advanceComboClock(2900, 200, 3000, true)
assert.equal(wrapped.stop, false)
assert.equal(wrapped.timeMs, 100)
assert.equal(advanceComboClock(2900, 200, 3000, false).stop, true)

const moved = moveClip(draft, nodClip.segmentId, 700)
assert.notEqual(comboDraftKey(moved), comboDraftKey(draft))
assert.equal(acceptComboPreview(comboDraftKey(draft), comboDraftKey(moved)), false)
const renamed = { ...draft, name: '另一个名字' }
assert.notEqual(comboDraftKey(renamed), comboDraftKey(draft))
const trimmed = trimClip(draft, smileClip.segmentId, 'end', 2500)
assert.equal(trimmed.clips.find((clip) => clip.segmentId === smileClip.segmentId)?.durationMs, 2500)

const overlap = conflictSegmentIds([{ segmentIds: [smileClip.segmentId, nodClip.segmentId] }])
assert.deepEqual(overlap, [smileClip.segmentId, nodClip.segmentId])
assert.equal(trackForMotion('Smile', smile.sourceId), 'face')
assert.equal(trackForMotion('Nod', nod.sourceId), 'head')
assert.equal(trackForMotion('Mouth', speech.sourceId), 'mouth')

const listed = catalogItems([
  { sourceId: 'preset:smile', sourceVersionId: '419', name: '微笑', track: 'face', trackType: 'MOTION', presetId: 'smile', durationMs: null, group: 'smile', supported: false, parameterIds: ['ParamMouthForm'], missingParameterIds: ['ParamMouthForm'] },
  { sourceId: 'preset:nod', sourceVersionId: '419', name: '点头', track: 'head', trackType: 'MOTION', presetId: 'nod', durationMs: null, group: 'nod', supported: true, parameterIds: ['ParamAngleY'], missingParameterIds: [] },
])
assert.equal(listed[0]?.compatibility, 'missing')
assert.equal(listed[0]?.purpose, '表情')
assert.equal(listed[1]?.compatibility, 'ready')
assert.equal(filterCatalog(listed, { keyword: '点头', part: 'head', purpose: '头部', compatibility: 'ready' }).length, 1)
assert.equal(filterCatalog(listed, { keyword: '', part: 'all', purpose: 'all', compatibility: 'missing' }).length, 1)

console.log('live2d combo contract ok')
