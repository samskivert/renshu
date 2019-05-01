export type ID = string
export type URL = string
export type Thunk = () => void

//
// Object stuff

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

//
// Date stuff

const pad = (value :number) => (value < 10) ? `0${value}` : `${value}`

// a date-stamp: yyyy-mm-dd
export type Stamp = string

export function toStamp (date :Date) :Stamp {
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
}

const stampRE = /^([0-9]+)-([0-9]+)-([0-9]+)$/

export function fromStamp (stamp :Stamp) :Date {
  let comps = stampRE.exec(stamp)
  if (comps && comps.length === 4) {
    let year = parseInt(comps[1])
    let month = parseInt(comps[2])-1
    let day = parseInt(comps[3])
    return new Date(year, month, day)
  }
  console.warn(`Invalid date stamp: '${stamp}'`)
  return new Date(stamp) // fallback!
}

const dateFmtOpts = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
export function formatDate (date :Stamp) :string {
  const locale = "en-US" // TODO: use browser locale?
  return fromStamp(date).toLocaleDateString(locale, dateFmtOpts)
}
