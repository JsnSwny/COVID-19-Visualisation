// Variables
// -----------------------

let data = null;
let mapData = null;
let casesRollup = null;
let sortedRollup = null;
let mapSvg = null;
let view = document.getElementById("view");
let filteredData = null;
let filteredCountries = [];
let selectedCountries = [];
let currentView = "map";
let filterDateMin = null;
let filterDateMax = null;
let isSimulating = false;
let dateExtents = null;
const continentSelect = document.getElementById("continent-selector"); // Continent selector dropdown
let chartDisplay = ["Cases"]; // Default for chart metrics to be displayed
const toggleViews = document.querySelectorAll(".toggle-view"); // Get all view tabs (Map, Chart etc.)
const simulationButton = document.getElementById("simulation-button");

// -----------------------

// Colors
// ------

var chartLines = d3
  .scaleOrdinal()
  .domain(["Cases", "Vaccinations", "Boosters", "Deaths"])
  .range(["#27A6DD", "#ED1B24", "#F8931F", "#009345"]);

//   https://www.vis4.net/blog/2013/09/mastering-multi-hued-color-scales/
var color = d3
  .scaleThreshold()
  .domain([1000, 10000, 1000000, 5000000, 10000000, 25000000, 50000000])
  .range([
    "#FFFFE0",
    "#FFDFB8",
    "#FFBC94",
    "#FF9777",
    "#FF6962",
    "#EE4256",
    "#D21F47",
    "#B0062C",
    "#8B0000",
  ]);

var darkColor = d3
  .scaleThreshold()
  .domain([1000, 10000, 1000000, 5000000, 10000000, 25000000, 50000000])
  .range([
    "#ffff47",
    "#ff9a1f",
    "#fa5d00",
    "#dd3400",
    "#c80900",
    "#8b0c1b",
    "#4d0b1a",
    "#1c0107",
    "#000",
  ]);

var continentColor = d3
  .scaleOrdinal()
  .domain([
    "Europe",
    "North America",
    "South America",
    "Oceania",
    "Africa",
    "Asia",
  ])
  .range(["#27A6DD", "#ED1B24", "#F8931F", "#009345", "#FFCD52", "#8CC63E"]);

var lineColor = d3
  .scaleOrdinal()
  .domain(d3.range(20))
  .range([
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf",
    "#393b79",
    "#637939",
    "#8c6d31",
    "#d6616b",
    "#7b4173",
    "#a55194",
    "#ce6dbd",
    "#de9ed6",
    "#3182bd",
    "#6baed6",
  ]);

// HELPER FUNCTIONS
// -----------------------

// Get the HTML item from the countries list by it's name
const getCountryText = (name) => {
  return d3.selectAll("[data-country]").filter(function () {
    return d3.select(this).attr("data-country") === name;
  });
};

// Get the rolled up stats of a country
const getCountryStats = (country_code) => {
  return countryStats.get(country_code);
};

// Format large numbers to K or M values
function formatNumber(number) {
  if (number >= 1000000) {
    return (number / 1000000).toFixed(0) + "M";
  } else if (number >= 1000) {
    return (number / 1000).toFixed(0) + "K";
  } else {
    return number.toString();
  }
}

// For calculating rollups
const calculateRollup = (data, group_by, sum_by = "cases") => {
  let casesRollup = data.filter((item) => item.iso_code.length <= 3);

  casesRollup = d3.rollup(
    casesRollup,
    (v) => d3.sum(v, (d) => d[sum_by]),
    (d) => d[group_by]
  );

  let sortedRollup = Array.from(casesRollup, ([key, value]) => ({
    key,
    value,
  })).sort((a, b) => d3.descending(a.value, b.value));

  return { casesRollup, sortedRollup };
};

// DATA REQUEST FUNCTIONS
// -----------------------

// Gets map data from github URL
const getMap = async () => {
  const mapData = await d3.json(
    "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"
  );
  return mapData;
};

// Gets covid data from local csv from a filtered csv file (filtered in exploration.ipynb to reduce load time)
const getData = async () => {
  const data = await d3.csv("filtered_cases.csv", (d) => {
    return {
      iso_code: d.iso_code,
      location: d.location,
      continent: d.continent,
      deaths: d.new_deaths,
      date: d3.timeParse("%Y-%m-%d")(d.date),
      cases: d.new_cases,
      vaccinations: d.new_vaccinations,
      gdp: d.gdp_per_capita,
      cases_per_million: d.new_cases_per_million,
      vaccinations_per_million: d.new_vaccinations_smoothed_per_million,
      deaths_per_million: d.new_deaths_per_million,
      boosters_per_million: d.new_boosters_per_million,
    };
  });
  return data;
};

