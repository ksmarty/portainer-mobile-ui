import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getSuggestions, type Suggestion } from '../lib/suggest'

export interface CodeEditorHandle {
  insertAtCursor: (text: string) => void
  focus: () => void
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const YAML_TOKEN =
  /("[^"]*"|'[^']*')|(#[^\n]*)|([A-Za-z_][A-Za-z0-9_.-]*)(?=\s*:)|(-?\b\d+(?:\.\d+)?\b)|(\b(?:true|false|yes|no|on|off)\b)|(\bnull\b|~)/g

function highlightYaml(code: string): string {
  let esc = escapeHtml(code)
  let out = ''
  let last = 0
  YAML_TOKEN.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = YAML_TOKEN.exec(esc)) !== null) {
    out += esc.slice(last, m.index)
    const [full, str, comment, key, num, bool, nul] = m
    if (str) out += `<span class="tok-str">${str}</span>`
    else if (comment) out += `<span class="tok-comment">${comment}</span>`
    else if (key) out += `<span class="tok-key">${key}</span>`
    else if (num) out += `<span class="tok-num">${num}</span>`
    else if (bool) out += `<span class="tok-bool">${bool}</span>`
    else if (nul) out += `<span class="tok-null">${nul}</span>`
    else out += full
    last = m.index + full.length
  }
  out += esc.slice(last)
  return out
}

interface CaretPos {
  top: number
  left: number
  width: number
}

function measureCaret(container: HTMLDivElement, ta: HTMLTextAreaElement, pos: number): { top: number; left: number } | null {
  const mirror = document.createElement('div')
  const cs = getComputedStyle(ta)
  const style: Record<string, string> = {
    position: 'absolute',
    top: '0',
    left: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    tabSize: '2',
    fontFamily: cs.fontFamily,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    lineHeight: cs.lineHeight,
    paddingTop: cs.paddingTop,
    paddingRight: cs.paddingRight,
    paddingBottom: cs.paddingBottom,
    paddingLeft: cs.paddingLeft,
    width: `${ta.clientWidth}px`,
  }
  Object.assign(mirror.style, style)
  mirror.textContent = ta.value.slice(0, pos)
  const marker = document.createElement('span')
  marker.textContent = '\u200b'
  mirror.appendChild(marker)
  container.appendChild(mirror)
  const base = mirror.getBoundingClientRect()
  const mark = marker.getBoundingClientRect()
  mirror.remove()
  return {
    top: mark.top - base.top - (ta.scrollTop || 0),
    left: mark.left - base.left - (ta.scrollLeft || 0),
  }
}

