groupedBarD3 = function module() {

  var margin = {left: 30, right: 30, top: 10, bottom: 30};

  var width         = 600 - margin.left - margin.right;
  var height        = 220 - margin.top - margin.bottom;
  var widthPercent  = "95%";
  var heightPercent = "95%";

  var categoryPadding = .4;
  
  // default colors
  var colorScale = d3.scale.category20();

  var showXAxis = true;
  var showXTicks = true;
  var xAxisLabel = null;

  var showYAxis = true;
  var yAxisTickLabel = null;
  var yAxisLabel = null;

  var showTooltip = true;
  var showBarLabel = true;
  var categories = null;
  

  /*
  * The default function for getting the category from the data.
  * Category is the field that the bars are grouped by.
  */
  function category(d) {
    return d.category;
  }

  /*
  * The default function for getting the name from the data.
  * Name is the field that represents the individual bar.
  */
  function name(d) {
    return d.name;
  }

  /*
  * The default function for getting the value from the data.
  * Value is the field that represents the height of the
  * individual bar.
  */
  function value(d) {
    return d.value;
  }


  /*
  * The default function for filling the individual
  * bar.  We use the category to map 
  * to a particular color in a color scale.
  */
  function fill(d,i) {
    return colorScale(name(d));
  }

  /*
  * The default function for the category label.  We
  * use the name (associated with the value).
  */
  function barLabel(d,i) {
    return d.name;
  }


  /*
  *  The default function for creating a scale for the x-axis.
  */
  function scale(x) {
    return range[((index.get(x) || (ranger.t === "range" ? index.set(x, domain.push(x)) : NaN)) - 1) % range.length];
  }



  /*
  *  The main function to render a grouped bar chart.
  *  It takes one argument, the d3 selected parent(s),
  *  primed with the data.  For each parent (typically
  *  just one), the function will create an SVG object,
  *  a grouped bar chart.  This function should be callled
  *  each time the data changes. Subsequent calls after
  *  the first call will remove and recreate the axis as well 
  *  as the individual bars.
  */      
  function exports(selection) {

    
    selection.each(function(data) {

      // Make sure we have categories
      if (!categories) {
        console.log("ERROR - cannot create groupedBarD3 because categories were not provided.")
        return;
      }


      // Add a property to the JSON object called "values" that contains an array of objects 
      // example value: [{name: cat1, value: 50}, {name: cat2, value: 33}]
      // Exclude the value that has 0 as this is the base that is the category. (e.g. 
      // exclude A value for A: )
      data.forEach(function(d) {
        d.values = categories.map(function(catName, i) { 
          var valueObj = {category: category(d), name: catName, value: +d.values[i]}; 
          return valueObj;
        });
      });
    


      var x0 = d3.scale.ordinal()
          .rangeRoundBands([0, width], categoryPadding);

      var x1 = d3.scale.ordinal();

      var y = d3.scale.linear()
          .range([height, 0]);

      if (showXAxis) {
        var xAxis = d3.svg.axis()
            .scale(x0)
            .orient("bottom");
        if (!showXTicks) {
          xAxis.tickSize(0);
        }
      }
      
      if (showYAxis) {
        var yAxis = d3.svg.axis()
            .scale(y)
            .orient("left");
            //.tickFormat(d3.format(".2s"));
      }   


      x0.domain(data.map(function(d) { return category(d); }));
      x1.domain(categories).rangeRoundBands([0, x0.rangeBand()]);
      y.domain([0, d3.max(data, function(d) { return d3.max(d.values, function(d1) { return value(d1); }); })]);


      var svg = d3.select(this)
                  .selectAll("svg")
                  .data([data]);

      svg.enter()
        .append("svg")
        .attr("width", widthPercent)
        .attr("height", heightPercent)
        .attr('viewBox', "0 0 " + parseInt(width+margin.left+margin.right) + " " + parseInt(height+margin.top+margin.bottom))
        .attr("preserveAspectRatio", "xMidYMid meet");

      var defs = svg.selectAll("defs").data([data]).enter()
                        .append("defs");

      var svgGroup = svg.selectAll("g.group").data([data]).enter()
        .append("g")
        .attr("class", "group")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      if (showXAxis) {
        svgGroup = svg.selectAll("g.group");
        svgGroup.selectAll("g.x").remove();
        svgGroup.selectAll("g.x").data([data]).enter()
          .append("g")
          .attr("class", "x axis")
          .attr("transform", "translate(0," + height + ")")
          .call(xAxis);

        // Add the text label for the x axis
        if (xAxisLabel) {
          svgGroup = svg.selectAll("g.group");
          svgGroup.selectAll("text.x.axis.label").remove();
          svgGroup.append("text")
            .attr("class", "x axis label")
            .attr("transform", "translate(" + (width / 2) + " ," + (height + margin.bottom) + ")")
            .style("text-anchor", "middle")
            .text(xAxisLabel);
        }

      }

      if (showYAxis) {
        svgGroup.selectAll("g.y").remove();
        svgGroup.selectAll("g.y").data([data]).enter()
          .append("g")
          .attr("class", "y axis")
          .call(yAxis);
        if (yAxisTickLabel) {
          svgGroup = svg.selectAll("g.group");
          svgGroup.selectAll("text.y.axis.label").remove();
          svgGroup.append("text")
            .attr("class", "y axis label")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .attr("font-size", "10px")
            .text(yAxisLabel);

        }  
 
         // Add the text label for the Y axis
         if (yAxisLabel) {
          svgGroup.selectAll("g.y axis label").remove();
          svgGroup.append("text")
              .attr("class", "y axis label")
              .attr("transform", "rotate(-90)")
              .attr("y", 0 - margin.left)
              .attr("x",0 - (height / 2))
              .attr("dy", "1em")
              .style("text-anchor", "middle")
              .text(yAxisLabel);

       }            
      }

      svgGroup = svg.selectAll("g.group")
      svgGroup.selectAll("g.category").remove();
      var barGroup = svgGroup.selectAll(".category")
            .data(data)
            .enter().append("g")
            .attr("class", "category")
            .attr("transform", function(d) { return "translate(" + x0(category(d)) + ",0)"; });

      var bars = barGroup.selectAll("rect")
                          .data(function(d) { return d.values; });


      bars.enter()
          .append("rect")
          .attr("width", x1.rangeBand())
          .attr("x", function(d) { return x1(name(d)); })
          .attr("y", function(d){  return y(value(d)); })
          .attr("height", function(d) { return height - y(value(d)); })
          .style("fill", fill)
          .on("mouseover", function(d) {  
            if (showTooltip) {
              div.transition()        
                 .duration(200)      
                 .style("opacity", .9);      
              div.html(d3.round(value(d)))                                  
                 .style("left", (d3.event.pageX) + "px") 
                 .style("text-align", 'left')    
                 .style("top", (d3.event.pageY - 24) + "px");    
             }
         })                  
         .on("mouseout", function(d) {      
            if (showTooltip) {
              div.transition()        
                 .duration(500)      
                 .style("opacity", 0);   
            } 
         });
         
       bars.exit().remove();

       if (showBarLabel) {
         barGroup.selectAll("text")
            .data(function(d) { return d.values; })
            .enter()
            .append("text").text( barLabel )
            .attr("x", function(d) { return x1(name(d))  + (x1.rangeBand() / 2); })
            .attr("y", function(d) { 
              return y(value(d)) - 5; 
            })
            .attr("text-anchor", "middle")
        }

       

    });  // end for loop on selection
  }



  /*
  *
  *  All functions in this section allow the grouped bar chart widget to be
  *  customized, using the "chained" approach, a "shorthand" style for
  *  calling functions, one after another.
  *
  */
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


  exports.category = function(_) {
    if (!arguments.length) return category;
    category = _;
    return exports; 
  }

  exports.name = function(_) {
    if (!arguments.length) return name;
    name = _;
    return exports; 
  }

  exports.values = function(_) {
    if (!arguments.length) return value;
    value = _;
    return exports; 
  }

  exports.categories = function(_) {
    if (!arguments.length) return categories;
    categories = _;
    return exports;
  }

  exports.fill = function(_) {
    if (!arguments.length) return fill;
    fill = _;
    return exports;
  }

  exports.colorList = function(_) {
    if (!arguments.length) return colorList;
    colorList = _;
    colorScale = d3.scale.ordinal().range(colorList);
    return exports;
  }

  exports.colorScale = function(_) {
    if (!arguments.length) return colorScale;
    colorScale = _;
    return exports;
  }

  exports.showBarLabel = function(_) {
    if (!arguments.length) return showBarLabel;
    showBarLabel = _;
    return exports;
  };

  exports.barLabel = function(_) {
    if (!arguments.length) return barLabel;
    barLabel = _;
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

  exports.showXTicks = function(_) {
    if (!arguments.length) return showXTicks;
    showXTicks = _;
    return exports;
  }

  exports.yAxisTickLabel = function(_) {
    if (!arguments.length) return yAxisTickLabel;
    yAxisTickLabel = _;
    return exports;
  }

  exports.categoryPadding = function(_) {
    if (!arguments.length) return categoryPadding;
    categoryPadding = _;
    return exports;
  }
 
  exports.xAxisLabel = function(_) {
    if (!arguments.length) return xAxisLabel;
    xAxisLabel = _;
    return exports;
  }
  
  exports.yAxisLabel = function(_) {
    if (!arguments.length) return yAxisLabel;
    yAxisLabel = _;
    return exports;
  }
    



  return exports;
}