// -----------------------

// View update functions
// -----------------------
const updateView = () => {
  switch (currentView) {
    case "map":
      updateMap();
      break;
    case "gdp":
      loadGDP();
      break;
    case "chart":
      loadChart();
      break;
    case "continentor":
      updateContinentor();
      break;
  }
};

const reloadView = () => {
  d3.select("#view").selectAll("svg").remove();
  switch (currentView) {
    case "map":
      loadMap(mapData);
      break;
    case "gdp":
      loadGDP();
      break;
    case "chart":
      loadChart();
      break;
    case "continentor":
      loadContinentor();
      break;
  }
};

// When view tab is selected, update view
toggleViews.forEach((item) => {
  item.addEventListener("click", () => {
    d3.select("#view").selectAll("svg").remove();
    toggleViews.forEach((view) => view.classList.remove("active"));
    item.classList.add("active");
    currentView = item.dataset.view;
    reloadView();
  });
});

// When window is resized, reload the current view
window.addEventListener("resize", (event) => {
  reloadView();
});

// -----------------------

// GDP VIEW
// -----------------------

const loadGDP = () => {
  d3.select("#view").selectAll("svg").remove();
  d3.select("#legend-container").selectAll("div").remove();
  mapWidth = document.querySelector(".map").offsetWidth;
  mapHeight = document.querySelector(".view").offsetHeight;
  // set the dimensions and margins of the graph
  const margin = { top: 10, right: 30, bottom: 60, left: 60 },
    width = mapWidth - margin.left - margin.right,
    height = mapHeight - margin.top - margin.bottom;

  // append the svg object to the body of the page
  const svg = d3
    .select("#view")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  let data = filteredData.filter((item) => item.iso_code.length <= 3);
  let rollupData = d3.rollup(
    data,
    (v) => ({
      average_gdp: d3.mean(v, (d) => d.gdp),
      average_cases_per_million: d3.mean(v, (d) => d.cases_per_million),
      continent: v[0].continent,
    }),
    (d) => d.location
  );

  const maxValues = {
    max_gdp: d3.max(rollupData.values(), (d) => d.average_gdp),
    max_cases_per_million: d3.max(
      rollupData.values(),
      (d) => d.average_cases_per_million
    ),
  };

  const filteredRollupData = d3.filter(
    rollupData,
    ([location, values]) => values.average_gdp != 0
  );

  const x = d3.scaleLinear().domain([0, maxValues.max_gdp]).range([0, width]);
  svg
    .append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(x));

  // Add Y axis
  const y = d3
    .scaleLinear()
    .domain([0, maxValues.max_cases_per_million])
    .range([height, 0]);
  svg.append("g").call(d3.axisLeft(y));

  // X label
  d3.select("#view svg")
    .append("text")
    .attr("x", width / 2 + 100)
    .attr("y", height + 50)
    .attr("text-anchor", "middle")
    .attr("class", "chart-labels")
    .style("font-size", 12)
    .text("GDP Per Capita");

  // Y label
  d3.select("#view svg")
    .append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "translate(20," + height / 2 + ")rotate(-90)")
    .style("font-size", 12)
    .attr("class", "chart-labels")
    .text("New Cases Per Million People");

  // // Add dots
  svg
    .append("g")
    .selectAll("dot")
    .data(filteredRollupData)
    .join(
      function (enter) {
        g = enter
          .append("circle")
          .attr("cx", function (d) {
            return x(d[1].average_gdp);
          })
          .attr("cy", function (d) {
            return y(d[1].average_cases_per_million);
          })
          .attr("r", 3)
          .style("fill", (d) => continentColor(d[1].continent))
          .on("mousemove", (e, d) => {
            console.log(d);
            code = codeToCountry[d[0]];
            toolboxMouseMove(e, code);
          })

          .on("mouseover", (e, d) => {
            toolboxMouseOver();
          })
          .on("mouseout", (e, d) => {
            toolboxMouseOut();
          });
        return g;
      },
      function (update) {
        let circle = update;
        circle
          .attr("cx", function (d) {
            return x(d[1].average_gdp);
          })
          .attr("cy", function (d) {
            return y(d[1].average_cases_per_million);
          });

        return;
      },
      function (exit) {
        return exit.remove();
      }
    );

  const legend = d3.select("#legend-container");

  continentColor.domain().forEach((continent, i) => {
    let legendItem = legend
      .append("div")
      .attr("class", "legend__item")
      .on("click", () => {
        continentSelect.value = continent;
        updateContinent(continent);
      })
      .style("cursor", "pointer");
    legendItem
      .append("span")
      .attr("width", 8)
      .attr("height", 8)
      .attr("class", "legend__color")
      .style("background-color", continentColor(continent))
      .style("opacity", () => {
        if (continentSelect.value == "World") {
          return 1;
        } else {
          if (continent != continentSelect.value) {
            return 0.4;
          }
        }
      });

    legendItem.append("span").text(continent).attr("class", "legend__text");
  });
};

