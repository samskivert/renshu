import { ObservableMap, observable, transaction } from "mobx"
import * as firebase from "firebase/app"
import "firebase/firestore"
import * as M from "./model"
import { Thunk, deepEqual } from "./util"

const DeleteValue = firebase.firestore.FieldValue.delete()

type ColRef = firebase.firestore.CollectionReference
type Data = firebase.firestore.DocumentData
type Query = firebase.firestore.Query
type Ref = firebase.firestore.DocumentReference

export abstract class DocsView<T extends M.Doc> {
  private _unsubscribe = () => {}

  @observable pending = true
  @observable items :T[] = []

  get sortedItems () :T[] {
    const items = this.items.slice()
    items.sort(this.sortComp)
    return items
  }

  constructor (query :Query, readonly sortComp :(a :T, b :T) => number) {
    this._unsubscribe = query.onSnapshot(snap => transaction(() => {
      for (let change of snap.docChanges()) {
        const data = change.doc.data()
        switch (change.type) {
        case "added":
          // console.log(`Adding item @ ${change.newIndex}: ${change.doc.ref.id} :: ${JSON.stringify(data)}`)
          const item = this.inflate(change.doc.ref, data)
          item.read(data)
          this.items.splice(change.newIndex, 0, item)
          break
        case "modified":
          // console.log(`Updating item @ ${change.newIndex}: ${change.doc.ref.id} :: ${JSON.stringify(data)}`)
          this.items[change.newIndex].read(data)
          break
        case "removed":
          // console.log(`Removing item @ ${change.oldIndex}: ${change.doc.ref.id}`)
          this.items.splice(change.oldIndex, 1)
        }
      }
      this.pending = false
    }))
  }

  close () {
    this._unsubscribe()
  }

  protected abstract inflate (ref :Ref, data :Data) :T
}

export class MapView<T> {
  private _unsubscribe = () => {}
  private _updating = false
  private _ready = false
  private _onReady :Thunk[] = []

  data :ObservableMap<string,T> = observable.map()

  constructor (readonly ref :Ref) {
    ref.onSnapshot(doc => {
      const ndata = doc.data()
      // if the document does not yet exist, create it
      if (!ndata) ref.set({})
      else transaction(() => {
        const data = this.data
        this._updating = true
        const nkeys = Object.keys(ndata)
        // remove all old elements for which we have no keys
        const nkset = new Set(nkeys)
        for (let okey of data.keys()) if (!nkset.has(okey)) data.delete(okey)
        // add/update new/changed mappings
        for (let nkey of nkeys) {
          const oval = data.get(nkey), nval = ndata[nkey]
          if (!this.equal(oval, nval)) data.set(nkey, nval)
        }
        this._updating = false
        // if we have any actions waiting on readiness, invoke them
        if (!this._ready) {
          this._ready = true
          for (const thunk of this._onReady) try {
            thunk()
          } catch (error) {
            console.warn(error)
          }
          this._onReady = []
        }
      })
    })
    this.data.observe(event => {
      // if we're mirroring remote changes to our local proxy,
      // we don't want to turn around and sync those back to the server
      if (this._updating) return
      switch (event.type) {
      case "add":
      case "update":
        this.ref.update({[event.name]: event.newValue})
        break
      case "delete":
        this.ref.update({[event.name]: DeleteValue})
        break
      }
    })
  }

  whenReady (thunk :Thunk) {
    if (this._ready) thunk()
    else this._onReady.push(thunk)
  }

  protected equal (oval :any, nval :any) :boolean {
    return deepEqual(oval, nval)
  }

  close () {
    this._unsubscribe()
  }
}

export class DB {
  db = firebase.firestore()
  uid :string = "none"

  constructor () {
    this.db.settings({})
    this.db.enablePersistence().catch(error => {
      console.warn(`Failed to enable offline mode: ${error}`)
    })
  }

  setUserId (uid :string) {
    this.uid = uid
  }

  userDocs (name :string) :ColRef {
    if (this.uid == "none") throw new Error(
      `Requested user collection ($name) prior to setting user.`)
    return this.db.collection("users").doc(this.uid).collection(name)
  }
}