export const CodeEditor = forwardRef<CodeEditorHandle, {
  value: string
  onChange: (v: string) => void
  minHeight?: number
  placeholder?: string
  extraEnv?: string[]
}>(function CodeEditor({ value, onChange, minHeight = 300, placeholder, extraEnv = [] }, ref) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const [caret, setCaret] = useState(0)
  const [active, setActive] = useState(0)
  const [hidden, setHidden] = useState(false)
  const [pos, setPos] = useState<CaretPos | null>(null)

  const html = useMemo(() => highlightYaml(value) + '\n', [value])

  const rawSug = useMemo(
    () => (hidden ? { items: [] as Suggestion[], replaceFrom: 0, filterText: '' } : getSuggestions(value, caret, extraEnv)),
    [value, caret, hidden, extraEnv],
  )

  const prefix = rawSug.filterText ?? value.slice(rawSug.replaceFrom, caret)
  const filtered = useMemo(() => {
    const p = prefix.toLowerCase()
    if (!p) return rawSug.items.slice(0, 9)
    const starts = rawSug.items.filter((i) => i.label.toLowerCase().startsWith(p))
    const rest = rawSug.items.filter((i) => !i.label.toLowerCase().startsWith(p) && i.label.toLowerCase().includes(p))
    return [...starts, ...rest].slice(0, 9)
  }, [rawSug, prefix])

  const open = filtered.length > 0

  useEffect(() => setActive(0), [filtered])

  useEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const wrap = wrapRef.current
    const ta = taRef.current
    if (!wrap || !ta) return
    const rel = measureCaret(wrap, ta, caret)
    if (!rel) {
      setPos(null)
      return
    }
    const wrapRect = wrap.getBoundingClientRect()
    const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 18
    const estH = Math.min(216, filtered.length * 30 + 10)
    const width = Math.min(300, window.innerWidth - 24)

    let top = wrapRect.top + rel.top - (ta.scrollTop || 0) + lineHeight + 4
    const left = Math.max(8, Math.min(wrapRect.left + rel.left - (ta.scrollLeft || 0), window.innerWidth - width - 8))

    if (top + estH > window.innerHeight - 10) {
      top = wrapRect.top + rel.top - (ta.scrollTop || 0) - estH - 4
      top = Math.max(8, top)
    }
    setPos({ top, left, width })
  }, [open, caret, filtered.length, value])

  const syncScroll = () => {
    if (preRef.current && taRef.current) {
      preRef.current.scrollTop = taRef.current.scrollTop
      preRef.current.scrollLeft = taRef.current.scrollLeft
    }
  }

  useImperativeHandle(ref, () => ({
    focus: () => taRef.current?.focus(),
    insertAtCursor: (text: string) => {
      const ta = taRef.current
      if (!ta) return
      const start = ta.selectionStart ?? value.length
      const next = value.slice(0, start) + text + value.slice(ta.selectionEnd ?? start)
      onChange(next)
      requestAnimationFrame(() => {
        ta.focus()
        const pos = start + text.length
        ta.setSelectionRange(pos, pos)
        setCaret(pos)
      })
    },
  }))

  const accept = (item: Suggestion) => {
    const ta = taRef.current
    if (!ta) return
    const next = value.slice(0, rawSug.replaceFrom) + item.insert + value.slice(caret)
    onChange(next)
    setHidden(true)
    requestAnimationFrame(() => {
      ta.focus()
      const pos = rawSug.replaceFrom + item.insert.length
      ta.setSelectionRange(pos, pos)
      setCaret(pos)
    })
  }

  const insertNewlineWithIndent = () => {
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart ?? value.length
    const before = value.slice(0, start)
    const lineStart = before.lastIndexOf('\n') + 1
    const line = before.slice(lineStart)
    const indent = line.match(/^\s*/)?.[0] ?? ''
    let newIndent = indent
    if (line.trim().endsWith(':')) newIndent += '  '
    const next = value.slice(0, start) + '\n' + newIndent + value.slice(start)
    onChange(next)
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + 1 + newIndent.length
      ta.setSelectionRange(pos, pos)
      setCaret(pos)
    })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((a) => (a + 1) % filtered.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => (a - 1 + filtered.length) % filtered.length)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        accept(filtered[active])
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setHidden(true)
      }
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      insertNewlineWithIndent()
    }
  }

  return (
    <div className="code-editor" style={{ minHeight }} ref={wrapRef}>
      <pre ref={preRef} className="code-editor-pre" aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />
      <textarea
        ref={taRef}
        className="code-editor-textarea"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setCaret(e.target.selectionStart)
          setHidden(false)
        }}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => setCaret(e.currentTarget.selectionStart)}
        onClick={(e) => setCaret(e.currentTarget.selectionStart)}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
        onScroll={syncScroll}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder={placeholder}
        style={{ minHeight }}
      />

      {open &&
        pos &&
        createPortal(
          <div className="editor-suggest" style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}>
            {filtered.map((item, i) => (
              <button
                key={item.label + i}
                className={`suggest-item ${i === active ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.preventDefault()
                  accept(item)
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span className="suggest-label">{item.label}</span>
                {item.hint && <span className="suggest-hint">{item.hint}</span>}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
})
