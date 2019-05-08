import { IObservableValue } from "mobx"
import { observer } from "mobx-react"
import * as React from "react";
import * as UI from "semantic-ui-react"
import * as firebase from "firebase/app"

import * as M from "./model"
import * as S from "./stores"
import { Thunk, Stamp } from "./util"

type Timestamp = firebase.firestore.Timestamp
const Timestamp = firebase.firestore.Timestamp

type PopupSize = "mini" | "tiny" | "small" | "large" | "huge"

function actionIcon (name :UI.SemanticICONS, size :PopupSize, tooltip :string,
                     onClick :() => void) :JSX.Element {
  const icon = <UI.Icon size={size} name={name} link onClick={onClick} />
  return <UI.Popup content={tooltip} trigger={icon} />
}

function listAction (name :UI.SemanticICONS, onClick :() => void) :JSX.Element {
  return <div style={{ display: "table-cell" }}>
    <UI.Button icon={name} size={"small"} circular onClick={onClick} />
  </div>
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
  const dt2 = new Date(then), d2 = dt2.getDate()
  if (elapsed < 24*Hour && d1 == d2) return "Today"
  if (elapsed < 7*Day) return dt2.toLocaleDateString([], {weekday: "long"})
  if (elapsed < 4*7*Day) return "Weeks ago"
  if (elapsed < 4*30*Day) return "Months ago"
  return "Ages ago"
}

function editString (value :IObservableValue<string>) :JSX.Element {
  return (<UI.Input onChange={ev => value.set(ev.currentTarget.value)}>
            <input value={value.get()} />
          </UI.Input>)
}

function iconEditString (icon :UI.SemanticICONS, placeholder :string,
                         value :IObservableValue<string>) :JSX.Element {
  return (<UI.Input icon iconPosition="left" placeholder={placeholder}
                    onChange={ev => value.set(ev.currentTarget.value)}>
            <input value={value.get()} />
            <UI.Icon name={icon} />
          </UI.Input>)
}

function editStamp (value :IObservableValue<Stamp>) :JSX.Element {
  return (<UI.Input type="date" onChange={ev => value.set(ev.currentTarget.value)}>
            <input value={value.get()} />
          </UI.Input>)
}

function newEntryInput (placeholder :string, value :IObservableValue<string>, create :Thunk) {
  return (
    <UI.Input placeholder={placeholder} action onChange={ev => value.set(ev.currentTarget.value)}>
      <input value={value.get()} onKeyDown={ev => { if (ev.key === "Enter") create() }} />
      <UI.Button disabled={value.get().length == 0} onClick={create}>Add</UI.Button>
    </UI.Input>)
}

function leftPadIcon (name :UI.SemanticICONS) :JSX.Element {
  return <UI.Icon style={{ marginLeft: 10 }} name={name} size="small" />
}

function caps (text :string) :string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// -------------------
// Practice Queue view

export const Icons :{[key :string] :UI.SemanticICONS} = {
  // tabs/repertoire
  Practice: "list",
  Song: "music",
  Drill: "stopwatch",
  Tech: "magic",
  Advice: "bullhorn",
  Perf: "star",
  About: "question",

  // UI things
  Menu: "angle double down",
  AddPQ: "add circle",
  LogPQ: "add square",
  LogPQAt: "add to calendar",
  Delete: "trash",
  PracticeCount: "sync",
  LastPracticed: "clock outline",
  Recording: "video",
  Person: "user",
}

function ritemIcon (type :M.RType) :UI.SemanticICONS {
  switch (type) {
  case   "part": return Icons.Song
  case  "drill": return Icons.Drill
  case   "tech": return Icons.Tech
  case "advice": return Icons.Advice
  }
}

function practiceMenuItems (store :S.AppStore, pable :M.Practicable,
                            part :string|void) :UI.DropdownItemProps[] {
  const name = pable.getName(part)
  const item :M.RItem = {type: pable.type, id: pable.ref.id, name}
  if (part) item.part = part
  const onAdd = () => {
    const undo = store.queue().add(item, pable.getPractices(part), pable.getLastPracticed(part))
    if (typeof undo === "string") store.snacks.showFeedback(undo)
    else store.snacks.showFeedback(`Added "${name}" to practice queue.`, undo)
  }
  const onLog = () => {
    const undo = store.logPractice(item)
    store.snacks.showFeedback(`Recorded practice of "${name}".`, undo)
  }
  const onLogAt = () => { store.startLogPracticeAt(item) }
  return [
    { value: "add",   onClick: onAdd,   icon: Icons.AddPQ,   text: "Add to practice queue" },
    { value: "log",   onClick: onLog,   icon: Icons.LogPQ,   text: "Log a practice" },
    { value: "logat", onClick: onLogAt, icon: Icons.LogPQAt, text: "Log a practice at..." },
  ]
}

