import { observable, computed, autorun } from "mobx"
import * as firebase from "firebase/app"
import "firebase/auth"
import * as DB from "./db"
import * as M from "./model"
import { ID, Thunk } from "./util"

type Data = firebase.firestore.DocumentData
type Ref = firebase.firestore.DocumentReference
type Timestamp = firebase.firestore.Timestamp
const Timestamp = firebase.firestore.Timestamp

//
// View model for feedback (snack) popups

type Snaction = {message :string, undo :Thunk|void}

export class SnackStore {
  @observable showing = false
  @observable current :Snaction = {message: "", undo: undefined}
  readonly queue :Snaction[] = []

  showFeedback (message :string, undo :Thunk|void = undefined) {
    this.queue.push({message, undo})
    // if we're currently showing when a message comes in, clear that message immediately;
    // once it's transitioned off screen, we'll show the next message
    if (this.showing) this.showing = false
    else this.showNext()
  }

  showNext () {
    const next = this.queue.shift()
    if (next) {
      this.current = next
      this.showing = true
    }
  }
}

//
// Component stores

function byName<T extends M.Piece> (a :T, b :T) {
  return a.name.value.localeCompare(b.name.value)
}
// function compareDates (a :Date, b :Date) {
//   return a == b ? 0 : (a < b ? -1 : 1)
// }

function compareStamps (a :Timestamp, b :Timestamp) :number {
  const ams = a.toMillis(), bms = b.toMillis()
  return ams < bms ? -1 : (ams === bms ? 0 : 1)
}

export class PracticeQueueStore extends DB.MapView<M.QItem> {

  @computed get items () :M.QItem[] {
    let items = Array.from(this.data.values())
    items.sort((a, b) => compareStamps(a.added, b.added))
    return items
  }

  constructor (readonly db :DB.DB) {
    super(db.userDocs("queues").doc("practice"))
  }

  add (type :M.RType, id :ID, part :string|void, name :string, targetPractices = 0) :Thunk|string {
    // TODO: this relies on the practice queue having already been resolved...
    for (let item of this.items) {
      if (item.type === type && item.id === id && item.part === part) {
        return `${name} is already on practice queue.`
      }
    }
    let added = Timestamp.now()
    let item :M.QItem = {type, id, name, added, practices: 0}
    if (part) item.part = part
    if (targetPractices > 0) item.targetPractices = targetPractices
    const key = `${added.toMillis()}`
    this.data.set(key, item)
    return () => { this.data.delete(key) } // undo thunk
  }

  notePractice (item :M.QItem) :Thunk {
    const key = `${item.added.toMillis()}`
    this.data.set(key, {...item, practices: item.practices+1, lastPracticed: Timestamp.now()})
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

class LogView extends DB.MapView<M.LItem> {

  @computed get items () :M.LItem[] {
    let items = Array.from(this.data.values())
    items.sort((a, b) => compareStamps(a.practiced, b.practiced))
    return items
  }

  constructor (readonly db :DB.DB, key :string) {
    super(db.userDocs("logs").doc(key))
  }
}

function toLogItem (qitem :M.QItem, practiced :Timestamp) :M.LItem {
  const {type, id, part, name} = qitem
  const litem :M.LItem = {type, id, name, practiced}
  if (part) litem.part = part
  return litem
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

  notePractice (item :M.QItem) :Thunk {
    const view = this.logView(new Date())
    const practiced = Timestamp.now()
    const lkey = `${practiced.toMillis()}`
    view.whenReady(() => view.data.set(lkey, toLogItem(item, practiced)))
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

export abstract class PieceStore<P extends M.Piece> extends DB.DocsView<P> {

  constructor (readonly db :DB.DB, readonly coll :string) {
    super(db.userDocs(coll), byName)
  }

  creatingName = observable.box("")

  async createPiece () {
    const ref = this.db.userDocs(this.coll).doc()
    const data = this.newPieceData(this.creatingName.get())
    // TODO: add created timestamp?
    await ref.set(data)
    this.creatingName.set("")
    this.editingId = ref.id
  }

  @observable editingId :string|void = undefined
  @computed get editingPiece () :P|void {
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
    this.editingPiece && this.editingPiece.commitEdit()
    this.editingId = undefined
  }
  cancelEdit () {
    this.editingId = undefined
  }

  protected abstract newPieceData (name :string) :Object
}

export class SongsStore extends PieceStore<M.Song> {
  constructor (readonly db :DB.DB) { super(db, "songs") }
  protected inflate (ref :Ref, data :Data) :M.Song { return new M.Song(ref, data) }
  protected newPieceData (name :string) :Object { return {name, parts: []} }
}

export class DrillsStore extends PieceStore<M.Drill> {
  constructor (readonly db :DB.DB) { super(db, "drills") }
  protected inflate (ref :Ref, data :Data) :M.Drill { return new M.Drill(ref, data) }
  protected newPieceData (name :string) :Object { return {name} }
}

export class TechsStore extends PieceStore<M.Technique> {
  constructor (readonly db :DB.DB) { super(db, "techs") }
  protected inflate (ref :Ref, data :Data) :M.Technique { return new M.Technique(ref, data) }
  protected newPieceData (name :string) :Object { return {name} }
}

//
// Top-level app

// TODO: upnext?
export type Tab = "practice" | "songs" | "drills" | "techs" | "advice" | "perfs"
export const TABS :Tab[] = [ "practice", "songs", "drills", "techs", "advice", "perfs" ]

export class AppStore {
  readonly db = new DB.DB()
  readonly snacks = new SnackStore()

  @observable user :firebase.User|null = null
  @observable tab :Tab = "practice"
  // TODO: persist pinned to browser local storage
  @observable pinned :Tab[] = []
  @observable showLogoff = false

  constructor () {
    firebase.auth().onAuthStateChanged(user => {
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
