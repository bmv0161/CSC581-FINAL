async function main() {
    // const delay = ms => new Promise(res => setTimeout(res, ms));

    //load data
    let DATA = await d3.json("./trips.json").then(data => {
        ORIGINAL_DATA_SIZE = data.features.length;
        data.features = data.features.filter(d => d.properties.distance > 0);
        return data;
    });

    //load color pallete
    let colors =  await d3.csv("./colors.csv").then(function(c) {
        c.push({});
        for(let hour in c[0]) {
            c[3][hour] = d3.scaleLinear()
                .range([c[1][hour], c[0][hour], "#000000"])
                .interpolate(d3.interpolateRgb.gamma(2.2));
        }
        return c;
    });

    let d = new Dashboard(DATA, colors);

    d.addChart(new LMap(d, "#map"))
        .addChart(new Bar(d, "#bar"))
        .addChart(new Pie(d, "#pie"))
        .addChart(new Heat(d, "#heat"))
}

class Dashboard {
    constructor(DATA, colors) {
        this.ORIGINAL = DATA;
        this.SELECTED = JSON.parse(JSON.stringify(DATA));
        this.parseTime(this.ORIGINAL);
        this.parseTime(this.SELECTED);
        this.colors = colors;
        this.primary_color = colors[0][0];
        this.charts = {};
        Tooltip.setdash(this);
    }

    addChart(chart) {
        this.charts[chart.elementID] = chart;
        return this;
    }
    update(DATA = this.SELECTED) {
        Object.keys(this.charts).forEach(k => {
            this.charts[k].update(DATA);
        })
    }
    reset(ignore = null) {
        Object.values(this.charts).forEach(v => {
            v.reset();
        })
        this.update(this.ORIGINAL);
    }
    parseTime(DATA) {
        const parseDate = d3.timeParse("%Y-%m-%d %H:%M:%S");
        DATA.features.forEach(f => {
            f.properties.starttime = parseDate(f.properties.starttime);
            //f.properties.endtime = parseDate(f.properties.endtime); 
        });
    }

    getChart(elementID) {
        return this.charts[elementID];
    }

    data = () => {
        return this.SELECTED;
    }
    getOriginal() {
        return this.ORIGINAL;
    }
    color (multi = 0) {
        return multi == 0 ? this.colors : this.primary_color;
    }
}

class Tooltip {
    static dash;
    constructor (elementID, selection, vars) {
        this.elementID = elementID;
        this.tooltip = d3.select(elementID)
            .append("div")
            .style("opacity", 0)
            .attr("class", "tooltip");
        this.vars = vars;
        this.content = null;
        this.selection = selection;
    }
    static setdash(d) {
        Tooltip.dash = d;
    }
}

class PieTooltip extends Tooltip {
    constructor(elementID, selection, vars) {
        super(elementID, selection, vars)
        this.mouseover()
        this.mousemove()
        this.mouseleave()
        this.mouseclick()
    }
    mouseover() {
        this.selection.on("mouseover", (event, d) => {
            this.tooltip.style("opacity", 1)
            d3.select(event.target)
                .style("stroke", "black")
                .style("stroke-width", 2)
        })
    }

