/*
*  Global variables
*/
var vcfiobio;
var chromosomeChart;
var variantDensityChart;
var variantDensityVF;
var variantDensityRefVF;


var tstvChart;
var alleleFreqChart;
var mutSpectrumChart;
var varTypeChart;
var qualDistributionChart;
var indelLengthChart; 


var densityPanelDimensions = {
	width: 0,
	height: 0,
	padding: 40,
	verticalOffset: 120
};

var chromosomeIndex = 0;
var regionStart = null;
var regionEnd = null;
var afData = null;

var densityOptions = {
	removeSpikes: true,
    maxPoints: 1000,
    epsilonRDP: null
}

var densityRegionOptions = {
	removeSpikes: false,
    maxPoints: 1000,
    epsilonRDP: null
}


var	samplingMultiplierLimit = 4;

var statsOptions = {	
	samplingMultiplier: 1,
	binSize : 80000, 
    binNumber : 40,
    start : 1
};


//
//  Mutation spectrum variables
// 
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
var lookupNucleotide = {
 A: ["G", "C", "T"],
 G: ["A", "C", "T"],
 C: ["A", "G", "T"],
 T: ["A", "G", "C"]
};

var colorListVarType = ["#2171b5", "#eff3ff", "#bdd7e7", "#6baed6", ];


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
	d3.selectAll("svg").style("visibility", "hidden");
	d3.selectAll(".svg-alt").style("visibility", "hidden");
	d3.selectAll(".samplingLoader").style("display", "block");

	vcfiobio = new vcfiobio();


	// Setup event handlers for File input
	document.getElementById('file').addEventListener('change', onFilesSelected, false);


	// Get the container dimensions to determine the chart dimensions
	getChartDimensions();


	// Create the chromosome picker chart. Listen for the click event on one of the arcs.
	// This event is dispatched when the user clicks on a particular chromosome.
	chromosomeChart = donutChooserD3()
		                .width(220)
		                .height(220)
		                .options({showTooltip: false})
						.on("clickslice", function(d, i) {
							chromosomeIndex = d.idx;
							regionStart = null;
							regionEnd = null;
							onReferenceSelected(d, d.idx);
						})
						.on("clickall", function() {
							chromosomeIndex = -1;
							regionStart = null;
							regionEnd = null;
							onAllReferencesSelected();
						});


	// Create the variant density chart
	variantDensityChart = lineD3()
                            .width(densityPanelDimensions.width)
                            .height( densityPanelDimensions.height - densityPanelDimensions.verticalOffset )
                            .widthPercent("100%")
                            .heightPercent("100%")
                            .kind("area")
							.margin( {left: 20, right: 20, top: 0, bottom: 20})
							.showXAxis(true)
							.showYAxis(false)
   							.pos( function(d) { return d[0] })
					   		.depth( function(d) { return d[1] })

	// View finder (area chart) for variant density chart (when a references is selected)
	variantDensityVF = lineD3()
                            .width(densityPanelDimensions.width)
                            .height(20)
                            .widthPercent("100%")
                            .heightPercent("100%")
                            .kind("area")
							.margin( {left: 20, right: 20, top: 10, bottom: 20})
							.showYAxis(false)
							.showBrush(true)
							.brushHeight(40)
   							.pos( function(d) { return d[0] })
					   		.depth( function(d) { return d[1] })
					   		.showGradient(false);

    // View finder (reference as boxes on x-axis) for variant density chart (for all references)
	variantDensityRefVF = barChartAltD3()
                        .width(densityPanelDimensions.width)
                        .height(20)
                        .widthPercent("100%")
                        .heightPercent("100%")
                        .margin( {left: 20, right: 20, top: 0, bottom: 0})
						.nameFunction( function(d) { return d.name })
				   		.valueFunction( function(d) { return d.value })
				   		.on("clickbar", function(d,i) {
				   			chromosomeIndex = d.idx;
				   			chromosomeChart.clickSlice(i);
							onReferenceSelected(d, d.idx);
				   		});

	// TSTV grouped barchart (to show ratio)
	tstvChart = groupedBarD3();
	var tstvCategories =  ["TS", "TV"];
	tstvChart.width(140)
	    .height(60)
	    .widthPercent("65%")
	    .heightPercent("65%")
		.margin( {left: 10, right: 10, top: 30, bottom: 10})
		.showXAxis(true)
		.showYAxis(false)
		.showXTicks(false)
		.showTooltip(false)
		.categories( tstvCategories )
		.categoryPadding(.4)
		.showBarLabel(true)
		.barLabel( function(d,i) {
	        return tstvCategories[i]
		 });

	// Allele freq chart
    alleleFreqChart = histogramD3()
                       .width(455)
                       .height(140)
					   .margin( {left: 45, right: 0, top: 0, bottom: 20})
					   .xValue( function(d, i) { return d[0] })
					   .yValue( function(d, i) { return Math.log(d[1]) })
					   .yAxisLabel( "log(frequency)" )
	alleleFreqChart.formatXTick( function(d,i) {
		return (d * 2) + '%';
	});
	alleleFreqChart.tooltipText( function(d, i) { 
		var value = afData[i][1];
		return  d3.round(value) + ' variants with ' + (d[0] * 2) + '%' + ' AF ';
	});


    
					   

	// Mutation spectrum grouped barchart
	mutSpectrumChart = groupedBarD3();
	mutSpectrumChart.width(455)
	    .height(120)
	    .widthPercent("95%")
	    .heightPercent("90%")
		.margin( {left: 45, right: 0, top: 10, bottom: 30})
		.categories( ["1", "2", "3"] )
		.categoryPadding(.5)
		.fill( function(d, i) {
		    var colorScheme =  colorSchemeMS[d.category]; 
		    var colorIdx = colorScheme[i];
		    return colorMS[colorIdx];
		 })
		.barLabel( function(d) {
			var nucleotide = lookupNucleotide[d.category];
	        return nucleotide[+d.name - 1]
		 })
		.xAxisLabel("Reference Base");


	// var type barchart (to show ratio)
	varTypeChart = groupedBarD3();
	var varTypeCategories = ["SNP", "Ins", "Del", "Other"];
	varTypeChart.width(150)
	    .height(90)
		.margin( {left: 40, right: 10, top: 30, bottom: 30})
		.showXAxis(true)
		.showYAxis(true)
		.showXTicks(false)
		.categories( varTypeCategories )
		.categoryPadding(.1)
		.colorList( colorListVarType )
		.showBarLabel(true)
		.barLabel( function(d,i) {
	        return varTypeCategories[i]
		 });


	// Indel length chart
	indelLengthChart = histogramD3();
	indelLengthChart.width( $("#indel-length").width() )
		.height( $("#indel-length").height()  - 20)
		.widthPercent("100%")
		.heightPercent("100%")
		.margin( {left: 40, right: 0, bottom: 30, top: 20})		
		.xValue( function(d) { return d[0] })
		.yValue( function(d) { return d[1] })
		.tooltipText( function(d) { 
			return d[1]  + ' variants with a ' +  Math.abs(d[0]) + " bp " + (d[0] < 0 ? "deletion" : "insertion"); 
		 })
		.xAxisLabel( function() { return 'Deletions: x < 0,    Insertions: x > 0'})


	// QC score histogram chart
	qualDistributionChart = histogramD3();
	qualDistributionChart.width( $("#qual-distribution").width() )
		.height( $("#qual-distribution").height()  - 20)
		.widthPercent("100%")
		.heightPercent("100%")
		.margin( {left: 40, right: 0, bottom: 30, top: 20})		
		.xValue( function(d) { return d[0] })
		.yValue( function(d) { return d[1] })
		.xAxisLabel("Variant Quality Score");
	qualDistributionChart.tooltipText( function(d, i) { 	
		return  d3.round(d[1]) + ' variants with VQ of ' + d[0];
	});


	// check if url to vcf file is supplied in url.  If it is, load this
	// and proceed directly to the display page
    if (window.location.search != "") {
        var vcfUrl = window.location.search.split(/\?[vV][cC][fF]=/)[1];
         _loadVcfFromUrl(vcfUrl);
    }

}

