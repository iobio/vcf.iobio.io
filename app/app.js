/*
*  Global variables
*/
var chromosomeChart;
var chromosomeDataManager;

var variantDensityChart;
var variantDensityDataMgr;

var statsAliveDataMgr;

var alleleFreqChart;
var mutSpectrumChart;


var chromosomeIndex = 0;

/*
*  Document initialization
*/
$(document).ready( function(){
	//d3BrowserAdjustments();

	init();

});

/*
*
* init
*
*  Load the chromsome picker radial chart.  Load the first chromosome's variant density.
*
*/
function init() {
	// Create the chromosome picker chart. Listen for the click event on one of the arcs.
	// This event is dispatched when the user clicks on a particular chromosome.
	chromosomeChart = donutChooserD3()
		                .width(220)
		                .height(220)
						.on("d3click", function(d, i) {
							chromosomeIndex = i;
							onChromosomeSelected(i);
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
		onChromosomeSelected(chromosomeIndex);


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



	// Allele Frequency chart
	alleleFreqChart = histogramD3()
                        .width("700")
                        .height("180")
						.margin( {left: 50, right: 20, top: 30, bottom: 0});





	// Mutation spectrum grouped barchart
	mutSpectrumChart = groupedBarD3();

	mutSpectrumChart.width("700")
                        .height("260")
						.margin( {left: 50, right: 20, top: 20, bottom: 30});
	


	// Initialize the stats alive data manager
	statsAliveDataMgr = new dataManagerD3();

	// Create the data manager for the chromosome picker chart
	statsAliveDataMgr.loadJsonData("data/sample5.json");

	// Listen for data ready even
	statsAliveDataMgr.on("dataReady", function(data) {
		var numberOfIterations = statsAliveDataMgr.getCleanedData().length;
		simulateServerData(numberOfIterations, 1);
	});

}

function simulateServerData(numberOfIterations, delaySeconds) {
	var i = 1;                   

	function simulateDataRead() {           
	   setTimeout(function () {   
	   	  var globalStats = statsAliveDataMgr.getCleanedData()[i];
	      renderGlobalStats(globalStats);         
	      i++;                     
	      if (i < numberOfIterations) { 
	      	 // Recursive call
	         simulateDataRead();           
	      }                       
	   }, delaySeconds * 1000) // Delay for n milliseconds after executing function.
	}

	simulateDataRead();
}

function onChromosomeSelected(i) {
	loadVariantDensityChart(i);

	renderStats(i);

}

function loadVariantDensityChart(i) {
	// Load the variant density data with random data points
	var ch = chromosomeDataMgr.getCleanedData()[i];
	variantDensityDataMgr.loadRandomPointData(+ch.value);

}

function renderGlobalStats(globalStats) {

	// # of Variants sampled
	var totalReads = globalStats.TotalRecords;
	d3.select("#total-reads")
			.select("#value")
			.text(totalReads);


	// TsTv Ratio
	var tstvRatio = globalStats.TsTvRatio;
	d3.select("#genome-stats")
			.select("#tstv-ratio")
			.select("#ratio-value")
			.text(tstvRatio.toFixed(2));

	// Alelle Frequency
	var afObj = globalStats.af_hist;
	var afData = statsAliveDataMgr.jsonToArray2D(afObj);
	var afSelection = d3.select("#genome-stats")
					    .select("#allele-freq-chart")
					    .datum(afData);
	alleleFreqChart(afSelection);	

	// Mutation Spectrum
	var msObj = globalStats.mut_spec;
	var msArray = statsAliveDataMgr.jsonToArray(msObj, "category", "values");
	var msSelection = d3.select("#genome-stats")
	                    .select("#mut-spectrum").datum(msArray);
	mutSpectrumChart(msSelection);


}

function renderStats(i) {

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










