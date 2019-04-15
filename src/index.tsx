import * as React from "react";
import * as ReactDOM from "react-dom";
// import * as firebase from "firebase/app"
import { Container, Grid } from 'semantic-ui-react'
// import 'semantic-ui-css/semantic.min.css'

// firebase.initializeApp({
//   apiKey: "AIzaSyDy3Caew0ql16PM0x7laFXTcs6jih_-e8o",
//   authDomain: "input-output-26476.firebaseapp.com",
//   projectId: "input-output-26476",
// })


const store = new AudioStore()
store.start()

ReactDOM.render(
  <Container>
  <h2>Renshu</h2>
  <Grid columns={3}>
    <Grid.Row>
      <Grid.Column>
        <div>Column 1</div>
      </Grid.Column>
      <Grid.Column>
        <div>Column 2</div>
      </Grid.Column>
      <Grid.Column>
        <div>Column 3</div>
      </Grid.Column>
    </Grid.Row>
    <Grid.Row>
      <Grid.Column>
        <div>Column 1</div>
      </Grid.Column>
      <Grid.Column>
        <div>Column 2</div>
      </Grid.Column>
      <Grid.Column>
        <div>Column 2</div>
      </Grid.Column>
    </Grid.Row>
  </Grid>
  </Container>,
  document.getElementById("app-root"))
