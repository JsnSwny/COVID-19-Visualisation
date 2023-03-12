const getMap = async () => {
  const mapData = await d3.json(
    "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"
  );
  return mapData;
};

const dataLink =
  "https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/owid-covid-data.csv";

const getData = async () => {
  const data = await d3.csv("new_cases.csv", (d) => {
    return {
      iso_code: d.iso_code,
      location: d.location,
      deaths: d.new_deaths,
      date: d3.timeParse("%Y-%m-%d")(d.date),
      cases: d.new_cases,
      vaccinations: d.new_vaccinations,
    };
  });
  return data;
};

map = getMap();

getData().then((data) => {
  const svg = d3.select("#map");
  let width = +svg.attr("width");
  let height = +svg.attr("height");

  const projection = d3
    .geoNaturalEarth1()
    // .center([7, 31]) // GPS of location to zoom on
    .scale(100) // This is like the zoom
    .translate([width / 2, height / 2]);

  // project.fitSize([900, 500], geojson);
  // Load external data and boot
  casesRollup = data.filter((item) => item.iso_code.length <= 3);

  casesRollup = d3.rollup(
    casesRollup,
    (v) => d3.sum(v, (d) => d.cases),
    (d) => d.iso_code
  );

  countryToCode = data.reduce((result, item) => {
    result[item.iso_code] = item.location;
    return result;
  }, {});

  const sortedRollup = Array.from(casesRollup, ([key, value]) => ({
    key,
    value,
  })).sort((a, b) => d3.descending(a.value, b.value));

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

  const loadCountryText = (data) => {
    var g = d3
      .select("#countries_list")
      .selectAll("li")
      .data(data)
      .join("li")
      .attr("class", "country-item");

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
      .attr("data-country", (d) => d.key)
      .style("flex", "1")
      .style("display", "flex")
      .style("justify-content", "space-between");

    countryText
      .append("span")
      .text((d) => countryToCode[d.key])
      .style("font-weight", "bold");

    countryText
      .append("span")
      .text((d) => d.value.toLocaleString())
      .style("flex", 1)
      .style("text-align", "right");
  };

  loadCountryText(sortedRollup);

  getMap().then((mapData) => {
    const createMap = () => {
      mapWidth = document.querySelector(".map").offsetWidth;
      svg.attr("width", mapWidth);
      projection.fitSize([mapWidth, 600], mapData);

      let map = svg
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
        .style("stroke", "#000000")
        .attr("fill", (d) => {
          return color(casesRollup.get(d.id));
        })
        .on("mouseover", function (e, d) {
          d3.select(this).attr("fill", "blue");
          getCountryText(d.id).style("color", "red");
        })
        .on("mouseout", function (e, d) {
          d3.select(this).attr("fill", (d) => color(casesRollup.get(d.id)));
          getCountryText(d.id).style("color", "black");
        });
      svg.attr("height", document.getElementById("map").getBBox().height + 10);
    };

    const getCountryText = (name) => {
      return d3.selectAll("[data-country]").filter(function () {
        return d3.select(this).attr("data-country") === name;
      });
    };

    createMap();

    const margin = { top: 10, right: 30, bottom: 30, left: 60 },
      width = window.document.body.clientWidth - 128,
      height = 200;

    worldData = data.filter((item) => item.location == "World");

    // append the svg object to the body of the page
    const linesvg = d3
      .select("#my_graph")
      .append("svg")
      .attr("width", width)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add X axis --> it is a date format
    const x = d3
      .scaleTime()
      .domain(d3.extent(worldData, (d) => d.date))
      .range([0, width]);
    xAxis = linesvg
      .append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x));

    // Add Y axis
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(worldData, (d) => +d.vaccinations)])
      .range([height, 0]);
    yAxis = linesvg.append("g").call(d3.axisLeft(y));

    // Add a clipPath: everything out of this area won't be drawn.
    const clip = linesvg
      .append("defs")
      .append("clipPath")
      .attr("id", "clip")
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("x", 0)
      .attr("y", 0);

    // Add brushing
    const brush = d3
      .brushX() // Add the brush feature using the d3.brush function
      .extent([
        [0, 0],
        [width, height],
      ]) // initialise the brush area: start at 0,0 and finishes at width,height: it means I select the whole graph area
      .on("end", updateChart); // Each time the brush selection changes, trigger the 'updateChart' function

    // Create the area variable: where both the area and the brush take place
    const area = linesvg.append("g").attr("clip-path", "url(#clip)");

    // Create an area generator
    const areaGenerator = d3
      .area()
      .x((d) => x(d.date))
      .y0(y(0))
      .y1((d) => y(d.cases));

    const generateArea = (values) => [];

    // Add the area
    area
      .append("path")
      .datum(worldData)
      .attr("class", "myArea") // I add the class myArea to be able to modify it later on.
      .attr("fill", "rgb(228, 23, 23)")
      .attr("fill-opacity", 0.2)
      .attr("stroke", "#D04B4B")
      .attr("stroke-width", 2)
      .attr("d", areaGenerator);

    const area2 = linesvg.append("g").attr("clip-path", "url(#clip)");
    const areaGenerator2 = d3
      .area()
      .x((d) => x(d.date))
      .y0(y(0))
      .y1((d) => y(d.vaccinations));

    // Add the area
    area2
      .append("path")
      .datum(worldData)
      .attr("class", "myArea") // I add the class myArea to be able to modify it later on.
      .attr("fill", "rgb(86, 75, 208)")
      .attr("fill-opacity", 0.2)
      .attr("stroke", "#564BD0")
      .attr("stroke-width", 2)
      .attr("d", areaGenerator2);

    area2.append("g").attr("class", "brush").call(brush);
    // area2.append("g").attr("class", "brush").call(brush);

    // A function that set idleTimeOut to null
    let idleTimeout;
    function idled() {
      idleTimeout = null;
    }

    // A function that update the chart for given boundaries
    function updateChart(event) {
      // What are the selected boundaries?
      extent = event.selection;

      // If no selection, back to initial coordinate. Otherwise, update X axis domain
      if (!extent) {
        if (!idleTimeout) return (idleTimeout = setTimeout(idled, 350)); // This allows to wait a little bit
        x.domain([4, 8]);
      } else {
        x.domain([x.invert(extent[0]), x.invert(extent[1])]);
        area2.select(".brush").call(brush.move, null); // This remove the grey brush area as soon as the selection has been done
      }

      // Update axis and area position
      xAxis.transition().duration(1000).call(d3.axisBottom(x));
      area
        .select(".myArea")
        .transition()
        .duration(1000)
        .attr("d", areaGenerator);
      area2
        .select(".myArea")
        .transition()
        .duration(1000)
        .attr("d", areaGenerator2);
    }

    // If user double click, reinitialize the chart
    linesvg.on("dblclick", function () {
      x.domain(d3.extent(worldData, (d) => d.date));
      xAxis.transition().call(d3.axisBottom(x));
      area.select(".myArea").transition().attr("d", areaGenerator);
      area2.select(".myArea").transition().attr("d", areaGenerator2);
    });
  });
});
