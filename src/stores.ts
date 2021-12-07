import { observable, computed, autorun } from "mobx"
import {getAuth, User} from "firebase/auth"
import {
  DocumentData, DocumentReference, Timestamp, doc, setDoc, deleteDoc
} from "firebase/firestore"
import * as DB from "./db"
import * as M from "./model"
import { Thunk, parseDateTime, toStamp } from "./util"

type Data = DocumentData
type Ref = DocumentReference

//
// View model for feedback (snack) popups

type Snakind = "feedback" | "error"
type Snaction = {message :string, kind :Snakind, undo :Thunk|void}

export class SnackStore {
  @observable showing = false
  @observable current :Snaction = {message: "", kind: "feedback", undo: undefined}
  readonly queue :Snaction[] = []

  showFeedback (message :string, undo :Thunk|void = undefined) {
    this.queue.push({message, kind: "feedback", undo})
    if (!this.showing) this.showNext()
  }

  showError (message :string) {
    this.queue.push({message, kind: "error", undo: undefined})
    if (!this.showing) this.showNext()
  }

  showNext () {
    // if we're currently showing a message, hide it; when the hide completes, showNext will be
    // called again and we'll show the next message on the queue
    if (this.showing) this.showing = false
    else {
      const next = this.queue.shift()
      if (next) {
        this.current = next
        this.showing = true
      }
    }
  }
}

//
// Component stores

function compareStamps (a :Timestamp, b :Timestamp) :number {
  const ams = a.toMillis(), bms = b.toMillis()
  return ams < bms ? -1 : (ams === bms ? 0 : 1)
}

export class PracticeQueueStore extends DB.MapView<M.QItem> {

  @computed get items () :M.QItem[] {
    let items = Array.from(this.data.values())
    items.sort((a, b) => a.name.localeCompare(b.name))
    return items
  }

  constructor (readonly db :DB.DB) {
    super(db, doc(db.userDocs("queues"), "practice"))
  }

  add (ritem :M.RItem, practices :number, lastPracticed :Timestamp|void,
       targetPractices = 0) :Thunk|string {
    // TODO: this relies on the practice queue having already been resolved...
    for (let item of this.items) {
      if (item.type === ritem.type && item.id === ritem.id && item.part === ritem.part) {
        return `${ritem.name} is already on practice queue.`
      }
    }
    let added = Timestamp.now()
    let qitem :M.QItem = {added, practices, ...ritem}
    if (lastPracticed) qitem.lastPracticed = lastPracticed
    if (targetPractices > 0) qitem.targetPractices = targetPractices
    const key = `${added.toMillis()}`
    this.data.set(key, qitem)
    return () => { this.data.delete(key) } // undo thunk
  }

  notePractice (item :M.QItem, when :Timestamp) :Thunk {
    const key = `${item.added.toMillis()}`
    this.data.set(key, {...item, practices: item.practices+1, lastPracticed: when})
    return () => { this.data.set(key, item) }
  }

  delete (item :M.QItem) :Thunk {
    const key = `${item.added.toMillis()}`
    this.data.delete(key)
    return () => { this.data.set(key, item) } // undo thunk
  }
}

const pad = (value :number) => (value < 10) ? `0${value}` : `${value}`

function dateKey (date :Date) {
  const y = date.getFullYear(), m = date.getMonth()+1, d = date.getDate()
  return `${y}${pad(m)}${pad(d)}`
}

export class LogView extends DB.MapView<M.LItem> {

  @computed get items () :M.LItem[] {
    let items = Array.from(this.data.values())
    items.sort((a, b) => compareStamps(a.practiced, b.practiced))
    return items
  }

  constructor (readonly db :DB.DB, key :string) {
    super(db, doc(db.userDocs("logs"), key))
  }

  hasPractice (item :M.RItem) :boolean {
    for (const li of this.data.values()) {
      if (li.id === item.id && li.part === item.part) return true
    }
    return false
  }

  delete (item :M.LItem) :Thunk {
    const key = `${item.practiced.toMillis()}`
    this.data.delete(key)
    return () => { this.data.set(key, item) } // undo thunk
  }
}

export class PracticeLogsStore {
  private _logs :Map<string, LogView> = new Map()

  @observable currentDate :Date = new Date()
  @observable pickingDate :Date|void = undefined

  constructor (readonly db :DB.DB) {}

  logView (date :Date) {
    const key = dateKey(date)
    let view = this._logs.get(key)
    if (!view) this._logs.set(key, view = new LogView(this.db, key))
    return view
  }

  notePractice (item :M.LItem, when :Timestamp) :Thunk {
    const view = this.logView(when.toDate())
    const lkey = `${when.toMillis()}`
    view.whenReady(() => view.data.set(lkey, item))
    return () => { view.whenReady(() => view.data.delete(lkey)) }
  }