function qitemView (store :S.AppStore, qitem :M.QItem) {
  const notePracticed = () => {
    const undo = store.logQueuePractice(qitem)
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
        <UI.Icon name={Icons.PracticeCount} size="small" /> {descrip}
        {qitem.lastPracticed && leftPadIcon(Icons.LastPracticed)}
        {qitem.lastPracticed && formatStamp(qitem.lastPracticed)}
      </UI.List.Description>
    </UI.List.Content>
    {listAction(Icons.LogPQ, notePracticed)}
    {listAction(Icons.Delete, markDone)}
  </UI.List.Item>)
}

const LItemTimeFormat = {hour: "numeric", minute: "2-digit"}

function litemView (store :S.AppStore, lview :S.LogView, litem :M.LItem) {
  let descrip = litem.practiced.toDate().toLocaleTimeString([], LItemTimeFormat)
  return (<UI.List.Item key={litem.practiced.toMillis()}>
    <UI.List.Icon name={ritemIcon(litem.type)} size="large" verticalAlign="middle" />
    <UI.List.Content>
      <UI.List.Header>{litem.name}</UI.List.Header>
      <UI.List.Description>{descrip}</UI.List.Description>
    </UI.List.Content>
    {listAction(Icons.Delete, () => {
      const undo = lview.delete(litem)
      store.snacks.showFeedback(`Removed "${litem.name}" from log.`, undo)
    })}
  </UI.List.Item>)
}

const tipIcon = (key :string) => <UI.Icon name={Icons[key]} size="small" />

function emptyQueue () :JSX.Element {
  return <UI.List.Item>
    <UI.List.Content>
      Nothing to practice! Add
      some {tipIcon("Song")}songs, {tipIcon("Drill")}drills, {tipIcon("Tech")}techniques,
      and {tipIcon("Advice")}advice and get down to business!
    </UI.List.Content>
  </UI.List.Item>
}

function emptyLog () :JSX.Element {
  return <UI.List.Item>
    <UI.List.Content>
      No practices logged on this date. Click the {tipIcon("LogPQ")}button on a practice queue
      item above to log that you practiced it.
    </UI.List.Content>
  </UI.List.Item>
}

function formatLogDate (date :Date) :string {
  return date.toLocaleDateString(
    [], {weekday: "short", year: "numeric", month: "short", day: "numeric"})
}

@observer
export class PracticeView extends React.Component<{store :S.AppStore}> {

  render () {
    const {store} = this.props, queue = store.queue()
    const logs = store.logs(), lview = logs.logView(logs.currentDate)
    const logTitle = window.innerWidth > 450 ? "Practice Log" : "Log" // responsive layout, lol!
    return (
      <UI.Container>
        <UI.Header>Practice Queue</UI.Header>
        <UI.List divided relaxed>{
          queue.items.length > 0 ? queue.items.map(qi => qitemView(store, qi)) : emptyQueue()
        }</UI.List>

        <UI.Header>
          <span style={{ marginRight: 15 }}>{logTitle}</span>
          {actionIcon("calendar outline", "large", "To today", () => logs.goToday())}
          {actionIcon("arrow circle left", "large", "Previous day", () => logs.rollDate(-1))}
          <span style={{ marginLeft: "0.5rem" }}>{formatLogDate(logs.currentDate)}</span>
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
          <UI.List.Item><UI.List.Content>
            No {this.docsNoun}. Add some below.
          </UI.List.Content></UI.List.Item>
      }</UI.List>

    return (
      <UI.Container>
        <UI.Header>{this.titleText}</UI.Header>
        {content}
        {newEntryInput(this.newPlaceholder, pstore.creatingName, () => pstore.create())}
      </UI.Container>)
  }

  protected docView (store :S.AppStore, doc :D) :JSX.Element {
    const contents = this.viewContents(store, doc)
    return (<UI.List.Item key={doc.ref.id}>
      <div style={{ display: "table-cell", width: "100%" }}>
        {this.viewHeader(store, doc)}
      </div>
      <div style={{ display: "table-cell", verticalAlign: "middle" }}>
        <UI.Dropdown icon={<UI.Icon name={Icons.Menu} size="large" />} direction="left">
          <UI.Dropdown.Menu>
            {this.docMenu(store, doc).map(o => <UI.Dropdown.Item key={`${o.value}`} {...o} />)}
          </UI.Dropdown.Menu>
        </UI.Dropdown>
      </div>
      {contents}
    </UI.List.Item>)
  }

