import { getSuggestions } from './src/lib/suggest.ts'

function accept(value, caret, item) {
  const r = getSuggestions(value, caret, ['MY_VAR'])
  const next = value.slice(0, r.replaceFrom) + item.insert + value.slice(caret)
  return { next, replaceFrom: r.replaceFrom, caret }
}

const cases = [
  ['services:\n  web:\n    image: ${', 36, 'typed ${ at end'],
  ['services:\n  web:\n    image: ${POS', 40, 'typed ${POS'],
  ['    - ${', 10, 'list item ${'],
]
for (const [text, caret, label] of cases) {
  const r = getSuggestions(text, caret, ['MY_VAR'])
  const item = r.items[0]
  const res = accept(text, caret, item)
  console.log(label, '->', JSON.stringify(res.next), 'replaceFrom=', r.replaceFrom, 'item.insert=', JSON.stringify(item.insert))
}
