import * as React from 'react';
import ReactDOM from 'react-dom';

import classes from './style.module.scss';

const App = () => <h1 className={classes.title}>Hello, World!</h1>;

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
