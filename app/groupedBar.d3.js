groupedBarD3 = function module() {

 
  var category    = function(d) { return d.category; };
  var name        = function(d) { return d.name; };
  var value       = function(d) { return d.value; };


  var margin = {left: 30, right: 30, top: 10, bottom: 30};

  var width = 600 - margin.left - margin.right;
  var height = 220 - margin.top - margin.bottom;
  
  var categories = ["1", "2", "3"];


  var showTooltip = true;

  var tooltipSelector = ".tooltip";

  var colorA = "#5254a3";
  var colorG = "#8ca252";
  var colorC = "#e7ba52";
  var colorT = "#ad494a";

  // agct green,black,blue,red
  var colorSchemeNucleotide = 
   {
     A: [colorG, colorC, colorT],
     G: [colorA, colorC, colorT],
     C: [colorA, colorG, colorT],
     T: [colorA, colorG, colorC]
   };

  var lookupNucleotide = {
     A: ["G", "C", "T"],
     G: ["A", "C", "T"],
     C: ["A", "G", "T"],
     T: ["A", "G", "C"]
   };



      
  function exports(selection) {

    
    selection.each(function(data) {


      // Add a property to the JSON object called "values" that contains an array of objects 
      // example value: [{name: cat1, value: 50}, {name: cat2, value: 33}]
      // Exclude the value that has 0 as this is the base that is the category. (e.g. 
      // exclude A value for A: )
      data.forEach(function(d) {

        // TODO: Exclude based on position, for example
        // if A record, exlude pos 0, G record, exclude pos 2
        d.values = d.values.filter( function(val) {
          if (val == 0) {
            return false;
          } else {
            return true;
          }
        }); 

        d.values = categories.map(function(catName, i) { 
          var valueObj = {category: d.category, name: catName, value: +d.values[i]}; 
          return valueObj;
        });

        
      });
    


      var x0 = d3.scale.ordinal()
          .rangeRoundBands([0, width], .1);

      var x1 = d3.scale.ordinal();

      var y = d3.scale.linear()
          .range([height, 0]);

      var color = d3.scale.category20b();

      var xAxis = d3.svg.axis()
          .scale(x0)
          .orient("bottom");
         
      var yAxis = d3.svg.axis()
          .scale(y)
          .orient("left")
          .tickFormat(d3.format(".2s"));

      x0.domain(data.map(function(d) { return category(d); }));
      x1.domain(categories).rangeRoundBands([0, x0.rangeBand()]);
      y.domain([0, d3.max(data, function(d) { return d3.max(d.values, function(d1) { return value(d1); }); })]);


      var svg = d3.select(this)
                  .selectAll("svg")
                  .data([data]);

      svg.enter()
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr('viewBox', "0 0 " + parseInt(width+margin.left+margin.right) + " " + parseInt(height+margin.top+margin.bottom))
        .attr("preserveAspectRatio", "xMidYMid meet");

      var svgGroup = svg.selectAll("g.group").data([data]).enter()
        .append("g")
        .attr("class", "group")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      svgGroup = svg.selectAll("g.group");
      svgGroup.selectAll("g.x").remove();
      svgGroup.selectAll("g.x").data([data]).enter()
        .append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);

      svgGroup.selectAll("g.y").remove();
      svgGroup.selectAll("g.y").data([data]).enter()
            .append("g")
            .attr("class", "y axis")
            .call(yAxis)
            .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .attr("font-size", "10px")
            .text("Mutation Frequency");


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
          .style("fill", function(d,i) {               
            var colorScheme =  colorSchemeNucleotide[d.category]; 
            var c = colorScheme[i];
            return c;
           });
       bars.exit().remove();

       barGroup.selectAll("text")
          .data(function(d) { return d.values; })
          .enter()
          .append("text").text(function(d){ 
            var nucleotide = lookupNucleotide[d.category];
            return nucleotide[+d.name - 1]
          })
          .attr("x", function(d) { return x1(name(d))  + (x1.rangeBand() / 2); })
          .attr("y", function(d) { 
            return y(value(d)) - 5; 
          })
          .attr("text-anchor", "middle")
          .attr("font-size", "13px")
          .attr("font-weight", "bold")
          .attr("fill", "black");

       

    });  // end for loop on selection
  }


  function scale(x) {
    return range[((index.get(x) || (ranger.t === "range" ? index.set(x, domain.push(x)) : NaN)) - 1) % range.length];
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

  return exports;
}