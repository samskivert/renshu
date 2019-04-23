import * as React from "react";
import * as ReactDOM from "react-dom";
import * as firebase from "firebase/app"
// import 'semantic-ui-css/semantic.min.css'
import * as S from "./stores"
import * as A from "./app"

firebase.initializeApp({
  apiKey: "AIzaSyAuqPyc7_V5S7YRjPsTLOlOr5wo190M_3M",
  authDomain: "renshu-35368.firebaseapp.com",
  databaseURL: "https://renshu-35368.firebaseio.com",
  projectId: "renshu-35368",
  storageBucket: "renshu-35368.appspot.com",
  messagingSenderId: "62024887940"
})


const appStore = new S.AppStore()
ReactDOM.render(
  <A.AppView store={appStore} />,
  document.getElementById("app-root"))
