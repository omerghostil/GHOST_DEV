export function getCurrentTime() {
  return new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())
}

export function getMinutesSinceTimeLabel(timeLabel: string) {
  const [hoursRaw, minutesRaw] = timeLabel.split(':')
  const hours = Number(hoursRaw)
  const minutes = Number(minutesRaw)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 0
  }

  const now = new Date()
  const candidate = new Date(now)
  candidate.setHours(hours, minutes, 0, 0)

  if (candidate.getTime() > now.getTime()) {
    candidate.setDate(candidate.getDate() - 1)
  }

  return Math.max(0, Math.floor((now.getTime() - candidate.getTime()) / 60000))
}
