# callbag-fsm

A pausable & listenable callbag that sends data generated from running a finite state machine

```
npm install callbag-fsm
```

This repo was developed as a part of [interactive-program-repair](https://gitlab.com/mjyc/interactive-program-repair).

## Examples

```javascript
const { run, subscribe } = require('callbag-fsm');

const source = run(s => (s === "S1" ? "S2"), "S1");

subscribe({next: console.log})(source); // S1
                                        // S2
                                        // S1
                                        // S2
                                        // .
                                        // .
                                        // .
```

## Demo

Generating simulated sensor inputs, e.g., from a sim-human

```
npm install;
node demo.js;  // print out results
```

Visualizing generated sensor data:

```
node demo.js > viz/src/data.json
cd viz;
npm install;
pr start;
```