  protected docMenu (store :S.AppStore, doc :D) :UI.DropdownItemProps[] {
    const onEdit = () => this.docsStore(store).startEdit(doc.ref.id)
    return [{ icon: "edit", text: this.editTip, value: "edit", onClick: onEdit }]
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

  protected get titleText () :string { return caps(`${this.docsNoun}`) }
  protected get editTip () :string { return `Edit ${this.docNoun}...` }
  protected get newPlaceholder () :string { return `${caps(this.docNoun)} name...` }

  protected abstract get docNoun () :string
  protected abstract get docIcon () :UI.SemanticICONS
  protected get docsNoun () :string { return `${this.docNoun}s` }

  protected abstract docsStore (store :S.AppStore) :S.DocsStore<D>
  protected abstract viewHeader (store :S.AppStore, doc :D) :JSX.Element[]
  protected viewContents (store :S.AppStore, doc :D) :JSX.Element[] { return [] }
  protected abstract editContents (doc :D) :JSX.Element[]
}

abstract class PiecesView<P extends M.Piece> extends DocsView<P> {

  protected viewHeader (store :S.AppStore, piece :P) :JSX.Element[] {
    const idata = (key :string, name :UI.SemanticICONS, url :string) => ({key, name, url})
    const icons = piece.recordings.value.map((r, ii) => idata(`rec${ii}`, Icons.Recording, r))
    piece.kuchishoga.value && icons.push(idata("kuchi", "comment", piece.kuchishoga.value))
    return [<UI.Header key="header" as="h3">{piece.name.value}{
      icons.map(i => <UI.Icon key={i.key} name={i.name} link onClick={() => window.open(i.url)} />)
    }</UI.Header>]
  }
}

function editRecordingsView (doc :M.Piece, docsNoun :string) :JSX.Element {
  const urls = doc.recordings.editValues
  const items = urls.length > 0 ? urls.map((url, ii) => <UI.Form.Field inline key={ii}>
    <UI.Input type="text" placeholder="URL" icon iconPosition="left">
      <UI.Icon name="linkify" />
      <input value={url} size={25} onChange={ ev => {
        // why I have to replace the whole array, I have no idea; mobx & JS are so fail
        const fuckingChrist = doc.recordings.editValues.toJS()
        fuckingChrist[ii] = ev.currentTarget.value
        doc.recordings.editValues.replace(fuckingChrist)
      }} />
    </UI.Input>
    <UI.Icon inverted circular size="small" link name={Icons.Delete}
             onClick={() => doc.recordings.deleteFromEdit(ii)} />
    </UI.Form.Field>) : [
      <UI.Segment key="empty">
        <p>Add video recording URLs and they'll be shown in your {docsNoun} list
        as <UI.Icon name={Icons.Recording} size="small"/> buttons.</p>
      </UI.Segment>
    ]
  return (
    <UI.Form.Group grouped key="recordings">
    <label>Recordings</label>
    {items}
    <UI.Form.Field key="add">
    <UI.Button type="button" size="mini" icon="add" onClick={() => doc.recordings.addToEdit("")} />
    </UI.Form.Field>
    </UI.Form.Group>)
}

// -----
// Songs

const statusEmoji = {
  ignorance: "🙉",
  learning: "🤔",
  refining: "🙂",
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
  protected get docIcon () :UI.SemanticICONS { return Icons.Song }

  protected viewHeader (store :S.AppStore, song :M.Song) :JSX.Element[] {
    return super.viewHeader(store, song).concat(song.composer.value ? [
      <div key="composer" style={{ marginBottom: 5 }}>
        <UI.Icon name="user" size="small" />{song.composer.value}
      </div> ] : [])
  }

  protected viewContents (store :S.AppStore, song :M.Song) :JSX.Element[] {
    function partView (part :M.Part) :JSX.Element {
      const menuIcon = <UI.Icon name={Icons.Menu} style={{ margin: "0 0 0 .5em" }} />
      const menuItems = practiceMenuItems(store, song, part.name)
      return <UI.Label style={{ margin: 3 }} key={part.name}>
        {`${statusEmoji[part.status]} ${part.name}`}
        <UI.Dropdown icon={menuIcon} direction="left">
          <UI.Dropdown.Menu>
            {menuItems.map(o => <UI.Dropdown.Item key={`${o.value}`} {...o} />)}
          </UI.Dropdown.Menu>
        </UI.Dropdown>
      </UI.Label>
    }
    return song.parts.value.map(partView)
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
          {iconEditString(Icons.Person, "", doc.composer.editValue)}
        </UI.Form.Field>
      </UI.Form.Group>,
      <UI.Form.Field key="ks">
        <label>Kuchi Shoga</label>
        {iconEditString("linkify", "URL", doc.kuchishoga.editValue)}
      </UI.Form.Field>,
      <UI.Form.Group grouped key="parts">
        <label>Parts</label>
        {(doc.parts.editValues).map((_, ii) => editPartView(doc, ii))}
        <UI.Form.Field key="add">
          <UI.Button type="button" size="mini" icon="add" onClick={() => doc.addPart("?")} />
        </UI.Form.Field>
      </UI.Form.Group>,
      editRecordingsView(doc, this.docsNoun)
    ]
  }
}

