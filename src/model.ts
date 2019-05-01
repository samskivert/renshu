import { IObservableValue, IObservableArray, observable, toJS } from "mobx"
import * as firebase from "firebase/app"
import "firebase/firestore"
import { ID, URL } from "./util"

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

// function splitTags (text :string) :string[] {
//   return text.split(" ").map(tag => tag.trim()).filter(tag => tag.length > 0)
// }

// class TagsProp extends Prop<string[]> {
//   syncValue :IObservableValue<string[]> = observable.box([])
//   editValue :IObservableValue<string> = observable.box("")

//   constructor (readonly name :string = "tags") { super() }

//   read (data :Data) {
//     this.syncValue.set(readProp(data, this.name) || [])
//   }
  // toUpdate (newValue :T) :Data {
  //   const upValue = (newValue === undefined || isEmptyArray(newValue)) ? DeleteValue : newValue
  //   return {[this.name]: upValue}
  // }
//   startEdit () {
//     this.editValue.set(this.value.join(" "))
//   }
//   commitEdit () {
//     const tags = this.editValue.get()
//     const newValue = tags ? splitTags(tags) : []
//     // annoyingly setting a []-valued prop to [] triggers a reaction... ugh JavaScript
//     if (!isEmptyArray(newValue) || !isEmptyArray(this.value)) this.syncValue.set(newValue)
//   }
// }

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

// Data model - Repertoire

export abstract class Piece extends Doc {
  readonly name = this.newProp<string>("name", "")
  readonly recordings = this.newProp<URL[]>("recordings", [])
  readonly kuchishoga = this.newProp<URL>("kuchishoga", "")
  readonly notes = this.newProp<string>("notes", "")
}

export type Status = "ignorance" | "learning" | "refining" | "mastering"

export type Part = {
  name :string
  status :Status
}

export class Song extends Piece {
  readonly composer = this.newProp<string>("composer", "")
  readonly parts = this.addProp(new ArrayProp<Part>("parts"))

  addPart (name :string) {
    this.parts.addToEdit({name, status: "ignorance"})
  }
}

export class Drill extends Piece {
  readonly via = this.newProp<string>("via", "")
}

export class Technique extends Piece {
  readonly via = this.newProp<string>("via", "")
}

export class Advice extends Doc {
  readonly text = this.newProp<string>("text", "")
  readonly from = this.newProp<string>("from", "")
  readonly date = this.addProp(new DateProp("date"))
}

export class Performance extends Doc {
  readonly date = this.addProp(new DateProp("date"))
  readonly location = this.newProp<string>("location", "")
  readonly songs = this.newProp<ID[]>("songs", [])
  readonly recordings = this.newProp<URL[]>("recordings", [])
  readonly notes = this.newProp<string>("notes", "")
}
