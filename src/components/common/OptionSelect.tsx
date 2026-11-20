import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type SelectOption = {
  value: string
  label: string
}

/** 宽度限制在父级内部，选项过长时截断，菜单与触发器左对齐，避免撑出右侧。 */
export function OptionSelect({
  label,
  value,
  onValueChange,
  options,
  disabled,
  className,
}: {
  label?: string
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  disabled?: boolean
  className?: string
}) {
  return (
    <label className={cn('block w-full min-w-0 max-w-xs text-sm text-muted-foreground', className)}>
      {label}
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className={label ? 'mt-1' : undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}