// ------
// Drills

@observer
export class DrillsView extends PiecesView<M.Drill> {
  protected docsStore (store :S.AppStore) :S.PiecesStore<M.Drill> { return store.drills() }
  protected get docNoun () :string { return "drill" }
  protected get docIcon () :UI.SemanticICONS { return Icons.Drill }

  protected viewHeader (store :S.AppStore, doc :M.Drill) :JSX.Element[] {
    return super.viewHeader(store, doc).concat(doc.via.value ? [
      <div key="via"><UI.Icon name={Icons.Person} size="small" />{doc.via.value}</div>] : [])
  }

  protected docMenu (store :S.AppStore, doc :M.Drill) :UI.DropdownItemProps[] {
    return super.docMenu(store, doc).concat(practiceMenuItems(store, doc))
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
          {iconEditString(Icons.Person, "Source", doc.via.editValue)}
        </UI.Form.Field>
      </UI.Form.Group>,
      <UI.Form.Field key="ks">
        <label>Kuchi Shoga</label>
        {iconEditString("linkify", "URL", doc.kuchishoga.editValue)}
      </UI.Form.Field>,
      editRecordingsView(doc, this.docsNoun)
    ]
  }
}

// ------
// Techs

@observer
export class TechsView extends PiecesView<M.Technique> {
  protected docsStore (store :S.AppStore) :S.PiecesStore<M.Technique> { return store.techs() }
  protected get docNoun () :string { return "technique" }
  protected get docIcon () :UI.SemanticICONS { return Icons.Tech }

  protected viewHeader (store :S.AppStore, doc :M.Technique) :JSX.Element[] {
    return super.viewHeader(store, doc).concat(doc.via.value ? [
      <div key="via"><UI.Icon name="user" size="small" />{doc.via.value}</div>] : [])
  }
  protected docMenu (store :S.AppStore, doc :M.Technique) :UI.DropdownItemProps[] {
    return super.docMenu(store, doc).concat(practiceMenuItems(store, doc))
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
          {iconEditString(Icons.Person, "Source", doc.via.editValue)}
        </UI.Form.Field>
      </UI.Form.Group>,
      <UI.Form.Field key="ks">
        <label>Kuchi Shoga</label>
        {iconEditString("linkify", "URL", doc.kuchishoga.editValue)}
      </UI.Form.Field>,
      editRecordingsView(doc, this.docsNoun)
    ]
  }
}

// ------
// Advice

@observer
export class AdviceView extends DocsView<M.Advice> {
  protected docsStore (store :S.AppStore) :S.DocsStore<M.Advice> { return store.advice() }
  protected get docNoun () :string { return "advice" }
  protected get docsNoun () :string { return "advice" }
  protected get newPlaceholder () :string { return `${caps(this.docNoun)}...` }
  protected get docIcon () :UI.SemanticICONS { return Icons.Advice }

  protected viewHeader (store :S.AppStore, doc :M.Advice) :JSX.Element[] {
    const elems = [<UI.Header key="header" as="h4">{doc.text.value}</UI.Header>]
    if (doc.from.value && doc.song.value) elems.push(
      <div key="via">
        <UI.Icon name={Icons.Song} size="small" />{doc.song.value}
        {leftPadIcon(Icons.Person)}{doc.from.value}
      </div>)
    else if (doc.from.value) elems.push(
      <div key="via">
        <UI.Icon name={Icons.Person} size="small" />{doc.from.value}
      </div>)
    else if (doc.song.value) elems.push(
      <div key="via">
        <UI.Icon name={Icons.Song} size="small" />{doc.song.value}
      </div>)
    return elems
  }
  protected docMenu (store :S.AppStore, doc :M.Advice) :UI.DropdownItemProps[] {
    return super.docMenu(store, doc).concat(practiceMenuItems(store, doc))
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
          {iconEditString(Icons.Person, "", doc.from.editValue)}
        </UI.Form.Field>
        <UI.Form.Field>
          <label>Song</label>
          {iconEditString(Icons.Song, "", doc.song.editValue)}
        </UI.Form.Field>
      <UI.Form.Field>
        <label>Date</label>
        {editStamp(doc.date.editValue)}
      </UI.Form.Field>
      </UI.Form.Group>
    ]
  }
}
