import { IObservableValue } from "mobx"
import { observer } from "mobx-react"
import * as React from "react";
import * as UI from 'semantic-ui-react'

import * as M from "./model"
import * as S from "./stores"
import { ID, Thunk } from "./util"

type Timestamp = firebase.firestore.Timestamp

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
  return <UI.Popup content={tooltip} trigger={icon} />
}

function listLinkIcon (name :UI.SemanticICONS, tooltip :string, url :string|void) :JSX.Element|void {
  return url ? listActionIcon(name, "large", tooltip, () => window.open(url)) : undefined
}

function formatStamp (when :Timestamp) :string {
  const now = Date.now(), then = when.toMillis()
  const elapsed = now - then
  const Minute = 60*1000
  if (elapsed < Minute) return "Just now!"
  if (elapsed < 15*Minute) return "a few minutes ago"
  if (elapsed < 45*Minute) return "about half an hour ago"
  if (elapsed < 90*Minute) return "about an hour ago"
  const dt1 = new Date(now), dt2 = new Date(then)
  const y1 = dt1.getFullYear(), y2 = dt2.getFullYear()
  const m1 = dt1.getMonth(),    m2 = dt2.getMonth()
  const d1 = dt1.getDate(),     d2 = dt2.getDate()
  if (y1 > y2+1) return "years ago"
  if (y1 > y2) return "last year"
  if (m1 > m2+1) return "months ago"
  if (m1 > m2) return "last month"
  if (d1 > d2+1) return `${(d2-d1)} days ago`
  if (d1 > d2) return "yesterday"
  return "today"
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

function addToPracticeQueue (store :S.AppStore, type :M.RType, id :ID, part :string|void,
                             name :string) {
  const undo = store.queue().add(type, id, part, name)
  if (typeof undo === "string") store.snacks.showFeedback(undo)
  else store.snacks.showFeedback(`Added ${name} to practice queue.`, undo)
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

function qitemView (store :S.AppStore, qitem :M.QItem) {
  let descrip = `Practices: ${qitem.practices}`
  if (qitem.targetPractices) descrip += ` of ${qitem.targetPractices}`
  if (qitem.lastPracticed) descrip += ` – Last: ${formatStamp(qitem.lastPracticed)}`
  return (<UI.List.Item key={qitem.added.toMillis()}>
    <UI.List.Icon name={ritemIcon(qitem.type)} size="large" verticalAlign="middle" />
    <UI.List.Content>
      <UI.List.Header>{qitem.name}</UI.List.Header>
      <UI.List.Description>{descrip}</UI.List.Description>
    </UI.List.Content>
    {listActionIcon("plus", "large", "Practiced!", () => {
      const undo = store.queue().notePractice(qitem)
      store.logs().notePractice(qitem)
      // TODO: increment practice counter on source item?
      store.snacks.showFeedback(`Recorded practice of ${qitem.name}.`, undo)
    })}
    {listActionIcon("check", "large", "Done!", () => {})}
  </UI.List.Item>)
}

const LItemTimeFormat = {hour: 'numeric', minute:'2-digit'}

function litemView (litem :M.LItem) {
  let descrip = litem.practiced.toDate().toLocaleTimeString([], LItemTimeFormat)
  return (<UI.List.Item key={litem.practiced.toMillis()}>
    <UI.List.Icon name={ritemIcon(litem.type)} size="large" verticalAlign="middle" />
    <UI.List.Content>
      <UI.List.Header>{litem.name}</UI.List.Header>
      <UI.List.Description>{descrip}</UI.List.Description>
    </UI.List.Content>
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
          lview.items.length > 0 ? lview.items.map(litemView) : emptyLog()
        }</UI.List>
      </UI.Container>)
  }
}

// ---------------------
// Base views for pieces

abstract class PiecesView<P extends M.Piece> extends React.Component<{store :S.AppStore}> {

  render () {
    const {store} = this.props, pstore = this.pieceStore(store)

    if (pstore.editingPiece) {
      return (<UI.Container>{this.editView(store, pstore.editingPiece)}</UI.Container>)
    }

    const content = pstore.pending ? <UI.Dimmer active inverted><UI.Loader /></UI.Dimmer> :
      <UI.List divided relaxed>{
        pstore.items.length > 0 ?
          pstore.sortedItems.map(s => this.pieceView(store, s)) :
          <UI.List.Item><UI.List.Content>{this.emptyText}</UI.List.Content></UI.List.Item>
      }</UI.List>

    return (
      <UI.Container>
        <UI.Header>{this.capsPieceNoun}</UI.Header>
        {content}
        {newEntryInput(this.newPlaceholder, pstore.creatingName, () => pstore.createPiece())}
      </UI.Container>)
  }

  protected pieceView (store :S.AppStore, piece :P) :JSX.Element {
    return (
      <UI.List.Item key={piece.ref.id}>
        <UI.List.Icon name={this.pieceIcon} size="large" verticalAlign="middle" />
        <UI.List.Content>
          <UI.Header key="header" as="h3">{piece.name.value}</UI.Header>
          {this.viewContents(store, piece)}
        </UI.List.Content>
        {listLinkIcon("comment", "Kuchi shoga", piece.kuchishoga.value)}
        {listActionIcon("edit", "large", this.editTip,
                        () => this.pieceStore(store).startEdit(piece.ref.id))}
      </UI.List.Item>
    )
  }

