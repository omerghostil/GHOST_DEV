import { describe, expect, it } from 'vitest'
import { isComplexTrigger, selectVisionDetailLevel, selectVisionModel } from './model-selector'

describe('model-selector', () => {
  it('מזהה טריגר מורכב לפי מילות מפתח', () => {
    expect(isComplexTrigger('זהה אנשים ורכבים חשודים בכניסה')).toBe(true)
    expect(isComplexTrigger('בדוק אם השער פתוח')).toBe(false)
  })

  it('בוחר מודל חזק למשימת scan מורכבת', () => {
    const model = selectVisionModel({
      task: 'scan',
      triggerText: 'detect objects and count vehicles',
    })
    expect(model).toBe('gpt-4.1')
  })

  it('מכבד modelOverride גם אם הטריגר פשוט', () => {
    const model = selectVisionModel({
      task: 'scan',
      triggerText: 'בדיקה פשוטה',
      modelOverride: 'gpt-4.1-mini',
    })
    expect(model).toBe('gpt-4.1-mini')
  })

  it('בוחר רמת detail חסכונית לסריקה פשוטה', () => {
    expect(selectVisionDetailLevel({ task: 'scan', triggerText: 'בדוק סטטוס שער' })).toBe('low')
    expect(selectVisionDetailLevel({ task: 'chat' })).toBe('high')
  })
})