function displayVcfUrlBox() {
    $('#vcf-url').css('visibility','visible');
    $("#vcf-url").children("input").focus();
}

function onUrlEntered() {
    var url = $("#url-input").val();
    window.history.pushState({'index.html' : 'bar'},null,"?vcf=" + url);
    _loadVcfFromUrl(url);
}

function _loadVcfFromUrl(url) {

    vcfiobio.openVcfUrl( url );

	d3.select("#vcf_file").text(url);

	d3.select("#selectData")
	  .style("visibility", "hidden")
	  .style("display", "none");

	d3.select("#showData")
	  .style("visibility", "visible");

	vcfiobio.loadRemoteIndex(url, onReferencesLoaded);

}

function onFilesSelected(event) {
	vcfiobio.openVcfFile( event, function(vcfFile) {

		d3.select("#vcf_file").text(vcfFile.name);

		d3.select("#selectData")
		  .style("visibility", "hidden")
		  .style("display", "none");

		d3.select("#showData")
		  .style("visibility", "visible");

		

		vcfiobio.loadIndex(onReferencesLoaded);

	});
}

function onReferencesLoaded(refData) {
    d3.selectAll("section#top svg").style("display", "block");
    d3.selectAll("section#top .svg-alt").style("display", "block");
	d3.selectAll("section#top .samplingLoader").style("display", "none");

	var otherRefData = null;
	var pieChartRefData = null;
	pieChartRefData = vcfiobio.getReferences(.005, 1);
	
	chromosomeChart(d3.select("#primary-references").datum(pieChartRefData));	
	
	// Show "ALL" references as first view
	chromosomeChart.clickAllSlices(pieChartRefData);
	
	//chromosomeIndex = 0;
	//chromosomeChart.clickSlice(chromosomeIndex);
	//onReferenceSelected(refData[chromosomeIndex], chromosomeIndex);
	
	otherRefData = vcfiobio.getReferences(0, .005);



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
	} else {
		d3.select("#other-references").style("display", "none");
	}

		
}



