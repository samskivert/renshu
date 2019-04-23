import { observable, transaction } from "mobx"
import * as firebase from "firebase/app"
import "firebase/firestore"
import * as M from "./model"

type ColRef = firebase.firestore.CollectionReference
type Data = firebase.firestore.DocumentData
type Query = firebase.firestore.Query
type Ref = firebase.firestore.DocumentReference

export class DocsView<T extends M.Doc> {
  private _unsubscribe = () => {}

  @observable pending = true
  @observable items :T[] = []

  get sortedItems () :T[] {
    const items = this.items.slice()
    items.sort(this.sortComp)
    return items
  }

  constructor (query :Query, readonly inflate :{new (ref :Ref, data :Data): T},
               readonly sortComp :(a :T, b :T) => number) {
    this._unsubscribe = query.onSnapshot(snap => transaction(() => {
      for (let change of snap.docChanges()) {
        const data = change.doc.data()
        switch (change.type) {
        case "added":
          // console.log(`Adding item @ ${change.newIndex}: ${change.doc.ref.id} :: ${JSON.stringify(data)}`)
          const item = new inflate(change.doc.ref, data)
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

  // songs () :DocsView<M.Song> {
  //   return new DocsView(this.userDocs("songs"), M.Song, byName)
  // }
  // drills () :DocsView<M.Drill> {
  //   return new DocsView(this.userDocs("drills"), M.Drill, byName)
  // }
  // techniques () :DocsView<M.Technique> {
  //   return new DocsView(this.userDocs("techniques"), M.Technique, byName)
  // }
  // advice () :DocsView<M.Advice> {
  //   return new DocsView(this.userDocs("advice"), M.Advice,
  //                       (a, b) => compareDates(a.date.value, b.date.value))
  // }

  userDocs (name :string) :ColRef {
    if (this.uid == "none") throw new Error(
      `Requested user collection ($name) prior to setting user.`)
    return this.db.collection("users").doc(this.uid).collection(name)
  }
}
