const { forEach, map, pipe, scan, take } = require("callbag-basics");
const random = require("random");
const { run, subscribe, hrun } = require("./index");

const makeRunNexkExercise = ({
  minLevel = -15,
  maxLevel = 15,
  activeTimeout = 0,
  inactiveTimeout = 500
} = {}) => {
  const runCenter = run(
    s => {
      if (s.label === "center")
        return {
          label: random.boolean() ? "left" : "right",
          stamp: s.stamp + random.uniform(activeTimeout + 100, 1000)() // "uniform_min > activeTimeout"
        };
      if (s.label === "left")
        return {
          label: "center",
          stamp: s.stamp + random.uniform(0, inactiveTimeout)() // "uniform_max < inactiveTimeout"
        };
      if (s.label === "right")
        return {
          label: "center",
          stamp: s.stamp + random.uniform(0, inactiveTimeout)() // "uniform_max < inactiveTimeout"
        };
      return s;
    },
    {
      label: "center",
      stamp: 0
    }
  );

  const runLeft = run(
    s => {
      if (s.label === "left")
        return {
          label: "center",
          stamp: s.stamp + random.uniform(inactiveTimeout + 100, 1000)() // "uniform_min > inactiveTimeout"
        };
      return s;
    },
    {
      label: "left",
      stamp: 0
    }
  );

  const runRight = run(
    s => {
      if (s.label === "right")
        return {
          label: "center",
          stamp: s.stamp + random.uniform(inactiveTimeout + 100, 1000)() // "uniform_min > inactiveTimeout"
        };
      return s;
    },
    {
      label: "right",
      stamp: 0
    }
  );

  const runNeckExercise = hrun(
    [runCenter, runLeft, runRight],
    s => {
      if (
        s.label === "hcenter" &&
        (s.child.label === "left" || s.child.label === "right") &&
        s.child.stamp > 5000
      )
        return {
          label: "h" + s.child.label,
          child: { label: s.child.label, stamp: 0 },
          stamp: s.stamp + s.child.stamp,
          start: s.child.label === "left" ? 1 : 2,
          stop: 0
        };
      if (
        (s.label === "hleft" || s.label === "hright") &&
        s.child.label === "center"
      )
        return {
          label: "hcenter",
          child: { label: "center", stamp: 0 },
          stamp: s.stamp + s.child.stamp,
          start: 0,
          stop: s.label === "hleft" ? 1 : 2
        };
      else return Object.assign({}, s, { start: undefined, stop: undefined });
    },
    {
      label: "hcenter",
      child: { label: "center", stamp: 0 },
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
    runNeckExercise,
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
