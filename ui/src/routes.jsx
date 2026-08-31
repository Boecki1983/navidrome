import React from 'react'
import { Route } from 'react-router-dom'
import Personal from './personal/Personal'
import Favorites from './favorites/Favorites'

const routes = [
  <Route exact path="/personal" render={() => <Personal />} key={'personal'} />,
  <Route
    exact
    path="/favorites"
    render={() => <Favorites />}
    key={'favorites'}
  />,
]

export default routes