  protected editView (store :S.AppStore, piece :P) :JSX.Element {
    const onCancel = () => this.pieceStore(store).cancelEdit()
    const onSave = () => this.pieceStore(store).commitEdit()
    return (
      <UI.Form>
        {this.editContents(piece)}
        <div key="buttons">
          <UI.Button type="button" secondary onClick={onCancel}>Cancel</UI.Button>
          <UI.Button primary onClick={onSave}>Save</UI.Button>
        </div>
      </UI.Form>)
  }

  protected get titleText () :string { return this.capsPieceNoun }
  protected get emptyText () :string { return `No ${this.pieceNoun}s.` }
  protected get editTip () :string { return `Edit ${this.pieceNoun}...` }
  protected get newPlaceholder () :string { return `${this.capsPieceNoun}...` }

  protected abstract get pieceNoun () :string
  protected abstract get pieceIcon () :UI.SemanticICONS
  protected get capsPieceNoun () :string {
    const noun = this.pieceNoun
    return noun.charAt(0).toUpperCase() + noun.slice(1)
  }

  protected abstract pieceStore (store :S.AppStore) :S.PieceStore<P>
  protected abstract viewContents (store :S.AppStore, piece :P) :JSX.Element[]
  protected abstract editContents (piece :P) :JSX.Element[]
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

function partView (store :S.AppStore, song :M.Song, part :M.Part) :JSX.Element {
  const button = <UI.Button style={{ margin: 3 }} size="mini" onClick={() => {
    const name = `${song.name.value} - ${part.name}`
    addToPracticeQueue(store, "part", song.ref.id, part.name, name)
  }}>{`${part.name} ${statusEmoji[part.status]}`}</UI.Button>
  return <UI.Popup key={part.name} content="Add to practice queue" trigger={button} />
}

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
  protected pieceStore (store :S.AppStore) :S.PieceStore<M.Song> { return store.songs() }
  protected get pieceNoun () :string { return "song" }
  protected get pieceIcon () :UI.SemanticICONS { return SongIcon }

  protected viewContents (store :S.AppStore, song :M.Song) :JSX.Element[] {
    const contents = song.parts.value.map(p => partView(store, song, p))
    contents.unshift(<div key="composer">{song.composer.value}</div>)
    return contents
  }

  protected editContents (song :M.Song) :JSX.Element[] {
    return [
      <UI.Form.Group key="name">
        <UI.Form.Field>
          <label>Name</label>
          {editString(song.name.editValue)}
        </UI.Form.Field>
        <UI.Form.Field>
          <label>Composer</label>
          {editString(song.composer.editValue)}
        </UI.Form.Field>
      </UI.Form.Group>,
      <UI.Form.Field key="ks">
        <label>Kuchi Shoga</label>
        {iconEditString("linkify", song.kuchishoga.editValue)}
      </UI.Form.Field>,
      <UI.Form.Group grouped key="parts">
        <label>Parts</label>
        {(song.parts.editValues).map((_, ii) => editPartView(song, ii))}
        <UI.Form.Field key="add">
          <UI.Button type="button" size="mini" icon="add" onClick={() => song.addPart("?")} />
        </UI.Form.Field>
      </UI.Form.Group>
    ]
  }
}

// ------
// Drills

@observer
export class DrillsView extends PiecesView<M.Drill> {
  protected pieceStore (store :S.AppStore) :S.PieceStore<M.Drill> { return store.drills() }
  protected get pieceNoun () :string { return "drill" }
  protected get pieceIcon () :UI.SemanticICONS { return DrillIcon }

  protected viewContents (store :S.AppStore, drill :M.Drill) :JSX.Element[] {
    return drill.via.value ? [<div key="via">via {drill.via.value}</div>] : []
  }

  protected editContents (drill :M.Drill) :JSX.Element[] {
    return [
      <UI.Form.Group key="name">
        <UI.Form.Field>
          <label>Name</label>
          {editString(drill.name.editValue)}
        </UI.Form.Field>
        <UI.Form.Field>
          <label>Via</label>
          {editString(drill.via.editValue)}
        </UI.Form.Field>
      </UI.Form.Group>,
      <UI.Form.Field key="ks">
        <label>Kuchi Shoga</label>
        {iconEditString("linkify", drill.kuchishoga.editValue)}
      </UI.Form.Field>
    ]
  }
}

// ------
// Techs

@observer
export class TechsView extends PiecesView<M.Technique> {
  protected pieceStore (store :S.AppStore) :S.PieceStore<M.Technique> { return store.techs() }
  protected get pieceNoun () :string { return "technique" }
  protected get pieceIcon () :UI.SemanticICONS { return TechIcon }

  protected viewContents (store :S.AppStore, tech :M.Technique) :JSX.Element[] {
    return tech.via.value ? [<div key="via">via {tech.via.value}</div>] : []
  }

  protected editContents (tech :M.Technique) :JSX.Element[] {
    return [
      <UI.Form.Group key="name">
        <UI.Form.Field>
          <label>Name</label>
          {editString(tech.name.editValue)}
        </UI.Form.Field>
        <UI.Form.Field>
          <label>Via</label>
          {editString(tech.via.editValue)}
        </UI.Form.Field>
      </UI.Form.Group>,
      <UI.Form.Field key="ks">
        <label>Kuchi Shoga</label>
        {iconEditString("linkify", tech.kuchishoga.editValue)}
      </UI.Form.Field>
    ]
  }
}
