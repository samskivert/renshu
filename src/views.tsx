import { IObservableValue } from "mobx"
import { observer } from "mobx-react"
import * as React from "react";
import * as UI from 'semantic-ui-react'
import * as firebase from "firebase/app"

import * as M from "./model"
import * as S from "./stores"
import { ID, Thunk, Stamp } from "./util"

type Timestamp = firebase.firestore.Timestamp
const Timestamp = firebase.firestore.Timestamp

type PopupSize = "mini" | "tiny" | "small" | "large" | "huge"

function actionIcon (name :UI.SemanticICONS, size :PopupSize, tooltip :string,
                     onClick :() => void) :JSX.Element {
  const icon = <UI.Icon size={size} name={name} link onClick={onClick} />
  return <UI.Popup content={tooltip} trigger={icon} />
}

function listActionIcon (name :UI.SemanticICONS, size :PopupSize, tooltip :string,
                         onClick :() => void) :JSX.Element {
  const icon = <UI.List.Icon size={size} name={name} verticalAlign="middle" link
                             onClick={onClick} style={{ paddingLeft: 5 }} />
  return <UI.Popup key={name} content={tooltip} trigger={icon} />
}

function listLinkIcon (name :UI.SemanticICONS, tooltip :string,
                       url :string|void) :JSX.Element|void {
  return url ? listActionIcon(name, "large", tooltip, () => window.open(url)) : undefined
}

function formatStamp (when :Timestamp) :string {
  const now = Date.now(), then = when.toMillis()
  const elapsed = now - then
  const Minute = 60*1000, Hour = 60*Minute, Day = 24*Hour
  if (elapsed < Minute) return "Just now!"
  if (elapsed < 15*Minute) return "A few minutes ago"
  if (elapsed < 45*Minute) return "About half an hour ago"
  if (elapsed < 90*Minute) return "About an hour ago"
  if (elapsed < 5*Hour) return "A few hours ago"
  const dt1 = new Date(now), d1 = dt1.getDate()
  const dt2 = new Date(then), y2 = dt2.getFullYear(), m2 = dt2.getMonth(), d2  = dt2.getDate()
  if (elapsed < 24*Hour && d1 == d2) return "Today"
  if (then >= new Date(y2, m2, d1-1).getMilliseconds()) return "Yesterday"
  if (elapsed < 7*Day) return "A few days ago"
  if (elapsed < 4*7*Day) return "Weeks ago"
  if (elapsed < 4*30*Day) return "Months ago"
  return "Ages ago"
}

function editString (value :IObservableValue<string>) :JSX.Element {
  return (<UI.Input onChange={ev => value.set(ev.currentTarget.value)}>
            <input value={value.get()} />
          </UI.Input>)
}

function iconEditString (icon :UI.SemanticICONS, value :IObservableValue<string>) :JSX.Element {
  return (<UI.Input icon iconPosition="left" onChange={ev => value.set(ev.currentTarget.value)}>
            <input value={value.get()} />
            <UI.Icon name={icon} />
          </UI.Input>)
}

function editStamp (value :IObservableValue<Stamp>) :JSX.Element {
  return (<UI.Input type="date" onChange={ev => value.set(ev.currentTarget.value)}>
            <input value={value.get()} />
          </UI.Input>)
}

function addToPracticeQueue (store :S.AppStore, type :M.RType, id :ID, part :string|void,
                             name :string, practices :number, lastPracticed :Timestamp|void) {
  const undo = store.queue().add(type, id, part, name, practices, lastPracticed)
  if (typeof undo === "string") store.snacks.showFeedback(undo)
  else store.snacks.showFeedback(`Added "${name}" to practice queue.`, undo)
}

function newEntryInput (placeholder :string, value :IObservableValue<string>, create :Thunk) {
  return (
    <UI.Input placeholder={placeholder} action onChange={ev => value.set(ev.currentTarget.value)}>
      <input value={value.get()} onKeyDown={ev => { if (ev.key === "Enter") create() }} />
      <UI.Button disabled={value.get().length == 0} onClick={create}>Add</UI.Button>
    </UI.Input>)
}

// -------------------
// Practice Queue view

const SongIcon = "music"
const DrillIcon = "stopwatch"
const TechIcon = "magic"
const AdviceIcon = "bullhorn"