// -----------------------

// CONTINENTOR TAB
// -----------------------

const loadContinentor = () => {
  mapHeight = document.querySelector(".view").offsetHeight;
  let r = mapHeight;
  lineSvg = d3
    .select("#view")
    .append("svg")
    .attr("width", r)
    .attr("height", r)
    .attr("class", "continentor");
  lineSvg = lineSvg.append("g");

  updateContinentor();
};

const updateContinentor = () => {
  d3.select("#legend-container").selectAll("div").remove();
  mapHeight = document.querySelector(".view").offsetHeight - 10;
  let r = mapHeight;

  let rollup = filteredData.filter((item) => item.iso_code.length <= 3);

  rollup = d3.rollup(
    rollup,
    (v) => d3.sum(v, (d) => d.cases),
    (d) => d.continent,
    (d) => d.location
  );

  var packLayout = d3.pack().size([r, r]);

  var rootNode = d3.hierarchy(rollup);
  rootNode.sum(function (d) {
    return d[1];
  });

  packLayout(rootNode);

  let lineSvg = d3.select(".continentor").select("g");

  var nodes = lineSvg
    .selectAll("g")
    .data(rootNode.descendants())
    .join(
      function (enter) {
        nodes = enter.append("g").attr("transform", function (d) {
          return "translate(" + [d.x, d.y] + ")";
        });
        nodes
          .append("circle")
          .style("fill", (d) => {
            switch (d.depth) {
              case 1:
                return continentColor(d.data[0]);
              case 2:
                return continentColor(d.parent.data[0]);
              default:
                return "#f1f1f1";
            }
          })
          .style("cursor", "pointer")
          .style("stroke", (d) => {
            if (d.depth == 0) {
              return "#d9d9d9";
            }
          })
          .style("stroke-width", (d) => {
            if (d.depth == 0) {
              return 2;
            }
          })

          .on("mousemove", (e, d) => {
            if (!d.data[0] && d.depth == 0) {
              code = "OWID_WRL";
            } else {
              code = codeToCountry[d.data[0]];
            }

            toolboxMouseMove(e, code);
          })

          .on("mouseover", (e, d) => {
            toolboxMouseOver();
          })
          .on("mouseout", (e, d) => {
            code = codeToCountry[d.data[0]];
            toolboxMouseOut();
          })
          .on("click", (e, d) => {
            code = codeToCountry[d.data[0]];
            let checkbox = getCountryText(code).node().children[0];
            checkbox.checked = !checkbox.checked;

            if (checkbox.checked) {
              addSelectedCountry(code);
            } else {
              removeSelectedCountry(code);
            }
          })
          .transition()
          .duration(2000)
          .attr("r", function (d) {
            return d.r;
          });
      },
      function (update) {
        nodes = update
          .transition()
          .ease(d3.easeSin)
          .duration(500)
          .attr("transform", function (d) {
            return "translate(" + [d.x, d.y] + ")";
          })
          .select("circle")
          .attr("r", function (d) {
            return d.r;
          })
          .style("fill", (d) => {
            switch (d.depth) {
              case 1:
                return continentColor(d.data[0]);
              case 2:
                return continentColor(d.parent.data[0]);
              default:
                return "#f1f1f1";
            }
          });
      },
      function (exit) {
        return exit.remove();
      }
    );

  const legend = d3.select("#legend-container");

  continentColor.domain().forEach((continent, i) => {
    let legendItem = legend.append("div").attr("class", "legend__item");
    legendItem
      .append("span")
      .attr("width", 8)
      .attr("height", 8)
      .attr("class", "legend__color")
      .style("background-color", continentColor(continent));
    legendItem.append("span").text(continent).attr("class", "legend__text");
  });
};

// -----------------------

// CHART TAB
// -----------------------