  setDate (date :Date) {
    const nkey = dateKey(date), okey = dateKey(this.currentDate)
    if (nkey !== okey) {
      this.currentDate = date
    }
  }

  async rollDate (days :number) {
    let date = new Date(this.currentDate)
    date.setDate(date.getDate() + days)
    // this.pickingDate = undefined // also clear picking date
    return this.setDate(date)
  }
  async goToday () {
    this.setDate(new Date())
  }

  startPick () {
    this.pickingDate = this.currentDate
  }
  updatePick (stamp :Date|void) {
    if (stamp) {
      this.pickingDate = stamp
      this.setDate(stamp)
    }
  }
  commitPick () {
    this.pickingDate = undefined
  }
}

export abstract class DocsStore<P extends M.Doc> extends DB.DocsView<P> {

  constructor (readonly db :DB.DB, readonly coll :string, sortComp :(a :P, b :P) => number) {
    super(db.userDocs(coll), sortComp)
  }

  creatingName = observable.box("")

  async create () {
    const ref = doc(this.db.userDocs(this.coll))
    const data = this.createData(this.creatingName.get())
    // TODO: add created timestamp?
    await setDoc(ref, data)
    this.creatingName.set("")
    this.editingId = ref.id
  }

  delete (doc :P) :Thunk {
    const oldData = doc.data
    deleteDoc(doc.ref).catch(this.db.errors.onError)
    return () => { setDoc(doc.ref, oldData).catch(this.db.errors.onError) }
  }

  protected abstract createData (name :string) :Object

  @observable editingId :string|void = undefined
  @computed get editingDoc () :P|void {
    if (this.editingId) {
      const piece = this.items.find(s => s.ref.id == this.editingId)
      piece && piece.startEdit()
      return piece
    }
  }

  startEdit (id :string) {
    this.editingId = id
  }
  commitEdit () {
    this.editingDoc && this.editingDoc.commitEdit()
    this.editingId = undefined
  }
  cancelEdit () {
    this.editingId = undefined
  }
}

// oh the tangled webs we weave...
interface PracticablesStore {
  items :M.Practicable[]
  whenReady (thunk :Thunk) :void
}

function comparePieceName<P extends M.Piece> (a :P, b :P) {
  return a.name.value.localeCompare(b.name.value)
}

export abstract class PiecesStore<P extends M.Piece> extends DocsStore<P> {
  constructor (readonly db :DB.DB, readonly coll :string) {
    super(db, coll, comparePieceName)
  }
}

export class SongsStore extends PiecesStore<M.Song> {
  constructor (readonly db :DB.DB) { super(db, "songs") }

  protected inflate (ref :Ref, data :Data) :M.Song {
    return new M.Song(ref, data, this.db.errors) }
  protected createData (name :string) :Object { return {name, parts: []} }
}

export class DrillsStore extends PiecesStore<M.Drill> {
  constructor (readonly db :DB.DB) { super(db, "drills") }
  protected inflate (ref :Ref, data :Data) :M.Drill {
    return new M.Drill(ref, data, this.db.errors) }
  protected createData (name :string) :Object { return {name} }
}

export class TechsStore extends PiecesStore<M.Technique> {
  constructor (readonly db :DB.DB) { super(db, "techs") }
  protected inflate (ref :Ref, data :Data) :M.Technique {
    return new M.Technique(ref, data, this.db.errors) }
  protected createData (name :string) :Object { return {name} }
}

export class AdviceStore extends DocsStore<M.Advice> {
  constructor (readonly db :DB.DB) {
    super(db, "advice", (a, b) => b.date.value.localeCompare(a.date.value)) }
  protected inflate (ref :Ref, data :Data) :M.Advice {
    return new M.Advice(ref, data, this.db.errors) }
  protected createData (text :string) :Object {
    return {text, date: toStamp(new Date()), practices: 0} }
}

//
// Top-level app

// TODO: upnext?
export type Tab = "practice" | "songs" | "drills" | "techs" | "advice" | "perfs" | "about"
export const TABS :Tab[] = [ "practice", "songs", "drills", "techs", "advice", "perfs", "about" ]

export class AppStore {
  readonly db = new DB.DB(this)
  readonly snacks = new SnackStore()

  @observable user :User|null = null
  @observable tab :Tab = "practice"
  // TODO: persist pinned to browser local storage
  @observable pinned :Tab[] = []
  @observable showLogoff = false

  @observable pendingLogItem :M.RItem|void = undefined
  @observable pendingLogDate = ""
  @observable pendingLogTime = ""