function onReferenceSelected(ref, i) {
	 d3.select("#reference_selected").text("Reference " + ref.name);
	 d3.select("#region_selected").text("0 - " + d3.format(",")(ref.value));
	 d3.select("#variant-density-panel").select(".hint").text("(drag bottom chart to select a region)");

     loadVariantDensityData(ref, i);
	 loadStats(chromosomeIndex);

}

function onAllReferencesSelected() {
	 d3.select("#reference_selected").text("All References");
	 d3.select("#region_selected").text("");
	 d3.select("#variant-density-panel").select(".hint").text("(click bottom chart to select a reference)");

	 loadGenomeVariantDensityData();
	 loadStats(chromosomeIndex);
}

function onVariantDensityChartRendered() {
}

function onVariantDensityVFChartRendered() {

}

function loadVariantDensityData(ref, i) {

	
	 d3.select("#variant-density-vf").style(    "display",    "block");
	 d3.select("#variant-density-ref-vf").style("display",    "none");
	 d3.selectAll("section#top .svg-alt").style("visibility", "visible");

	// Get the point data (the estimated density)
	var data = vcfiobio.getEstimatedDensity(ref.name, 
		true, densityOptions.removeSpikes, densityOptions.maxPoints, densityOptions.epsilonRDP);

	// Calculate the width and height of the panel as it may have changed since initialization
	getChartDimensions();
	variantDensityChart.width(densityPanelDimensions.width);
	variantDensityChart.height(densityPanelDimensions.height / 2);
	variantDensityVF.width(densityPanelDimensions.width);
	
	// Load the variant density chart with the data
	variantDensityChart.showXAxis(true);
	variantDensityChart(d3.select("#variant-density").datum(data), onVariantDensityChartRendered);
	variantDensityVF(d3.select("#variant-density-vf").datum(data), onVariantDensityVFChartRendered);

	// Listen for the brush event.  This will select a subsection of the x-axis on the variant
	// density chart, allowing the user to zoom in to a particular region to sample that specific
	// region rather than the entire chromosome.
	variantDensityVF.on("d3brush", function(brush) {
		if (!brush.empty()) {

			// These are the region coordinates
			regionStart = d3.round(brush.extent()[0]);
			regionEnd   = d3.round(brush.extent()[1]);

			d3.select("#region_selected")
			   .text(d3.format(",")(regionStart) + ' - ' + d3.format(",")(regionEnd));

			// Get the estimated density for the reference (already in memory)
			var data = vcfiobio.getEstimatedDensity(ref.name, 
				true, densityRegionOptions.removeSpikes, densityRegionOptions.maxPoints, densityRegionOptions.epsilonRDP);

			// Now filter the estimated density data to only include the points that fall within the selected
			// region
			var filteredData = data.filter(function(d) { 
				return (d[0] >= regionStart && d[0] <= regionEnd) 
			});

			// Show the variant density for the selected region
			variantDensityChart(d3.select("#variant-density").datum(filteredData), onVariantDensityChartRendered);

			// Load the stats based on the selected region
			loadStats(chromosomeIndex);
		}
	});	

	// Listen for finished event which is dispatched after line is drawn.  If chart has
	// transitions, event is dispatched after transitions have occurred.
	variantDensityChart.on("d3rendered", onVariantDensityChartRendered);



}