const loadChart = () => {
  // set the dimensions and margins of the graph
  d3.select("#view").selectAll("svg").remove();
  d3.select("#legend-container").selectAll("div").remove();
  mapHeight = document.querySelector(".view").offsetHeight;
  mapWidth = document.querySelector(".map").offsetWidth;
  const margin = { top: 10, right: 100, bottom: 70, left: 65 },
    width = mapWidth - margin.left - margin.right,
    height = mapHeight - margin.top - margin.bottom;

  // append the svg object to the body of the page
  const lineSvg = d3
    .select("#view")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  const legend = d3.select("#legend-container");

  // X label
  d3.select("#view svg")
    .append("text")
    .attr("x", width / 2 + 100)
    .attr("y", height + 80)
    .attr("text-anchor", "middle")
    .attr("class", "chart-labels")
    .style("font-size", 12)
    .text("Date");

  // Y label
  d3.select("#view svg")
    .append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "translate(10," + height / 2 + ")rotate(-90)")
    .style("font-size", 12)
    .attr("class", "chart-labels")
    .text("Total Per Million People");

  if (selectedCountries == 0) {
    chartLines.domain().forEach((item, i) => {
      let legendItem = legend
        .append("div")
        .attr("class", "legend__item")
        .style("opacity", () => (chartDisplay.includes(item) ? 1 : 0.4))
        .style("cursor", "pointer")
        .on("click", () => {
          if (chartDisplay.includes(item)) {
            chartDisplay = chartDisplay.filter(
              (chartItem) => chartItem != item
            );
          } else {
            chartDisplay.push(item);
          }
          loadChart();
        });
      legendItem
        .append("span")
        .attr("width", 8)
        .attr("height", 8)
        .attr("class", "legend__color")
        .style("background-color", chartLines(item));

      legendItem.append("span").text(item).attr("class", "legend__text");
    });
  } else {
    selectedCountries.forEach((item, idx) => {
      let legendItem = legend.append("div").attr("class", "legend__item");

      legendItem
        .append("span")
        .attr("width", 8)
        .attr("height", 8)
        .attr("class", "legend__color")
        .style("background-color", lineColor(idx));

      legendItem.append("span").text(item).attr("class", "legend__text");
    });
  }

  updateChart();
};

const addSelectedCountry = (id) => {
  selectedCountries.push(id);
  updateView();
};

const removeSelectedCountry = (id) => {
  selectedCountries = selectedCountries.filter((item) => item != id);
  updateView();
};

