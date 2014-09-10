lineD3 = function module() {

  var dispatch = d3.dispatch("d3brush");

  var KIND_LINE = "line";
  var KIND_AREA = "area";

  var kind = KIND_LINE;

  var pos    = function(d) { return d.pos };
  var depth  = function(d) { return d.depth };

  // accessor after RDP conversion
  var _pos   = function(d) { return d[0] };
  var _depth = function(d) { return d[1] };


  var margin = {left: 50, right: 20, top: 10, bottom: 30};

  var width = 600 - margin.left - margin.right;
  var height = 220 - margin.top - margin.bottom;
  

  var showTooltip = true;
  var showYAxis = true;

  var tooltipSelector = ".tooltip";

  var dispatch = d3.dispatch("d3brush");


      
  function exports(selection) {

    
    selection.each(function(data) {

      var epsilonRate = 0.3;
      var epislon = parseInt( epsilonRate * (pos(data[data.length-1]) - pos(data[0])) / width );
      var points = data.map(function(d) { return [pos(d), depth(d)]; });
      data = properRDP(points, epislon);

      var svg = d3.select(this)
                  .selectAll("svg")
                  .data([data]);

      svg.enter()
        .append("svg")
        .attr("width", "100%")
        .attr("height", "80%")
        .attr('viewBox', "0 0 " + parseInt(width+margin.left+margin.right) + " " + parseInt(height+margin.top+margin.bottom))
        .attr("preserveAspectRatio", "xMidYMid meet")
        
      var svgGroup =  svg.selectAll("g.group").data([data]).enter()
        .append("g")
        .attr("class", "group")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        
      var x = d3.scale.linear()
          .range([0, width]);

      var y = d3.scale.linear()
          .range([height , 0]);

      x.domain(d3.extent(data, _pos));
      y.domain([0, d3.max(data, _depth)]);

      var brush = d3.svg.brush()
        .x(x)
        .on("brushend", function() {
            dispatch.d3brush(brush);
         });

      var xAxis = d3.svg.axis()
          .scale(x)
          .tickFormat(function (d) {
             if ((d / 1000000) >= 1)
               d = d / 1000000 + "M";
             else if ((d / 1000) >= 1)
               d = d / 1000 + "K";
             return d;            
          })
          .orient("bottom");

      var yAxis = d3.svg.axis()
          .scale(y)
          .orient("left");


      var areaOrLine;

      if (kind == KIND_AREA) {
        areaOrLine = d3.svg.area()
          .interpolate("linear")
          .x(function(d) { return x(_pos(d)); })
          .y0(height)
          .y1(function(d) { return y(_depth(d)); });
      } else {
        areaOrLine = d3.svg.line()
          .interpolate("linear")
          .x(function(d,i) { return x(_pos(d)); })
          .y(function(d) { return y(_depth(d)); });
      }

      if (kind == KIND_AREA) {
        svgGroup.selectAll("#area-gradient").data([data]).enter()
          .append("linearGradient")
          .attr("id", "area-gradient")
          .attr("gradientUnits", "userSpaceOnUse")
          .attr("x1", "0%").attr("y1", "0%")
          .attr("x2", "0%").attr("y2", "100%")
          .selectAll("stop")
          .data([
            {offset: "0%", color: "lightsteelblue"},
            {offset: "100%", color: "steelblue"}
           ])
          .enter().append("stop")
          .attr("offset", function(d) { return d.offset; })
          .attr("stop-color", function(d) { return d.color; });
      }


      svgGroup = svg.selectAll("g.group")
      svgGroup.selectAll("g.x").remove();

      svgGroup.selectAll("g.x").data([data]).enter()
        .append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);


      if (showYAxis) {
        svgGroup.selectAll("g.y").remove();
        svgGroup.selectAll("g.y").data([data]).enter()
            .append("g")
            .attr("class", "y axis")
            .call(yAxis);
      }
        

      // not sure why, but second time through, the svgGroup is a
      // "placeholder", so we will just select the group again
      // to remove the path and then add the new one.
      svgGroup = svg.selectAll("g.group")
      svgGroup.select("#area-chart-path").remove();
      
      svgGroup.append("path")
        .datum(data)
        .attr("id", "area-chart-path")
        .attr("class", kind)
        .attr("d", areaOrLine(data))
        .transition()
        .duration(3000)
        .attrTween('d', function() {
          {
            var interpolate = d3.scale.quantile()
                .domain([0,1])
                .range(d3.range(1, data.length + 1));

            return function(t) {
                var interpolatedArea = data.slice(0, interpolate(t));
                return areaOrLine(interpolatedArea);
            }
          }
        });

        svgGroup.append("g")
            .attr("class", "x brush")
            .call(brush)
            .selectAll("rect")
            .attr("y", -6)
            .attr("height", height + 6);




  });
}

  function _tooltip() {
     return d3.select(tooltipSelector);
  }


  exports.showTooltip = function(_) {
    if (!arguments.length) return showTooltip;
    showTooltip = _;
    return exports;
  };

  exports.tooltipSelector = function(_) {
    if (!arguments.length) return tooltipSelector;
    tooltipSelector = _;
    return exports;
  };

  exports.margin = function(_) {
    if (!arguments.length) return margin;
    margin = _;
    return exports;
  };

  exports.width = function(_) {
    if (!arguments.length) return width;
    width = _;
    width = width - margin.left - margin.right;
    return exports;
  };

  exports.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    height = height - margin.top - margin.bottom;
    return exports;
  };
 
  exports.brush = function(_) {
    if (!arguments.length) return brush;
    brush = _;
    return exports; 
  };

  exports.pos = function(_) {
    if (!arguments.length) return pos;
    pos = _;
    return exports; 
  }

  exports.depth = function(_) {
    if (!arguments.length) return dept;
    depth = _;
    return exports; 
  }

  exports.kind = function(_) {
    if (!arguments.length) return kind;
    kind = _;
    return exports; 
  }

  exports.showYAxis = function(_) {
    if (!arguments.length) return showYAxis;
    showYAxis = _;
    return exports; 
  }

  // This adds the "on" methods to our custom exports
  d3.rebind(exports, dispatch, "on");
  return exports;
}