function loadGenomeVariantDensityData(ref, i) {

	d3.select("#variant-density-vf").style(    "display",     "none");
	d3.select("#variant-density-ref-vf").style("display",     "block");
	d3.selectAll("section#top .svg-alt").style("visibility", "visible");

	// Calculate the width and height of the panel as it may have changed since initialization
	getChartDimensions();
	variantDensityChart.width(densityPanelDimensions.width);
	variantDensityChart.height(densityPanelDimensions.height - densityPanelDimensions.verticalOffset);
	variantDensityRefVF.width(densityPanelDimensions.width);

	
	var data = vcfiobio.getGenomeEstimatedDensity( densityOptions.removeSpikes, 
		densityOptions.maxPoints, densityOptions.epsilonRDP);

	
	// Load the variant density chart with the data
	variantDensityChart.showXAxis(false);
	variantDensityChart(d3.select("#variant-density").datum(data), onVariantDensityChartRendered);
	variantDensityRefVF(d3.select("#variant-density-ref-vf").datum(vcfiobio.getReferences(.005, 1)));

}


function loadStats(i) {

	d3.select("#total-reads").select("#value").text(0);

	d3.selectAll("section#middle svg").style(            "visibility", "hidden");
	d3.selectAll("section#middle .svg-alt").style(       "visibility", "hidden");
	d3.selectAll("section#middle .samplingLoader").style("display",    "block");
	d3.selectAll("section#bottom svg").style(            "visibility", "hidden");
	d3.selectAll("section#bottom .svg-alt").style(       "visibility", "hidden");
	d3.selectAll("section#bottom .samplingLoader").style( "display",   "block");


	var options = JSON.parse(JSON.stringify(statsOptions));
	var refs = [];
	refs.length = 0;
	// If we are getting stats by sampling all references,
	// we will divide the bins across the references.
	// Otherwise, the user has selected a particular reference
	// (and optionally selected a region of the reference)
	// and we will sample across the reference or a region
	// of the reference.
	if (i == -1) {
		var numReferences = vcfiobio.getReferences(.005, 1).length;
		for (var x = 0; x < numReferences; x++) {
			refs.push(x);
		}
		options.binNumber = d3.round(statsOptions.binNumber / numReferences);

	} else {
		refs.push(i);
		options.start = regionStart;
		options.end   = regionEnd;
	}

	// Incread the bin size by the sampling multiplier, which
	// captures the number of times the "sample more" button
	// has been pressed by the user
	options.binNumber = options.binNumber * statsOptions.samplingMultiplier;

	vcfiobio.getStats(refs, options, function(data) {
		renderStats(data);
	});


}