    mousemove() {
        this.selection.on("mousemove", (event, d) => {
            this.tooltip.html(`current data:<br>${d[this.vars]} / ${ORIGINAL_DATA_SIZE}`)
                .style("left", event.x + 20 + "px")
                .style("top", event.y + 0 + "px")
        })
    }
    mouseleave() {
        this.selection.on("mouseout", (event, d) => {
            this.tooltip.style("opacity", 0)
                .style("top", event.y - 9999 + "px");

                d3.select(event.target)
                .style("stroke", "none")
        })
    }
    mouseclick() {
        this.selection.on("click", (event, d) => {
            Tooltip.dash.reset(); 
        })
    }
}
class BarTooltip extends Tooltip {
    constructor(elementID, selection, vars) {
        super(elementID, selection, vars)
        this.mouseover()
        this.mousemove()
        this.mouseleave()
        this.mouseclick()
    }
    mouseover() {
        this.selection.on("mouseover", (event, d) => {
            this.tooltip.style("opacity", 1)
            d3.select(event.target)
                .style("stroke", "black")
                .style("stroke-width", 4)
        })
    }
    mousemove() {
        this.selection.on("mousemove", (event, d) => {
            let str = "";
            this.vars.forEach(v => {
                str += `${v}: ${d[1][v]}<br>`;
            })
            this.content = str.slice(0,-("<br>".length))
            this.tooltip.html(this.content)
                .style("left", event.x + 5 + "px")
                .style("top", event.y - 70 + "px")
            d3.select(event.target)
                .style("stroke", "black")
                .style("stroke-width", 4)
        })
    }
    mouseleave() {
        this.selection.on("mouseout", (event, d) => {
            this.tooltip.style("opacity", 0)
                .style("top", event.y - 9999 + "px");
            d3.select(event.target)
                .style("stroke", "none")
                .style("opacity", 0.8)
        })
    }
    mouseclick() {
        this.selection.on("click", (event, d) => {
            Tooltip.dash.getChart("#map").highlightLayer(d[0]); 
        })
    }
}

class HeatTooltip extends Tooltip {
    singleselection = {
        check: false,
        target: null,
    };

    constructor(elementID, selection, vars) {
        super(elementID, selection, vars)
        
        this.mouseover()
        this.mousemove()
        this.mouseleave()
        //this.mouseclick()
        // this.dblclick()
    }
    mouseover() {
        this.selection.on("mouseover", (event, d) => {            
            this.tooltip.style("opacity", 1);
            d3.select(event.target)
                .attr('stroke', "black")
                .attr('stroke-width', "5");
        })
    }
    mousemove() {
        this.selection.on("mousemove", (event, d) => {
            let str = "";
            this.vars.forEach(v => {
                str += `${v}: ${d[v]}<br>`;
            })
            this.content = str.slice(0,-("<br>".length))
            this.tooltip.html(this.content)
                .style("left", event.x + 10 + "px")
                .style("top", event.y - 70 + "px")
        })
    }
    mouseleave() {
        this.selection.on("mouseout", (event, d) => {
            this.tooltip.style("opacity", 0).style("top", event.y - 9999 + "px");

            if(event.target !== this.singleselection.target) {
                if( event.target.className.baseVal == "select") {
                    d3.select(event.target)
                        .attr('stroke', "black")
                        .attr('stroke-width', "3");
                } else {
                    d3.select(event.target)
                        .attr('stroke', "black")
                        .attr('stroke-width', "1");
                }
            }
        })
    }
    // mouseclick() {
    //     this.selection.on("click", (event, d) => {
    //         Tooltip.dash.getChart(this.elementID).selection(d.name);
    //     })
    // }
    // dblclick() {
    //     this.selection.on("dblclick", (event, d) => {
    //         if(this.singleselection.check && this.singleselection.target == event.target) {
    //             Tooltip.dash.reset(this.elementID);
    //             this.singleselection.target = null;
    //             this.singleselection.check = !this.singleselection.check;
    //         } else if(this.singleselection.check && this.singleselection.target != event.target) {
    //             d3.select(this.singleselection.target)
    //                 .style("stroke", "black")
    //                 .style("stroke-width", 5)
    //             Tooltip.dash.reset(this.elementID);

    //             Tooltip.dash.getChart(this.elementID).selection(d.name);
    //             this.singleselection.target = event.target;
    //             d3.select(event.target)
    //                 .style("stroke", "black")
    //                 .style("stroke-width", 1)
    //         }else {
    //             d3.selectAll(".sqaures rect")
    //                 .style("stroke", "black")
    //                 .style("stroke-width", 1)
    //                 .attr("class", "deselect");
    //             Tooltip.dash.getChart(this.elementID).selection(d.name);
    //             this.singleselection.target = event.target;
    //             d3.select(event.target)
    //                 .style("stroke", "black")
    //                 .style("stroke-width", 3)
    //                 .attr("class", "select");
                
    //             this.singleselection.check = !this.singleselection.check;
    //         }
    //     })
    // }
}

class Chart {
    constructor(dash, elementID) {
        let dom = document.getElementById(elementID.slice(1));
        this.dimensions = dom.getBoundingClientRect();
        this.elementID = elementID;
        this.dash = dash;
        this.svg = null;
        this.DATA = null;
    }
    reset() {}
}

