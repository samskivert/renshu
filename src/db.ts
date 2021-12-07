import { ObservableMap, observable, transaction } from "mobx"
import {
  CollectionReference, DocumentData, DocumentReference, Query,
  collection, deleteField, doc, getFirestore, onSnapshot, setDoc, updateDoc
} from "firebase/firestore"
import * as M from "./model"
import { ErrorSink, Thunk, deepEqual } from "./util"

type ColRef = CollectionReference
type Data = DocumentData
type Ref = DocumentReference

class DeferredActions {
  private _ready = false
  private _onReady :Thunk[] = []

  noteReady () {
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
  }

  whenReady (thunk :Thunk) {
    if (this._ready) thunk()
    else this._onReady.push(thunk)
  }
}

export abstract class DocsView<T extends M.Doc> {
  private _unsubscribe = () => {}
  private _deferred = new DeferredActions()

  @observable pending = true
  @observable items :T[] = []

  get sortedItems () :T[] {
    const items = this.items.slice()
    items.sort(this.sortComp)
    return items
  }

  constructor (query :Query, readonly sortComp :(a :T, b :T) => number) {
    this._unsubscribe = onSnapshot(query, snap => transaction(() => {
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
      this._deferred.noteReady()
      this.pending = false
    }))
  }

  whenReady (thunk :Thunk) {
    this._deferred.whenReady(thunk)
  }

  close () {
    this._unsubscribe()
  }

  protected abstract inflate (ref :Ref, data :Data) :T
}

export class MapView<T> {
  private _unsubscribe = () => {}
  private _updating = false
  private _deferred = new DeferredActions()

  data :ObservableMap<string,T> = observable.map()

  constructor (readonly db :DB, readonly ref :Ref) {
    onSnapshot(ref, doc => {
      const ndata = doc.data()
      // if the document does not yet exist, create it
      if (!ndata) setDoc(ref, {})
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
        this._deferred.noteReady()
      })
    })
    this.data.observe(event => {
      // if we're mirroring remote changes to our local proxy,
      // we don't want to turn around and sync those back to the server
      if (this._updating) return
      switch (event.type) {
      case "add":
      case "update":
        updateDoc(this.ref, {[event.name]: event.newValue}).catch(this.db.errors.onError)
        break
      case "delete":
        updateDoc(this.ref, {[event.name]: deleteField()}).catch(this.db.errors.onError)
        break
      }
    })
  }

  whenReady (thunk :Thunk) {
    this._deferred.whenReady(thunk)
  }

  close () {
    this._unsubscribe()
  }

  protected equal (oval :any, nval :any) :boolean {
    return deepEqual(oval, nval)
  }
}

export class DB {
  db = getFirestore()
  uid :string = "none"

  constructor (readonly errors :ErrorSink) {
    // this.db.enablePersistence().catch(error => {
    //   console.warn(`Failed to enable offline mode: ${error}`)
    // })
  }

  setUserId (uid :string) {
    this.uid = uid
  }

  userDocs (name :string) :ColRef {
    if (this.uid == "none") throw new Error(
      `Requested user collection ($name) prior to setting user.`)
    return collection(doc(collection(this.db, "users"), this.uid), name)
  }
}
