import { observable, computed, autorun } from "mobx"
import * as firebase from "firebase/app"
import "firebase/auth"
import * as DB from "./db"
import * as M from "./model"

export type Thunk = () => void

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
export type Tab = "songs" | "drills" | "techs" | "advice" | "perfs"
export const TABS :Tab[] = [ "songs", "drills", "techs", "advice", "perfs" ]

export class AppStore {
  readonly db = new DB.DB()
  readonly snacks = new SnackStore()

  @observable user :firebase.User|null = null
  @observable tab :Tab = "songs"
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
