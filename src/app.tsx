import { observer } from "mobx-react"
import * as React from "react";
import * as UI from 'semantic-ui-react'

import * as firebase from "firebase/app"
import "firebase/auth"
import StyledFirebaseAuth from 'react-firebaseui/StyledFirebaseAuth'

import * as S from "./stores"
import * as M from "./model"
import * as V from "./views"

const authConfig = {
  signInFlow: 'redirect',
  signInOptions: [
    firebase.auth.GoogleAuthProvider.PROVIDER_ID,
    firebase.auth.FacebookAuthProvider.PROVIDER_ID,
    // firebase.auth.TwitterAuthProvider.PROVIDER_ID,
    firebase.auth.EmailAuthProvider.PROVIDER_ID,
  ],
  callbacks: {
    signInSuccessWithAuthResult: () => false
  },
};

const Renshu = "練習"
const tipIcon = (key :string) => <UI.Icon name={V.Icons[key]} size="small" />
const aboutBlurb = () => <p>
    Renshu ({Renshu}) is an app for tracking your taiko practice. It assists you by
    tracking {tipIcon("Song")}songs, {tipIcon("Drill")}drills, {tipIcon("Tech")}techniques,
    and {tipIcon("Advice")}advice, and helping you to create and evolve your practice plan.
  </p>

// ----------
// Login view

class LoginView extends React.Component {
  render () {
    return (<UI.Container text>
      <UI.Header>Welcome to Renshu</UI.Header>
      {aboutBlurb()}
      <UI.Header>Log In</UI.Header>
      <p>
        Renshu keeps your data in the cloud and needs a user id to keep track of it.
        Please select one of the following account providers:
      </p>
      <StyledFirebaseAuth uiConfig={authConfig} firebaseAuth={firebase.auth()}/>
      <UI.Header>Privacy</UI.Header>
      <p>
        We do not make use of any information or capabilities from these account providers
        other than to obtain a unique identifier with which to associate your data.
        We don't use your name, email address, profile photo, nor read your posts, tweets, etc.
        — <a href="privacy.html">Privacy policy</a>
      </p>
    </UI.Container>)
  }
}

// -------------------
// About and help view

declare var __BUILD__: string;

function link (url :string, text :string) {
  const href = `https://${url}`
  return <a href={href}>{text}</a>
}

class AboutView extends React.Component<{store :S.AppStore}> {
  render () {
    const {store} = this.props
    // NOTE: the text is carefully wrapped below to avoid HTML omitting spaces between text and
    // icon elements that appear after a newline, be careful when changing; go team HTML!
    const about = <div key="about">
      <UI.Header as="h2">About</UI.Header>
      {aboutBlurb()}
      <p>
        Enter the songs, drills and techniques that make up your repertoire, as well as advice
        you receive from your teachers and fellow drummers, and then add them to
        your {tipIcon("Practice")}practice queue so that you know exactly what to work on next time
        you practice.
      </p>
      <p>
        Renshu also provides a {tipIcon("Practice")}practice log. Tap the {tipIcon("LogPQ")} button
        next to any item on your practice queue to log that you practiced it. Items on your queue
        will show {tipIcon("PracticeCount")}how many times you've practiced them
        and {tipIcon("LastPracticed")}the last time you logged a practice.
        Remove things from your queue with the {tipIcon("Delete")} button. You can add things to,
        and remove them from your practice queue as your practice priorities change.
      </p>
    </div>
    const account = store.user ? <div key="account" style={{ marginTop: 20 }}>
      <UI.Header as="h2">Account</UI.Header>
      <p>You are logged in as:</p>
      <ul>{store.user.providerData.map(
        p => p && <li key={p.providerId}>{p.displayName} via {p.providerId}</li>)}</ul>
      <UI.Button onClick={() => firebase.auth().signOut()}>Log out</UI.Button>
    </div> : undefined
    const credits = <div key="credits" style={{ marginTop: 20 }}>
      <UI.Header as="h2">Colophon</UI.Header>
      <p>Renshu was created by {link("samskivert.com", "Michael Bayne")} in 2019.</p>
      <UI.List>
        <UI.List.Item>
          <UI.List.Icon name="database" />
          <UI.List.Content>
            It is built on Google's {link("firebase.google.com", "Firebase")} app platform.
          </UI.List.Content>
        </UI.List.Item>
        <UI.List.Item>
          <UI.List.Icon name="code" />
          <UI.List.Content>
            The code is written in {link("www.typescriptlang.org", "TypeScript")}.
          </UI.List.Content>
        </UI.List.Item>
        <UI.List.Item>
          <UI.List.Icon name="react" />
          <UI.List.Content>
            The user interface uses the {link("react.semantic-ui.com", "Semantic UI")} library
            with {link("reactjs.org", "React")} and {link("github.com/mobxjs/mobx", "MobX")} for
            reactive plumbing.
          </UI.List.Content>
        </UI.List.Item>
        <UI.List.Item>
          <UI.List.Icon name="github" />
          <UI.List.Content>
            The source code is freely available
            on {link("github.com/samskivert/renshu", "Github")}.
          </UI.List.Content>
        </UI.List.Item>
        <UI.List.Item>
          <UI.List.Icon name="privacy" />
          <UI.List.Content>
            The <a href="privacy.html">privacy policy</a> explains what data the app collects
            (as little as possible).
          </UI.List.Content>
        </UI.List.Item>
      </UI.List>
      <p>Current build: {__BUILD__}</p>
    </div>
    return <UI.Container text>
      {about}
      {account}
      {credits}
    </UI.Container>
  }
}

