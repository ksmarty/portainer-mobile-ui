import { getSuggestions } from './src/lib/suggest.ts'

const cases = [
  ['image: ${', 9, 'after typing ${'],
  ['image: ${POST', 13, 'after typing ${POST'],
  ['    KEY: ${', 12, 'env map line with ${'],
]
for (const [text, caret, label] of cases) {
  const r = getSuggestions(text, caret, ['MY_VAR', 'POSTGRES_PASSWORD'])
  console.log(label, '->', r.items.length, 'items; filterText=', JSON.stringify(r.filterText), 'replaceFrom=', r.replaceFrom, 'first=', r.items[0]?.insert)
}
