#!/usr/bin/env node

/**
 * For generated simulated human inputs for the neck exercise program used in
 *   the [interactive_program_repair](../../) repo.
 */

const { forEach, fromIter, map, pipe, scan, share } = require("callbag-basics");
const dropAfter = require("callbag-drop-after");
const dropRepeats = require("callbag-drop-repeats");
const random = require("random");
const zip = require("lodash.zip");
const { run, subscribe, hrun } = require("./index");

const minLevel = -15;
const maxLevel = 15;
const activeTimeout = 0;
const inactiveTimeout = 500;

const makeSimHuman = ({ dropAfterPredicate = () => true } = {}) => {
  const runFacingCenter = run(
    s => {
      if (s.label === "facing_center")
        return {
          label: random.boolean() ? "facing_left" : "facing_right",
          stamp: s.stamp + random.uniform(activeTimeout + 100, 2000)() // "uniform_min > activeTimeout"
        };
      if (s.label === "facing_left")
        // simulating noisy detection
        return {
          label: "facing_center",
          stamp: s.stamp + random.uniform(0, inactiveTimeout - 100)() // "uniform_max < inactiveTimeout"
        };
      if (s.label === "facing_right")
        // simulating noisy detection
        return {
          label: "facing_center",
          stamp: s.stamp + random.uniform(0, inactiveTimeout - 100)() // "uniform_max < inactiveTimeout"
        };
      return s;
    },
    {
      label: "facing_center",
      stamp: 0
    }
  );

  const runFacingLeft = run(
    s => {
      if (s.label === "facing_left")
        return {
          label: "facing_center",
          stamp: s.stamp + random.uniform(inactiveTimeout + 100, 1000)() // "uniform_min > inactiveTimeout"
        };
      return s;
    },
    {
      label: "facing_left",
      stamp: 0
    }
  );

  const runFacingRight = run(
    s => {
      if (s.label === "facing_right")
        return {
          label: "facing_center",
          stamp: s.stamp + random.uniform(inactiveTimeout + 100, 1000)() // "uniform_min > inactiveTimeout"
        };
      return s;
    },
    {
      label: "facing_right",
      stamp: 0
    }
  );

  const runSim = hrun(
    [runFacingCenter, runFacingLeft, runFacingCenter, runFacingRight],
    s => {
      if (
        s.label === "intention_center" &&
        (s.child.label === "facing_left" || s.child.label === "facing_right") &&
        s.child.stamp > 5000
      )
        return s.i % 4 === 0
          ? {
              label: "intention_left",
              child: { label: "facing_left", stamp: 0 },
              stamp: s.stamp + s.child.stamp,
              i: s.i + 1,
              start: 1,
              stop: 0
            }
          : {
              label: "intention_right",
              child: { label: "facing_right", stamp: 0 },
              stamp: s.stamp + s.child.stamp,
              i: s.i + 1,
              start: 3,
              stop: 0
            };
      if (
        (s.label === "intention_left" || s.label === "intention_right") &&
        s.child.label === "facing_center"
      )
        return {
          label: "intention_center",
          child: { label: "facing_center", stamp: 0 },
          stamp: s.stamp + s.child.stamp,
          start: 0,
          i: s.i + 1,
          stop: s.label === "intention_left" ? 1 : 3
        };
      return Object.assign({}, s, { start: undefined, stop: undefined });
    },
    {
      label: "intention_center",
      child: { label: "facing_center", stamp: 0 },
      stamp: 0,
      i: 0,
      start: 0
    }
  );

  const states = pipe(
    runSim,
    map(x => ({
      parent: x.label,
      child: x.child.label,
      stamp: x.stamp + x.child.stamp,
      i: x.i
    })),
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

const simHuman = makeSimHuman({
  dropAfterPredicate: x => x.i === 13
});

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
          const generateFaceAngle = {
            facing_center: random.uniform(minLevel, maxLevel),
            facing_left: random.uniform(minLevel * 3, minLevel),
            facing_right: random.uniform(maxLevel, maxLevel * 3)
          };
          const generateNoseAngle = {
            facing_center: random.uniform(-60, 60),
            facing_left: random.uniform(-60, 60),
            facing_right: random.uniform(-60, 60)
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
          const faceAngle = zip(
            simHumanRecordedResampled.intention.map(x => x.value),
            simHumanRecordedResampled.action.map(x => x.value),
            simHumanRecordedResampled.action.map(x => x.stamp)
          ).map(([intention, action, stamp]) => ({
            value: generateFaceAngle[action](),
            stamp
          }));
          const noseAngle = zip(
            simHumanRecordedResampled.intention.map(x => x.value),
            simHumanRecordedResampled.action.map(x => x.value),
            simHumanRecordedResampled.action.map(x => x.stamp)
          ).map(([intention, action, stamp]) => ({
            value: generateNoseAngle[action](),
            stamp
          }));
          const askMultipleChoiceFinished = [{ value: "I'm ready", stamp: 0 }];
          const state = [{ value: "S1", stamp: 0 }].concat(
            simHumanRecorded.intention
              .map((x, i, arr) => {
                return Object.assign(
                  x,
                  x.value === "intention_center" &&
                    (i !== 0 &&
                      (arr[i - 1].value === "intention_left" ||
                        arr[i - 1].value === "intention_right"))
                    ? {
                        flag: true
                      }
                    : {
                        flag: false
                      }
                );
              })
              .filter(x => x.flag)
              .map((x, i) => ({ value: "S" + (i + 2), stamp: x.stamp }))
          );

          // print results
          console.log(
            JSON.stringify(
              {
                input: Object.assign({}, simHumanRecorded, {
                  faceAngle,
                  noseAngle,
                  askMultipleChoiceFinished,
                  state
                }),
                traces: Object.assign({}, simHumanRecorded, {
                  faceAngle,
                  noseAngle,
                  askMultipleChoiceFinished,
                  state
                }),
                settings: {
                  progName: "makeNeckExercise"
                }
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
