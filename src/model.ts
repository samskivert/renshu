import { IObservableValue, IObservableArray, observable, toJS } from "mobx"
import * as firebase from "firebase/app"
import "firebase/firestore"
import { ID, URL, Stamp, Thunk, trunc } from "./util"

type Ref = firebase.firestore.DocumentReference
type Data = firebase.firestore.DocumentData
type Timestamp = firebase.firestore.Timestamp
const Timestamp = firebase.firestore.Timestamp
const DeleteValue = firebase.firestore.FieldValue.delete()

// function assertDefined<T> (value :T|undefined) :T {
//   if (value) return value
//   throw new Error(`Illegal undefined value`)
// }

function updateRef (ref :Ref, data :Data) {
  ref.update(data).
    // then(() => console.log(`Yay, updated ${ref.id} (with ${JSON.stringify(data)})`)).
    catch(err => console.warn(`Failed to update ${ref.id}: ${err}`))
}

function isEmptyArray (value :any) :boolean {
  return Array.isArray(value) && value.length === 0
}

abstract class Prop<T> {
  get value () :T { return this.syncValue.get() }
  abstract get name () :string
  abstract get syncValue () :IObservableValue<T>
  abstract read (data :Data) :void
  abstract toUpdate (newValue :T) :Data
  abstract startEdit () :void
  abstract commitEdit () :void
  toString () { return this.name }
}

function readProp (data :Data, prop :string) :any {
  const dotidx = prop.indexOf(".")
  if (dotidx == -1) return data[prop]
  else return readProp(data[prop.substring(0, dotidx)], prop.substring(dotidx+1))
}

function writeProp (data :Data, prop :string, value :any) {
  if (!data) console.warn(`Cannot write prop to null data [data=${data}] '${prop}'='${value}'`)
  else {
    const dotidx = prop.indexOf(".")
    if (dotidx == -1) data[prop] = value
    else writeProp(data[prop.substring(0, dotidx)], prop.substring(dotidx+1), value)
  }
}

export function projectField<T,F> (value :IObservableValue<T>, name :string) :Value<F> {
  const fvalue :IObservableValue<F> = observable.box(value[name])
  fvalue.observe(change => {
    const old = value.get()
    value.set({...old, [name]: change.newValue})
  })
  return fvalue
}

export interface Value<T> {
  get () :T
  set (value :T) :void
}

class SimpleProp<T> extends Prop<T> {
  syncValue :IObservableValue<T>
  editValue :IObservableValue<T>

  constructor (readonly name :string, defval :T) {
    super()
    this.syncValue = observable.box(defval)
    this.editValue = observable.box(defval)
  }

  read (data :Data) {
    this.syncValue.set(readProp(data, this.name))
  }
  toUpdate (newValue :T) :Data {
    const upValue = (newValue === undefined || isEmptyArray(newValue)) ? DeleteValue : newValue
    return {[this.name]: upValue}
  }

  startEdit () {
    this.editValue.set(this.value)
  }
  commitEdit () {
    this.syncValue.set(this.editValue.get())
  }
}

class ArrayProp<T> extends Prop<T[]> {
  syncValue :IObservableValue<T[]>
  editValues :IObservableArray<T>

  constructor (readonly name :string) {
    super()
    this.syncValue = observable.box([])
    this.editValues = observable.array([])
  }

  read (data :Data) {
    this.syncValue.set(readProp(data, this.name) || [])
  }
  toUpdate (newValue :T[]) :Data {
    const upValue = (newValue === undefined || isEmptyArray(newValue)) ? DeleteValue : newValue
    return {[this.name]: upValue}
  }

  startEdit () {
    this.editValues.replace(this.value)
  }
  editValue (idx :number) :Value<T> {
    const evs = this.editValues
    return {
      get() :T { return evs[idx] },
      set (value :T) :void { evs[idx] = value }
    }
  }

