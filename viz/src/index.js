const visualize = simTraces => {
  // process simTraces
  const inputTraces = {};
  Object.keys(simTraces.input).map(k => {
    if (simTraces.input[k].length > 0) {
      inputTraces[k] = simTraces.input[k];
    }
  });

  // update DOM
  const elems = {
    div: document.createElement("div"),
    canvases: []
      .concat(Object.keys(inputTraces))
      .map(() => document.createElement("canvas"))
  };

  elems.div.style = "width: 99%;";
  elems.canvases.map((canvas, i) => {
    canvas.id = `chart${i}`;
    canvas.style = `width: 99%; height: ${Math.floor(
      98 / elems.canvases.length
    )}vh;`;
    elems.div.appendChild(canvas);
  });
  document.body.appendChild(elems.div);

  // visualize!
  const tableau10 = {
    blue: "#1f77b4",
    orange: "#ff7f0e",
    green: "#2ca02c",
    red: "#d62728",
    purple: "#9467bd",
    brown: "#8c564b",
    magenta: "#e377c2",
    gray: "#7f7f7f",
    lime: "#bcbd22",
    cyan: "#17becf"
  };

  Object.keys(inputTraces)
    .map(k => {
      const suggestedMax =
        []
          .concat(...Object.values(inputTraces))
          .map(({ stamp }) => stamp)
          .sort((a, b) => a - b)
          .reverse()[0] / 1000;
      return {
        data: inputTraces[k].map(({ stamp, value }) => ({
          x: stamp / 1000,
          y: value
        })),
        type:
          typeof inputTraces[k][0].value === "string" ? "category" : "linear",
        labels:
          typeof inputTraces[k][0].value === "string"
            ? inputTraces[k]
                .map(k => k.value)
                .filter((k, i, arr) => arr.indexOf(k) === i)
                .reverse()
            : undefined,
        labelString: k,
        suggestedMax
      };
    })
    .map(({ data, type, labels, labelString, suggestedMax }, i) => {
      new Chart(document.getElementById(`chart${i}`), {
        type: "line",
        data: {
          datasets: [
            {
              backgroundColor: tableau10[Object.keys(tableau10)[i]],
              borderColor: tableau10[Object.keys(tableau10)[i]],
              borderWidth: 1,
              pointRadius: 2,
              fill: false,
              lineTension: 0,
              steppedLine: true,
              data: data
            }
          ]
        },
        options: {
          legend: {
            display: false
          },
          scales: {
            xAxes: [
              {
                type: "linear",
                display: true,
                scaleLabel: {
                  display: true,
                  labelString: "Time (seconds)"
                },
                ticks: {
                  stepSize: 5,
                  suggestedMax
                }
              }
            ],
            yAxes: [
              {
                type,
                labels,
                display: true,
                scaleLabel: {
                  display: true,
                  labelString
                },
                afterFit: function(scaleInstance) {
                  scaleInstance.width = 100; // sets the width to 100px
                }
              }
            ]
          },
          responsive: true,
          animation: false
        }
      });
    });
};

fetch("/src/data.json")
  .then(response => {
    return response.json();
  })
  .then(rawData => {
    console.log(rawData);
    visualize(rawData);
  });
