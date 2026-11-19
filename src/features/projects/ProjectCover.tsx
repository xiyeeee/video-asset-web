import { cn } from '@/lib/utils'

export function ProjectCover({ name, className }: { name: string; className?: string }) {
  const hue = [...name].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 360
  return (
    <div
      aria-hidden="true"
      className={cn('grid place-items-center font-semibold text-white', className)}
      style={{ backgroundImage: `linear-gradient(135deg, hsl(${hue} 62% 42%), hsl(${(hue + 36) % 360} 48% 24%))` }}
    >
      {name.trim().slice(0, 1) || '项'}
    </div>
  )
}