  addToEdit (elem :T) {
    this.editValues.push(elem)
  }
  deleteFromEdit (idx :number) {
    this.editValues.splice(idx, 1)
  }
  commitEdit () {
    this.syncValue.set(this.editValues.toJS())
  }
}

class DateProp extends SimpleProp<Date> {

  constructor (readonly name :string) { super(name, new Date()) }

  read (data :Data) {
    const stamp :Timestamp = readProp(data, this.name)
    this.syncValue.set(stamp.toDate())
  }
  toUpdate (newValue :Date) :Data {
    return {[this.name]: Timestamp.fromDate(newValue)}
  }
}

type Filter = (text :string|void) => boolean
export function makeFilter (seek :string) :Filter {
  if (seek === "") return _ => true
  else if (seek.toLowerCase() !== seek) return text => text ? text.includes(seek) : false
  else return text => text ? (text.toLowerCase().includes(seek)) : false
}

export abstract class Doc {
  protected readonly props :Prop<any>[] = []
  protected _syncing = true

  constructor (readonly ref :Ref, readonly data :Data) {}

  abstract get title () :string

  read (data :Data) {
    this._syncing = false
    this.readProps(data)
    this._syncing = true
  }

  newProp<T> (name :string, defval :T) {
    return this.addProp(new SimpleProp(name, defval))
  }

  addProp<T,P extends Prop<T>> (prop :P) :P {
    prop.syncValue.observe(change => {
      if (this._syncing) {
        const newValue = toJS(change.newValue)
        console.log(`Syncing ${prop.name} = '${newValue}'`)
        updateRef(this.ref, prop.toUpdate(newValue))
        writeProp(this.data, prop.name, newValue)
      }
    })
    this.props.push(prop)
    return prop
  }

  removeProp<T> (prop :Prop<T>) {
    const idx = this.props.indexOf(prop)
    if (idx >= 0) this.props.splice(idx, 1)
  }

  startEdit () {
    for (let prop of this.props) prop.startEdit()
  }
  commitEdit () {
    for (let prop of this.props) prop.commitEdit()
  }

  protected readProps (data :Data) {
    for (let prop of this.props) try { prop.read(data) } catch (error) {
      console.warn(`Failed to read prop: ${prop} from ${JSON.stringify(data)}`)
      console.warn(error)
    }
  }
}

// Data model - Practice Queue & Log

export type RType = "part" | "drill" | "tech" | "advice"

export interface RItem {
  type :RType
  id :ID
  part? :string
  name :string
}

export interface QItem extends RItem {
  added :Timestamp
  practices :number
  targetPractices? :number
  lastPracticed? :Timestamp
}

export interface LItem extends RItem {
  practiced :Timestamp
}

export interface Practicable {
  type :RType
  ref :Ref
  getName (part :string|void) :string
  getPractices (part :string|void) :number
  getLastPracticed (part :string|void) :Timestamp|void
  notePractice (part :string|void, when :Timestamp) :Thunk
}

// Data model - Repertoire

function notePractice (practices :IObservableValue<number>,
                       lastPracticed :IObservableValue<Timestamp|void>,
                       when :Timestamp) :Thunk {
  const oldCount = practices.get() || 0 // TEMP: handle bogus data
  const oldLast = lastPracticed.get()
  practices.set(oldCount + 1)
  lastPracticed.set(when)
  return () => {
    practices.set(oldCount)
    lastPracticed.set(oldLast)
  }
}

export abstract class Piece extends Doc implements Practicable {
  readonly name = this.newProp<string>("name", "")
  readonly recordings = this.addProp(new ArrayProp<URL>("recordings"))
  readonly kuchishoga = this.newProp<URL>("kuchishoga", "")
  readonly notes = this.newProp<string>("notes", "")
  readonly practices = this.newProp<number>("practices", 0)
  readonly lastPracticed = this.newProp<Timestamp|void>("lastPracticed", undefined)

