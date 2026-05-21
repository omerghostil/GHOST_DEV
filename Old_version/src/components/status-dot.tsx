import type { LiveState } from '../types'

interface StatusDotProps {
  liveState: LiveState
  className?: string
}

export function StatusDot({ liveState, className = '' }: StatusDotProps) {
  return <span className={`status-dot status-${liveState.toLowerCase()} ${className}`.trim()} />
}
