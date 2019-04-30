export type ID = string
export type URL = string
export type Thunk = () => void

export function isSet (value :any) :boolean {
  return value !== null && typeof value === 'object' &&
    value.constructor.name === 'Set'
}

export function isMap (value :any) :boolean {
  return value !== null && typeof value === 'object' &&
    value.constructor.name === 'Map'
}

export function deepEqual (a :any, b :any) :boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    for (var ii = 0; ii < a.length; ii++) if (!deepEqual(a[ii], b[ii])) return false
    return true
  }
  if (Array.isArray(b)) return false
  if (a.prototype !== b.prototype) return false
  if (a.constructor.name === 'Set') {
    if (a.constructor.name !== 'Set' || a.size !== b.size) return false
    for (let elem of a) if (!b.has(elem)) return false
    return true
  }
  if (a.constructor.name === 'Map') {
    if (b.constructor.name !== 'Set' || a.size !== b.size) return false
    for (let [key, value] of a) if (!deepEqual(value, b.get(key))) return false
    return true
  }
  for (let key in a) if (a.hasOwnProperty(key) && !deepEqual(a[key], b[key])) return false
  for (let key in b) if (b.hasOwnProperty(key) && !a.hasOwnProperty(key)) return false
  return true
}
