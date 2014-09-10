/*
*  Global variables
*/
var chromosomeChart;
var chromosomeDataManager;
var variantDensityChart;
var variantDensityDataMgr;

var chromosomeIndex = 0;

/*
*  Document initialization
*/
$(document).ready( function(){
	//d3BrowserAdjustments();

	loadTopCharts();

});

/*
*
* loadTopCharts
*
*  Load the chromsome picker radial chart.  Load the first chromosome's variant density.
*
*/
function loadTopCharts() {
	// Create the chromosome picker chart. Listen for the click event on one of the arcs.
	// This event is dispatched when the user clicks on a particular chromosome.
	chromosomeChart = donutChooserD3()
		                .width(220)
		                .height(220)
						.on("d3click", function(d, i) {
							chromosomeIndex = i;
							loadVariantDensityChart(i);
						 });

	// Create the data manager						
	chromosomeDataMgr = dataManagerD3();

	// This is where we will hold the currently selected chromosome (index)
	chromosomeIndex = 0;


	// Create the variant density chart
	variantDensityChart = lineD3()
	                                .width("700")
	                                .height("180")
	                                .kind("line")
									.margin( {left: 30, right: 20, top: 30, bottom: 40})
									.showYAxis(false);

	// Create variant density data manager
	variantDensityDataMgr = dataManagerD3();


	// Create the data manager for the chromosome picker chart
	chromosomeDataMgr.loadCsvData("data/human_chromosomes.csv", function(d) {
		d.value = +d.chlength;
		d.name = d.chromosome;	
	  });

	// After the chromosome data has come back, load the chromosome picker chart
	// and then select the first chromsome;
	chromosomeDataMgr.on("dataReady", function(data) {

		chromosomeChart(d3.select("#chromosome-picker").datum(chromosomeDataMgr.getCleanedData()));	
		chromosomeIndex = 0;
		chromosomeChart.clickSlice(chromosomeIndex);
		loadVariantDensityChart(chromosomeIndex);


	});

	// After the variant density data is loaded, fill in the variant density chart
	// When the data has been loaded, show the variant density chart.
	variantDensityDataMgr.on("dataReady", function(data) {
		// Display the selected chromome name in the title of the variant density chart.
		d3.select("#variant-density")
			.select(".title")
			.text("ch" + chromosomeDataMgr.getCleanedData()[chromosomeIndex].name + " Variant Density");

		// Load the variant density chart with the data
		variantDensityChart(d3.select("#variant-density").datum(variantDensityDataMgr.getCleanedData()));

		// Listen for the brush event.  This will select a subsection of the x-axis on the variant
		// density chart, allowing the user to zoom in to a particular region to sample that specific
		// region rather than the entire chromosome.
		variantDensityChart.on("d3brush", function(brush) {
			if (!brush.empty()) {
				var start = parseInt(brush.extent()[0]);
				var end = parseInt(brush.extent()[1]);
				alert("d3brush start=" + start + " end=" + end);
			}
		});
		
	});
}



function loadVariantDensityChart(i) {
	// Load the variant density data with random data points
	var ch = chromosomeDataMgr.getCleanedData()[i];
	variantDensityDataMgr.loadRandomPointData(+ch.value);

}


             
function d3BrowserAdjustments() {
	var lastTime = 0;
	var vendors = ['ms', 'moz', 'webkit', 'o'];
	for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
	window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
	window.cancelAnimationFrame = window[vendors[x] + 'CancelAnimationFrame'] || window[vendors[x] + 'CancelRequestAnimationFrame'];
	}
	if(!window.requestAnimationFrame)
	window.requestAnimationFrame = function (callback, element) {
	  var currTime = new Date().getTime();
	  var timeToCall = Math.max(0, 16 - (currTime - lastTime));
	  var id = window.setTimeout(function () {
	    callback(currTime + timeToCall);
	  },
	  timeToCall);
	  lastTime = currTime + timeToCall;
	  return id;
	};
	if(!window.cancelAnimationFrame)
	window.cancelAnimationFrame = function (id) {
	  clearTimeout(id);
	}
}










