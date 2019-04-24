import { observer } from "mobx-react"
import * as React from "react";
import * as UI from 'semantic-ui-react'

import * as firebase from "firebase/app"
import "firebase/auth"
import StyledFirebaseAuth from 'react-firebaseui/StyledFirebaseAuth'

import * as S from "./stores"
import * as V from "./views"

const authConfig = {
  signInFlow: 'redirect',
  signInOptions: [
    firebase.auth.GoogleAuthProvider.PROVIDER_ID,
    // firebase.auth.FacebookAuthProvider.PROVIDER_ID,
    // firebase.auth.TwitterAuthProvider.PROVIDER_ID,
    firebase.auth.EmailAuthProvider.PROVIDER_ID,
  ],
  callbacks: {
    signInSuccessWithAuthResult: () => false
  },
};

const PostUrl = "http://samskivert.com/blog/2018/11/pim-samsara/"

class LoginView extends React.Component {
  render () {
    return (<div>
      <UI.Header>Welcome to Renshu</UI.Header>
      <p>
        Renshu is an app for tracking your taiko practice.
      </p>
      <p>
        If you stumbled into it with no context and are wondering what it is,
        you can read the <a href={PostUrl}>blog post</a> I wrote about it when it was
        first created.
      </p>
      <UI.Header>Log In</UI.Header>
      <p>
        Renshu keeps your data in the cloud. This means that we need some sort of account
        with which we can associate your data. Please select one of the following account
        providers that we will use for that purpose and that purpose only.
      </p>
      <StyledFirebaseAuth uiConfig={authConfig} firebaseAuth={firebase.auth()}/>
      <UI.Header>Privacy</UI.Header>
      <p>
        We do not make use of any information or capabilities from these account providers
        other than to obtain a unique identifier for your data. We don't use your name,
        email address, profile photo, nor read your tweets, etc. If we could request fewer
        permissions we would. — <a href="privacy.html">Privacy policy</a>
      </p>
    </div>)
  }
}

interface AVProps {
  store :S.AppStore
}

type TabData = {tab :S.Tab, title :string, icon :JSX.Element}
const TabInfo :TabData[] = [
  {tab: "queue",  title: "Practice Queue", icon: <UI.Icon name='list' />},
  {tab: "songs",  title: "Repertoire",     icon: <UI.Icon name='music' />},
  {tab: "drills", title: "Drills",         icon: <UI.Icon name='sync' />},
  {tab: "techs",  title: "Techniques",     icon: <UI.Icon name='magic' />},
  {tab: "advice", title: "To Hear",        icon: <UI.Icon name='pencil alternate' />},
  {tab: "perfs",  title: "Performances",   icon: <UI.Icon name='star outline' />}
]
// function infoFor (tab :S.Tab) :TabData {
//   for (let info of TabInfo) if (info.tab === tab) return info
//   return TabInfo[0]
// }

@observer
export class AppView extends React.Component<AVProps> {

  render () {
    // we have to check user to ensure an observable depend, meh
    const {store} = this.props, {user} = store
    if (!user) return (
      <div>
        <UI.Menu>
          <UI.Menu.Item>
            <UI.Header>Renshu</UI.Header>
          </UI.Menu.Item>
        </UI.Menu>
        <UI.Container><LoginView /></UI.Container>
      </div>
    )

    let content :JSX.Element
    switch (store.tab) {
    case "songs": content = <V.SongsView store={store} /> ; break
    case "queue":
    case "drills":
    case "techs":
    case "advice":
    case "perfs":
    default: content = <p> TODO: {store.tab} </p>
    }

    return <div>
      <UI.Menu>
        <UI.Menu.Item key="title">
          <UI.Header>Renshu</UI.Header>
        </UI.Menu.Item>
        {TabInfo.map(info =>
          <UI.Menu.Item key={info.tab} name={info.tab} active={store.tab == info.tab}
                        onClick={() => store.tab = info.tab}>
            {info.icon}
          </UI.Menu.Item>
        )}
      </UI.Menu>
      {content}
    </div>

    // function appView (stores :S.Stores, tab :S.Tab, toolbar :JSX.Element) :JSX.Element {
    //   const [content, footer] = contentView(store, stores, width, tab)
    //   return <div key={tab} className={classes.section}>
    //     <UI.AppBar className={classes.appBar}>{toolbar}</UI.AppBar>
    //     <main className={classes.content}>{content}</main>
    //     <UI.AppBar color="secondary" className={classes.appBar}>{footer}</UI.AppBar>
    //   </div>
    // }
    // function auxView (stores :S.Stores, info :TabData) :JSX.Element {
    //   const {tab, icon, title} = info, unpin = () => store.unpin(tab)
    //   const footer = <UI.Toolbar>
    //     <UI.IconButton color="inherit">{icon}</UI.IconButton>
    //     <UI.Typography style={{marginRight: 5}} variant="h6" color="inherit">{title}</UI.Typography>
    //     <V.Spacer />
    //     <UI.IconButton color="inherit" onClick={unpin}><Icons.Close /></UI.IconButton>
    //   </UI.Toolbar>
    //   return appView(stores, tab, footer)
    // }

    // const hideLogoff = () => store.showLogoff = false
    // const logoff = () => { firebase.auth().signOut() ; hideLogoff() }
    // const logoffDialog =
    //   <UI.Dialog open={store.showLogoff} onClose={hideLogoff} aria-labelledby="logoff-title">
    //     <UI.DialogTitle id="logoff-title">{"Sign out?"}</UI.DialogTitle>
    //     <UI.DialogActions>
    //       <UI.Button onClick={hideLogoff} color="primary">No</UI.Button>
    //       <UI.Button onClick={logoff} color="primary" autoFocus>Yes</UI.Button>
    //     </UI.DialogActions>
    //   </UI.Dialog>

    // const mainToolbar = <UI.Toolbar>
    //   <UI.Typography style={{marginRight: 5}} variant="h6" color="inherit">I/O</UI.Typography>
    //   {TabInfo.filter(info => !store.isPinned(info.tab))
    //           .map(info => menuButton(info.tab, info.icon, () => store.tab = info.tab))}
    //   <V.Spacer />
    //   {width !== "xs" && menuButton("pin", Icons.pin, () => store.pin(store.tab))}
    //   {menuButton("logoff", <Icons.CloudOff />, () => store.showLogoff = true)}
    //   {logoffDialog}
    // </UI.Toolbar>

    // if (store.pinned.length > 0) return (
    //   <div className={classes.panes}>
    //   {appView(stores, store.tab, mainToolbar)}
    //   {store.pinned.map(tab => auxView(stores, infoFor(tab)))}
    //   </div>
    // )
    // else return appView(stores, store.tab, mainToolbar)
  }
}