function updateChart() {
  mapWidth = document.querySelector(".map").offsetWidth;
  mapHeight = document.querySelector(".view").offsetHeight;
  const margin = { top: 10, right: 100, bottom: 30, left: 50 },
    width = mapWidth - margin.left - margin.right,
    height = mapHeight - margin.top - margin.bottom;
  const lineSvg = d3.select("#view").select("g");
  lineSvg.selectAll("g").remove();
  lineSvg.selectAll("path").remove();

  let new_data = filteredData.filter((item) =>
    filteredCountries.includes(item.iso_code)
  );
  let rollup = calculateRollup(
    new_data,
    "date",
    "cases_per_million"
  ).casesRollup;

  let rollupVaccinations = calculateRollup(
    new_data,
    "date",
    "vaccinations_per_million"
  ).casesRollup;

  let rollupDeaths = calculateRollup(
    new_data,
    "date",
    "deaths_per_million"
  ).casesRollup;

  let rollupBoosters = calculateRollup(
    new_data,
    "date",
    "boosters_per_million"
  ).casesRollup;

  const x = d3
    .scaleTime()
    .domain(
      d3.extent(rollup, function (d) {
        return d[0];
      })
    )
    .range([0, width]);
  let xAxis = lineSvg
    .append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(x));

  // Add a clipPath: everything out of this area won't be drawn.
  var clip = lineSvg
    .append("defs")
    .append("svg:clipPath")
    .attr("id", "clip")
    .append("svg:rect")
    .attr("width", width)
    .attr("height", height)
    .attr("x", 0)
    .attr("y", 0);

  // Add brushing
  var brush = d3
    .brushX() // Add the brush feature using the d3.brush function
    .extent([
      [0, 0],
      [width, height],
    ]) // initialise the brush area: start at 0,0 and finishes at width,height: it means I select the whole graph area
    .on("end", resizeChart); // Each time the brush selection changes, trigger the 'updateChart' function

  // Create the line variable: where both the line and the brush take place
  var line = lineSvg.append("g").attr("clip-path", "url(#clip)");

  let y = null;
  let path = null;

  let vacMax = 0;
  let caseMax = 0;
  let boosterMax = 0;
  let deathMax = 0;

  if (chartDisplay.includes("Vaccinations")) {
    vacMax = d3.max(rollupVaccinations, function (d) {
      return d[1];
    });
  }

  if (chartDisplay.includes("Cases")) {
    caseMax = d3.max(rollup, function (d) {
      return d[1];
    });
  }

  if (chartDisplay.includes("Deaths")) {
    deathMax = d3.max(rollupDeaths, function (d) {
      return d[1];
    });
  }

  if (chartDisplay.includes("Boosters")) {
    boosterMax = d3.max(rollupBoosters, function (d) {
      return d[1];
    });
  }

  let max = Math.max(vacMax, caseMax, deathMax, boosterMax);

  if (selectedCountries.length == 0) {
    y = d3.scaleLinear().domain([0, max]).range([height, 0]);
    lineSvg.append("g").call(d3.axisLeft(y));

    // Add the line
    path = line.append("path");

    if (chartDisplay.includes("Cases")) {
      path
        .datum(rollup)
        .attr("class", "line") // I add the class line to be able to modify this line later on.
        .attr("fill", "none")
        .attr("stroke", chartLines("Cases"))
        .attr("stroke-width", 2)
        .attr(
          "d",
          d3
            .line()
            .x(function (d) {
              return x(d[0]);
            })
            .y(function (d) {
              return y(d[1]);
            })
        );
    }
    if (chartDisplay.includes("Vaccinations")) {
      path = line.append("path");
      path
        .datum(rollupVaccinations)
        .attr("class", "line") // I add the class line to be able to modify this line later on.
        .attr("fill", "none")
        .attr("stroke", chartLines("Vaccinations"))
        .attr("stroke-width", 2)
        .attr(
          "d",
          d3
            .line()
            .x(function (d) {
              return x(d[0]);
            })
            .y(function (d) {
              return y(d[1]);
            })
        );
    }
    if (chartDisplay.includes("Deaths")) {
      path = line.append("path");
      path
        .datum(rollupDeaths)
        .attr("class", "line") // I add the class line to be able to modify this line later on.
        .attr("fill", "none")
        .attr("stroke", chartLines("Deaths"))
        .attr("stroke-width", 2)
        .attr(
          "d",
          d3
            .line()
            .x(function (d) {
              return x(d[0]);
            })
            .y(function (d) {
              return y(d[1]);
            })
        );
    }
    if (chartDisplay.includes("Boosters")) {
      path = line.append("path");
      path
        .datum(rollupBoosters)
        .attr("class", "line") // I add the class line to be able to modify this line later on.
        .attr("fill", "none")
        .attr("stroke", chartLines("Boosters"))
        .attr("stroke-width", 2)
        .attr(
          "d",
          d3
            .line()
            .x(function (d) {
              return x(d[0]);
            })
            .y(function (d) {
              return y(d[1]);
            })
        );
    }
  } else {
    all_country_data = new_data.filter((item) =>
      selectedCountries.includes(item.iso_code)
    );

    let max = d3.max(all_country_data, function (d) {
      return parseInt(d.cases);
    });
    y = d3.scaleLinear().domain([0, max]).range([height, 0]);
    lineSvg.append("g").call(d3.axisLeft(y));

    selectedCountries.forEach((item, idx) => {
      countryData = new_data.filter((data) => data.iso_code == item);

      // Add the line
      path = line.append("path");

      path
        .datum(countryData)
        .attr("class", "line")
        .attr("fill", "none")
        .attr("stroke", lineColor(idx))
        .attr("stroke-width", 2)
        .attr(
          "d",
          d3
            .line()
            .x(function (d) {
              return x(d.date);
            })
            .y(function (d) {
              return y(d.cases);
            })
        );
    });
  }
  // Add the brushing
  line.append("g").attr("class", "brush").call(brush);

  // A function that set idleTimeOut to null
  var idleTimeout;
  function idled() {
    idleTimeout = null;
  }

  // Handles when chart is brushed/resized
  function resizeChart(e) {
    extent = e.selection; // Boundaries

    // If no selection, back to initial coordinate. Otherwise, update X axis domain
    if (!e.selection) {
      if (!idleTimeout) return (idleTimeout = setTimeout(idled, 350)); // This allows to wait a little bit
      x.domain([4, 8]);
    } else {
      filterDateMin = x.invert(e.selection[0]);
      filterDateMax = x.invert(e.selection[1]);
      filterDataByDate(filteredData);
      x.domain([filterDateMin, filterDateMax]);
      line.select(".brush").call(brush.move, null); // Removes gray selection after brushing is complete
    }

    // Update axis and line position
    xAxis.transition().duration(1000).call(d3.axisBottom(x));

    if (selectedCountries.length == 0) {
      line
        .selectAll(".line")
        .transition()
        .duration(1000)
        .attr(
          "d",
          d3
            .line()
            .x(function (d) {
              return x(d[0]);
            })
            .y(function (d) {
              return y(d[1]);
            })
        );
    } else {
      line
        .selectAll(".line")
        .transition()
        .duration(1000)
        .attr(
          "d",
          d3
            .line()
            .x(function (d) {
              return x(d.date);
            })
            .y(function (d) {
              return y(d.cases);
            })
        );
    }
  }

  // This was to transition the line path, but was buggy when paired with brushing so has been removed

  // const pathLength = path.node().getTotalLength();

  // const transitionPath = d3.transition().ease(d3.easeSin).duration(2000);

  // path
  //   .attr("stroke-dashoffset", pathLength)
  //   .attr("stroke-dasharray", pathLength)
  //   .transition(transitionPath)
  //   .attr("stroke-dashoffset", 0);
}

