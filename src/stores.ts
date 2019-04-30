import { observable, computed, autorun } from "mobx"
import * as firebase from "firebase/app"
import "firebase/auth"
import * as DB from "./db"
import * as M from "./model"
import { ID, Thunk } from "./util"

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

export class SongsStore extends DB.DocsView<M.Song> {

  @observable creatingName :string = ""

  @observable editingId :string|void = undefined
  @computed get editingSong () :M.Song|void {
    if (this.editingId) {
      const song = this.items.find(s => s.ref.id == this.editingId)
      song && song.startEdit()
      return song
    }
  }

  constructor (readonly db :DB.DB) {
    super(db.userDocs("songs"), M.Song, byName)
  }

  createSong () :string {
    const ref = this.db.userDocs("songs").doc()
    const data = {name: this.creatingName, parts: []} // TODO: created timestamp?
    ref.set(data)
    this.creatingName = ""
    return ref.id
  }

  editSong (id :string) {
    this.editingId = id
  }
  commitEdit () {
    // TODO
    this.editingSong && this.editingSong.commitEdit()
    this.editingId = undefined
  }
  cancelEdit () {
    this.editingId = undefined
  }
}

//
// Top-level app

// TODO: upnext?
export type Tab = "queue" | "songs" | "drills" | "techs" | "advice" | "perfs"
export const TABS :Tab[] = [ "queue", "songs", "drills", "techs", "advice", "perfs" ]

export class AppStore {
  readonly db = new DB.DB()
  readonly snacks = new SnackStore()

  @observable user :firebase.User|null = null
  @observable tab :Tab = "queue"
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

  songs () :SongsStore {
    return this._songs ? this._songs : (this._songs = new SongsStore(this.db))
  }
  private _songs :SongsStore|void = undefined

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
