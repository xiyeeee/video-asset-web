import { UnavailableAssets } from './UnavailableAssets'

export function DialogueAssets() {
  return (
    <div className="space-y-3">
      <label className="block max-w-xs text-sm text-muted-foreground">
        说话人
        <select disabled className="mt-1 w-full rounded-lg border border-white/10 bg-card px-3 py-2 text-sm">
          <option>没有可筛选的说话人</option>
        </select>
      </label>
      <UnavailableAssets
        type="DIALOGUE"
        title="对话"
        description="台词、说话人和时间戳还不能提取。说话人未确定时会显示未知角色，不会猜测角色名。"
      />
    </div>
  )
}