function ritemIcon (type :M.RType) :UI.SemanticICONS {
  switch (type) {
  case   "part": return SongIcon
  case  "drill": return DrillIcon
  case   "tech": return TechIcon
  case "advice": return AdviceIcon
  }
}

function leftPadIcon (name :UI.SemanticICONS) :JSX.Element {
  return <UI.Icon style={{ marginLeft: 10 }} name={name} size="small" />
}

function qitemView (store :S.AppStore, qitem :M.QItem) {
  const notePracticed = () => {
    const undo = store.notePractice(qitem)
    store.snacks.showFeedback(`Recorded practice of "${qitem.name}".`, undo)
  }
  const markDone = () => {
    const undo = store.queue().delete(qitem)
    store.snacks.showFeedback(`Removed "${qitem.name}" from queue.`, undo)
  }
  let descrip = `${qitem.practices}`
  if (qitem.targetPractices) descrip += ` of ${qitem.targetPractices}`
  return (<UI.List.Item key={qitem.added.toMillis()}>
    <UI.List.Icon name={ritemIcon(qitem.type)} size="large" verticalAlign="middle" />
    <UI.List.Content>
      <UI.List.Header>{qitem.name}</UI.List.Header>
      <UI.List.Description>
        <UI.Icon name="sync" size="small" /> {descrip}
        {qitem.lastPracticed && leftPadIcon("clock outline")}
        {qitem.lastPracticed && formatStamp(qitem.lastPracticed)}
      </UI.List.Description>
    </UI.List.Content>
    {listActionIcon("plus", "large", "Practiced!", notePracticed)}
    {listActionIcon("check", "large", "Done!", markDone)}
  </UI.List.Item>)
}

const LItemTimeFormat = {hour: 'numeric', minute:'2-digit'}

function litemView (store :S.AppStore, lview :S.LogView, litem :M.LItem) {
  let descrip = litem.practiced.toDate().toLocaleTimeString([], LItemTimeFormat)
  return (<UI.List.Item key={litem.practiced.toMillis()}>
    <UI.List.Icon name={ritemIcon(litem.type)} size="large" verticalAlign="middle" />
    <UI.List.Content>
      <UI.List.Header>{litem.name}</UI.List.Header>
      <UI.List.Description>{descrip}</UI.List.Description>
    </UI.List.Content>
    {listActionIcon("trash", "large", "Delete", () => {
      const undo = lview.delete(litem)
      store.snacks.showFeedback(`Removed "${litem.name}" from log.`, undo)
    })}
  </UI.List.Item>)
}

function emptyQueue () :JSX.Element {
  return <UI.List.Item>
    <UI.List.Content>
      Nothing to practice! Add songs and drills to the queue from their respective tabs.
    </UI.List.Content>
  </UI.List.Item>
}

function emptyLog () :JSX.Element {
  return <UI.List.Item>
    <UI.List.Content>
      No practices logged on this date.
    </UI.List.Content>
  </UI.List.Item>
}

function formatLogDate (date :Date) :string {
  return date.toLocaleDateString()
}

@observer
export class PracticeView extends React.Component<{store :S.AppStore}> {

  render () {
    const {store} = this.props, queue = store.queue()
    const logs = store.logs(), lview = logs.logView(logs.currentDate)

    return (
      <UI.Container>
        <UI.Header>Practice Queue</UI.Header>
        <UI.List divided relaxed>{
          queue.items.length > 0 ? queue.items.map(qi => qitemView(store, qi)) : emptyQueue()
        }</UI.List>

        <UI.Header>
          <span style={{ marginRight: 20 }}>Practice Log</span>
          {actionIcon("calendar outline", "large", "To today", () => logs.goToday())}
          {actionIcon("arrow circle left", "large", "Previous day", () => logs.rollDate(-1))}
          {formatLogDate(logs.currentDate)}
          {actionIcon("arrow circle right", "large", "Next day", () => logs.rollDate(1))}
        </UI.Header>
        <UI.List divided relaxed>{
          lview.items.length > 0 ? lview.items.map(l => litemView(store, lview, l)) : emptyLog()
        }</UI.List>
      </UI.Container>)
  }
}

