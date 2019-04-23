import { IObservableValue } from "mobx"
import { observer } from "mobx-react"
import * as React from "react";
import * as UI from 'semantic-ui-react'

import * as M from "./model"
import * as S from "./stores"

function partView (part :M.Part) :JSX.Element {
  return <UI.Menu.Item key={part.name} name={part.name}
                       onClick={() => console.log(`TODO: ${part.name}!`)} />
}

function songView (store :S.SongsStore, song :M.Song) :JSX.Element {
  return (
    <UI.List.Item key={song.ref.id}>
      <UI.List.Icon name='music' size='large' verticalAlign='middle' />
      <UI.List.Content>
        <UI.Header as="h3">
          <UI.Header.Content>{song.name.value}</UI.Header.Content>
          <UI.Icon className="test" name="edit" link onClick={() => store.editSong(song.ref.id)} />
        </UI.Header>
        <div>{song.composer.value}</div>
        <UI.Menu secondary compact size='mini'>
          <UI.Menu.Item header>Parts:</UI.Menu.Item>
          {song.parts.value.map(partView)}
        </UI.Menu>
      </UI.List.Content>
    </UI.List.Item>
  )
}

function editPartView (song :M.Song, idx :number) :JSX.Element {
  const part = song.parts.editValues[idx]
  // <UI.Input placeholder="Song..." action
  //           onChange={ev => songs.creatingName = ev.currentTarget.value}>
  //   <input value={songs.creatingName} />
  //   <UI.Button disabled={songs.creatingName.length == 0}
  //              onClick={() => songs.createSong()}>Add</UI.Button>
  // </UI.Input>
  return <UI.Form.Field key={idx}>
    <UI.Input size="mini" icon placeholder="Part..."
                   onChange={ ev => part.name = ev.currentTarget.value }>
      <input size={5} value={part.name} />
      <UI.Icon inverted circular link name="close" onClick={() => song.parts.deleteFromEdit(idx)} />
    </UI.Input>
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
    <UI.Form.Group inline>
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
        songs.items.length > 0 ? songs.items.map(s => songView(songs, s)) : <UI.List.Item>
          <UI.List.Content>No songs.</UI.List.Content>
        </UI.List.Item>
      }</UI.List>

    // <List.Item>
    //   <List.Icon name='github' size='large' verticalAlign='middle' />
    //   <List.Content>
    //     <List.Header as='a'>Semantic-Org/Semantic-UI</List.Header>
    //     <List.Description as='a'>Updated 10 mins ago</List.Description>
    //   </List.Content>
    // </List.Item>
    // <List.Item>
    //   <List.Icon name='github' size='large' verticalAlign='middle' />
    //   <List.Content>
    //     <List.Header as='a'>Semantic-Org/Semantic-UI-Docs</List.Header>
    //     <List.Description as='a'>Updated 22 mins ago</List.Description>
    //   </List.Content>
    // </List.Item>
    // <List.Item>
    //   <List.Icon name='github' size='large' verticalAlign='middle' />
    //   <List.Content>
    //     <List.Header as='a'>Semantic-Org/Semantic-UI-Meteor</List.Header>
    //     <List.Description as='a'>Updated 34 mins ago</List.Description>
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
