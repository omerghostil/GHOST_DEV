// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './login-page'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true

interface RenderedLoginPage {
  container: HTMLDivElement
  unmount: () => void
}

/**
 * מרנדר את קומפוננטת ההתחברות לתוך DOM בדיקות.
 */
function renderLoginPage(
  onAuthenticate: (user: string, passkey: string) => Promise<boolean> | boolean,
): RenderedLoginPage {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  act(() => {
    root.render(<LoginPage onAuthenticate={onAuthenticate} />)
  })

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

/**
 * מדמה הקלדה בשדה קלט באופן שתואם ל-react בדפדפן.
 */
function setInputValue(input: HTMLInputElement, value: string): void {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('LoginPage', () => {
  it('מציג אייקון מותג בכותרת ההתחברות', () => {
    const { container, unmount } = renderLoginPage(() => false)
    const icon = container.querySelector('img.login-brand-icon') as HTMLImageElement | null

    expect(icon).toBeTruthy()
    expect(icon?.getAttribute('src')).toBe('/ghost-icon-128.png')
    expect(icon?.getAttribute('alt')).toBe('Ghost icon')
    unmount()
  })

  it('מציג הודעת שגיאה כאשר ההתחברות נכשלת', async () => {
    const { container, unmount } = renderLoginPage(() => false)
    const form = container.querySelector('form')
    const userInput = container.querySelector('input[name="user"]') as HTMLInputElement
    const passkeyInput = container.querySelector('input[name="passkey"]') as HTMLInputElement

    expect(form).toBeTruthy()
    expect(userInput).toBeTruthy()
    expect(passkeyInput).toBeTruthy()

    act(() => {
      setInputValue(userInput, 'wrong')
      setInputValue(passkeyInput, 'wrong-pass')
    })

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    const errorElement = container.querySelector('[role="alert"]')
    expect(errorElement?.textContent).toContain('Invalid credentials')
    unmount()
  })

  it('מפעיל callback עם הפרטים שהוזנו כאשר ההתחברות מצליחה', async () => {
    const authenticateSpy = vi.fn().mockReturnValue(true)
    const { container, unmount } = renderLoginPage(authenticateSpy)
    const form = container.querySelector('form')
    const userInput = container.querySelector('input[name="user"]') as HTMLInputElement
    const passkeyInput = container.querySelector('input[name="passkey"]') as HTMLInputElement

    act(() => {
      setInputValue(userInput, 'admin')
      setInputValue(passkeyInput, 'admin8888')
    })

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    expect(authenticateSpy).toHaveBeenCalledWith('admin', 'admin8888')
    expect(authenticateSpy).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[role="alert"]')).toBeNull()
    unmount()
  })
})
