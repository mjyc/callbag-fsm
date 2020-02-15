const { forEach, fromIter, map, pipe, scan, share } = require("callbag-basics");
const dropAfter = require("callbag-drop-after");
const dropRepeats = require("callbag-drop-repeats");
const random = require("random");
const zip = require("lodash.zip");
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
        // simulating noisy detection
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

// used for generating sensor inputs
const resample = (trace, interval) => {
  const arr = [];
  pipe(
    fromIter(trace),
    map(x =>
      Object.assign({}, x, {
        stamp: Math.floor(x.stamp / interval) * interval
      })
    ),
    dropRepeats((a, b) => a.stamp === b.stamp), // downsampling
    forEach(x => arr.push(x))
  );

  function* range(from, to) {
    let i = from;
    while (i <= to) {
      yield i;
      i++;
    }
  }

  const out = [];
  let arri = 0;
  pipe(
    fromIter(
      range(arr[0].stamp / interval, arr[arr.length - 1].stamp / interval)
    ),
    forEach(i => {
      // upsampling
      const newarri = arr.findIndex(x => x.stamp === i * interval);
      arri = newarri === -1 ? arri : newarri;
      out.push(Object.assign({}, arr[arri], { stamp: i * interval }));
    })
  );
  return out;
};

const simHuman = makeSimHuman({ dropAfterPredicate: x => x.i === 16 });

const done = {};
const simHumanRecorded = Object.keys(simHuman).reduce((prev, k) => {
  prev[k] = [];
  setTimeout(() => {
    subscribe({
      next: x => prev[k].push(x),
      complete: () => {
        done[k] = true;
        if (Object.keys(done).length === Object.keys(simHuman).length) {
          // done generating FSM traces and now to generating sensor inputs
          const samplingInterval = 100; // 1hz
          const generateNoseAngle = {
            intention_center: {
              facing_center: random.uniform(-20, 20),
              facing_away: () =>
                random.boolean()
                  ? random.uniform(-60, -20)()
                  : random.uniform(20, 60)()
            },
            intention_away: {
              facing_center: random.uniform(-20, 20),
              facing_away: () =>
                random.boolean()
                  ? random.uniform(-60, -20)()
                  : random.uniform(20, 60)()
            }
          };
          // preprocessing to
          // 1. remove the duplicates at transition points; keep 2nd ones
          // 2. remove the very last switched data point
          Object.keys(simHumanRecorded).map(k => {
            simHumanRecorded[k] = simHumanRecorded[k]
              .slice(0)
              .reverse()
              .filter(
                (x, i, arr) => arr.findIndex(y => y.stamp === x.stamp) === i
              )
              .reverse()
              .slice(0, -1);
          });
          const simHumanRecordedResampled = Object.keys(
            simHumanRecorded
          ).reduce((prev, k) => {
            prev[k] = resample(simHumanRecorded[k], samplingInterval);
            return prev;
          }, {});
          const noseAngle = zip(
            simHumanRecordedResampled.intention.map(x => x.value),
            simHumanRecordedResampled.action.map(x => x.value),
            simHumanRecordedResampled.action.map(x => x.stamp)
          ).map(([intention, action, stamp]) => ({
            value: generateNoseAngle[intention][action](),
            stamp
          }));

          // print results
          console.log(
            JSON.stringify(
              {
                input: Object.assign({}, simHumanRecorded, { noseAngle })
              },
              null,
              2
            )
          );
        }
      }
    })(simHuman[k]);
  }, 0);

  return prev;
}, {});