function renderStats(stats) {


	d3.selectAll("section#middle svg").style("visibility", "visible");
	d3.selectAll("section#middle .svg-alt").style("visibility", "visible");
   	d3.selectAll("section#middle .samplingLoader").style("display", "none");


	d3.selectAll("section#bottom svg").style("visibility", "visible");
	d3.selectAll("section#bottom .svg-alt").style("visibility", "visible");
   	d3.selectAll("section#bottom .samplingLoader").style("display", "none");


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
	d3.select("#tstv-ratio")
		.select("#ratio-value")
		.text(tstvRatio.toFixed(2));

	if (tstvData != null) {
		tstvData.length = 0;
	}
	var tstvData = [
	  {category: "", values: [tstvRatio, 1] }
	];		
	// This is the parent object for the chart
	var tstvSelection = d3.select("#ratio-panel").datum(tstvData);
	// Render the mutation spectrum chart with the data
	tstvChart(tstvSelection);

	// Var types
	var varTypeArray = vcfiobio.jsonToValueArray(stats.var_type);
	var varTypeData = [
	  {category: "", values: varTypeArray}
	];		
	// This is the parent object for the chart
	var varTypeSelection = d3.select("#var-type").datum(varTypeData);
	// Render the var type data with the data
	varTypeChart(varTypeSelection);

	// Alelle Frequency
	var afObj = stats.af_hist;
	afData = vcfiobio.jsonToArray2D(afObj);	
	var afSelection = d3.select("#allele-freq-histogram")
					    .datum(afData);
	var afOptions = {outliers: true, averageLine: false};					    
	alleleFreqChart(afSelection, afOptions);	

	// Mutation Spectrum
	var msObj = stats.mut_spec;
	var msArray = vcfiobio.jsonToArray(msObj, "category", "values");
	// Exclude the 0 value as this is the base that that represents the
	// "category"  Example:  For mutations for A, keep values for G, C, T,
	// but exclude 0 value for A.
	msArray.forEach(function(d) {
        d.values = d.values.filter( function(val) {
          if (val == 0) {
            return false;
          } else {
            return true;
          }
      	});
    }); 
    // This is the parent object for the chart
	var msSelection = d3.select("#mut-spectrum").datum(msArray);
	// Render the mutation spectrum chart with the data
	mutSpectrumChart(msSelection);


	// QC distribution
	var qualPoints = vcfiobio.jsonToArray2D(stats.qual_dist.regularBins);
	var factor = 2;
	qualReducedPoints = vcfiobio.reducePoints(qualPoints, factor, function(d) { return d[0]; }, function(d) { return d[1]});
	//for (var i = 0; i < qualReducedPoints.length; i++) {
	//	qualReducedPoints[i][0] = i;
	//}

	var qualSelection = d3.select("#qual-distribution-histogram")
					    .datum(qualReducedPoints);
	var qualOptions = {outliers: true, averageLine: true};
	qualDistributionChart(qualSelection, qualOptions);	



	// Indel length distribution
	var indelData = vcfiobio.jsonToArray2D(stats.indel_size);
	var indelSelection = d3.select("#indel-length-histogram")
					    .datum(indelData);
	var indelOptions = {outliers: true, averageLine: false};
	indelLengthChart(indelSelection, indelOptions);	

	// Reset the sampling multiplier back to one
	// so that next time we get stats, we start
	// with the default sampling size that can
	// be increased as needed
	statsOptions.samplingMultiplier = 1;

	
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

 function increaseSampling() {
    if (statsOptions.samplingMultiplier >= samplingMultiplierLimit) { 
    	alert("You have reached the sampling limit"); 
    	return;
    }
    statsOptions.samplingMultiplier += 1;
    loadStats(chromosomeIndex);
}

function getChartDimensions() {

	densityPanelDimensions.width  = $("#variant-density-panel").width() - densityPanelDimensions.padding;
    densityPanelDimensions.height = $("#variant-density-panel").height();

 

}








