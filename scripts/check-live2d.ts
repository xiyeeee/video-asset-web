import assert from 'node:assert/strict'
import {
  availableMotionTests,
  characterForHistory,
  hasMoreLive2dPage,
  indexModelDirectory,
  isCurrentLive2dRequest,
  isLive2dFinished,
  isLive2dSettled,
  live2dDownloadName,
  live2dEventsPath,
  live2dModelSaved,
  live2dTaskBody,
  orderLive2dVersions,
  versionForSelection,
  modelRequestNeedsAuth,
  motionTarget,
  resolveModelReference,
  rewriteModelFiles,
  safeModelReference,
  shouldApplyLive2dTask,
  type ModelSettingsJson,
} from '../src/services/live2d/contract.ts'

const uploadBody = live2dTaskBody('12', ' 许宁 ', { uploadFileId: 'file-1' })
assert.deepEqual(uploadBody, { projectId: '12', modelName: '许宁', uploadFileId: 'file-1' })
assert.equal('sourceAssetId' in uploadBody, false)

const assetBody = live2dTaskBody('12', '许宁', { sourceAssetId: 'asset-9' })
assert.deepEqual(assetBody, { projectId: '12', modelName: '许宁', sourceAssetId: 'asset-9' })
assert.equal('uploadFileId' in assetBody, false)
assert.throws(() => live2dTaskBody('12', '   ', { uploadFileId: 'file-1' }))
assert.throws(() => live2dTaskBody('0', '许宁', { sourceAssetId: 'asset-9' }))

assert.equal(isLive2dSettled('QUEUED'), false)
assert.equal(isLive2dSettled('RUNNING'), false)
assert.equal(isLive2dSettled('SUCCEEDED'), true)
assert.equal(isLive2dSettled('FAILED'), true)
assert.equal(shouldApplyLive2dTask('12', '12'), true)
assert.equal(shouldApplyLive2dTask('12', '13'), false)
assert.equal(shouldApplyLive2dTask('12', undefined), false)
assert.equal(live2dEventsPath('12', 'abc'), '/api/projects/12/live2d/tasks/abc/events')
assert.equal(live2dEventsPath('12', 'a b').includes('access_token'), false)
assert.equal(live2dEventsPath('12', 'a b').includes(' '), false)

const modelRoot = `/api/projects/12/live2d/models/1/files/${'a'.repeat(64)}`
const modelEntry = `${modelRoot}/runtime/model.model3.json`
assert.equal(modelRequestNeedsAuth(modelEntry, 'http://localhost:5173'), false)
assert.equal(modelRequestNeedsAuth('http://localhost:5173/api/protected-file', 'http://localhost:5173'), true)
assert.equal(modelRequestNeedsAuth('https://storage.example/model.model3.json?sig=1', 'http://localhost:5173'), false)
assert.equal(modelRequestNeedsAuth('blob:http://localhost:5173/abc', 'http://localhost:5173'), false)

const sibling = resolveModelReference('https://storage.example/models/haru/haru.model3.json?sig=1', 'textures/00.png')
assert.equal(sibling, 'https://storage.example/models/haru/textures/00.png')
assert.equal(resolveModelReference(modelEntry, 'model.moc3'), `${modelRoot}/runtime/model.moc3`)
assert.throws(() => safeModelReference('../secret.moc3'))
assert.throws(() => resolveModelReference('https://storage.example/models/haru/haru.model3.json', 'https://evil.example/a.png'))

const model: ModelSettingsJson = {
  Version: 3,
  FileReferences: {
    Moc: 'model.moc3',
    Textures: ['textures/atlas.png'],
    Physics: 'model.physics3.json',
    Expressions: [{ Name: 'smile', File: 'expressions/smile.exp3.json' }],
    Motions: { Idle: [{ File: 'motions/idle.motion3.json' }] },
  },
}
const rewritten = rewriteModelFiles(model, (reference) => `blob:${reference}`)
assert.equal(rewritten.FileReferences.Moc, 'blob:model.moc3')
assert.deepEqual(rewritten.FileReferences.Textures, ['blob:textures/atlas.png'])
assert.equal(rewritten.FileReferences.Expressions?.[0]?.File, 'blob:expressions/smile.exp3.json')
assert.equal(rewritten.FileReferences.Motions?.Idle?.[0]?.File, 'blob:motions/idle.motion3.json')
assert.equal(model.FileReferences.Moc, 'model.moc3')