// ----------
// Base views

abstract class DocsView<D extends M.Doc> extends React.Component<{store :S.AppStore}> {

  render () {
    const {store} = this.props, pstore = this.docsStore(store)

    if (pstore.editingDoc) {
      return (<UI.Container>{this.editView(store, pstore.editingDoc)}</UI.Container>)
    }

    const content = pstore.pending ? <UI.Dimmer active inverted><UI.Loader /></UI.Dimmer> :
      <UI.List divided relaxed>{
        pstore.items.length > 0 ?
          pstore.sortedItems.map(s => this.docView(store, s)) :
          <UI.List.Item><UI.List.Content>{this.emptyText}</UI.List.Content></UI.List.Item>
      }</UI.List>

    return (
      <UI.Container>
        <UI.Header>{this.capsDocNoun}</UI.Header>
        {content}
        {newEntryInput(this.newPlaceholder, pstore.creatingName, () => pstore.create())}
      </UI.Container>)
  }

  protected docView (store :S.AppStore, doc :D) :JSX.Element {
    return (
      <UI.List.Item key={doc.ref.id}>
        <UI.List.Icon name={this.docIcon} size="large" verticalAlign="middle" />
        <UI.List.Content>{this.viewContents(store, doc)}</UI.List.Content>
        {this.viewIcons(store, doc)}
        {listActionIcon("edit", "large", this.editTip,
                        () => this.docsStore(store).startEdit(doc.ref.id))}
      </UI.List.Item>
    )
  }

  protected editView (store :S.AppStore, doc :D) :JSX.Element {
    const onDelete = () => {
      const undo = this.docsStore(store).delete(doc)
      store.snacks.showFeedback(`Deleted "${doc.title}".`, undo)
    }
    const onCancel = () => this.docsStore(store).cancelEdit()
    const onSave = () => this.docsStore(store).commitEdit()
    return (
      <UI.Form>
        {this.editContents(doc)}
        <div key="delete" style={{ float: "right" }}>
          <UI.Button type="button" color="red" onClick={onDelete}>Delete</UI.Button>
        </div>
        <div key="buttons">
          <UI.Button type="button" secondary onClick={onCancel}>Cancel</UI.Button>
          <UI.Button primary onClick={onSave}>Save</UI.Button>
        </div>
      </UI.Form>)
  }

  protected get titleText () :string { return this.capsDocNoun }
  protected get emptyText () :string { return `No ${this.docNoun}s.` }
  protected get editTip () :string { return `Edit ${this.docNoun}...` }
  protected get newPlaceholder () :string { return `${this.capsDocNoun}...` }

  protected abstract get docNoun () :string
  protected abstract get docIcon () :UI.SemanticICONS
  protected get capsDocNoun () :string {
    const noun = this.docNoun
    return noun.charAt(0).toUpperCase() + noun.slice(1)
  }

  protected abstract docsStore (store :S.AppStore) :S.DocsStore<D>
  protected abstract viewContents (store :S.AppStore, doc :D) :JSX.Element[]
  protected abstract viewIcons (store :S.AppStore, doc :D) :JSX.Element[]
  protected abstract editContents (doc :D) :JSX.Element[]

}

abstract class PiecesView<P extends M.Piece> extends DocsView<P> {

  protected viewContents (store :S.AppStore, piece :P) :JSX.Element[] {
    return [<UI.Header key="header" as="h3">{piece.name.value}</UI.Header>]
  }
  protected viewIcons (store :S.AppStore, piece :P) :JSX.Element[] {
    const icon = listLinkIcon("comment", "Kuchi shoga", piece.kuchishoga.value)
    return icon ? [icon] : []
  }
}

// -----
// Songs

const statusEmoji = {
  ignorance: "🤔",
  learning: "🙂",
  refining: "😃",
  mastering: "😎"
}

const statusOptions = [
  { key: "ignorance", value: "ignorance",
    text: statusEmoji.ignorance, content: `${statusEmoji.ignorance} Not known` },
  { key: "learning", value: "learning",
    text: statusEmoji.learning, content: `${statusEmoji.learning} Learning` },
  { key: "refining", value: "refining",
    text: statusEmoji.refining, content: `${statusEmoji.refining} Refining` },
  { key: "mastering", value: "mastering",
    text: statusEmoji.mastering, content: `${statusEmoji.mastering} Mastering` },
]

