donutChooserD3 = function module() {
  var dispatch = d3.dispatch("clickslice", "clickall");

  var name = function(d) { return d.name };
  var value  = function(d) { return d.value };

  var defaults = {showTooltip:true},
      margin = {top: 5, right: 5, bottom: 5, left: 5};

  var width = 220 - margin.left - margin.right;
  var height = 220 - margin.top - margin.bottom;

 
  var pie = d3.layout.pie()
              .sort(null)
              .value(function (d) {
                return value(d);
               });

  var color = d3.scale.category20b();
  var currentSlice = null;
  var sliceApiSelected = null;
  var options = null;
  var arcs = null;
  var tooltipSelector = ".tooltip";
  var radius;
  var radiusOffset;
  var svg;
  var arc;
  var clickedSlice;
  var clickedSlices = [];
      
  function exports(selection) {
    

    radius = Math.min(width, height ) / 2;
    radiusOffset = (radius * .1) / 2;
    outerRadius = radius - radiusOffset;
    innerRadius = outerRadius - (radius / 2);


    arc = d3.svg.arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius);


    selection.each(function(data) {



      // Select the svg element, if it exists.
      svg = d3.select(this).selectAll("svg").data([data]);

      // Otherwise, create the skeletal exports.
      var g = svg.enter()
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%") 
        .attr('viewBox', "-" + radiusOffset + " -" + radiusOffset + " " + parseInt(width+margin.left+margin.right) + " " + parseInt(height+margin.top+margin.bottom))
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g")
        .attr("transform", "translate(" + radius +  "," + radius + ")");

      // set up arcs (g.arc)
      arcs = g.selectAll("g.arc")
        .data(pie(data))
        .enter()
        .append("g")
        .attr("class", "arc");
      
      // set up the arc paths 
      arcs.append("path")
        .attr("fill", function(d, i) {
          return color(i);
        })
        .attr("d", arc);


     // ALL link inside of donut chart for selecting all pieces
     g.append("text")
      .attr("dy", ".35em")
      .style("text-anchor", "middle")
      .attr("class", "inside")
      .text(function(d) { return 'All'; })
      .on("click", function(d) { 
        clickedSlices.length = 0;
        for (var i = 0; i < data.length; i++) {
          var theSlice = arcs.selectAll("d.arc")[i].parentNode;
          _clickSlice(theSlice, theSlice.__data__,  i, false);
        }
        dispatch.clickall();    
      } );
      
      arcs.append("text")
        .attr("class", "chartlabel")
        .attr("dy", ".35em")
        .attr("transform", function(d) {
          return "translate(" + _arcLabelPosition(d, .55) + ")";
        })
        .attr("text-anchor", "middle")
        .text(function(d) {
          return name(d.data);
        });

      arcs.on("mouseover", _selectSlice)
          .on("mouseout", function(d) {
              if (this != clickedSlice) {
                d3.select(this)
                  .select("path")
                  .transition()
                  .duration(150).attr("transform", "translate(0,0)"); 
              }
            })
          .on("click", function(d, i) {
              _clickSlice(this, d, i, true);
            });

      
    });
  }

  function _tooltip() {
     return d3.select(tooltipSelector);
  }

  function _clickSlice(theSlice, d, i, singleSelection) {
    if (singleSelection) {
      if (clickedSlices.length > 0) {
        for (var i = 0; i < clickedSlices.length; i++) {
          _unclickSlice(clickedSlices[i]);
        }
        clickedSlices.length = 0;

      } else if (clickedSlice) {
        _unclickSlice(clickedSlice);
      }

    } 


    // Bold the label of the clicked slice
    d3.select(theSlice).selectAll("text").attr("class", "chartlabelSelected");


    // Offset the arc even more than mouseover offset
    // Calculate angle bisector
    var ang = d.startAngle + (d.endAngle - d.startAngle)/2; 
    // Transformate to SVG space
    ang = (ang - (Math.PI / 2) ) * -1;

    // Calculate a 10% radius displacement
    var x = Math.cos(ang) * radius * 0.1;
    var y = Math.sin(ang) * radius * -0.1;

    d3.select(theSlice)
      .select("path")
      .attr("transform", "rotate(0)")
      .transition()
      .duration(200)
      .attr("transform", "translate("+x+","+y+")"); 

    d3.select(theSlice)
      .select("text")
      .attr("transform", "rotate(0)")
      .transition()
      .duration(200)
      .attr("transform", "translate("+_arcLabelPosition(d, .65)+")"); 


    if (singleSelection) {
      clickedSlice = theSlice;
      dispatch.clickslice(d.data, i);    
    }
    else {
      clickedSlices.push(theSlice);
    }

  }

  function _unclickSlice(clickedSlice) {
    // change the previous clicked slice back to no offset
    d3.select(clickedSlice)
      .select("path")
      .transition()
      .duration(150).attr("transform", "translate(0,0)"); 

    // change the previous clicked slice label back to normal font
    d3.select(clickedSlice).selectAll("text").attr("class", "chartlabel");
    var labelPos = _arcLabelPosition(clickedSlice.__data__, .55);

    // change the previous clicked label back to the normal position
    d3.select(clickedSlice)
      .select("text")
      .attr("transform", "rotate(0)")
      .transition()
      .duration(200)
      .attr("transform", "translate("+labelPos+")"); 

  }

  function _selectSlice(d, i, gNode, deselectPrevSlice) {
        var theSlice = this; 

        // We have a gNode when this function is
        // invoked during initialization to selected
        // the first slice.
        if (gNode) {
          theSlice = gNode;
          sliceApiSelected = gNode;
          
        } else {
          // We have to get rid of previous selection
          // when we mouseenter after first chromsome
          // was auto selected because mouseout
          // event not triggered when leaving first
          // selected slice.
          if (deselectPrevSlice) {
            if (sliceApiSelected) {
              d3.select(sliceApiSelected).select("path")
                  .transition()
                  .duration(150)
                  .attr("transform", "translate(0,0)"); 
                sliceApiSelected = null;
            }
          }
        }
        
        // show tooltip
        if (options.showTooltip) {
          _tooltip().transition()
            .duration(200)
            .style("opacity", .9);

          var centroid = arc.centroid(d);

          var matrix = theSlice.getScreenCTM()
                      .translate(+theSlice.getAttribute("cx"),
                                 +theSlice.getAttribute("cy"));
          // position tooltip
          _tooltip().html(name(d.data))
            .style("visibility", "visible")
            .style("left", (matrix.e + centroid[0]) + "px")
            .style("top", (matrix.f + centroid[1]- 18) + "px");

        }


        if (theSlice != clickedSlice) {
          // Calculate angle bisector
          var ang = d.startAngle + (d.endAngle - d.startAngle)/2; 
          // Transformate to SVG space
          ang = (ang - (Math.PI / 2) ) * -1;

          // Calculate a .5% radius displacement (inverse to make slice to inward)
          var x = Math.cos(ang) * radius * 0.05;
          var y = Math.sin(ang) * radius * -0.05;
          d3.select(theSlice)
            .select("path")
            .attr("transform", "rotate(0)")
            .transition()
            .duration(200)
            .attr("transform", "translate("+x+","+y+")"); 

        }



        this.currentSlice = theSlice;

  }


  function _arcLabelPosition(d, ratio) {
    var r = ( innerRadius + outerRadius ) * ratio;
    var oa = arc.startAngle.call(d);
    var ia = arc.endAngle.call(d);
    a = ( oa(d) + ia(d) ) / 2 - (Math.PI/ 2);      
    return [ Math.cos(a) * r, Math.sin(a) * r ];
  };



  exports.clickSlice = function(i) {   
    var theSlice = arcs.selectAll("d.arc")[i].parentNode;
    _clickSlice(theSlice, theSlice.__data__, i, true);
    _selectSlice(theSlice.__data__,  i, theSlice);
    clickedSlice = theSlice;
    return exports;
  }

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
  
  exports.x = function(_) {
    if (!arguments.length) return x;
    x = _;
    return exports;
  };

  exports.y = function(_) {
    if (!arguments.length) return y;
    y = _;
    return exports;
  };
    
  exports.xAxis = function(_) {
    if (!arguments.length) return xAxis;
    xAxis = _;
    return exports; 
  };

  exports.yAxis = function(_) {
    if (!arguments.length) return yAxis;
    yAxis = _;
    return exports; 
  };  

  exports.color = function(_) {
    if (!arguments.length) return color;
    color = _;
    return exports;
  }
  
  exports.brush = function(_) {
    if (!arguments.length) return brush;
    brush = _;
    return exports; 
  };

  exports.value = function(_) {
    if (!arguments.length) return value;
    value = _;
    return exports; 
  }

  exports.name = function(_) {
    if (!arguments.length) return name;
    name = _;
    return exports; 
  }

  exports.options = function(_) {
    if (!arguments.length) return options;
    options = _;
    return exports; 
  }

  // This adds the "on" methods to our custom exports
  d3.rebind(exports, dispatch, "on");
  return exports;
}