import { useId, useState } from 'react'
import type { ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type AuthFieldProps = ComponentProps<'input'> & { label: string; error?: string; password?: boolean }

export function AuthField({ label, error, password = false, className, type, ...props }: AuthFieldProps) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          {...props}
          id={id}
          type={password ? (visible ? 'text' : 'password') : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn('h-10 bg-black/20', password && 'pr-10', className)}
        />
        {password ? (
          <button
            type="button"
            className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
            aria-label={visible ? `隐藏${label}` : `显示${label}`}
            aria-pressed={visible}
            onClick={() => setVisible((value) => !value)}
          >
            {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          </button>
        ) : null}
      </div>
      {error ? <p id={`${id}-error`} className="text-xs text-rose-300">{error}</p> : null}
    </div>
  )
}