class Pie extends Chart{
    margin = 2

    constructor(dash, elementID) {
        super(dash, elementID);
        this.diameter = d3.min([this.dimensions.width, this.dimensions.height]) - this.margin * 4;
        this.outerRadius = this.diameter / 2;
        this.innerRadius = this.outerRadius / 2;
        this.DATA = this.formatData(this.dash.data());
        this.colors = d3.scaleOrdinal()
            .domain([0,1])
            .range(["#808080", this.dash.color(1)]);
        this.pie = this.pieChart()
            .color(this.colors)
            .outerRadius(this.outerRadius)
            .innerRadius(this.innerRadius);
        this.domPieChart;

        this.render();
    }

    formatData(DATA) {
        let data = [{
            series: 0, value: ORIGINAL_DATA_SIZE - DATA.features.length,
        },{
            series: 1, value: DATA.features.length,
        }]
    
        return data;
    }

    render() {
        let svg = d3.select(this.elementID)
            .append("svg")
            .classed(".path", true)
                .attr('width', this.dimensions.width)
                .attr('height', this.dimensions.height);

        this.domPieChart = svg.append('g')
            .attr('class', 'pie-chart')
            .attr('transform', `translate(${this.dimensions.width / 2}, ${this.dimensions.height / 2})`)
            .call(this.pie.data(this.DATA));

        const tooltip = new PieTooltip(this.elementID, this.domPieChart.selectAll(".pie-chart .slice"), "value")
    }

    update(DATA) {
        this.DATA = this.formatData(DATA);

        this.domPieChart.call(this.pie.data(this.DATA));
    }

    pieChart (options) {
        var animationDuration = 500,
          color = d3.scaleOrdinal(d3.schemeCategory10),
          data = [],
          innerRadius = 0,
          outerRadius = 100,
          arc = d3.arc(),
          pie = d3.pie()
            .sort(null)
            .value(function (d) {
              return d.value;
            });
      
        function updateTween (d) {
          var i = d3.interpolate(this._current, d);
          this._current = i(0);
          return function(t) {
            return arc(i(t));
          };
        }
      
        function exitTween (d) {
          var end = Object.assign({}, this._current, { startAngle: this._current.endAngle });
          var i = d3.interpolate(d, end);
          return function(t) {
            return arc(i(t));
          };
        }
      
        function joinKey (d) {
          return d.data.series;
        }
      
        function pieChart (context) {
          var slices = context.selectAll('.slice').data(pie(data), joinKey);
      
          var oldSlices = slices.exit();
      
          var newSlices = slices.enter().append('path')
            .each(function(d) { this._current = Object.assign({}, d, { startAngle: d.endAngle }); })
            .attr('class', 'slice')
            .style('fill', function (d) { return color(joinKey(d)); });
      
          var t = d3.transition().duration(animationDuration);
      
          arc.innerRadius(innerRadius).outerRadius(outerRadius);
      
          oldSlices
            .transition(t)
              .attrTween('d', exitTween)
              .remove();
      
          var t2 = t.transition();
          slices
            .transition(t2)
              .attrTween('d', updateTween);
      
          var t3 = t2.transition();
          newSlices
            .transition(t3)
              .attrTween('d', updateTween);
        }
      
        pieChart.data = function (_) {
          return arguments.length ? (data = _, pieChart) : data;
        };
      
        pieChart.innerRadius = function (_) {
          return arguments.length ? (innerRadius = _, pieChart) : innerRadius;
        };
      
        pieChart.outerRadius = function (_) {
          return arguments.length ? (outerRadius = _, pieChart) : outerRadius;
        };

        pieChart.color = function (_) {
            return arguments.length ? (color = _, pieChart) : color;
          };
      
        return pieChart;
    }
}

