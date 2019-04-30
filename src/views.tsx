import { IObservableValue } from "mobx"
import { observer } from "mobx-react"
import * as React from "react";
import * as UI from 'semantic-ui-react'

import * as M from "./model"
import * as S from "./stores"

type Timestamp = firebase.firestore.Timestamp

type PopupSize = "mini" | "tiny" | "small" | "large" | "huge"

function actionIcon (name :UI.SemanticICONS, size :PopupSize, tooltip :string,
                     onClick :() => void) :JSX.Element {
  const icon = <UI.Icon size={size} name={name} link onClick={onClick} />
  return <UI.Popup content={tooltip} trigger={icon} />
}

function linkIcon (name :UI.SemanticICONS, tooltip :string, url :string) :JSX.Element {
  return actionIcon(name, "mini", tooltip, () => window.open(url))
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
  const y1 = dt1.getUTCFullYear(), y2 = dt2.getUTCFullYear()
  const m1 = dt1.getUTCMonth(),    m2 = dt2.getUTCMonth()
  const d1 = dt1.getUTCDate(),     d2 = dt2.getUTCDate()
  if (y1 > y2+1) return "years ago"
  if (y1 > y2) return "last year"
  if (m1 > m2+1) return "months ago"
  if (m1 > m2) return "last month"
  if (d1 > d2+1) return `${(d2-d1)} days ago`
  if (d1 > d2) return "yesterday"
  return "today"
}

// -------------------
// Practice Queue view

function qitemView (store :S.AppStore, qitem :M.QItem) {
  let descrip = `Practices: ${qitem.practices}`
  if (qitem.targetPractices) descrip += ` of ${qitem.targetPractices}`
  if (qitem.lastPracticed) descrip += ` – Last: ${formatStamp(qitem.lastPracticed)}`
  return (<UI.List.Item key={qitem.added.toMillis()}>
    <UI.List.Icon name="music" size="large" verticalAlign="middle" />
    <UI.List.Content>
      <UI.List.Header>{qitem.name}</UI.List.Header>
      <UI.List.Description>{descrip}</UI.List.Description>
    </UI.List.Content>
    {actionIcon("plus", "large", "Practiced!", () => {
      const undo = store.queue().notePractice(qitem)
      // TODO: add practice log entry
      // TODO: increment practice counter on source item?
      store.snacks.showFeedback(`Recorded practice of ${qitem.name}.`, undo)
    })}
    {actionIcon("check", "large", "Done!", () => {})}
  </UI.List.Item>)
}

@observer
export class PracticeQueueView extends React.Component<{store :S.AppStore}> {

  render () {
    const {store} = this.props, queue = store.queue()

    const content = // songs.pending ? <UI.Dimmer active inverted><UI.Loader /></UI.Dimmer> :
      <UI.List divided relaxed>{
        queue.items.length > 0 ? queue.items.map(qi => qitemView(store, qi)) : <UI.List.Item>
          <UI.List.Content>
            Nothing to practice! Add songs and drills to the queue from their respective tabs.
          </UI.List.Content>
        </UI.List.Item>
      }</UI.List>

    return (
      <UI.Container>
        <UI.Header>Practice Queue</UI.Header>
        {content}
      </UI.Container>)
  }
}

// ----------
// Songs view

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
  const name = `${part.name} ${statusEmoji[part.status]}`
  const onClick = () => {
    const name = `${song.name.value} - ${part.name}`
    const undo = store.queue().add("part", song.ref.id, part.name, name)
    if (typeof undo === "string") store.snacks.showFeedback(undo)
    else store.snacks.showFeedback(`Added ${name} to practice queue.`, undo)
  }
  return <UI.Menu.Item key={part.name} name={name} onClick={onClick} />
}

