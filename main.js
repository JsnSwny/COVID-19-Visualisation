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

const getCountryText = (name) => {
  return d3.selectAll("[data-country]").filter(function () {
    return d3.select(this).attr("data-country") === name;
  });
};

const getMap = async () => {
  const mapData = await d3.json(
    "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"
  );
  return mapData;
};

const dataLink =
  "https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/owid-covid-data.csv";

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
    };
  });
  return data;
};

const toggleViews = document.querySelectorAll(".toggle-view");

const updateView = () => {
  switch (currentView) {
    case "chart":
      updateChart();
      break;
  }
};

toggleViews.forEach((item) => {
  item.addEventListener("click", () => {
    d3.select("#view").selectAll("svg").remove();
    toggleViews.forEach((view) => view.classList.remove("active"));
    item.classList.add("active");
    currentView = item.dataset.view;
    switch (item.dataset.view) {
      case "map":
        loadMap(mapData);
        break;
      case "chart":
        loadChart();
        break;
      case "continentor":
        loadContinentor();
        break;
    }
  });
});

const loadContinentor = () => {
  let r = 600;
  lineSvg = d3.select("#view").append("svg").attr("width", r).attr("height", r);
  lineSvg = lineSvg.append("g");

  let node = null;
  let rollup = data.filter((item) => item.iso_code.length <= 3);

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

  var nodes = lineSvg

    .selectAll("g")
    .data(rootNode.descendants())
    .join("g")
    .attr("transform", function (d) {
      return "translate(" + [d.x, d.y] + ")";
    });

  nodes
    .append("circle")
    .on("click", function (e, d) {
      zoom(e, node == d ? root : d);
      e.stopPropagation();
    })

    .on("mouseover", (e, d) => {
      lineSvg
        .append("text")
        .attr("class", "country-text country-text--hover")
        .text(() => {
          if (d.children === undefined) {
            return d.data[0];
          }
        })
        .attr("dx", d.x)
        .attr("dy", d.y);
    })
    .on("mouseout", (e, d) => {
      lineSvg.selectAll(".country-text--hover").remove();
    })
    .transition()
    .duration(2000)
    .attr("r", function (d) {
      return d.r;
    });
};

const loadChart = () => {
  // set the dimensions and margins of the graph

  mapWidth = document.querySelector(".map").offsetWidth;
  const margin = { top: 10, right: 100, bottom: 30, left: 55 },
    width = mapWidth - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;

  // append the svg object to the body of the page
  const lineSvg = d3
    .select("#view")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

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
  const margin = { top: 10, right: 100, bottom: 30, left: 50 },
    width = mapWidth - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;
  const lineSvg = d3.select("#view").select("g");
  lineSvg.selectAll("g").remove();
  lineSvg.selectAll("path").remove();
  let new_data = data.filter((item) =>
    filteredCountries.includes(item.iso_code)
  );

  let rollup = calculateRollup(new_data, "date").casesRollup;

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

  if (selectedCountries.length == 0) {
    y = d3
      .scaleLinear()
      .domain([
        0,
        d3.max(rollup, function (d) {
          return d[1];
        }),
      ])
      .range([height, 0]);
    lineSvg.append("g").call(d3.axisLeft(y));

    // Add the line
    path = line.append("path");

    path
      .datum(rollup)
      .attr("class", "line") // I add the class line to be able to modify this line later on.
      .attr("fill", "none")
      .attr("stroke", "#d04b4b")
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
  } else {
    let lineColor = d3
      .scaleSequential()
      .domain([0, selectedCountries.length])
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
      ]);
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

  function resizeChart(e) {
    // What are the selected boundaries?
    extent = e.selection;

    // If no selection, back to initial coordinate. Otherwise, update X axis domain
    if (!e.selection) {
      if (!idleTimeout) return (idleTimeout = setTimeout(idled, 350)); // This allows to wait a little bit
      x.domain([4, 8]);
    } else {
      filterDateMin = x.invert(e.selection[0]);
      filterDateMax = x.invert(e.selection[1]);
      filterDataByDate(filteredData);
      x.domain([filterDateMin, filterDateMax]);
      line.select(".brush").call(brush.move, null); // This remove the grey brush area as soon as the selection has been done
    }

    // Update axis and line position
    xAxis.transition().duration(1000).call(d3.axisBottom(x));

    if (selectedCountries.length == 0) {
      line
        .select(".line")
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

  // const pathLength = path.node().getTotalLength();

  // const transitionPath = d3.transition().ease(d3.easeSin).duration(2000);

  // path
  //   .attr("stroke-dashoffset", pathLength)
  //   .attr("stroke-dasharray", pathLength)
  //   .transition(transitionPath)
  //   .attr("stroke-dashoffset", 0);
}

const loadMap = (mapData) => {
  mapSvg = d3.select("#view").append("svg").attr("id", "map");
  mapWidth = document.querySelector(".map").offsetWidth;
  mapSvg.attr("width", mapWidth);
  mapSvg.attr("height", 750);
  let width = +mapSvg.attr("width");
  let height = +mapSvg.attr("height");
  const projection = d3
    .geoNaturalEarth1()
    .center([0, 5])
    .scale(100)
    .translate([width / 2, height / 2]);

  projection.fitSize([mapWidth, 750], mapData);

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
    })
    .on("mouseout", function (e, d) {
      getCountryText(d.id).classed("country-item--hover", false);
    })
    .on("click", function (e, d) {
      let checkbox = getCountryText(d.id).node().children[0];
      checkbox.checked = !checkbox.checked;

      if (checkbox.checked) {
        addSelectedCountry(d.id);
      } else {
        removeSelectedCountry(d.id);
      }
    });
  mapSvg.attr("height", document.getElementById("map").getBBox().height + 10);
};