  abstract get type () :RType
  get title () :string { return this.name.value }

  getName (part :string|void) { return part ? `${this.name.value} - ${part}` : this.name.value }
  getPractices (part :string|void) { return this.practices.value || 0 /*temp*/ }
  getLastPracticed (part :string|void) { return this.lastPracticed.value }
  notePractice (part :string|void, when :Timestamp) :Thunk {
    // only songs have parts and song overrides notePractice, so we should never see a part here
    if (part) console.warn(`Got unexpected part in practice [piece=${this.ref.id}, part=${part}]`)
    return notePractice(this.practices.syncValue, this.lastPracticed.syncValue, when)
  }
}

export type Status = "ignorance" | "learning" | "refining" | "mastering"

export type Part = {
  name :string
  status :Status
  practices :number
  lastPracticed? :Timestamp
}

export class Song extends Piece {
  readonly composer = this.newProp<string>("composer", "")
  readonly parts = this.addProp(new ArrayProp<Part>("parts"))

  get type () :RType { return "part" }
  addPart (name :string) {
    this.parts.addToEdit({name, status: "ignorance", practices: 0})
  }

  getPractices (pname :string|void) {
    const part = this.getPart(pname)
    return part ? part.practices : 0
  }
  getLastPracticed (pname :string|void) {
    const part = this.getPart(pname)
    return part && part.lastPracticed
  }
  notePractice (pname :string|void, when :Timestamp) :Thunk {
    const pidx = this.parts.value.findIndex(p => p.name == pname)
    if (pidx < 0) {
      console.warn(`Unable to find part for practice? [song=${this.ref.id}, item=${pname}]`)
      return () => {}
    }
    const part = this.parts.value[pidx]
    const oparts = this.parts.value
    const nparts = this.parts.value.slice(0)
    nparts[pidx] = {...part, practices: part.practices+1, lastPracticed: when}
    this.parts.syncValue.set(nparts)
    return () => { this.parts.syncValue.set(oparts) }
  }

  private getPart (pname :string|void) :Part|void {
    return this.parts.value.find(p => p.name == pname)
  }
}

export class Drill extends Piece {
  readonly via = this.newProp<string>("via", "")
  get type () :RType { return "drill" }
}

export class Technique extends Piece {
  readonly via = this.newProp<string>("via", "")
  get type () :RType { return "tech" }
}

export class Advice extends Doc implements Practicable {
  readonly text = this.newProp<string>("text", "")
  readonly from = this.newProp<string>("from", "")
  readonly song = this.newProp<string>("song", "")
  readonly date = this.newProp<Stamp>("date", "")
  readonly practices = this.newProp<number>("practices", 0)
  readonly lastPracticed = this.newProp<Timestamp|void>("lastPracticed", undefined)

  get type () :RType { return "advice" }
  get title () :string { return trunc(this.text.value, 30) }

  getName (part :string|void) {
    return this.song.value ? `${this.song.value} - ${this.text.value}` : this.text.value
  }
  getPractices (part :string|void) { return this.practices.value || 0 /*temp*/ }
  getLastPracticed (part :string|void) { return this.lastPracticed.value }
  notePractice (part :string|void, when :Timestamp) :Thunk {
    // only songs have parts and song overrides notePractice, so we should never see a part here
    if (part) console.warn(`Got unexpected part in practice [piece=${this.ref.id}, part=${part}]`)
    return notePractice(this.practices.syncValue, this.lastPracticed.syncValue, when)
  }
}

export class Performance extends Doc {
  readonly date = this.addProp(new DateProp("date"))
  readonly location = this.newProp<string>("location", "")
  readonly songs = this.addProp(new ArrayProp<ID>("songs"))
  readonly recordings = this.addProp(new ArrayProp<URL>("recordings"))
  readonly notes = this.newProp<string>("notes", "")

  get title () :string { return `Performance on ${this.date.value.toLocaleDateString()}` }
}
