async function main() {
let map = L.map('map').setView([41.1446, -8.6063], 11);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

let colorScales = await d3.csv("./colors.csv").then(function(c) {
    c.push({});
    for(let hour in c[0]) {
        c[3][hour] = d3.scaleLinear()
        .range([c[1][hour], c[0][hour], "#000000"])
        .interpolate(d3.interpolateRgb.gamma(2.2))
    }
    return c
})

d3.json("./trips.json").then(function(data) {
    data.features = data.features.filter(d => d.properties.distance > 0)
    const parseDate = d3.timeParse("%Y-%m-%d %H:%M:%S");
    let groupedData = {}

    data.features.forEach(f => {
        f.properties.starttime = parseDate(f.properties.starttime);
        f.properties.endtime = parseDate(f.properties.endtime); 
        
        let h = f.properties.starttime.getHours();
        if(typeof groupedData[h] == "undefined") {
            groupedData[h] = {
                features: [],
                type: "featureCollection"
            }
        }
        groupedData[h].features.push(f)
    })
    let keys = Object.keys(groupedData).map(Number)
    let domain = [d3.min(keys), d3.max(keys)]
    
    let colors = d3.scaleOrdinal();
    let visibleLayers = L.featureGroup().addTo(map);
    let layers = {}


    for(let hour in colorScales[3]) {
        // console.log([
        //     d3.min(groupedData[hour].features, d => d.properties.minspeed),
        //     d3.mean(groupedData[hour].features, d => d.properties.avspeed),
        //     d3.max(groupedData[hour].features, d => d.properties.maxspeed)
        // ])
        colorScales[3][hour].domain([
            d3.min(groupedData[hour].features, d => d.properties.avspeed),
            d3.mean(groupedData[hour].features, d => d.properties.avspeed),
            d3.max(groupedData[hour].features, d => d.properties.avspeed)
        ]
            //d3.extent(groupedData[hour].features, d => d.properties.avspeed)
        )
    }

    renderHistogram(data.features, colors);

    function renderPaths(range) {
        //visibleLayers.clear
        for(let i = domain[0]; i <= domain[1]; i++) {
            if(i >= range[0] && i <= range[1]) {
                addLayer(i, groupedData[i]) 
            } else {
                removeLayer(i)
            }
        }
        //map.fitBounds(visibleLayers.getBounds());
    }

    function addLayer(hour, d) {
        if(typeof layers[hour] != "undefined") {
            visibleLayers.addLayer(layers[hour]);
            // map.fitBounds(layers[hour].getBounds());
            return;
        }
        let g = d3.select(".leaflet-zoom-animated g")        
        let jsonLayer = L.geoJSON(d, {
            style: function(feature) {
                return {
                    className: "trip tripfill",
                    stroke: 2,
                    opacity: .7,
                    color: colorScales[3][feature.properties.starttime.getHours()](feature.properties.avspeed)
                };
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup(`id: ${feature.properties.tripid}<br>speed: ${feature.properties.avspeed}<br>` 
                    + `distance: ${feature.properties.distance}<br>duration: ${feature.properties.duration}`);
                layer.on("click", function(e) { 
                    e.target.getPopup().setLatLng(e.latlng).openOn(map);
                    highlightLayer(e.target.feature.properties.starttime.getHours())
                });

                layer.on("mouseover", function(e) { 
                    e.target.setStyle({
                        opacity: 1,
                        weight: 7
                    });
                    d3.select("#hour" + e.target.feature.properties.starttime.getHours())
                        .style("stroke", "black")
                        .style("stroke-width", 4)
                });
                layer.on("mouseout", e => {
                    jsonLayer.resetStyle(e.target);
                    d3.select("#hour" + e.target.feature.properties.starttime.getHours())
                        .style("stroke", "none")
                        .style("opacity", 0.8)
                });
            }
        });

        layers[hour] = jsonLayer
        visibleLayers.addLayer(jsonLayer);
        // map.fitBounds(jsonLayer.getBounds());
    }

    function removeLayer(hour) {
        visibleLayers.removeLayer(layers[hour])
    }

    function highlightLayer(hour) {
        layers[hour].bringToFront();
    }
    
    function renderHistogram(data, colors) {
        const dom = document.getElementById('histogram')
        const dimensions = dom.getBoundingClientRect();
        const margin = {top: 10, right: 20, bottom: 30, left: 40}
        const height = dimensions.height - margin.top - margin.bottom;
        const width = dimensions.width - margin.left - margin.right;
        

        let hours = d3.rollup(data, v => { return {
            count: v.length,
            speed: Math.round(d3.mean(v, d => d.properties.avspeed) * 10) / 10,
            distance: Math.round(d3.mean(v, d => d.properties.distance) * 10) / 10
        }}, d => d.properties.starttime.getHours())
        
        colors.domain([...hours.keys()])
            .range(Object.values(colorScales[0]))


        const tickwidth = width / hours.size
    
        const svg = d3.select('#histogram')
            .append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
            .append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`)
        let xScale = [domain[0], domain[1] + 1]
        const x = d3.scaleLinear()
            .domain(xScale)
            .range([0, width]);
    
        let valprev = [-1,-1];
        let sliderRange = d3.sliderTop(x)
            .handle("m 0 7 l -3 -5 l 0 -19 l 6 0 l 0 19 z")
            .default(xScale)
            .fill('#2196f3')
            .on('onchange', val => {
                val = [Math.floor(val[0]), Math.floor(val[1])]
                if(val[0] != valprev[0] || val[1] != valprev[1]) {
                    selection(val);
                }
            })
    
    
        var gRange = svg.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', 50)
            .attr('transform', `translate(-${margin.left},-${margin.top})`)
            .attr("class", 'slider')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
            
        gRange.call(sliderRange);
    
        d3.selectAll('.slider .axis').remove();
        d3.selectAll(".parameter-value .handle").attr("fill", "#000000")
    
        svg.append("g").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(x));
    
        const y = d3.scaleLinear()
            .domain([0, d3.max(hours.values(), d => d.count) + 50])
            .range([height, 0]);
        svg.append("g").call(d3.axisLeft(y));
    
    
        const Tooltip = d3.select("#histogram")
            .append("div")
            .style("opacity", 0)
            .attr("class", "tooltip")
        
        const mouseover = function(event, d) {
            Tooltip.style("opacity", 1)
            d3.select("#hour" + d[0])
                .style("stroke", "black")
                .style("stroke-width", 4)
        }
        const mousemove = function(event, d) {
            Tooltip.html(`count: ${d[1].count}<br>aveSpeed: ${d[1].speed}<br>aveDistance: ${d[1].distance}`)
                .style("left", event.x + 5+ "px")
                .style("top", event.y - 70 + "px")
            d3.select(this)
                .style("stroke", "black")
                .style("stroke-width", 4)
        }
        const mouseleave = function(event, d) {
            Tooltip.style("opacity", 0)
                .style("top", event.y - 9999 + "px")
            d3.select(this)
                .style("stroke", "none")
                .style("opacity", 0.8)
        }
        const mouseclick = function (event, d) {
            highlightLayer(d[0]); 
        }
        
        renderBars();
        renderPaths(domain);
    
        function renderBars() {
            svg.selectAll("bar").data(hours)
                .join("rect")
                    .attr("x", d => x(d[0]) + 5)
                    .attr("y", d => y(d[1].count))
                    .attr("width", tickwidth - 10)
                    .attr("height", d => height - y(d[1].count))
                    .attr("fill", d => colors(d[0]))
                    .attr("id", d => "hour" + d[0])
                .on("mouseover", mouseover)
                .on("mouseleave", mouseleave)
                .on("mousemove", mousemove)
                .on("click", mouseclick)
        }
    
        function selection(val) {
            svg.selectAll("rect").data(hours)
                .attr("fill", d => {
                    if(d[0] < val[0] || d[0] > val[1]) {
                        return "#808080"
                    } else {
                        return colors(d[0])
                    }
                });
            
            renderPaths(val);
        }
    }
});
}