class Heat extends Chart{
    constructor(dash, elementID) {
        super(dash, elementID);
        this.layout = {x:4, y:5, top: 30};
        this.height = this.dimensions.height;
        this.width = this.dimensions.width;
        this.color = this.dash.color(1);

        this.box = {
            y: (this.height - this.layout.top) / this.layout.y,
            x: this.width / this.layout.x,
        }

        this.elementID = elementID;
        this.DATA = this.formatData(this.dash.data());

        this.selected = this.DATA.map(d => {
            return {
                name: d.name,
                selected: true,
            }   
        });

        this.render();
    }

    formatData(DATA) {
        let newDATA = [];
        DATA.features.forEach(d => {
            d.properties.streetnames.forEach(s => {
                if(s in newDATA) {
                    newDATA[s].count++;
                } else {
                    newDATA[s] = {
                        name: s,
                        count: 0,
                        speed: Math.round(d.properties.avspeed * 10) / 10,
                    };
                }
            });
        })

        newDATA = Object.values(newDATA);
        
        let order = "count";
        newDATA.sort((a, b) => {
            if(a[order] > b[order]) return -1;
            if(a[order] < b[order]) return 1;
            return 0;
        })

        newDATA = newDATA.slice(0, this.layout.x * this.layout.y);

        return newDATA;
    }

    render() {
        this.svg = d3.select(this.elementID)
            .append('svg')
                .attr('width', this.width).attr('height', this.height)
            .append('g')
                .attr("transform", `translate(0, ${this.layout.top})`);
        
        this.colorScale = d3.scaleLinear()
            .domain(d3.extent(this.DATA, d => d.speed))
            .range(['#ffffff', this.color])

        this.svg.append('g')
            .attr('transform', `translate(${this.dimensions.width/2}, ${-this.layout.top / 2})`)
            .append('text')
            .attr('class', 'label')
            .attr('text-anchor', 'middle')
            .text(`Speed of Top ${this.layout.x * this.layout.y} Streets`);
                
        const squares = this.svg.append('g')  
            .classed('squares', true)
            .attr('transform', 'translate(2,2)')
            .selectAll('rect')
            .data(this.DATA)
            .join('rect')
                .attr('width', this.box.x - 5 + "px")
                .attr('height', this.box.y -5 + "px")
                .attr('stroke', "black")
                .attr('stroke-width', "3")
                .attr('class', 'select')
                .attr('x', (d,i) => this.box.x * (i % this.layout.x))
                .attr('y', (d,i) => this.box.y * (Math.floor(i / this.layout.x)))
                .attr('fill', d => this.colorScale(d.speed))

        

        const tooltip = new HeatTooltip(this.elementID, squares, ["name", "count", "speed"])
    }
    update(DATA) {
        this.DATA = this.formatData(DATA);
        this.svg.selectAll(".squares rect")
            .data(this.DATA)
                .transition().duration(1000)
                    .style("fill", d => this.colorScale(d.speed))
    }
    selection(name) {
        let s = this.selected.find(n => n.name == name);
        s.selected = !s.selected;

        if(s.selected) {
            
            this.dash.data().features.filter(d => d.properties.streetnames.includes(name));
        } else {
            this.dash.data
        }
        
        this.dash.update()
    }
}

class Bar extends Chart{

    constructor(dash, elementID, margin = {top:10, right: 20, bottom: 30, left: 50}) {
        super(dash, elementID);
        this.margin = margin;
        this.height = this.dimensions.height - this.margin.top - this.margin.bottom;
        this.width = this.dimensions.width - this.margin.left - this.margin.right;
        this.DATA = this.formatData(this.dash.data()); 

        this.colors = d3.scaleOrdinal()
            .domain([...this.DATA.keys()])
            .range(Object.values(this.dash.color()[0]));
        this.primary_color = this.dash.color(1);
        this.tickwidth = this.width / this.DATA.size;

        this.domain = d3.extent(this.DATA.keys());
        this.x  = d3.scaleLinear();
        this.y = d3.scaleLinear();

        this.sliderRange;
        this.xScale;

        this.render();

    }

