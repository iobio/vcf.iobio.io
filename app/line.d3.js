lineD3 = function module() {

  var dispatch = d3.dispatch("d3brush", "d3rendered");

  var KIND_LINE = "line";
  var KIND_AREA = "area";

  var kind = KIND_LINE;

  var pos    = function(d) { return d.pos };
  var depth  = function(d) { return d.depth };
  var formatXTick = null;


  var margin = {left: 50, right: 20, top: 10, bottom: 30};

  var width = 600 - margin.left - margin.right;
  var height = 220 - margin.top - margin.bottom;
  var widthPercent  = "95%";
  var heightPercent = "95%";

  var showTooltip = true;
  var showBrush = false;
  var showXAxis = true;
  var showYAxis = true;
  var showTransition = true;
  var showGradient = true;
  var brushHeight = null;

  var tooltipSelector = ".tooltip";



      
  function exports(selection, cb) {

   
    selection.each(function(data) {


      var svg = d3.select(this)
                  .selectAll("svg")
                  .data([data]);

      var x = d3.scale.linear()
          .range([0, width]);

      var y = d3.scale.linear()
          .range([height , 0]);

      x.domain(d3.extent(data, pos));
      y.domain([0, d3.max(data, depth)]);

      svg.enter()
        .append("svg")
        .attr("width", widthPercent)
        .attr("height", heightPercent)
        .attr('viewBox', "0 0 " + parseInt(width+margin.left+margin.right) + " " + parseInt(height+margin.top+margin.bottom))
        .attr("preserveAspectRatio", "xMinYMid meet");

      // The chart dimensions could change after instantiation, so update viewbox dimensions
      // every time we draw the chart.
      d3.select(this).selectAll("svg")
         .attr('viewBox', "0 0 " + parseInt(width+margin.left+margin.right) + " " + parseInt(height+margin.top+margin.bottom));

      
      if (kind == KIND_AREA && showGradient) {
          var defs = svg.selectAll("defs").data([data]).enter()
                        .append("defs");

          var lg = defs.selectAll("linearGradient").data([data]).enter()
                 .append("linearGradient")
                 .attr("id", "area-chart-gradient")
                 .attr("x1", "0")
                 .attr("x2", "0")
                 .attr("y1", "0")
                 .attr("y2", "1");

           lg.selectAll("stop.area-chart-gradient-top").data([data]).enter()
             .append("stop")
             .attr("class", "area-chart-gradient-top")
             .attr("offset", "60%");

           lg.selectAll("stop.area-chart-gradient-bottom").data([data]).enter()
             .append("stop")
             .attr("class", "area-chart-gradient-bottom")
             .attr("offset", "100%");
      }
  
        
      var svgGroup =  svg.selectAll("g.group").data([data]).enter()
        .append("g")
        .attr("class", "group")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      // Tooltip
      var formatter = d3.format(',');
      svgGroup.on("mouseover", function(d) {  
             mousex = d3.mouse(this);
             mousex = mousex[0];
             var invertedx = x.invert(mousex);
             var pos1 = d3.event.pageX - $(this).position().left;
             var invertedx1 = x.invert(pos1);
             /*
             div.transition()        
                 .duration(200)      
                 .style("opacity", .9);      

              div.html(mousex + ' ' + invertedx + ' ' + pos1 + ' ' + invertedx1)
                 .style("left", (d3.event.pageX) + "px") 
                 .style("text-align", 'left')    
                 .style("top", (d3.event.pageY - 24) + "px");   
              */ 
             })                  
         .on("mousemove", function() {    
             mousex = d3.mouse(this);
             mousex = mousex[0];
             var invertedx = x.invert(mousex);
             var pos1 = d3.event.pageX - $(this).position().left;
             var invertedx1 = x.invert(pos1);
             /*

            div.html(mousex + ' ' + invertedx + ' ' + pos1 + ' ' + invertedx1)
               .style("left", (d3.event.pageX) + "px") 
               .style("top", (d3.event.pageY - 24) + "px");
               */
          })               
         .on("mouseout", function() {       
             div.transition()        
                 .duration(500)      
                 .style("opacity", 0);   
       });   

     
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
      if (formatXTick) {
        xAxis.tickFormat(formatXTick);
      }


      var yAxis = d3.svg.axis()
          .scale(y)
          .orient("left");


      var line = d3.svg.line()
          .interpolate("linear")
          .x(function(d,i) { return x(pos(d)); })
          .y(function(d) { return y(depth(d)); });

      var area;

      if (kind == KIND_AREA) {
        area = d3.svg.area()
          .interpolate("linear")
          .x(function(d) { return x(pos(d)); })
          .y0(height)
          .y1(function(d) { return y(depth(d)); });
      } 

      
      svgGroup = svg.selectAll("g.group")
      svgGroup.selectAll("g.x").remove();
      if (showXAxis) {
        svgGroup.selectAll("g.x").data([data]).enter()
          .append("g")
          .attr("class", "x axis")
          .attr("transform", "translate(0," + height + ")")
          .call(xAxis);        
      }

      svgGroup.selectAll("g.y").remove();
      if (showYAxis) {
        svgGroup.selectAll("g.y").data([data]).enter()
            .append("g")
            .attr("class", "y axis")
            .call(yAxis);
      }
        

      // not sure why, but second time through, the svgGroup is a
      // "placeholder", so we will just select the group again
      // to remove the path and then add the new one.
      svgGroup = svg.selectAll("g.group")
      svgGroup.select("#line-chart-path").remove();
      
      var linePath = svgGroup.append("path")
        .datum(data)
        .attr("id", "line-chart-path")
        .attr("class", "line")
        .attr("d", line(data));

      if (showTransition) {
        linePath.transition()
          .duration(3000)
          .attrTween('d', function() {
              {
                var interpolate = d3.scale.quantile()
                    .domain([0,1])
                    .range(d3.range(1, data.length + 1));

                return function(t) {
                    var interpolatedArea = data.slice(0, interpolate(t));
                    return line(interpolatedArea);
                }
              }
            })
          .each("end", function(d) {
              dispatch.d3rendered();
          });
          
      }


      if (kind == KIND_AREA) {
        svgGroup.select("#area-chart-path").remove();
        var areaPath = svgGroup.append("path")
          .datum(data)
          .attr("id", "area-chart-path")
          .attr("d", area(data));

        if (showGradient) {
          areaPath.style("fill", "url(#area-chart-gradient)");
        }

        if (showTransition) {
          areaPath.transition()
             .duration(3000)
             .attrTween('d', function() {
                { 
                  var interpolate = d3.scale.quantile()
                      .domain([0,1])
                      .range(d3.range(1, data.length + 1));

                  return function(t) {
                      var interpolatedArea = data.slice(0, interpolate(t));
                      return area(interpolatedArea);
                  }
                }
              });
             
        }
       }

      if (showBrush) {
        if (brushHeight == null ) {
          brushHeight = height;
          brushY = -6;
        } else {
          brushY = 0 - (brushHeight / 2);
        }
        svgGroup.append("g")
            .attr("class", "x brush")
            .call(brush)
            .selectAll("rect")
            .attr("y", brushY)
            .attr("height", brushHeight);
      }

      if (!showTransition) {
        dispatch.d3rendered();
      }


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

  exports.showXAxis = function(_) {
    if (!arguments.length) return showXAxis;
    showXAxis = _;
    return exports; 
  }

  exports.showYAxis = function(_) {
    if (!arguments.length) return showYAxis;
    showYAxis = _;
    return exports; 
  }
  
  exports.formatXTick = function(_) {
    if (!arguments.length) return formatXTick;
    formatXTick = _;
    return exports;
  }

  exports.showTransition = function(_) {
    if (!arguments.length) return showTransition;
    showTransition = _;
    return exports;
  }

  exports.showGradient = function(_) {
    if (!arguments.length) return showGradient;
    showGradient = _;
    return exports;
  }

  exports.showBrush = function(_) {
    if (!arguments.length) return showBrush;
    showBrush = _;
    return exports;
  }

  exports.brushHeight = function(_) {
    if (!arguments.length) return brushHeight;
    brushHeight = _;
    return exports;
  }

  // This adds the "on" methods to our custom exports
  d3.rebind(exports, dispatch, "on");
  return exports;
}