// -----------------------------------
// Practice Log Date/Time Picker Popup


function logPracticeAtTimeView (store :S.AppStore, ritem :M.RItem) :JSX.Element {
  return <UI.Modal open={true} size="mini" onClose={() => store.cancelLogPracticeAt()} >
    <UI.Modal.Content>
      <p>Log at practice of <b>{ritem.name}</b> at:</p>
      <UI.Input type="date" value={store.pendingLogDate}
                onChange={ev => store.pendingLogDate = ev.currentTarget.value} />
      <UI.Input type="time" value={store.pendingLogTime}
                onChange={ev => store.pendingLogTime = ev.currentTarget.value} />
    </UI.Modal.Content>
    <UI.Modal.Actions>
      <UI.Button secondary content='Cancel' onClick={() => store.cancelLogPracticeAt() } />
      <UI.Button primary content='Log it!' onClick={() => store.commitLogPracticeAt() } />
    </UI.Modal.Actions>
  </UI.Modal>
}

// ---------------------
// Snack (feedback) view

const SnackAutoClear = 5000 // millis

export function snackView (store :S.SnackStore) :JSX.Element|void {
  const {message, undo} = store.current
  const showNext = () => store.showNext()
  return <UI.Transition visible={store.showing} animation='fade right' duration={500}
                        onComplete={() => setTimeout(showNext, SnackAutoClear)} onHide={showNext}>
    <UI.Message info className="snack" >
      <span>{message}</span>
      <UI.Icon name="times" style={{ float: 'right', marginLeft: "1em" }} onClick={showNext} />
      {undo && <UI.Button size="mini" compact basic
                          style={{ float: 'right', marginLeft: 10, marginRight: 10 }}
                          onClick={() => { undo() ; store.showNext() }}>UNDO</UI.Button>}
    </UI.Message>
  </UI.Transition>
}

// ------------------------------
// Main app view: shell with tabs

type TabData = {tab :S.Tab, title :string, icon :JSX.Element}
const TabInfo :TabData[] = [
  {tab: "practice", title: "Practice",     icon: <UI.Icon name={V.Icons.Practice} />},
  {tab: "songs",    title: "Songs",        icon: <UI.Icon name={V.Icons.Song} />},
  {tab: "drills",   title: "Drills",       icon: <UI.Icon name={V.Icons.Drill} />},
  {tab: "techs",    title: "Techniques",   icon: <UI.Icon name={V.Icons.Tech} />},
  {tab: "advice",   title: "Advice",       icon: <UI.Icon name={V.Icons.Advice} />},
  // {tab: "perfs",    title: "Performances", icon: <UI.Icon name={V.Icons.Perf} />},
  {tab: "about",    title: "About",        icon: <UI.Icon name={V.Icons.About} />},
]

@observer
export class AppView extends React.Component<{store :S.AppStore}> {

  render () {
    // we have to check user to ensure an observable depend, meh
    const {store} = this.props, {user} = store
    if (!user) return (
      <div>
        <UI.Menu>
          <UI.Menu.Item><UI.Header>{Renshu}</UI.Header></UI.Menu.Item>
        </UI.Menu>
        <UI.Container><LoginView /></UI.Container>
      </div>
    )

    let content :JSX.Element
    switch (store.tab) {
    case "practice": content = <V.PracticeView store={store} /> ; break
    case    "songs": content = <V.SongsView store={store} />    ; break
    case   "drills": content = <V.DrillsView store={store} />   ; break
    case    "techs": content = <V.TechsView store={store} />    ; break
    case   "advice": content = <V.AdviceView store={store} />   ; break
    // case    "perfs": content = <p> TODO: {store.tab} </p>       ; break
    case    "about": content = <AboutView store={store} />      ; break
    default:         content = <p> Error: {store.tab} </p>      ; break
    }

    return <div>
      <UI.Menu fixed="top">
        <UI.Responsive minWidth={450}>
          <UI.Menu.Item key="title"><UI.Header>{Renshu}</UI.Header></UI.Menu.Item>
        </UI.Responsive>
        {TabInfo.map(info =>
          <UI.Menu.Item key={info.tab} name={info.tab} active={store.tab == info.tab}
                        onClick={() => store.tab = info.tab}>
            {info.icon}
          </UI.Menu.Item>
        )}
      </UI.Menu>
      {snackView(store.snacks)}
      {store.pendingLogItem ? logPracticeAtTimeView(store, store.pendingLogItem) : undefined}
      <div style={{ padding: "60 0 15 0" }}>
        {content}
      </div>
    </div>
  }
}
