barChartAltD3 = function module() {
    var width = 400,
        height = 300;

    var widthPercent  = "95%";
    var heightPercent = "95%";


    var margin = {left: 10, right: 10, top: 10, bottom: 10};
    var barPadding = 1;


    var dispatch = d3.dispatch("hoverbar", "clickbar");
    var barPadding = .1;
    var barOuterPadding = 0;

    var name = function(d) { return d[0]; };
    var value = function(d) { return d[1]; };
    var color = d3.scale.category20b();

    function exports(_selection) {
        _selection.each(function(_data) {


            var xRange = d3.scale.linear()
                .range([margin.right, width - margin.left])
                .domain([0, d3.max(_data, function (d) { return value(d); }) ]);



            var barWidth = width / _data.length;
            var scaling = width / d3.max(_data, function(d) { return value(d)});

            // Set the x offset for each data element
            var totalValue = 0;
            for (var i = 0; i  < _data.length; i++) {
                totalValue += value(_data[i]);          
            }
            var offset = 0;
            for (var i = 0; i  < _data.length; i++) {
                _data[i].width = d3.round(width * (value(_data[i]) / totalValue));
                _data[i].offset = offset;
                offset += _data[i].width;  

                if (i == _data.length - 1)  {
                    var actualWidth = _data[i].offset + _data[i].width;
                    var diff = width - actualWidth;
                    if ( diff > 0 ) {
                        _data[i].width += diff;
                    }
                }        
            }

            // Trick to just append the svg skeleton once
            var svg = d3.select(this)
                .selectAll("svg")
                .data([_data]);
            svg.enter().append("svg")
                .classed("chart", true)
                .attr("width", widthPercent)
                .attr("height", widthPercent)
                .attr('viewBox', "0 0 " + parseInt(width+margin.left+margin.right) + " " + parseInt(height+margin.top+margin.bottom))
                .attr("preserveAspectRatio", "xMinYMid meet");

            // The chart dimensions could change after instantiation, so update viewbox dimensions
            // every time we draw the chart.
            d3.select(this).selectAll("svg")
               .attr('viewBox', "0 0 " + parseInt(width+margin.left+margin.right) + " " + parseInt(height+margin.top+margin.bottom));

         

            svg.selectAll("g.bars").remove();
            var grouping =  svg.selectAll("g.bars").data([_data]).enter()
                .append("g")
                .attr("class", "bars")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");



            // Enter, Update, Exit on bars
            var bars = grouping.selectAll(".bar")
                .data(_data);

            bars.enter().append("rect")
                .classed("bar", true)
                .attr({
                    x: function(d, i) { return d.offset},
                    width: function(d, i) { return d.width;},
                    y: function(d, i) { return 0; },
                    height: function(d, i) { return 0; }
                })
                .style("fill", function(d,i) { return color(i)})
                .style("opacity", ".75")
                .on("mouseover", function(d,i) {
                    d3.select(this.parentNode).selectAll("rect").style("opacity", ".5");

                    d3.select(this)
                      .style("stroke", "darkturquoise")
                      .style("stroke-width", "2")
                      .style("opacity", 1);


                    dispatch.barHover;
                })
                .on("mouseout", function(d,i) {
                    d3.select(this.parentNode).selectAll("rect").style("opacity", ".75");
                    
                    d3.select(this)
                      .style("stroke-width", "0");

                    dispatch.hoverbar;
                })
                .on("click", function(d, i) {
                    dispatch.clickbar(d, i); 
                });
            
            bars.transition()
                .delay(function(d, i) { return i; })
                .duration(3000)
                .attr('y', function(d) { return 0; })
                .attr('height', function(d) { return height; })
            
            bars.enter().append("text")
                    .classed("chartlabel", true)
                    .attr("x", function(d, i) { return d.offset + (d.width / 2)})
                    .attr("y", function(d, i) { return (height / 2) + 3 })
                    .style("text-anchor", "middle")
                    .text(function(d) { return name(d) })                
                    .on("click", function(d, i) {
                        dispatch.clickbar(d, i); 
                     });
            
            

            bars.exit().transition().style({opacity: 0}).remove();
        });
    }

    exports.width = function(_) {
        if (!arguments.length) return w;
        width = _;
        return exports;
    };
    exports.height = function(_) {
        if (!arguments.length) return height;
        height = _;
        return exports;
    };

    exports.widthPercent = function(_) {
        if (!arguments.length) return widthPercent;
        widthPercent = _;
        return exports;
    };

    exports.heightPercent = function(_) {
        if (!arguments.length) return heightPercent;
        heightPercent = _;
        return exports;
    };

    exports.margin = function(_) {
        if (!arguments.length) return margin;
        margin = _;
        return exports;
    };
    exports.barPadding = function(_) {
        if (!arguments.length) return barPadding;
        barPadding = _;
        return exports;
    };
    exports.nameFunction = function(_) {
        if (!arguments.length) return name;
        name = _;
        return exports;
    };
    exports.valueFunction = function(_) {
        if (!arguments.length) return value;
        value = _;
        return exports;
    };

    d3.rebind(exports, dispatch, "on");

    return exports;
};