const { forEach, fromIter, map, pipe, take } = require("callbag-basics");
const xs = require("xstream").default;
const { mockTimeSource } = require("@cycle/time");
const { run, hrun, subscribe } = require("./index");

describe("run", () => {
  test("#0", done => {
    const actual = [];
    pipe(
      run(s => (s === "S1" ? "S2" : s === "S2" ? "S3" : "S1"), "S1"),
      take(10),
      subscribe({
        next: d => actual.push(d),
        complete: () => {
          const expected = [
            "S1",
            "S2",
            "S3",
            "S1",
            "S2",
            "S3",
            "S1",
            "S2",
            "S3",
            "S1"
          ];
          expect(actual).toEqual(expected);
          done();
        }
      })
    );
  });
});

describe("hrun", () => {
  test("#0", done => {
    const actual = [];
    pipe(
      hrun(
        [
          run(s => (s === "S1" ? "S2" : s === "S2" ? "S3" : "S1"), "S1"),
          run(s => (s === "F1" ? "F2" : "F1"), "F1")
        ],
        s => {
          if (s.parent === "H1" && s.child === "S3")
            return { parent: "H2", child: "F1", start: 1, stop: 0 };
          if (s.parent === "H2" && s.child === "F2")
            return { parent: "H1", child: "S1", start: 0, stop: 1 };
          else
            return Object.assign({}, s, { start: undefined, stop: undefined });
        },
        { parent: "H1", child: "S1", start: 0 }
      ),
      map(x => ({ parent: x.parent, child: x.child })),
      take(10),
      subscribe({
        next: d => actual.push(d),
        complete: () => {
          const expected = [
            { parent: "H1", child: "S1" },
            { parent: "H1", child: "S2" },
            { parent: "H1", child: "S3" },
            { parent: "H2", child: "F1" },
            { parent: "H2", child: "F2" },
            { parent: "H1", child: "S1" },
            { parent: "H1", child: "S2" },
            { parent: "H1", child: "S3" },
            { parent: "H2", child: "F1" },
            { parent: "H2", child: "F2" }
          ];
          expect(actual).toEqual(expected);
          done();
        }
      })
    );
  });
});
