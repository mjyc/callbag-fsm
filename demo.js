const { forEach, map, pipe, scan, share } = require("callbag-basics");
const dropAfter = require("callbag-drop-after");
const random = require("random");
const { run, subscribe, hrun } = require("./index");

const makeSimHuman = ({ dropAfterPredicate = () => true } = {}) => {
  const runFacingCenter = run(
    s => {
      if (s.label === "facing_center")
        return {
          label: random.boolean() ? "facing_center" : "facing_away",
          stamp: s.stamp + random.uniform(500, 1000)()
        };
      if (s.label === "facing_away")
        // noise
        return {
          label: "facing_center",
          stamp: s.stamp + random.uniform(100, 500)()
        };
      return s;
    },
    {
      label: "facing_center",
      stamp: 0
    }
  );

  const runFacingAway = run(
    s => {
      if (s.label === "facing_away")
        return {
          label: "facing_center",
          stamp: s.stamp + random.uniform(1500, 2000)()
        };
      return s;
    },
    {
      label: "facing_away",
      stamp: 0
    }
  );

  const runSim = hrun(
    [runFacingCenter, runFacingAway],
    s => {
      if (
        s.label === "intention_center" &&
        s.child.label === "facing_away" &&
        s.child.stamp > 5000
      )
        return {
          label: "intention_away",
          child: { label: s.child.label, stamp: 0 },
          stamp: s.stamp + s.child.stamp,
          start: 1,
          stop: 0
        };
      if (s.label === "intention_away" && s.child.label === "facing_center")
        return {
          label: "intention_center",
          child: { label: "facing_center", stamp: 0 },
          stamp: s.stamp + s.child.stamp,
          start: 0,
          stop: 1
        };
      else return Object.assign({}, s, { start: undefined, stop: undefined });
    },
    {
      label: "intention_center",
      child: { label: "facing_center", stamp: 0 },
      stamp: 0,
      start: 0
    }
  );

  // TODOs
  // 7. switch the example into a simpler example and provide a mermaid diagram
  const states = pipe(
    runSim,
    scan(
      (prev, x) =>
        Object.assign(
          {
            parent: x.label,
            child: x.child.label,
            stamp: x.stamp + x.child.stamp
          },
          { i: prev.parent !== x.label ? prev.i + 1 : prev.i }
        ),
      { i: 0 }
    ),
    dropAfter(dropAfterPredicate),
    share
  );

  return {
    intention: map(x => ({ value: x.parent, stamp: x.stamp }))(states),
    action: map(x => ({ value: x.child, stamp: x.stamp }))(states)
  };
};

const simHuman = makeSimHuman({ dropAfterPredicate: x => x.i === 15 });

const done = {};
const simHumanRecorded = Object.keys(simHuman).reduce((prev, k) => {
  prev[k] = [];
  setTimeout(() => {
    subscribe({
      next: x => prev[k].push(x),
      complete: () => {
        done[k] = true;
        if (Object.keys(done).length === Object.keys(simHuman).length) {
          // done
          console.log(JSON.stringify({ input: simHumanRecorded }, null, 2));
        }
      }
    })(simHuman[k]);
  }, 0);

  return prev;
}, {});