// -----------------------

// TOOLTIP
// -----------------------

const Tooltip = d3
  .select("#view")
  .append("div")
  .attr("class", "tooltip")
  .style("opacity", 0)
  .style("background-color", "white")
  .style("border", "solid")
  .style("border-width", "2px")
  .style("border-radius", "5px")
  .style("padding", "5px")
  .style("position", "absolute")
  .style("pointer-events", "none");

const toolboxMouseOver = function () {
  Tooltip.style("opacity", 1);
};

var toolboxMouseMove = function (event, code) {
  stats = getCountryStats(code);
  Tooltip.html(
    `<h4 class="toolbox__title">${stats.location}</h4>
    Cases: ${stats.cases}
    <br>
    Vaccinations: ${stats.vaccinations}
    <br>
    Deaths: ${stats.deaths}
    `
  )
    .style("left", d3.pointer(event, this)[0] + "px")
    .style("top", d3.pointer(event, this)[1] - 100 + "px");
};
var toolboxMouseOut = function () {
  Tooltip.style("opacity", 0);
};

// -----------------------

// MAP VIEW
// -----------------------

const loadMap = (mapData) => {
  d3.select("#legend-container").selectAll("div").remove();
  mapSvg = d3.select("#view").append("svg").attr("id", "map");
  let width = document.querySelector(".map").offsetWidth;
  let height = document.querySelector(".view").offsetHeight;
  mapSvg.attr("width", width);
  mapSvg.attr("height", height);
  const projection = d3.geoNaturalEarth1().translate([width / 2, height / 2]);
  projection.fitSize([width, height], mapData);

  let map = mapSvg
    .on("wheel", function (e) {
      initX = d3.pointer(e, this);
    })
    .append("g");
  map
    .selectAll("path")
    .data(mapData.features.filter((d) => d.id !== "GRL" && d.id !== "ATA"))
    .join("path")
    .attr("class", "country")
    .attr("d", d3.geoPath().projection(projection))
    .style("stroke", "#510012")
    .attr("fill", (d) => {
      return color(casesRollup.get(d.id));
    })
    .on("mouseover", function (e, d) {
      getCountryText(d.id).classed("country-item--hover", true);
      toolboxMouseOver();
    })
    .on("mouseout", function (e, d) {
      getCountryText(d.id).classed("country-item--hover", false);
      toolboxMouseOut();
    })
    .on("mousemove", (e, d) => toolboxMouseMove(e, d.id))
    .on("click", function (e, d) {
      let checkbox = getCountryText(d.id).node().children[0];
      checkbox.checked = !checkbox.checked;

      if (checkbox.checked) {
        addSelectedCountry(d.id);
      } else {
        removeSelectedCountry(d.id);
      }
    });

  const legend = d3.select("#legend-container");

  color.domain().forEach((range, i) => {
    let legendItem = legend.append("div").attr("class", "legend__item");
    legendItem
      .append("span")
      .attr("width", 8)
      .attr("height", 8)
      .attr("class", "legend__color")
      .style("background-color", color(range));
    legendItem
      .append("span")
      .text(
        `${formatNumber(range)}${
          i == color.domain().length - 1
            ? "+"
            : ` - ${formatNumber(color.domain()[i + 1])}`
        } `
      )
      .attr("class", "legend__text");
  });

  // mapSvg.attr("height", document.getElementById("map").getBBox().height + 10);
};

const updateMap = () => {
  d3.selectAll(".country")
    .transition()
    .ease(d3.easeSin)
    .duration(500)
    .attr("fill", (d) => {
      return color(casesRollup.get(d.id));
    });
};

