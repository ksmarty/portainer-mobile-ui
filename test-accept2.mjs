import { getSuggestions } from './src/lib/suggest.ts'
const r = getSuggestions('services:\n  web:\n    image: ${', 36, ['MY_VAR'])
console.log('items count:', r.items.length)
console.log(r.items.slice(0, 3).map(i => `${i.label} | insert=${JSON.stringify(i.insert)}`))