const updateMap = () => {
  d3.selectAll(".country")
    .transition()
    .duration(50)
    .attr("fill", (d) => {
      return color(casesRollup.get(d.id));
    });
};

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

const calculateRollup = (data, group_by) => {
  let casesRollup = data.filter((item) => item.iso_code.length <= 3);

  casesRollup = d3.rollup(
    casesRollup,
    (v) => d3.sum(v, (d) => d.cases),
    (d) => d[group_by]
  );

  let sortedRollup = Array.from(casesRollup, ([key, value]) => ({
    key,
    value,
  })).sort((a, b) => d3.descending(a.value, b.value));

  return { casesRollup, sortedRollup };
};

const updateData = () => {
  // project.fitSize([900, 500], geojson);
  // Load external data and boot

  countryToCode = filteredData.reduce((result, item) => {
    result[item.iso_code] = item.location;
    return result;
  }, {});

  codeToContinent = filteredData.reduce((result, item) => {
    result[item.iso_code] = item.continent;
    return result;
  }, {});

  sortedRollup = calculateRollup(filteredData, "iso_code").sortedRollup;
  casesRollup = calculateRollup(filteredData, "iso_code").casesRollup;

  d3.select("#total").text(
    sortedRollup
      .map((item) => item.value)
      .reduce((a, b) => a + b, 0)
      .toLocaleString()
  );
  loadCountryText(sortedRollup);
};

const updateContinent = (continent) => {
  if (continent == "World") {
    filteredCountries = Array.from(
      new Set(
        filteredData
          .filter((item) => item.iso_code.length <= 3)
          .map((item) => item.iso_code)
      )
    );
  } else {
    new_data = data.filter((item) => item.continent == continent);
    filteredCountries = Array.from(
      new Set(
        filteredData
          .filter((item) => item.continent == continent)
          .map((item) => item.iso_code)
      )
    );
  }
  filterDataByDate(new_data);
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

const continentSelect = document.getElementById("continent-selector");

continentSelect.addEventListener("change", () => {
  updateContinent(continentSelect.value);
});

const filterDataByDate = (data) => {
  filteredData = data.filter(
    (item) => item.date >= filterDateMin && item.date <= filterDateMax
  );
  updateData();
  updateSlider();
};

const simulationButton = document.getElementById("simulation-button");

simulationButton.addEventListener("click", () => {
  isSimulating = !isSimulating;

  if (isSimulating) {
    console.log(simulationButton.querySelector("span"));
    simulationButton.classList.toggle("playing");
    simulationButton.querySelector("span").innerHTML = "Pause Simulation";
    simulationButton.querySelector("i").classList = "fa-solid fa-pause";
  } else {
    simulationButton.querySelector("span").innerHTML = "Play Simulation";
    simulationButton.classList.toggle("playing");
    simulationButton.querySelector("i").classList = "fa-solid fa-play";
  }
});

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

  getMap().then((map) => {
    mapData = map;
    loadMap(mapData);

    let dataExtent = d3.extent(data, function (d) {
      return d.date;
    });
    $(function () {
      filterDateMin = new Date(dataExtent[0]);
      filterDateMax = new Date(dataExtent[0]);
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
          updateMap();
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

  setInterval(() => {
    if (isSimulating) {
      filterDateMax.setDate(filterDateMax.getDate() + 7);
      filterDataByDate(data);
      updateMap();
      updateData();
      updateSlider();
    }
  }, 100);
});
