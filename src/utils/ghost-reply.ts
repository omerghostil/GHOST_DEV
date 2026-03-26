import type { Channel } from '../types'

export function buildGhostReply(channel: Channel, prompt: string) {
  const sources = channel.type === 'group' ? channel.members : [channel.name]

  if (prompt.includes('מבצע')) {
    return {
      text: `זיהיתי כאן ניסוח שמתאים למבצע. פתחתי את פרטי הערוץ כדי שתוכל לשמור את "${prompt}" כמבצע עם תזמון וטריגר.`,
      sources,
    }
  }

  if (prompt.includes('חסימה') || prompt.includes('חוסם')) {
    return {
      text: `לא זוהתה חסימה מלאה ב-${channel.name}. יש תנועה תקינה, אבל כדאי להמשיך דגימה כל ${channel.memoryInterval} שניות.`,
      sources,
    }
  }

  if (prompt.includes('סכם') || prompt.includes('דקות')) {
    return {
      text: `ב-${channel.name} לא זוהתה חריגה קריטית בפרק הזמן האחרון. הפעילות עקבית עם "${channel.watchScope}".`,
      sources,
    }
  }

  return {
    text: `כרגע ${channel.name} מנטר ${channel.watchScope}. אם תרצה, אפשר להפוך את הבקשה הזו למבצע עם טריגר ותזמון קבוע.`,
    sources,
  }
}
