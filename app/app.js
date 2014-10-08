/*
*  Global variables
*/
var indexDataMgr;

var chromosomeChart;

var variantDensityChart;
var variantDensityDataMgr;

var statsAliveDataMgr;

var alleleFreqChart;
var mutSpectrumChart;

var serverSimulator = null;


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
	indexDataMgr = new indexDataManager();


	// Setup event handlers for File input
	document.getElementById('file').addEventListener('change', onFilesSelected, false);

	// Create the chromosome picker chart. Listen for the click event on one of the arcs.
	// This event is dispatched when the user clicks on a particular chromosome.
	chromosomeChart = donutChooserD3()
		                .width(220)
		                .height(220)
						.on("d3click", function(d, i) {
							chromosomeIndex = i;
							onReferenceSelected(d, i);
						 });


	// Create the variant density chart
	variantDensityChart = lineD3()
                            .width("700")
                            .height("180")
                            .kind("area")
							.margin( {left: 30, right: 20, top: 30, bottom: 40})
							.showYAxis(false);



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

	


}

function onFilesSelected(event) {
	indexDataMgr.openVcfFile( event, function() {

		d3.select("#selectData")
		  .style("visibility", "hidden")
		  .style("display", "none");

		d3.select("#showData")
		  .style("visibility", "visible");

		indexDataMgr.loadIndex(onReferencesLoaded);

	});
}

function onReferencesLoaded(refData) {

	var pieChartRefData = indexDataMgr.getReferences(.01, 1);
	
	chromosomeChart(d3.select("#primary-references").datum(pieChartRefData));	
	chromosomeIndex = 0;
	chromosomeChart.clickSlice(chromosomeIndex);
	onReferenceSelected(refData[chromosomeIndex], chromosomeIndex);

	var otherRefData = indexDataMgr.getReferences(0, .01);

	if (otherRefData.length > 0) {
		var dropdown = d3.select("#other-references-dropdown");

		dropdown.on("change", function(event) {
			chromosomeIndex = this.value;
			onReferenceSelected(refData[chromosomeIndex], chromosomeIndex);
		});
		
		dropdown.selectAll("option")
		  .data(otherRefData)
		  .enter()
		  .append("option")
		  .attr( "value", function(d,i) { return d.idx; } )
		  .text( function(d,i) { return d.name } );

		d3.select("#other-references").style("display", "block");
	}

		
}



function onReferenceSelected(ref, i) {
	loadVariantDensityData(ref, i);

	loadStats(ref, i);

}

function loadVariantDensityData(ref, i) {
	
	var variantDensityData = indexDataMgr.getEstimatedDensity(ref.name);

	

	// Load the variant density chart with the data
	variantDensityChart(d3.select("#variant-density").datum(variantDensityData));

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



}

function loadStats(ref, i) {
	d3.select("#total-reads").style("display", "block");
	d3.select("#total-reads")
			.select("#value")
			.text(0);

	// Create the data manager for the chromosome picker chart
	statsAliveDataMgr.loadJsonData("data/sample5.json");
			
	// Listen for data ready even
	statsAliveDataMgr.on("dataReady", function(data) {
		var numberOfIterations = statsAliveDataMgr.getCleanedData().length;
		simulateServerData(numberOfIterations, 1);
	});


}



function simulateServerData(numberOfIterations, delaySeconds) {
	var i = 0;
	var numberOfInterations = numberOfInterations;

	if (window.serverSimulator) {
		window.clearInterval(window.serverSimulator);
	}

	serverSimulator = setInterval(function () {doStats()}, delaySeconds * 1000);
	
	function doStats() {
		if (i > numberOfInterations) {
			window.clearInterval(serverSimulator);
		}
    	var stats = statsAliveDataMgr.getCleanedData()[i];
	    renderStats(stats);
	    i++;     
	}

/*
	var i = 1;      

	
	simulation = new function() {           
	   setTimeout(function () {   
	   	  var stats = statsAliveDataMgr.getCleanedData()[i];
	      renderStats(stats);         
	      i++;                     
	      if (i < numberOfIterations) { 
	      	 // Recursive call
	         simulation();           
	      }                       
	   }, delaySeconds * 1000) // Delay for n milliseconds after executing function.
	}

	simulateDataRead();

	*/
}

function renderStats(stats) {

	// # of Variants sampled
	var totalReads = stats.TotalRecords;
	d3.select("#total-reads")
			.select("#value")
			.text(totalReads);


	// TsTv Ratio
	var tstvRatio = stats.TsTvRatio;
	d3.select(".genome-stats")
			.select("#tstv-ratio")
			.select("#ratio-value")
			.text(tstvRatio.toFixed(2));

	// Alelle Frequency
	var afObj = stats.af_hist;
	var afData = statsAliveDataMgr.jsonToArray2D(afObj);
	var afSelection = d3.select(".genome-stats")
					    .select("#allele-freq-chart")
					    .datum(afData);
	alleleFreqChart(afSelection);	

	// Mutation Spectrum
	var msObj = stats.mut_spec;
	var msArray = statsAliveDataMgr.jsonToArray(msObj, "category", "values");
	var msSelection = d3.select(".genome-stats")
	                    .select("#mut-spectrum").datum(msArray);
	mutSpectrumChart(msSelection);


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










