barChartD3 = function module() {
    var width = 400,
        height = 300;

    var margin = {left: 10, right: 10, top: 10, bottom: 10};
    var barPadding = 1;
    var widthPercent  = "95%";
    var heightPercent = "95%";


    var dispatch = d3.dispatch("customHover");
    var barPadding = .1;
    var barOuterPadding = 0;

    var color = d3.scale.category20b();

    var name = function(d) { return d[0]; };
    var value = function(d) { return d[1]; };


    function exports(_selection) {
        _selection.each(function(_data) {

            var yRange = d3.scale.linear()
                .range([height - margin.top, margin.bottom])
                .domain([0, d3.max(_data, function (d) { return value(d); }) ]);

            var barWidth = d3.round(width / _data.length);
            var scaling = height / d3.max(_data, function(d) { return value(d)});

            // Trick to just append the svg skeleton once
            var svg = d3.select(this)
                .selectAll("svg")
                .data([_data]);
            svg.enter().append("svg")
                .classed("chart", true)
                .attr("width", widthPercent)
                .attr("height", heightPercent)
                .attr('viewBox', "0 0 " + parseInt(width+margin.left+margin.right) + " " + parseInt(height+margin.top+margin.bottom))
                .attr("preserveAspectRatio", "xMidYMid meet");

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
                    x: function(d, i) { return i * barWidth; },
                    width: function(d, i) { return barWidth; },
                    y: function(d, i) { return yRange(value(d)); },
                    height: function(d, i) { return height - yRange(value(d)); }
                })
                .on("mouseover", dispatch.customHover);

            bars.transition()
                .attr({
                    x: function(d, i) { return i * barWidth; },
                    width: function(d, i) { return barWidth; },
                    y: function(d, i) { return yRange(value(d)); },
                    height: function(d, i) { return height - yRange(value(d)); }
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
 




    //d3.rebind(exports, dispatch, "on");
    return exports;
};