// -----------------------

// Update list of countries on the right
const loadCountryText = (data) => {
  var g = d3
    .select("#countries_list")
    .selectAll("li")
    .data(data)
    .join(
      function (enter) {
        g = enter
          .append("li")
          .attr("class", "country-item")
          .attr("data-country", (d) => d.key)
          .on("click", function (e, d) {
            let checkbox = getCountryText(d.key).node().children[0];
            checkbox.checked = !checkbox.checked;

            if (checkbox.checked) {
              addSelectedCountry(d.key);
            } else {
              removeSelectedCountry(d.key);
            }
          });
        g.append("input")
          .attr("type", "checkbox")
          .attr("class", "country-item__check")
          .on("click", function () {
            this.checked = !this.checked;
          });

        g.append("span")
          .attr("class", "country-item__indicator")
          .style("background-color", (d) => color(d.value));

        g.append("img")
          .attr("class", "country-item__image")
          .attr("crossorigin", "anonymous")
          // https://alexsobolenko.github.io/flag-icons/
          .attr("src", (d) => `flags/4x3/${d.key.toLowerCase()}.svg`);
        var countryText = g
          .append("div")

          .style("flex", "1")
          .style("display", "flex")
          .style("justify-content", "space-between");

        countryText
          .append("span")
          .attr("class", "country-text-name")
          .text((d) => countryToCode[d.key])
          .style("font-weight", "bold");

        countryText
          .append("span")
          .attr("class", "country-text-value")
          .text((d) => d.value.toLocaleString())
          .style("flex", 1)
          .style("text-align", "right");
        return g;
      },
      function (update) {
        update.attr("data-country", (d) => d.key);
        update
          .select(".country-text-value")
          .text((d) => d.value.toLocaleString());
        update.select(".country-text-name").text((d) => countryToCode[d.key]);

        update
          .select(".country-item__indicator")
          .style("background-color", (d) => color(d.value));

        update
          .select(".country-item__image")
          .attr("src", (d) => `flags/4x3/${d.key.toLowerCase()}.svg`);

        return;
      },
      function (exit) {
        return exit.remove();
      }
    );
};

// General function for handling updating data when it changes
const updateData = () => {
  // Mapping code to country
  countryToCode = filteredData.reduce((result, item) => {
    result[item.iso_code] = item.location;
    return result;
  }, {});

  // Mapping country to code
  codeToCountry = filteredData.reduce((result, item) => {
    result[item.location] = item.iso_code;
    return result;
  }, {});

  // Mapping code to country
  codeToContinent = filteredData.reduce((result, item) => {
    result[item.iso_code] = item.continent;
    return result;
  }, {});

  sortedRollup = calculateRollup(filteredData, "iso_code").sortedRollup;
  casesRollup = calculateRollup(filteredData, "iso_code").casesRollup;

  // Update total value in top left
  d3.select("#total").text(
    sortedRollup
      .map((item) => item.value)
      .reduce((a, b) => a + b, 0)
      .toLocaleString()
  );

  // Define country stats for tooltip
  countryStats = d3.rollup(
    filteredData,
    (v) => ({
      cases: d3.sum(v, (d) => d["cases"]).toLocaleString(),
      vaccinations: d3.sum(v, (d) => d["vaccinations"]).toLocaleString(),
      deaths: d3.sum(v, (d) => d["deaths"]).toLocaleString(),
      continent: v[0].continent,
      location: v[0].location,
    }),
    (d) => d.iso_code
  );

  loadCountryText(sortedRollup);
};

// CONTINENT UPDATE
// -----------------------

// Update data when continent is updated
const updateContinent = (continent) => {
  if (continent == "World") {
    new_data = data;
    filteredCountries = Array.from(
      new Set(
        data
          .filter((item) => item.iso_code.length <= 3)
          .map((item) => item.iso_code)
      )
    );
  } else {
    new_data = data.filter((item) => item.continent == continent);
    filteredCountries = Array.from(
      new Set(
        data
          .filter((item) => item.continent == continent)
          .map((item) => item.iso_code)
      )
    );
  }

  filteredData = new_data.filter(
    (item) => item.date >= filterDateMin && item.date <= filterDateMax
  );

  filterDataByDate(filteredData);
  updateView();
  updateData();

  mapSvg
    .select("g")
    .selectAll("path")
    .data(mapData.features.filter((d) => d.id !== "GRL" && d.id !== "ATA"))
    .join(
      function (enter) {
        enter.append("path");
      },
      function (update) {
        update
          .transition()
          .duration(1000)
          .style("opacity", (d) =>
            continent == "World"
              ? 1
              : codeToContinent[d.id] != continent
              ? 0.2
              : 1
          );
        return;
      },
      function (exit) {
        return exit.remove();
      }
    );
};

