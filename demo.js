const { forEach, map, pipe, scan, take } = require("callbag-basics");
const random = require("random");
const { run, subscribe, hrun } = require("./index");

const makeRunNexkExercise = ({} = {}) => {
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

  // TODOs:
  // 1. finish implement "counting" (merge map & scan)
  // 2. add dropwhen
  // 3. remove duplicates
  // 4. multicast it
  // 5. turn them into xstreams
  // 6. move traceviz in here and publish as a package
  // 7. switch the example into a simpler example and provide a mermaid diagram
  return pipe(
    runSim,
    map(x => ({
      parent: x.label,
      child: x.child.label,
      stamp: x.stamp + x.child.stamp
    })),
    scan(
      (prev, x) => {
        if (prev.parent !== x.parent)
          return Object.assign({}, x, { i: prev.i + 1 });
        return Object.assign({}, x, { i: prev.i });
      },
      { i: 0 }
    ),
    take(100)
  );
};

subscribe({
  next: d => {
    delete d.start;
    delete d.stop;
    console.log(d);
  },
  complete: () => {}
})(makeRunNexkExercise());