const tests = availableMotionTests(['ParamEyeLOpen', 'ParamAngleX', 'ParamBodyAngleX'])
assert.deepEqual(tests.map((item) => item.id), ['blink', 'head'])
assert.deepEqual(tests[0]?.parameters, ['ParamEyeLOpen'])
assert.equal(motionTarget('blink', 0, 1, 1), 0)
assert.equal(motionTarget('mouth', 0, 1, 0), 1)
assert.equal(motionTarget('head', -30, 30, 0), 15)

const entry = { name: 'model.model3.json', webkitRelativePath: 'Sample/model.model3.json' }
const moc = { name: 'model.moc3', webkitRelativePath: 'Sample/model.moc3' }
const indexed = indexModelDirectory([entry, moc])
assert.equal(indexed.entryName, 'model.model3.json')
assert.equal(indexed.files.get('model.moc3'), moc)
const extra = { name: 'other.model3.json', webkitRelativePath: 'Sample/other.model3.json' }
assert.throws(() => indexModelDirectory([entry, extra]))

const characters = [
  { characterId: '7', name: '许宁', avatarUrl: null, latestVersionId: '420' },
  { characterId: '8', name: '林夏', avatarUrl: null, latestVersionId: '500' },
]
assert.equal(characterForHistory(characters, { characterId: '8', versionId: '500' }).character?.characterId, '8')
assert.equal(characterForHistory(characters, { characterId: '8', versionId: '500' }).matched, true)
assert.equal(characterForHistory(characters, { characterId: '9', versionId: '1' }).character?.characterId, '7')
assert.equal(characterForHistory(characters, { characterId: '9', versionId: '1' }).matched, false)
assert.equal(characterForHistory(characters, null).matched, false)
assert.equal(characterForHistory([], { characterId: '7', versionId: '420' }).character, null)

const versions = [
  { versionId: '410', versionNumber: 1, modelName: '许宁', thumbnailUrl: null, savedAt: '2026-11-24T01:00:00Z', status: 'AVAILABLE' as const },
  { versionId: '419', versionNumber: 2, modelName: '许宁', thumbnailUrl: null, savedAt: '2026-11-24T02:00:00Z', status: 'AVAILABLE' as const },
]
assert.deepEqual(orderLive2dVersions(versions).map((item) => item.versionNumber), [2, 1])
assert.equal(versionForSelection(versions, '410')?.versionId, '410')
assert.equal(versionForSelection(versions, null)?.versionId, '419')
assert.equal(live2dModelSaved({ status: 'SUCCEEDED', saveStatus: 'SAVED', result: { characterId: '31', versionId: '419' } }), true)
assert.equal(live2dModelSaved({ status: 'SUCCEEDED', saveStatus: 'SAVING', result: { characterId: null, versionId: null } }), false)
assert.equal(live2dModelSaved({ status: 'SUCCEEDED', saveStatus: 'FAILED', result: null }), false)
assert.equal(live2dModelSaved(null), false)
assert.equal(isLive2dFinished({ status: 'SUCCEEDED', saveStatus: 'SAVING' }), false)
assert.equal(isLive2dFinished({ status: 'SUCCEEDED', saveStatus: 'SAVED' }), true)
assert.equal(isLive2dFinished({ status: 'FAILED', saveStatus: 'NOT_STARTED' }), true)
assert.equal(hasMoreLive2dPage(20, 20, 21), true)
assert.equal(hasMoreLive2dPage(21, 1, 21), false)
assert.equal(hasMoreLive2dPage(0, 0, 0), false)
assert.equal(isCurrentLive2dRequest(2, 2), true)
assert.equal(isCurrentLive2dRequest(2, 3), false)
assert.equal(live2dDownloadName('attachment; filename="live2d-419.zip"', '419'), 'live2d-419.zip')
assert.equal(live2dDownloadName('', '419'), 'live2d-419.zip')

console.log('live2d contract ok')
