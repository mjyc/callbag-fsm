# callbag-fsm

A pausable & listenable callbag that sends data generated from running a finite state machine

```
npm install callbag-fsm
```

## Examples

TODO: update below example

```javascript
const { run, subscribe } = require('callbag-fsm');
const forEach = require('callbag-for-each');

const source = fromIter([10,20,30,40])

forEach(x => console.log(x))(source); // 10
                                      // 20
                                      // 30
                                      // 40
```

## Demo

To run examples, install nodejs (>= v10.16.0) and npm (>= 6.9.0) and run

```
npm install;
node demo.js; // generate simulated sensor inputs (from a sim-human)
```

TODO: finish here

You