continentSelect.addEventListener("change", () => {
  updateContinent(continentSelect.value);
});

// -----------------------

// Update data when start/end date is altered
const filterDataByDate = (data) => {
  filteredData = data.filter(
    (item) => item.date >= filterDateMin && item.date <= filterDateMax
  );
  // updateContinent(continentSelect.value);
  updateData();
  updateSlider();
};

// -----------------------

// SIMULATION
// -----------------------

const startSimulation = () => {
  isSimulating = true;
  if (
    dateExtents[1] * 1000 ==
    new Date($("#slider-range").slider("values", 1)) * 1000000
  ) {
    new_date = filterDateMin.setDate(filterDateMin.getDate() + 1);
    filterDateMax = new Date(new_date);
    updateSlider();
  }
  simulationButton.classList.toggle("playing");
  simulationButton.querySelector("span").innerHTML = "Pause Simulation";
  simulationButton.querySelector("i").classList = "fa-solid fa-pause";
};

const stopSimulation = () => {
  isSimulating = false;
  simulationButton.querySelector("span").innerHTML = "Play Simulation";
  simulationButton.classList.toggle("playing");
  simulationButton.querySelector("i").classList = "fa-solid fa-play";
};

simulationButton.addEventListener("click", () => {
  if (!isSimulating) {
    startSimulation();
  } else {
    stopSimulation();
  }
});

// -----------------------

// Update slider values
const updateSlider = () => {
  $("#slider-range").slider("values", 0, filterDateMin.getTime() / 1000);
  $("#slider-range").slider("values", 1, filterDateMax.getTime() / 1000);
  $("#startDate").html(
    new Date($("#slider-range").slider("values", 0) * 1000).toLocaleDateString(
      "en-GB",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    )
  );
  $("#endDate").html(
    new Date($("#slider-range").slider("values", 1) * 1000).toLocaleDateString(
      "en-GB",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    )
  );
};

// MAIN FUNCTION
// -----------------------

// This is what gets the data, and initialises everything when the site first loads
getData().then((res) => {
  data = res;
  filteredData = res;
  updateData();

  loadCountryText(sortedRollup);
  filteredCountries = Array.from(
    new Set(
      data
        .filter((item) => item.iso_code.length <= 3)
        .map((item) => item.iso_code)
    )
  );

  dateExtents = d3.extent(data, function (d) {
    return d.date;
  });

  getMap().then((map) => {
    mapData = map;
    loadMap(mapData);

    let dataExtent = d3.extent(data, function (d) {
      return d.date;
    });
    $(function () {
      filterDateMin = new Date(dataExtent[0]);
      filterDateMax = new Date(dataExtent[1]);
      $("#slider-range").slider({
        range: true,
        min: dataExtent[0].getTime() / 1000,
        max: dataExtent[1].getTime() / 1000,
        step: 86400,
        values: [
          dataExtent[0].getTime() / 1000,
          dataExtent[1].getTime() / 1000,
        ],
        slide: function (event, ui) {
          $("#startDate").html(
            new Date(
              $("#slider-range").slider("values", 0) * 1000
            ).toLocaleDateString("en-GB", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            })
          );
          $("#endDate").html(
            new Date(
              $("#slider-range").slider("values", 1) * 1000
            ).toLocaleDateString("en-GB", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            })
          );
        },
        stop: function (event, ui) {
          filterDateMin = new Date(ui.values[0] * 1000);
          filterDateMax = new Date(ui.values[1] * 1000);
          filterDataByDate(data);
          updateView();
          updateData();
        },
      });
      $("#startDate").html(
        new Date(
          $("#slider-range").slider("values", 0) * 1000
        ).toLocaleDateString("en-GB", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
      );
      $("#endDate").html(
        new Date(
          $("#slider-range").slider("values", 1) * 1000
        ).toLocaleDateString("en-GB", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
      );
    });
  });

  // While simulate is true, update the end date by 30 every 800ms
  setInterval(() => {
    if (isSimulating) {
      filterDateMax.setDate(filterDateMax.getDate() + 30);
      filterDataByDate(data);
      updateView();
      updateData();
      updateSlider();
      if (
        dateExtents[1] * 1000 ==
        new Date($("#slider-range").slider("values", 1)) * 1000000
      ) {
        stopSimulation();
      }
    }
  }, 800);
});
