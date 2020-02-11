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
    if (t === 1 && id === null) play();
    if (t === 2) stop();
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
    if (t === 1) {
      if (talkbacks.length === fsms.length) {
        if (state === null) {
          state = initState;
          if (typeof state.start !== "undefined") talkbacks[state.start](1);
          if (typeof state.stop !== "undefined") talkbacks[state.stop](2);
        }
      }
      // else - fsms not ready, throw an error?
    }
    if (t === 2) {
      talkbacks.map(talkback => talkback(2));
      state = null;
    }
  });
};

const subscribe = ({ next, complete = () => {} } = {}) => fsm => {
  let talkback;
  fsm(0, (t, d) => {
    if (t === 0) talkback = d;
    if (t === 1) next(d);
    if (t === 2) complete();
    if (t === 0) talkback(1);
  });
  return () => {
    talkback && talkback(2);
  };
};

module.exports = {
  run,
  hrun,
  subscribe
};
