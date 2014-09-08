// Create the chromosome picker chart. Listen for the click event on one of the arcs.
// This event is dispatched when the user clicks on a particular chromosome.
var chromosomeChart = donutChooserD3()
                        .width(220)
                        .height(220)
						.on("d3click", function(d, i) {
							chromosomeIndex = i;
							loadVariantDensityChart(i);
						 });

// Create the data manager						
var chromosomeDataMgr = dataManagerD3();

// This is where we will hold the currently selected chromosome (index)
var chromosomeIndex = 0;


// Create the variant density chart
var variantDensityChart = lineD3()
                                .width("700")
                                .height("180")
                                .kind("area")
								.margin( {left: 30, right: 20, top: 30, bottom: 40})
								.showYAxis(false);

// Create variant density data manager
var variantDensityDataMgr = dataManagerD3();



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



function loadVariantDensityChart(i) {
	// Load the variant density data with random data points
	var ch = chromosomeDataMgr.getCleanedData()[i];
	variantDensityDataMgr.loadRandomPointData(+ch.value);

}