    formatData(DATA) {
        let data = d3.rollup(DATA.features, v => { return {
            count: v.length,
            speed: Math.round(d3.mean(v, d => d.properties.avspeed) * 10) / 10,
            distance: Math.round(d3.mean(v, d => d.properties.distance) * 10) / 10
        }}, d => d.properties.starttime.getHours())

        return data;
    }
    render() {
        this.svg = d3.select(this.elementID).append("svg").attr("width", this.width + this.margin.left + this.margin.right)
                .attr("height", this.height + this.margin.top + this.margin.bottom)
            .append("g")
                .attr("transform", `translate(${this.margin.left},${this.margin.top})`)
        this.xScale = [this.domain[0], this.domain[1] + 1]
        this.x.domain(this.xScale)
            .range([0, this.width]);
    
        let valprev1 = this.domain;
        let valprev2 = this.domain;
        this.sliderRange = d3.sliderTop(this.x)
            .handle("m 0 7 l -3 -5 l 0 -19 l 6 0 l 0 19 z")
            .default(this.xScale)
            .fill(this.primary_color)
            .on('onchange', val => {
                val = [Math.floor(val[0]), Math.ceil(val[1])]
                if(val[0] != valprev1[0] || val[1] != valprev1[1]) {
                    this.greyout(val);
                    valprev1 = val;
                }
            }).on("end", val => {
                val = [Math.floor(val[0]), Math.ceil(val[1])]
                if(val[0] != valprev2[0] || val[1] != valprev2[1]) {
                    this.selection(val);
                    valprev2 = val;
                }
            })
    
        this.gRange = this.svg.append('svg')
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', 50)
            .attr('transform', `translate(-${this.margin.left},-${this.margin.top})`)
            .attr("class", 'slider')
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        this.gRange.call(this.sliderRange);
    
        d3.selectAll('.slider .axis').remove();
        d3.selectAll(".parameter-value .handle").attr("fill", "#ffffff")
    
        this.svg.append("g").attr("transform", `translate(0, ${this.height})`).call(d3.axisBottom(this.x));
        
        this.y.domain([0, d3.max(this.DATA.values(), d => d.count) + 50])
            .range([this.height, 0]);
        this.svg.append("g").call(d3.axisLeft(this.y));

        this.svg.append('g')
            .attr('transform', `translate(${-(this.margin.left * .70)}, ${this.dimensions.height/2})`)
            .append('text')
            .attr('class', 'label')
            .attr('text-anchor', 'middle')
            .attr('transform', 'rotate(-90)')
            .text('Trips by Hour');

        let rect = this.renderBars();

    }
    renderBars() {
        const t = this.svg.transition().duration(750);

        const rect = this.svg.append('g')
            .classed('bars', true)
            .selectAll("bars")
            .data(this.DATA)
            .enter().append("rect")
                //.attr("x", d => this.x(d[0]) + 5)
                //.attr("y", d => this.y(d[1].count))
                .attr("width", this.tickwidth - 10)
                .attr("height", d => this.height - this.y(d[1].count))
                .attr("fill", d => this.colors(d[0]))
                .attr("id", d => "hour" + d[0])
                .call(enter => enter.transition(t)
                    .attr("height", d => this.height - this.y(d[1].count))
                    .attr("y", d => this.y(d[1].count)))
                    .attr("x", d => this.x(d[0]) + 5)

        const tooltip = new BarTooltip(this.elementID, rect, ["count", "speed", "distance"]);
        return rect;
    }
    greyout(val) {
        this.svg.selectAll("rect").data(this.DATA)
            .attr("fill", d => {
                if(d[0] < val[0] || d[0] > val[1]) {
                    return "#808080"
                } else {
                    return this.colors(d[0])
                }
            });        
    }
    selection(val) {
        let data = this.dash.getOriginal();
        
        this.dash.data().features = data.features.filter(d => {
            let h = d.properties.starttime.getHours();
            return h >= val[0] && h < val[1];
        })
        
        this.dash.update();
    }

    update(DATA) {
        this.DATA = this.formatData(DATA);
        // const update = this.svg.selectAll(".bars rect")
        //     .data(this.DATA)
        //         // .attr("width", this.tickwidth - 10)
        //         // .attr("fill", d => this.colors(d[0]))
        //         // .attr("id", d => "hour" + d[0])
        //         .call(enter => enter.transition(t)
        //             .attr("height", d => this.height - this.y(d[1].count))
        //             .attr("y", d => this.y(d[1].count)))
        //             .attr("x", d => this.x(d[0]) + 5)

        this.svg.selectAll(".bars rect").remove();
        this.svg.select(".bars").remove();
            
        this.renderBars();
    }
    reset() {
        this.sliderRange.value(this.xScale);
    }

}