function editPartView (song :M.Song, idx :number) :JSX.Element {
  const part = song.parts.editValues[idx]
  return <UI.Form.Field inline key={idx}>
    <UI.Input type="text" placeholder="Part..."
              action icon iconPosition="left"
              onChange={ ev => part.name = ev.currentTarget.value }>
      <input size={15} value={part.name} />
      <UI.Dropdown button basic value={part.status} options={statusOptions}
                   onChange={(_, data) => part.status = data.value as M.Status}/>
    </UI.Input>
    <UI.Icon inverted circular size="small" link name="close"
             onClick={() => song.parts.deleteFromEdit(idx)} />
  </UI.Form.Field>
}

@observer
export class SongsView extends PiecesView<M.Song> {
  protected docsStore (store :S.AppStore) :S.PiecesStore<M.Song> { return store.songs() }
  protected get docNoun () :string { return "song" }
  protected get docIcon () :UI.SemanticICONS { return SongIcon }

  protected viewContents (store :S.AppStore, song :M.Song) :JSX.Element[] {
    function partView (part :M.Part) :JSX.Element {
      const button = <UI.Button style={{ margin: 3 }} size="mini" onClick={() => {
        const name = `${song.name.value} - ${part.name}`
        addToPracticeQueue(store, "part", song.ref.id, part.name, name,
                           part.practices || 0 /*temp*/, part.lastPracticed)
      }}>{`${part.name} ${statusEmoji[part.status]}`}</UI.Button>
      return <UI.Popup key={part.name} content="Add to practice queue" trigger={button} />
    }
    const contents = song.parts.value.map(partView)
    if (song.composer.value) contents.unshift(
      <div key="composer"><UI.Icon name="user" size="small" />{song.composer.value}</div>)
    return super.viewContents(store, song).concat(contents)
  }

  protected editContents (doc :M.Song) :JSX.Element[] {
    return [
      <UI.Form.Group key="name">
        <UI.Form.Field>
          <label>Name</label>
          {editString(doc.name.editValue)}
        </UI.Form.Field>
        <UI.Form.Field>
          <label>Composer</label>
          {editString(doc.composer.editValue)}
        </UI.Form.Field>
      </UI.Form.Group>,
      <UI.Form.Field key="ks">
        <label>Kuchi Shoga</label>
        {iconEditString("linkify", doc.kuchishoga.editValue)}
      </UI.Form.Field>,
      <UI.Form.Group grouped key="parts">
        <label>Parts</label>
        {(doc.parts.editValues).map((_, ii) => editPartView(doc, ii))}
        <UI.Form.Field key="add">
          <UI.Button type="button" size="mini" icon="add" onClick={() => doc.addPart("?")} />
        </UI.Form.Field>
      </UI.Form.Group>
    ]
  }
}

// ------
// Drills

@observer
export class DrillsView extends PiecesView<M.Drill> {
  protected docsStore (store :S.AppStore) :S.PiecesStore<M.Drill> { return store.drills() }
  protected get docNoun () :string { return "drill" }
  protected get docIcon () :UI.SemanticICONS { return DrillIcon }

  protected viewContents (store :S.AppStore, doc :M.Drill) :JSX.Element[] {
    const contents = doc.via.value ? [
      <div key="via"><UI.Icon name="user" size="small" />{doc.via.value}</div>] : []
    return super.viewContents(store, doc).concat(contents)
  }
  protected viewIcons (store :S.AppStore, doc :M.Drill) :JSX.Element[] {
    const icons = [listActionIcon("plus", "large", "Add to practice queue", () => {
      addToPracticeQueue(store, "drill", doc.ref.id, undefined, doc.name.value,
                         doc.practices.value || 0 /*temp*/, doc.lastPracticed.value)
    })]
    // TODO: add a "log a practice" button to log practice without first adding to queue?
    // (ditto for other practicables...)
    return icons.concat(super.viewIcons(store, doc))
  }

