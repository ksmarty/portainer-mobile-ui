import { getSuggestions } from './src/lib/suggest.ts'

const cases = [
  ['    image: $', 12, 'typed $'],
  ['    image: ${', 13, 'typed ${'],
  ['    image: $POS', 15, 'typed $POS'],
  ['    image: ${POS', 16, 'typed ${POS'],
  ['    password: abc$def', 22, 'mid-word $ (should NOT trigger)'],
]
for (const [text, caret, label] of cases) {
  const r = getSuggestions(text, caret, ['MY_VAR'])
  const item = r.items[0]
  const next = item ? text.slice(0, r.replaceFrom) + item.insert + text.slice(caret) : text
  console.log(label, '-> items:', r.items.length, '| result:', JSON.stringify(next))
}