class LMap extends Chart {
    constructor(dash, elementID) {
        super(dash, elementID)
        this.colors = this.dash.color();
        this.map = L.map(elementID.slice(1)).setView([41.1446, -8.6063], 11);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(this.map);

        this.DATA = this.formatData(this.dash.data());

        let keys = Object.keys(this.DATA).map(Number);
        this.domain = d3.extent(keys);

        this.visibleLayers = L.featureGroup().addTo(this.map);
        this.layers = {};
        this.pathLayers = {};

        for(let hour in this.colors[3]) {
            this.colors[3][hour].domain([
                d3.min(this.DATA[hour].features, d => d.properties.avspeed),
                d3.mean(this.DATA[hour].features, d => d.properties.avspeed),
                d3.max(this.DATA[hour].features, d => d.properties.avspeed)
            ]
                //d3.extent(groupedData[hour].features, d => d.properties.avspeed)
            )
        }

        this.render(this.domain);
        
    }

    formatData(DATA) {
        let groupedDATA = {};
        DATA.features.forEach(f => {
            let h = f.properties.starttime.getHours();
            if(typeof groupedDATA[h] == "undefined") {
                groupedDATA[h] = {
                    features: [],
                    type: "featureCollection"
                }
            }
            groupedDATA[h].features.push(f)
        })

        return groupedDATA;
    }

    render(range) {
        for(let i = this.domain[0]; i <= this.domain[1]; i++) {
            if(i >= range[0] && i <= range[1]) {
                this.addLayer(i, this.DATA[i]) 
            } else {
                this.removeLayer(i)
            }
        }
    }

    addLayer(hour, d) {
        if(typeof this.layers[hour] != "undefined") {
            this.visibleLayers.addLayer(this.layers[hour]);
            // map.fitBounds(layers[hour].getBounds());
            return;
        }
        let g = d3.select(".leaflet-zoom-animated g")
        let jsonLayer = L.geoJSON(d, {
            style: feature => this.draw(feature),
            onEachFeature: (feature, layer) => this.handleEvents(feature, layer)
        });

        this.layers[hour] = jsonLayer
        this.visibleLayers.addLayer(jsonLayer);
        // map.fitBounds(jsonLayer.getBounds());
    }

    draw(feature) {
        return {
            className: "trip tripfill",
            stroke: 2,
            opacity: .7,
            color: this.colors[3][feature.properties.starttime.getHours()](feature.properties.avspeed)
        };
    }

    handleEvents(feature, layer) {
        this.pathLayers[feature.properties.tripid] = layer;
        let hour = feature.properties.starttime.getHours();
        layer.bindPopup(`id: ${feature.properties.tripid}<br>speed: ${feature.properties.avspeed}<br>` 
            + `distance: ${feature.properties.distance}<br>duration: ${feature.properties.duration}`);
        layer.on("click", (e) => { 
            e.target.getPopup().setLatLng(e.latlng).openOn(this.map);
            this.highlightLayer(hour)
        });

        layer.on("mouseover", function(e) { 
            e.target.setStyle({
                opacity: 1,
                weight: 7
            });
            d3.select("#hour" + hour)
                .style("stroke", "black")
                .style("stroke-width", 4)
        });
        layer.on("mouseout", e => {
            this.layers[hour].resetStyle(e.target);
            d3.select("#hour" + hour)
                .style("stroke", "none")
                .style("opacity", 0.8)
        });
    }

    update(DATA) {
        this.visibleLayers.eachLayer(layer => {
            this.visibleLayers.removeLayer(layer);
        })
        DATA.features.forEach(f => {
            let layer = this.pathLayers[f.properties.tripid];
            this.visibleLayers.addLayer(layer);
        })
    }

    resetMap() {
        this.render(this.domain);
    }

    removeLayer(hour) {
        this.visibleLayers.removeLayer(this.layers[hour])
    }

    highlightLayer(hour) {
        this.layers[hour].bringToFront();
    }
}