  protected editContents (doc :M.Drill) :JSX.Element[] {
    return [
      <UI.Form.Group key="name">
        <UI.Form.Field>
          <label>Name</label>
          {editString(doc.name.editValue)}
        </UI.Form.Field>
        <UI.Form.Field>
          <label>Via</label>
          {editString(doc.via.editValue)}
        </UI.Form.Field>
      </UI.Form.Group>,
      <UI.Form.Field key="ks">
        <label>Kuchi Shoga</label>
        {iconEditString("linkify", doc.kuchishoga.editValue)}
      </UI.Form.Field>
    ]
  }
}

// ------
// Techs

@observer
export class TechsView extends PiecesView<M.Technique> {
  protected docsStore (store :S.AppStore) :S.PiecesStore<M.Technique> { return store.techs() }
  protected get docNoun () :string { return "technique" }
  protected get docIcon () :UI.SemanticICONS { return TechIcon }

  protected viewContents (store :S.AppStore, doc :M.Technique) :JSX.Element[] {
    const contents = doc.via.value ? [
      <div key="via"><UI.Icon name="user" size="small" />{doc.via.value}</div>] : []
    return super.viewContents(store, doc).concat(contents)
  }
  protected viewIcons (store :S.AppStore, doc :M.Technique) :JSX.Element[] {
    const icons = [listActionIcon("plus", "large", "Add to practice queue", () => {
      addToPracticeQueue(store, "tech", doc.ref.id, undefined, doc.name.value,
                         doc.practices.value || 0 /*temp*/, doc.lastPracticed.value)
    })]
    return icons.concat(super.viewIcons(store, doc))
  }

  protected editContents (doc :M.Technique) :JSX.Element[] {
    return [
      <UI.Form.Group key="name">
        <UI.Form.Field>
          <label>Name</label>
          {editString(doc.name.editValue)}
        </UI.Form.Field>
        <UI.Form.Field>
          <label>Via</label>
          {editString(doc.via.editValue)}
        </UI.Form.Field>
      </UI.Form.Group>,
      <UI.Form.Field key="ks">
        <label>Kuchi Shoga</label>
        {iconEditString("linkify", doc.kuchishoga.editValue)}
      </UI.Form.Field>
    ]
  }
}

// ------
// Advice

@observer
export class AdviceView extends DocsView<M.Advice> {
  protected docsStore (store :S.AppStore) :S.DocsStore<M.Advice> { return store.advice() }
  protected get docNoun () :string { return "advice" }
  protected get docIcon () :UI.SemanticICONS { return AdviceIcon }
  protected get emptyText () :string { return `No ${this.docNoun}.` }

  protected viewContents (store :S.AppStore, doc :M.Advice) :JSX.Element[] {
    const elems = [<UI.Header key="header" as="h4">{doc.text.value}</UI.Header>]
    if (doc.from.value && doc.song.value) elems.push(
      <div key="via">
        <UI.Icon name="user" size="small" />{doc.from.value}
        {leftPadIcon("music")}{doc.song.value}
      </div>)
    else if (doc.from.value) elems.push(<div key="via">from {doc.from.value}</div>)
    else if (doc.song.value) elems.push(<div key="via">re: <em>{doc.song.value}</em></div>)
    return elems
  }
  protected viewIcons (store :S.AppStore, doc :M.Advice) :JSX.Element[] {
    return [listActionIcon("plus", "large", "Add to practice queue", () => {
      const name = doc.song.value ? `${doc.song.value} - ${doc.text.value}` : doc.text.value
      addToPracticeQueue(store, "advice", doc.ref.id, undefined, name,
                         doc.practices.value || 0 /*temp*/, doc.lastPracticed.value)
    })]
  }

  protected editContents (doc :M.Advice) :JSX.Element[] {
    return [
      <UI.Form.Field key="text">
        <label>Advice</label>
        {editString(doc.text.editValue)}
      </UI.Form.Field>,
      <UI.Form.Group key="from">
        <UI.Form.Field>
          <label>From</label>
          {editString(doc.from.editValue)}
        </UI.Form.Field>
        <UI.Form.Field>
          <label>Song</label>
          {editString(doc.song.editValue)}
        </UI.Form.Field>
      <UI.Form.Field>
        <label>Date</label>
        {editStamp(doc.date.editValue)}
      </UI.Form.Field>
      </UI.Form.Group>
    ]
  }
}