function songView (store :S.AppStore, song :M.Song) :JSX.Element {
  const ksIcon = song.kuchishoga.value ?
    linkIcon("comment", "Kuchi shoga", song.kuchishoga.value) :
    null
  return (
    <UI.List.Item key={song.ref.id}>
      <UI.List.Icon name="music" size="large" verticalAlign="middle" />
      <UI.List.Content>
        <UI.Header as="h3">
          <UI.Header.Content>{song.name.value}</UI.Header.Content>
          {ksIcon}
          {actionIcon("edit", "mini", "Edit song", () => store.songs().editSong(song.ref.id))}
        </UI.Header>
        <div>{song.composer.value}</div>
        <UI.Menu secondary compact size="mini">
          <UI.Menu.Item header>Parts:</UI.Menu.Item>
          {song.parts.value.map(p => partView(store, song, p))}
        </UI.Menu>
      </UI.List.Content>
    </UI.List.Item>
  )
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

function editString (value :IObservableValue<string>) :JSX.Element {
  return (<UI.Input onChange={ev => value.set(ev.currentTarget.value)}>
    <input value={value.get()} />
  </UI.Input>)
}

function editSongView (store :S.SongsStore, song :M.Song) :JSX.Element {
  return (<UI.Form>
    <UI.Form.Group>
      <UI.Form.Field>
        <label>Name</label>
        {editString(song.name.editValue)}
      </UI.Form.Field>
      <UI.Form.Field>
        <label>Composer</label>
        {editString(song.composer.editValue)}
      </UI.Form.Field>
    </UI.Form.Group>
    <UI.Form.Group grouped>
      <label>Parts</label>
      {(song.parts.editValues).map((_, ii) => editPartView(song, ii))}
      <UI.Form.Field key="add">
        <UI.Button size="mini" icon="add" onClick={() => song.addPart("?")} />
      </UI.Form.Field>
    </UI.Form.Group>
      <UI.Form.Field>
        <label>Kuchi Shoga</label>
        <UI.Input icon iconPosition="left"
                  onChange={ev => song.kuchishoga.editValue.set(ev.currentTarget.value)}>
          <input value={song.kuchishoga.editValue.get()} />
          <UI.Icon name="linkify" />
        </UI.Input>
      </UI.Form.Field>
    <div>
      <UI.Button secondary onClick={() => store.cancelEdit()}>Cancel</UI.Button>
      <UI.Button primary onClick={() => store.commitEdit()}>Save</UI.Button>
    </div>
  </UI.Form>)
}

@observer
export class SongsView extends React.Component<{store :S.AppStore}> {

  render () {
    const {store} = this.props, songs = store.songs()

    if (songs.editingSong) {
      return (
        <UI.Container>
          {editSongView(songs, songs.editingSong)}
        </UI.Container>)
    }

    const content = songs.pending ? <UI.Dimmer active inverted><UI.Loader /></UI.Dimmer> :
      <UI.List divided relaxed>{
        songs.items.length > 0 ? songs.items.map(s => songView(store, s)) : <UI.List.Item>
          <UI.List.Content>No songs.</UI.List.Content>
        </UI.List.Item>
      }</UI.List>

    // <List.Item>
    //   <List.Icon name="github" size="large" verticalAlign="middle" />
    //   <List.Content>
    //     <List.Header as="a">Semantic-Org/Semantic-UI</List.Header>
    //     <List.Description as="a">Updated 10 mins ago</List.Description>
    //   </List.Content>
    // </List.Item>
    // <List.Item>
    //   <List.Icon name="github" size="large" verticalAlign="middle" />
    //   <List.Content>
    //     <List.Header as="a">Semantic-Org/Semantic-UI-Docs</List.Header>
    //     <List.Description as="a">Updated 22 mins ago</List.Description>
    //   </List.Content>
    // </List.Item>
    // <List.Item>
    //   <List.Icon name="github" size="large" verticalAlign="middle" />
    //   <List.Content>
    //     <List.Header as="a">Semantic-Org/Semantic-UI-Meteor</List.Header>
    //     <List.Description as="a">Updated 34 mins ago</List.Description>
    //   </List.Content>
    // </List.Item>
    return (
      <UI.Container>
        <UI.Header>Repertoire</UI.Header>
        {content}
        <UI.Input placeholder="Song..." action
                  onChange={ev => songs.creatingName = ev.currentTarget.value}>
          <input value={songs.creatingName} />
          <UI.Button disabled={songs.creatingName.length == 0}
                     onClick={() => songs.createSong()}>Add</UI.Button>
        </UI.Input>
      </UI.Container>)
  }
}