  constructor () {
    getAuth().onAuthStateChanged(user => {
      if (user) console.log(`User logged in: ${user.uid}`)
      else console.log('User logged out.')
      this.db.setUserId(user ? user.uid : "none")
      // if (this.stores) this.stores.close()
      // if (user) this.stores = new Stores(this.db)
      // else this.stores = null
      this.user = user
    })

    // sync "pinned" property to local storage
    const pinned = localStorage.getItem("pinned")
    if (pinned) this.pinned = pinned.split(" ").map(p => p as Tab)
    autorun(() => {
      const tabs = this.pinned
      if (tabs.length > 0) localStorage.setItem("pinned", tabs.join(" "))
      else localStorage.removeItem("pinned")
    })
  }

  onError (error :Error) {
    this.snacks.showFeedback(`${error}`)
  }

  //
  // All the stores

  queue () :PracticeQueueStore {
    return this._pqueue ? this._pqueue : (this._pqueue = new PracticeQueueStore(this.db))
  }
  private _pqueue :PracticeQueueStore|void = undefined

  logs () :PracticeLogsStore {
    return this._plogs ? this._plogs : (this._plogs = new PracticeLogsStore(this.db))
  }
  private _plogs :PracticeLogsStore|void = undefined

  songs () :SongsStore {
    return this._songs ? this._songs : (this._songs = new SongsStore(this.db))
  }
  private _songs :SongsStore|void = undefined

  drills () :DrillsStore {
    return this._drills ? this._drills : (this._drills = new DrillsStore(this.db))
  }
  private _drills :DrillsStore|void = undefined

  techs () :TechsStore {
    return this._techs ? this._techs : (this._techs = new TechsStore(this.db))
  }
  private _techs :TechsStore|void = undefined

  advice () :AdviceStore {
    return this._advice ? this._advice : (this._advice = new AdviceStore(this.db))
  }
  private _advice :AdviceStore|void = undefined

  //
  // Logical actions that span multiple stores

  logQueuePractice (qitem :M.QItem, when = Timestamp.now()) :Thunk {
    const undo0 = this.queue().notePractice(qitem, when)
    const undo1 = this.logPractice(qitem, when)
    return () => { undo0() ; undo1() }
  }

  logPractice (ritem :M.RItem, when = Timestamp.now()) :Thunk {
    // TODO: update item on practice queue with last practiced time if it exists
    const litem :M.LItem = {practiced: when, ...ritem}
    const undo1 = this.logs().notePractice(litem, when)
    // this is a hack: if we note a practice and then undo it before it is applied,
    // wrong things will happen... async programming is hard
    let undo2 = () => { console.log(`Ack, thhpt! (${JSON.stringify(litem)})`) }
    const store = this.storeFor(litem.type)
    store.whenReady(() => {
      const piece = store.items.find(p => p.ref.id === litem.id)
      if (piece) undo2 = piece.notePractice(litem.part, when)
      else console.warn(`Unable to find piece for practice [${JSON.stringify(litem)}]`)
    })
    return () => { undo1(); undo2() }
  }

  startLogPracticeAt (ritem :M.RItem) {
    // we don't want to reset the pending time every time; if you log one thing at a time,
    // you should be able to log others easily at/near the same time
    if (this.pendingLogDate === "") {
      const now = new Date()
      this.pendingLogDate = toStamp(now)
      this.pendingLogTime = now.toLocaleTimeString(
        [], {hour12: false, hour: "2-digit", minute: "2-digit"})
    }
    this.pendingLogItem = ritem
  }
  commitLogPracticeAt () {
    const ritem = this.pendingLogItem
    if (ritem) {
      const when = parseDateTime(this.pendingLogDate, this.pendingLogTime)
      const undo = this.logPractice(ritem, Timestamp.fromDate(when))
      this.pendingLogItem = undefined
      this.snacks.showFeedback(
        `Recorded practice of "${ritem.name}" at ${when.toLocaleString()}.`, undo)
    }
  }
  cancelLogPracticeAt () {
    this.pendingLogItem = undefined
  }

  private storeFor (type :M.RType) :PracticablesStore {
    switch (type) {
    case   "part": return this.songs()
    case  "drill": return this.drills()
    case   "tech": return this.techs()
    case "advice": return this.advice()
    }
  }

  //
  // Pinned tabs

  isPinned (tab :Tab) :boolean { return this.pinned.includes(tab) }

  pin (tab :Tab) {
    this.pinned.unshift(tab)
    for (let rtab of TABS) {
      if (!this.isPinned(rtab)) {
        this.tab = rtab
        break
      }
    }
  }

  unpin (tab :Tab) {
    let idx = this.pinned.indexOf(tab)
    if (idx >= 0) this.pinned.splice(idx, 1)
  }
}
