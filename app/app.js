/*
*  Global variables
*/
var indexDataMgr;
var chromosomeChart;
var variantDensityChart;


var statsAliveDataMgr;
var alleleFreqChart;
var mutSpectrumChart;

var serverSimulator = null;

var chromosomeIndex = 0;

 
var colorSchemeMS = {
	 	A: [1, 2, 3],
	 	G: [0, 2, 3],
	 	C: [0, 1, 3],
	 	T: [0, 1, 2]
 };
 var colorMS = [
   "#8ca252", 
   "#e7ba52", 
   "#1f77b4", 
   "#ad494a"
 ]; 


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
	d3.selectAll("svg").style("display", "none");
	d3.selectAll(".svg-alt").style("display", "none");
	d3.selectAll(".samplingLoader").style("display", "block");

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
                            .width("800")
                            .height("120")
                            .kind("area")
							.margin( {left: 30, right: 20, top: 30, bottom: 40})
							.showYAxis(false)
   							.pos( function(d) { return d[0] })
					   		.depth( function(d) { return d[1] });


    alleleFreqChart = lineD3()
                       .kind("area")
                       .width("500")
                       .height("110")
					   .margin( {left: 40, right: 10, top: 10, bottom: 10})
					   .showTransition(false)
					   .pos( function(d) { return d[0] })
					   .depth( function(d) { return d[1] });
	alleleFreqChart.formatXTick( function(d,i) {
		return (d * 2) + '%';
	});
	



	// Mutation spectrum grouped barchart
	mutSpectrumChart = groupedBarD3();

	mutSpectrumChart.width("570")
                        .height("200")
						.margin( {left: 50, right: 10, top: 10, bottom: 20})
						.fill( function(d, i) {
						    var colorScheme =  colorSchemeMS[d.category]; 
						    var colorIdx = colorScheme[i];
						    return colorMS[colorIdx];
						 });
	


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
    d3.selectAll("section#top svg").style("display", "block");
    d3.selectAll("section#top .svg-alt").style("display", "block");
	d3.selectAll("section#top .samplingLoader").style("display", "none");


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

	 d3.selectAll("section#middle svg").style("visibility", "hidden");
	 d3.selectAll("section#middle .svg-alt").style("display", "none");
	 d3.selectAll("section#middle .samplingLoader").style("display", "block");
}

function onVariantDensityChartRendered() {
	d3.selectAll("section#middle svg").style("visibility", "visible");
	d3.selectAll("section#middle .svg-alt").style("display", "block");
   	d3.selectAll("section#middle .samplingLoader").style("display", "none");

   	loadStats(chromosomeIndex);
}

function loadVariantDensityData(ref, i) {
	
	var removeOutliers = true;
	var variantDensityData = indexDataMgr.getEstimatedDensity(ref.name, removeOutliers);

	

	// Load the variant density chart with the data
	variantDensityChart(d3.select("#variant-density").datum(variantDensityData), onVariantDensityChartRendered);

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

	// Listen for finished event which is dispatched after line is drawn.  If chart has
	// transitions, event is dispatched after transitions have occurred.
	variantDensityChart.on("d3rendered", onVariantDensityChartRendered);



}

function loadStats(i) {
	
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

}

function renderStats(stats) {

	// # of Variants sampled	
	var readParts = shortenNumber(stats.TotalRecords);
	d3.select("#total-reads")
			.select("#value")
			.text(readParts[0]);
	d3.select("#total-reads")
			.select("#number")
			.text(readParts[1] || "");


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
					    .select("#allele-freq")
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

function shortenNumber(num) {
    if(num.toString().length <= 3)
        return [num];
    else if (num.toString().length <= 6)
        return [Math.round(num/1000), "thousand"];
    else
        return [Math.round(num/1000000), "million"];
}









