// inspired by the "pausable stream" example at https://egghead.io/articles/comparing-callbags-to-rxjs-for-reactive-programming
const run = (transition, initState) => (start, sink) => {
  if (start !== 0) return;
  let state = null;
  let id = null;

  const stop = () => {
    clearInterval(id);
    id = null;
    state = null;
  };
  const play = () => {
    id = setInterval(() => {
      if (state === null) state = initState;
      else state = transition(state);
      sink(1, state);
    }, 0);
  };
  sink(0, (t, d) => {
    // toggle fsm
    if (t === 1) {
      if (id) stop();
      else play();
    }
    if (t === 2) stop();
  });
};

const subscribe = ({ next, complete }) => fsm => {
  let talkback;
  fsm(0, (t, d) => {
    if (t === 0) talkback = d;
    if (t === 1) next(d);
    if (t === 2) complete();
    if (t === 0) talkback(1);
  });
};

// h(ierarchical fsm)run
const hrun = (fsms, transition, initState) => (start, sink) => {
  if (start !== 0) return;
  let state = null;
  let talkbacks = [];

  fsms.map((fsm, i) => {
    fsm(0, (t, d) => {
      if (t === 0) talkbacks[i] = d;
      if (t === 1) {
        const curState = Object.assign({}, state, { child: d });
        if (curState.stop !== i) sink(1, curState);
        state = transition(curState);
        if (talkbacks.length === fsms.length) {
          if (typeof state.start !== "undefined") talkbacks[state.start](1);
          if (typeof state.stop !== "undefined") talkbacks[state.stop](2);
        }
      }
      // t === 2 does not happen for fsms
    });
  });

  sink(0, t => {
    console.log("hrun t", t);
    if (t === 1) {
      if (talkbacks.length === fsms.length) {
        if (state === null) {
          // start
          state = initState;
          if (typeof state.start !== "undefined") talkbacks[state.start](1);
          if (typeof state.stop !== "undefined") talkbacks[state.stop](2);
        } else {
          // stop
          state = null;
          talkbacks.map(talkback => talkback(2));
        }
      }
      // else - fsms not ready, throw an error?
    }
    if (t === 2) {
      talkbacks.map(talkback => talkback(2));
    }
  });
};

/**
 * Utils for interoperating with [xstream](https://github.com/staltz/xstream)
 */

const xs = require("xstream").default;

const callbagToXs = timeSource => pullable =>
  xs.create({
    start(listener) {
      let talkback;
      let schedule;
      let currentTime;
      let startStamp;
      let lastStamp;
      pullable(0, (t, d) => {
        // console.log("callbagToXs t, d", t, d);
        if (t === 0) {
          const op = timeSource.createOperator();
          schedule = op.schedule;
          currentTime = op.currentTime;
          startStamp = currentTime();
          lastStamp = startStamp;
          talkback = d;
        }
        if (t === 1) {
          lastStamp = startStamp + d.stamp;
          schedule.next(listener, lastStamp, d);
        }
        if (t === 2)
          typeof d === "undefined"
            ? schedule.complete(listener, lastStamp)
            : schedule.error(listener, lastStamp, d);
        if (t === 0) talkback(1);
      });
    },
    stop() {}
  });

const xsToCallbag = xstream => (start, sink) => {
  if (start !== 0) return;
  const subs = xstream.subscribe({
    next: x => sink(1, x),
    error: x => sink(2, x),
    complete: () => sink(2)
  });
  sink(0, t => {
    if (t === 2) subs.unsubscribe();
  });
};

module.exports = {
  run,
  subscribe,
  hrun,
  callbagToXs,
  xsToCallbag
};
