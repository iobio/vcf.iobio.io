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

var chromosomePieLayout;

var sampleNamesFromUrl = null;
var samplesSet = false; //If samples are set before loading the vizualization


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

var statsData = null;


var densityOptions = {
  removeSpikes: false,
    maxPoints:  5000,
    epsilonRDP: null
}

var densityRegionOptions = {
  removeSpikes: false,
    maxPoints: 1000,
    epsilonRDP: null
}


var  samplingMultiplierLimit = 4;

var statsOptions = {
  samplingMultiplier: 1,
  binSize : 80000,
    binNumber : 50,
    minFileSamplingSize: 1000000,
    start : 1
};

var colorScale = d3.scale.category20b();


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

var iobioServer           = "nv-prod.iobio.io/";
var dataSelect            = null;
var genomeBuildHelper     = null;
var genomeBuildServer     = "https://" + iobioServer + "genomebuild/";


var flag = false;
var myTime;
var tbiMyTime;
var sampleDataFlag = false;
var timings;
var urlFunctionTime;
var buildFlag = false; //Sets true when the build is selected in the file upload
var sampleLoadFlag = false; //Sets true when the samples are selected in the file upload
var demoBuildFlag = false;
var demoSpeciesFlag = false;
var demoFlag = true;

var mosaicToIobioSources = {
    "https://mosaic.chpc.utah.edu":          {iobio: "mosaic.chpc.utah.edu/"},
    "https://mosaic-dev.genetics.utah.edu":  {iobio: "mosaic.chpc.utah.edu/"},
    "http://mosaic-dev.genetics.utah.edu":   {iobio: "mosaic.chpc.utah.edu/"},
    "https://staging.frameshift.io":         {iobio: "nv-prod.iobio.io/"}
};



/*
*  Document initialization
*/
$(document).ready( function(){

  genomeBuildHelper = new GenomeBuildHelper();
  genomeBuildHelper.promiseInit({DEFAULT_BUILD: null}).then(function() {
    init();
  });
});

/*
*
* init
*
*  Load the chromsome picker radial chart.  Load the first chromosome's variant density.
*
*/
function init() {

  var url_string = new URL(window.location.href);

  var iobio_source_string = url_string.searchParams.get("iobio_source");


  // These are the url parameters passed when vcf.iobio is launched
  // from Mosaic
  var access_token = url_string.searchParams.get("access_token");
  var token_type   = url_string.searchParams.get("token_type");
  var sampleId     = url_string.searchParams.get("sample_id");
  var projectId    = url_string.searchParams.get("project_id");
  var source       = url_string.searchParams.get("source");
  var build        = url_string.searchParams.get("build");
  if (access_token && token_type) {
    localStorage.setItem('hub-iobio-tkn', token_type + ' ' + access_token);
    if (mosaicToIobioSources[source]) {
      iobioServer = mosaicToIobioSources[source].iobio;
    }
  }


  if(iobio_source_string === "mosaic.chpc.utah.edu"){
    iobioServer = "mosaic.chpc.utah.edu/";
  }




  d3.selectAll("svg").classed("hide", true);
  d3.selectAll(".svg-alt").classed("hide", true);
  d3.selectAll(".samplingLoader").classed("hide", false);

  vcfiobio = new vcfiobio();
  vcfiobio.setSamples([]);
    $('#url-input').focusout(function() {
      vcfiobio.vcfURL = $('#url-input').val();
      vcfiobio.tbiURL = $('#url-tbi-input').val();
        dataSelect.setDefaultBuildFromData();
      });
    $('#vcf-sample-select').selectize(
      {
        create: true,
        maxItems: null,
        valueField: 'value',
          labelField: 'value',
          searchField: ['value']
      }
    );




  // Setup event handlers for File input
  document.getElementById('file').addEventListener('change', onFilesSelected, false);

  // Initialize the data selection widget
  dataSelect = new DataSelect();
  dataSelect.init();


  // Get the container dimensions to determine the chart dimensions
  getChartDimensions();


  // Create the chromosome picker chart. Listen for the click event on one of the arcs.
  // This event is dispatched when the user clicks on a particular chromosome.
  var r = 90;
    chromosomeChart = iobio.viz.pieChooser()
        .radius(r)
        .innerRadius(r*.5)
        .padding(30)
        .color( function(d,i) {
          return colorScale(i);
        })
        .on("click", function(d,i) {
            chromosomeIndex = d.data.idx;
      regionStart = null;
      regionEnd = null;
      onReferenceSelected(d.data, d.data.idx);
        })
        .on("clickall", function(d,i) {
            chromosomeIndex = -1;
      regionStart = null;
      regionEnd = null;
      onAllReferencesSelected();
      loadStats(chromosomeIndex);
        })
        .tooltip( function(d) {
          return d.data.name;
        });
    chromosomePieLayout = d3.layout.pie()
                                   .sort(null)
                                   .value(function(d,i) {return +d.value});



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


    document.getElementById('bedfile-input').addEventListener('change', onAddBed, false);
    $('#remove-bedfile-button').on('click', onRemoveBed)

  $("#use-bed-cb input[type='checkbox']").change(function(){
        var useBed = this.checked;
        if (useBed) {
          onDefaultBed();
        } else {
          onRemoveBed();
        }
    });

  // TSTV grouped barchart (to show ratio)
  tstvChart = groupedBarD3();
  var tstvCategories =  ["TS", "TV"];
  tstvChart.width($("#tstv-ratio").width()  - 20)
      .height($("#tstv-ratio").height() - 130)
      .widthPercent("100%")
      .heightPercent("100%")
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
                       .width(355)
                       .height(120)
             .margin( {left: 45, right: 0, top: 10, bottom: 30})
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
  mutSpectrumChart.width(355)
      .height(120)
      .widthPercent("95%")
      .heightPercent("80%")
    .margin( {left: 45, right: 0, top: 15, bottom: 30})
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


  indelLengthChart = iobio.viz.barViewer()
                    .xValue(function(d) { return d[0]; })
                    .yValue(function(d) { return d[1]; })
                    .wValue(function() { return 1; })
                    .tooltip(function(d) {
                      return d[1]  + ' variants with a ' +  Math.abs(d[0]) + " bp " + (d[0] < 0 ? "deletion" : "insertion");
                    })
                    .height(d3.round(+$("#indel-length").height() - 65))
                    .width(d3.round(+$("#indel-length").width() - 20))
                    .margin({top: 10, right: 10, bottom: 18, left: 40})
                    .sizeRatio(.65)
                    .color( function(d,i) {
                      if (d[0] < 0) {
                        return colorMS[3];
                      } else {
                        return colorMS[2];
                      }
                    })
                    .tooltip( function(d) {
                      return d[1] + " variants with a " + Math.abs(d[0]) + " bp " + (d[0] < 0 ? "deletion" : "insertion");
                    })
    indelLengthChart.xAxis().tickFormat(tickFormatter);
    indelLengthChart.yAxis().tickFormat(tickFormatter);

    $("#indel-length input[type='checkbox']").change(function(){
        var outliers = this.checked;
        fillInDelLengthChart(window.statsData, outliers);
    });


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
      // check for low sampling flag
        var sampling = getParameterByName('sampling')
        if (sampling == 'low') {
          statsOptions.binSize = 40000;
          statsOptions.binNumber = 20;
        }
          sampleNamesFromUrl = getParameterByName('samples');
        if (sampleNamesFromUrl && sampleNamesFromUrl.length > 0) {
              $('#samples-filter-header #sample-names').removeClass("hide");
              var sampleNames = sampleNamesFromUrl.split(",");
              if (sampleNames.length > 6) {
            $('#samples-filter-header #sample-names').text(sampleNames.length + " samples filtered");
              } else {
            $('#samples-filter-header #sample-names').text(sampleNames.join(" "));
              }
        } else {
              $('#samples-filter-header #sample-names').addClass("hide");
        }

        var species = getParameterByName('species');
        if (species && species.length > 0) {
          genomeBuildHelper.setCurrentSpecies(species);
        }
        var build   = getParameterByName('build');
        if (build && build.length > 0) {
          $('#current-build').text(build)
          genomeBuildHelper.setCurrentBuild(build);
        }

        var vcfUrl = decodeUrl(getParameterByName('vcf'));
        var tbiUrl = decodeUrl(getParameterByName('tbi'));

        if (vcfUrl && genomeBuildHelper.getCurrentBuild() && genomeBuildHelper.getCurrentSpecies()) {
          onRefreshShowAnalysis(vcfUrl, tbiUrl, sampleNamesFromUrl && sampleNamesFromUrl.length >  0 ? sampleNamesFromUrl.split(",") : null);

        } else if (vcfUrl) {
          if(species === "Not specified" || species === "" || species === "null" || build=== "Not specified" || build === "GRCh37" || build === "GRCh38" || build=== "mm10/GRCm38"){
            $('#url-input').val("");
            if (tbiUrl) {
              $('#url-tbi-input').val("");
            }
            displayVcfUrlBox();
          }
          else {
            $('#url-input').val(vcfUrl);
            if (tbiUrl) {
              $('#url-tbi-input').val(tbiUrl);
            }
          }
          displayVcfUrlBox();
        }
    }

    $('#report-problem').on('click', displayReportProblem);

    $('#report-problem-button').on('click', emailProblem);


  if (localStorage.getItem('hub-iobio-tkn') && localStorage.getItem('hub-iobio-tkn').length > 0
      && sampleId && projectId && source) {
    if (build && build.length > 0) {
      genomeBuildHelper.setCurrentBuild(build);
    }

    self.mosaicSession = new MosaicSession();
    self.mosaicSession.promiseInit(sampleId, source, projectId)
    .then(modelInfo => {
      vcfiobio.setSamples([]);
      vcfiobio.vcfURL = modelInfo.vcf
      vcfiobio.tbiURL = modelInfo.tbi
      vcfiobio.samples = [sampleId]
      toggleDisplayProperties()
      vcfiobio.loadRemoteIndex(vcfiobio.vcfURL, vcfiobio.tbiURL, onReferencesLoading,
      function() {
        onReferencesLoaded();
        window.history.pushState({'index.html' : 'bar'},null,"?vcf="
          + encodeURIComponent(vcfiobio.getVcfUrl()) + "&tbi="
          + encodeURIComponent(vcfiobio.getTbiURL()) + "&samples="
          + sampleId + '&build='
          + genomeBuildHelper.getCurrentBuildName()
          + '&species=' + genomeBuildHelper.getCurrentSpeciesName());
        loadStats(chromosomeIndex)

      });
    })
    .catch(function(error) {
      alert("Unable to get data source information from Mosaic");
    })

  }

}


var sampleNamesFromUrlArray = [];

function onRefreshShowAnalysis(vcfUrl, tbiUrl, sampleNamesFromUrl){

  if(sampleNamesFromUrl===null || sampleNamesFromUrl.length===0){
    vcfiobio.loadRemoteIndex(vcfUrl, tbiUrl, onReferencesLoading, onReferencesLoaded);
    toggleDisplayProperties();
  }
  else {
    vcfiobio.setSamples(sampleNamesFromUrl);
      if (samplesSet===false) {
        samplesSet=true;
        toggleDisplayProperties();
       $('#sample-picker').removeClass("hide");

      vcfiobio.loadRemoteIndex(vcfUrl, tbiUrl, onReferencesLoading, onReferencesLoaded);

        if (sampleNamesFromUrl.length > 0) {
              $('#samples-filter-header #sample-names').removeClass("hide");
              if (sampleNamesFromUrl.length > 6) {
            $('#samples-filter-header #sample-names').text(sampleNamesFromUrl.length + " samples filtered");
              } else {
            $('#samples-filter-header #sample-names').text(sampleNamesFromUrl.join(" "));
              }
        } else {
              $('#samples-filter-header #sample-names').addClass("hide");
        }
        window.history.pushState({'index.html' : 'bar'},null,"?vcf=" + encodeURIComponent(vcfiobio.getVcfUrl()) + "&tbi=" + encodeURIComponent(vcfiobio.getTbiURL()) + "&samples=" + sampleNamesFromUrl.join(",") + '&build=' + genomeBuildHelper.getCurrentBuildName() + '&species=' + genomeBuildHelper.getCurrentSpeciesName());
        vcfiobio.setSamples(sampleNamesFromUrl);

        vcfiobio.getSampleNames(function(sampleNames){
          //If the samples are present in the url
          if (sampleNames.length > 1) {

          $('#show-sample-dialog').removeClass("hide");
          $('#sample-picker').removeClass("hide");

          sampleNames.forEach( function(sampleName) {
            $('#vcf-sample-select')[0].selectize.addOption({value:sampleName});
          });
          if (sampleNamesFromUrl) {
            $('#vcf-sample-select')[0].selectize.setValue(sampleNamesFromUrl.split(","));
            sampleNamesFromUrl = "";
          }

          var x = $('#vcf-sample-select').selectize();
          var selectize  = x[0].selectize;
          $('#vcf-sample-box').removeClass("hide");

          }
        });
      $("#vcf-sample-select-box").detach().appendTo('#filterSampelDiv').css("text-align", "center");
       $("#sample-go-button").detach().appendTo('#sample-go-button-inModal').removeClass("hide").prop('disabled', false)
       handleSampleGoButtonClick(vcfUrl, tbiUrl, onReferencesLoading, onReferencesLoaded)

      }
    else if(samplesSet){
      $("#vcf-sample-select-box").detach().appendTo('#filterSampelDiv').css("text-align", "center");
      $("#sample-go-button").detach().appendTo('#sample-go-button-inModal');
      if (sampleNamesFromUrl.length > 0) {
            $('#samples-filter-header #sample-names').removeClass("hide");
            if (samples.length > 6) {
          $('#samples-filter-header #sample-names').text(sampleNamesFromUrl.length + " samples filtered");
            } else {
          $('#samples-filter-header #sample-names').text(sampleNamesFromUrl.join(" "));
            }
      } else {
            $('#samples-filter-header #sample-names').addClass("hide");
      }
      window.history.pushState({'index.html' : 'bar'},null,"?vcf=" + encodeURIComponent(vcfiobio.getVcfUrl()) + "&tbi=" + encodeURIComponent(vcfiobio.getTbiURL()) + "&samples=" + sampleNamesFromUrl.join(",") + '&build=' + genomeBuildHelper.getCurrentBuildName() + '&species=' + genomeBuildHelper.getCurrentSpeciesName());
      vcfiobio.setSamples(sampleNamesFromUrl);
      loadStats(chromosomeIndex);
    }
  }

}

function getHumanRefNames(refName) {
    if (refName.indexOf("chr") == 0) {
      return "chr1 chr2 chr3 chr4 chr5 chr6 chr7 chr8 chr9 chr10 chr11 chr12 chr13 chr14 chr15 chr16 chr17 chr18 chr20 chr21 chr22 chrX chrY";
    } else {
      return "1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 X Y";
    }
}

function decodeUrl(url) {
  if (url && (url.slice(0,14) == 'https%3A%2F%2F' || url.slice(0,13) == 'http%3A%2F%2F'))
    return decodeURIComponent(url)
  else
    return url;
}

function tickFormatter (d) {
  if ((d / 1000000) >= 1)
    d = d / 1000000 + "M";
  else if ((d / 1000) >= 1)
    d = d / 1000 + "K";
  return d;
}

function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function displayReportProblem() {
  $('#report-problem-email').val("");
  $('#report-problem-note').val("");

  $('#primary-references svg').height("150px");
  $('#primary-references svg').width("150px");
  $('#ratio-panel svg').height("130px");
  $('#ratio-panel svg').width("300px");


  $('#report-problem-screen-capture').html("");
  $('#report-problem-screen-capture').append( '<section id="banner">' + $('section#banner').html() + '</section>');
  $('#report-problem-screen-capture').append( '<section id="top">'    + $('section#top').html()    + '</section>');
  $('#report-problem-screen-capture').append( $('section#middle').html());
  $('#report-problem-screen-capture').append( $('section#bottom').html());

}

function emailProblem() {
  $.valHooks.textarea = {
      get: function(elem) {
          return elem.value.replace(/\r?\n/g, "<br>");
      }
  };

  var email = $('#report-problem-email').val();
  var note  = $('#report-problem-note').val();

  var email_body = '<html>';

  email_body    += '<head>';
  email_body    += '<link href="http://fonts.googleapis.com/css?family=Quattrocento+Sans" rel="stylesheet" type="text/css">';
    email_body    += '<link rel="stylesheet" href="http://localhost/vcf.iobio.io/assets/css/iobio.css" type="text/css">';
    email_body    += '<link rel="stylesheet" href="http://localhost/vcf.iobio.io/assets/css/vcf.iobio.css" type="text/css">';
    email_body    += '<link rel="stylesheet" href="http://localhost/vcf.iobio.io/assets/css/standalone.css" type="text/css">';
  email_body    += '</head>';

  email_body    += '<body>';
  email_body    += '<div id="report-problem-screen-capture">';
  email_body    += $('#report-problem-screen-capture').html();
  email_body    += '</div>'
  email_body    += '</body>'

  email_body    += '</html>';

  vcfiobio.sendEmail(email_body, email, note);

  $('#modal-report-problem').modal('hide');

}

  function enableTbiUrl(){

    if (!flag) {
      flag = true;
      $("#url-tbi-input").prop('disabled', false);
      $("#url-tbi-input").css('display', "inline");
      clearTimeout(myTime);
    }
   else if (flag) {
    flag = false;
    $("#url-tbi-input").prop('disabled', true);
    $("#url-tbi-input").css('display', "none");
    if(document.getElementById("url-input").value.length > 5 ){
      myTime = setTimeout(loadUrlFunc, 2000);
    }
   }
  }


  function urlFunction(){
    window.history.pushState({'index.html' : 'bar'},null,'?build=null' + '&species=' + genomeBuildHelper.getCurrentSpeciesName());
    var species_dropdownValue = $('#select-species').selectize();
    var selectize_species  = species_dropdownValue[0].selectize;
    selectize_species.setValue("Human");

    //If flag is set and tbi url is entered first
    if(document.getElementById("url-input").value.length > 5 && document.getElementById("url-tbi-input").value.length > 5 && flag){
      $("#accessing-headers-gif").removeClass("hide");
      myTime = setTimeout(loadUrlFunc, 1500);
    }
    //If flag is set and url is entered
    else if(document.getElementById("url-input").value.length > 5 && flag){
      $("#accessing-headers-gif").addClass("hide");
    }
    //If just vcf url is entered and flag is not set
    else if (document.getElementById("url-input").value.length > 5) {
      $("#accessing-headers-gif").removeClass("hide");
        myTime = setTimeout(loadUrlFunc, 1500);
    }
  }


  function tbiUrlFunction(){
    demoFlag = false;
    if(document.getElementById("url-input").value.length > 5 && document.getElementById("url-tbi-input").value.length > 5 ){
      var tbiMyTime =  setTimeout(loadFromUrl, 3500);
      $("#sampleDataUrl").addClass("hide");
      $("#accessing-headers-gif").removeClass("hide");
    }
  }


  function clearUrlFunction(){
    //Clear the samples

    demoFlag = false;
    var selectTheOptions = $("#vcf-sample-select").selectize();
		var control = selectTheOptions[0].selectize;
		control.clearOptions();

    //Hide the load button for no samples
    $("#go-button-for-noSamples").addClass("hide");
    $("#go-button-for-load").addClass("hide");

    //Hide the load button for files with samples
    $("#all-sample-go-button").addClass("hide");
    $("#sample-go-button").addClass("hide");
    $("#vcf-sample-box").addClass("hide");

    sampleDataFlag= false;
    $("#sample-Dataset-load").addClass("hide");
    $("#go-button-for-load").addClass("hide");
    clearTimeout(myTime);
    $("#accessing-headers-gif").addClass("hide"); //Stop the loading gif
    $("#select-build-box").addClass("hide"); //Hide the select build box
    if(flag===true){
      clearTimeout(tbiMyTime)
    }
  }


  function clearUrlInput(){
    document.getElementById("url-input").value = "";
    clearTimeout(myTime);
    sampleDataFlag= false;
    $("#sample-Dataset-load").addClass("hide");
    $("#accessing-headers-gif").addClass("hide"); //Stop the loading gif
    $("#select-build-box").addClass("hide"); //Hide the select build box
  }


  function loadUrlFunc(){
    if (!flag) {
      loadFromUrl();
    }
    else if (flag && document.getElementById("url-tbi-input").value.length > 5 ) {
      loadFromUrl();
    }
  }



function displayVcfUrlBox() {
    $('#vcf-url').css('visibility','visible');
    $('#vcf-url-button-panel').css('visibility','visible');
    $("#vcf-url").children("input").focus();
    $("#go-panel").removeClass("hide");
    $("#url-button").removeClass("hide");
    $("#file-go-button").addClass("hide");
    $("#select-build-box").removeClass("hide");
    $("#select-species-box").removeClass("hide");
    $("#vcf-sample-select-box").addClass("hide");
    $("#all-sample-go-button").addClass("hide");
    $("#sample-go-button").addClass("hide");
    $("#go-button-for-load").removeClass("hide");

    vcfiobio.vcfURL = $('#url-input').val();
    vcfiobio.tbiURL = $('#url-tbi-input').val();
    dataSelect.setDefaultBuildFromData(); //builds data for species and genome build
    loadWithSample();

    $('#select-species')[0].selectize.on("change", function(){
      if($('#select-species')[0].selectize.getValue().length>0){
        demoSpeciesFlag = true;
        checkToEnableDemoLoadButton();
      }
    })
}

function checkToEnableDemoLoadButton(){
  if(demoBuildFlag && demoSpeciesFlag && demoFlag){
    $("#go-button-for-load").prop('disabled', false).removeClass("disabled");
    demoFlag = false;
  }
}
function loadWithSample(){
  $("#select-build-box").removeClass("hide");
}


// Only for loading the sample dataset on load
  function demoDataLoad(){
      var url    = $("#url-input").val();
      updateUrl("vcf",  encodeURIComponent(url));

      var tbiUrl = $("#url-tbi-input").val();
      updateUrl("tbi",  encodeURIComponent(tbiUrl));
      printBuildName();
      _loadDemoVcfFromUrl(url, tbiUrl);
  }


  function _loadDemoVcfFromUrl(url, tbiUrl, sampleNames){
    $("#file-alert").addClass("hide");
    dataSelect.setDefaultBuildFromData();

    vcfiobio.openVcfUrl( url, tbiUrl, function( success, message) {
      if (success) {
        $('.vcf-sample.loader').removeClass("hide");
      d3.select("#vcf_file").text(url);

      vcfiobio.getSampleNames(function(sampleNames) {
        $('.vcf-sample.loader').addClass("hide");
        if (sampleNames.length === 0 ) {
          vcfiobio.loadRemoteIndex(url, tbiUrl, onReferencesLoading, onReferencesLoaded);
          toggleDisplayProperties();
        }
    });
    } else {
      displayFileError(message);

      $('#vcf-url').css("visibility", "visible");
      $("#go-panel").removeClass("hide");
      $("url-go-button").removeClass("hide");
      $("file-go-button").addClass("hide");
      $("#url-input").val(url);
      $("#tbi-url-input").val(tbiUrl ? tbiUrl : '');
    }
    });
  }


function printBuildName(){
  var species = getParameterByName('species');
  setTimeout(function(){
    var build = getParameterByName('build');
    console.log("species", species)
    if (build && build.length > 0 && species===!null) {
      $('#current-build').text(build);
    }
    else if(species===null){
      $('#current-build').text("");
    }
  }, 1500)
}

function onFileButtonClicked() {
    $('#vcf-url').css('visibility', 'hidden');
    $('#vcf-url-button-panel').css('visibility', 'hidden');
    $("#go-panel").removeClass("hide");
    $("#url-go-button").addClass("hide");
    $("#file-go-button").removeClass("hide");
    $("#select-species-box").addClass("hide");
    $("#select-build-box").addClass("hide");
    $("#go-button-for-noSamples").addClass("hide");
    $("#vcf-sample-select-box").addClass("hide");
    $("#all-sample-go-button").addClass("hide");
    $("#sample-go-button").addClass("hide");
    $("#go-button-for-load").addClass("hide");
    // dataSelect.setDefaultBuildFromData();
}

function loadFromUrl() {

    var url    = $("#url-input").val();


    var tbiUrl = $("#url-tbi-input").val();


    _loadVcfFromUrl(url, tbiUrl);
}


function loadFromFile() {
  $('.vcf-sample.loader').removeClass("hide");

  vcfiobio.getSampleNames(function(sampleNames) {
    $('.vcf-sample.loader').addClass("hide");
    //If the samples are present in the file
    if (sampleNames.length > 1) {
      enableSampleSelectDropDown();

    sampleNames.forEach( function(sampleName) {
      $('#vcf-sample-select')[0].selectize.addOption({value:sampleName});
    });
    if (sampleNamesFromUrl) {
      $('#vcf-sample-select')[0].selectize.setValue(sampleNamesFromUrl.split(","));
      sampleNamesFromUrl = "";
    }

    var x = $('#vcf-sample-select').selectize();
    var selectize  = x[0].selectize;

    //Selecting all samples
    $("#all-sample-go-button").click(function(){
      var z = selectize.setValue(Object.keys(selectize.options));
      $("#all-sample-go-button").addClass("disabled")
    })


    if($('#select-build')[0].selectize.getValue().length>0){
      buildFlag = true;
    }

    //Enable the load button only if build is selected and the samples are selected
    $('#select-build')[0].selectize.on("change", function(){
      if (buildFlag && sampleLoadFlag) {
        $("#sample-go-button").prop('disabled', false).removeClass("disabled");
      }
      else {
        $("#sample-go-button").prop('disabled', true).addClass("disabled");
      }
    })

    // Enable and disable load button for samples
    $('#vcf-sample-select')[0].selectize.on("change", function(value){ //*
      var species_value = $('#select-species')[0].selectize.getValue();
      sampleLoadFlag = true;
      if(species_value === "Not specified"){
        if (value) {
          $("#sample-go-button").prop('disabled', false).removeClass("disabled");
        }
        else if(value === null){
          $("#sample-go-button").prop('disabled', true).addClass("disabled");
        }
      }
      else {
        if (value && buildFlag) {
          $("#sample-go-button").prop('disabled', false).removeClass("disabled");
        }
        else if(value === null){
          $("#sample-go-button").prop('disabled', true).addClass("disabled");
        }
      }
    });


    //If the species dropdown is changed later, check if the species is "Not provided".
    // if yes, enable load button without the need for samples
    $('#select-species')[0].selectize.on("change", function(){
      var species_value = $('#select-species')[0].selectize.getValue();
      if(species_value==="Not specified" && sampleLoadFlag){
        $("#sample-go-button").prop('disabled', false).removeClass("disabled");
        window.history.pushState({'index.html' : 'bar'},null,'?species=not specified');
        genomeBuildHelper.setCurrentBuild("not specified")
      }
    })

    $('#vcf-sample-box').removeClass("hide");
    $('#sample-go-button').removeClass("hide");
      $('#all-sample-go-button').removeClass("hide");

    $('#sample-go-button').off('click');

    //Clicking the load button
    handleSampleGoButtonForFile();
    }
    else {
      //If the file contains no samples.
      var speciesFlagNoSamples = false;
      var buildFlagNoSamples = false;

      if($('#select-build')[0].selectize.getValue() && $('#select-species')[0].selectize.getValue()){
        $("#go-button-for-noSamples").prop('disabled', false);
      }

      $('#select-species')[0].selectize.on("change", function(){
        if($('#select-species')[0].selectize.getValue().length>0){
          if($('#select-species')[0].selectize.getValue() === "Not specified"){
            window.history.pushState({'index.html' : 'bar'},null,'?build=not specified' + '&species=not specified');
            genomeBuildHelper.setCurrentBuild("not specified")
            speciesFlagNoSamples = true;
            $("#go-button-for-noSamples").prop('disabled', false)
          }
          else{
            speciesFlagNoSamples = true;
            checkBuildSpeciesNoSampleData(buildFlagNoSamples, speciesFlagNoSamples);
          }
        }
      });

      $('#select-build')[0].selectize.on("change", function(){
        if($('#select-build')[0].selectize.getValue().length>0){
          buildFlagNoSamples = true;
          checkBuildSpeciesNoSampleData(buildFlagNoSamples, speciesFlagNoSamples);
        }
      });

      $("#go-button-for-noSamples").removeClass("hide");
      // $("#go-button-for-noSamples").prop('disabled', false).removeClass("hide");
      $("#accessing-headers-gif").addClass("hide"); //Hide the loading gif
      $("#select-species-box").removeClass("hide"); //Show the select species box
      $("#select-build-box").removeClass("hide"); //Show the select build box

      $("#go-button-for-noSamples").on("click", function(){
        printBuildName();
        vcfiobio.loadIndex(onReferencesLoading, onReferencesLoaded, displayFileError);
        toggleDisplayProperties();
      })
    }
  });
}

function handleSampleGoButtonForFile(){
  $('#sample-go-button').on('click', function() {
    printBuildName();
      if (samplesSet===false) {
        samplesSet=true;
        toggleDisplayProperties();

      vcfiobio.loadIndex(onReferencesLoading, onReferencesLoaded, displayFileError);

      $("#vcf-sample-select-box").detach().appendTo('#filterSampelDiv').css("text-align", "center");
      $("#sample-go-button").detach().appendTo('#sample-go-button-inModal');
      handleSelectedSamplesForFile();

      }
    else if(samplesSet){
      handleSelectedSamplesForFile();
      loadStats(chromosomeIndex);

    }
  });
}


function handleSelectedSamplesForFile(){
  var samples =  $('#vcf-sample-select')[0].selectize.items;
  if (samples.length > 0) {
        $('#samples-filter-header #sample-names').removeClass("hide");
        if (samples.length > 6) {
      $('#samples-filter-header #sample-names').text(samples.length + " samples filtered");
        } else {
      $('#samples-filter-header #sample-names').text(samples.join(" "));
        }
  } else {
        $('#samples-filter-header #sample-names').addClass("hide");
  }
  window.history.pushState({'index.html' : 'bar'},null,'?build=' + genomeBuildHelper.getCurrentBuildName() + '&species=' + genomeBuildHelper.getCurrentSpeciesName());
  vcfiobio.setSamples(samples);
}


function updateUrl(paramName, value) {
  var params = {};
  // turn params into hash
  window.location.search.split('&').forEach(function(param){
    if (param != '') {
      param = param.split('?').length == 1 ? param : param.split('?')[1];
      var fields = param.split('=');
      params[fields[0]] = fields[1];
    }
  });
  params[paramName] = value;
  var search = [];
  Object.keys(params).forEach(function(key) {
    search.push(key + '=' + params[key]);
  })
    window.history.replaceState(null,null,'?'+search.join('&'));
}


function _loadVcfFromUrl(url, tbiUrl, sampleNames) {

  $("#file-alert").addClass("hide");
  dataSelect.setDefaultBuildFromData();

  if (sampleNames != null) {
    vcfiobio.setSamples(sampleNames);
  }
    vcfiobio.openVcfUrl( url, tbiUrl, function( success, message) {
      if (success) {

        $('.vcf-sample.loader').removeClass("hide");

      d3.select("#vcf_file").text(url);


      //get samples
      vcfiobio.getSampleNames(function(sampleNames) {
        $('.vcf-sample.loader').addClass("hide");
        //If the samples are present in the url
        if (sampleNames.length > 1) {
          enableSampleSelectDropDown();

        sampleNames.forEach( function(sampleName) {
          $('#vcf-sample-select')[0].selectize.addOption({value:sampleName});
        });
        if (sampleNamesFromUrl) {
          $('#vcf-sample-select')[0].selectize.setValue(sampleNamesFromUrl.split(","));
          sampleNamesFromUrl = "";
        }

        var x = $('#vcf-sample-select').selectize();
        var selectize  = x[0].selectize;

      //Selecting all the samples
        $("#all-sample-go-button").click(function(){
          var z = selectize.setValue(Object.keys(selectize.options));
          $("#all-sample-go-button").addClass("disabled")
        })

        // Enable and disable load button for samples
        $('#vcf-sample-select')[0].selectize.on("change", function(value){
          if (value) {
            $("#sample-go-button").prop('disabled', false).removeClass("disabled");
          }
          else if(value === null){
            $("#sample-go-button").prop('disabled', true).addClass("disabled");
          }
        });

        $('#vcf-sample-box').removeClass("hide");
        $('#sample-go-button').removeClass("hide");
          $('#all-sample-go-button').removeClass("hide");

        $('#sample-go-button').off('click');
        handleSampleGoButtonClick(url, tbiUrl, onReferencesLoading, onReferencesLoaded);
        }
        else {
          //If the url contains no samples.
          var speciesFlagNoSamples = false;
          var buildFlagNoSamples = false;

          if($('#select-build')[0].selectize.getValue() && $('#select-species')[0].selectize.getValue()){
            $("#go-button-for-noSamples").prop('disabled', false);
          }

          $('#select-species')[0].selectize.on("change", function(){
            if($('#select-species')[0].selectize.getValue().length>0){
              if($('#select-species')[0].selectize.getValue() === "Not specified"){
                window.history.pushState({'index.html' : 'bar'},null,'?build=not specified' + '&species=not specified');
                genomeBuildHelper.setCurrentBuild("not specified")
                speciesFlagNoSamples = true;
                $("#go-button-for-noSamples").prop('disabled', false)
              }
              else{
                speciesFlagNoSamples = true;
                checkBuildSpeciesNoSampleData(buildFlagNoSamples, speciesFlagNoSamples);
              }
            }
          });

          $('#select-build')[0].selectize.on("change", function(){
            if($('#select-build')[0].selectize.getValue().length>0){
              buildFlagNoSamples = true;
              checkBuildSpeciesNoSampleData(buildFlagNoSamples, speciesFlagNoSamples);
            }
          });

          $("#go-button-for-noSamples").removeClass("hide");
          $("#accessing-headers-gif").addClass("hide"); //Hide the loading gif
          $("#select-build-box").removeClass("hide"); //Show the select build box
          $("#go-button-for-load").addClass("hide"); //Hide the sample load button
          handleSampleGoButtonNoSamples(url, tbiUrl, onReferencesLoading, onReferencesLoaded);

        }
      });

    } else {
      displayFileError(message);

      $('#vcf-url').css("visibility", "visible");
      $("#go-panel").removeClass("hide");
      $("url-go-button").removeClass("hide");
      $("file-go-button").addClass("hide");
      $("#url-input").val(url);
      $("#tbi-url-input").val(tbiUrl ? tbiUrl : '');
    }
    });
}

function checkBuildSpeciesNoSampleData(buildFlagNoSamples, speciesFlagNoSamples){
  if(buildFlagNoSamples && speciesFlagNoSamples){
    $("#go-button-for-noSamples").prop('disabled', false);
  }
  else {
    $("#go-button-for-noSamples").prop('disabled', true);
  }
}

function enableSampleSelectDropDown(){
  $("#accessing-headers-gif").addClass("hide"); //Hide the loading gif
  $("#select-build-box").removeClass("hide"); //Show the select-build box
  $("#select-species-box").removeClass("hide"); //Show the select species box
  $("#vcf-sample-select-box").removeClass("hide"); //Show the samples
  $('#show-sample-dialog').removeClass("hide");
  $('#sample-picker').removeClass("hide");
}


function handleSampleGoButtonNoSamples(url, tbiUrl, onReferencesLoading, onReferencesLoaded){
  $("#go-button-for-noSamples").on("click", function(){
    updateUrl("vcf",  encodeURIComponent(url));
    updateUrl("tbi",  encodeURIComponent(tbiUrl));
    printBuildName();
    toggleDisplayProperties();
    vcfiobio.loadRemoteIndex(url, tbiUrl, onReferencesLoading, onReferencesLoaded);

  })
}

function handleSampleGoButtonClick(url, tbiUrl, onReferencesLoading, onReferencesLoaded){
  $('#sample-go-button').on('click', function() {
    updateUrl("vcf",  encodeURIComponent(url));
    updateUrl("tbi",  encodeURIComponent(tbiUrl));
    printBuildName();
      if (!samplesSet) { //Check if we are on the home page or analysis page
        samplesSet=true;
        toggleDisplayProperties();

      vcfiobio.loadRemoteIndex(url, tbiUrl, onReferencesLoading, onReferencesLoaded);

      $("#vcf-sample-select-box").detach().appendTo('#filterSampelDiv').css("text-align", "center");
      $("#sample-go-button").detach().appendTo('#sample-go-button-inModal');
      handleSelectedSamples();
      }
    else if(samplesSet){
      handleSelectedSamples();
      loadStats(chromosomeIndex);
    }

  });
}


function handleSelectedSamples(){
  var samples =  $('#vcf-sample-select')[0].selectize.items;
  if (samples.length > 0) {
        $('#samples-filter-header #sample-names').removeClass("hide");
        if (samples.length > 6) {
      $('#samples-filter-header #sample-names').text(samples.length + " samples filtered");
        } else {
      $('#samples-filter-header #sample-names').text(samples.join(" "));
        }
  } else {
        $('#samples-filter-header #sample-names').addClass("hide");
  }
  vcfiobio.setSamples(samples);
  window.history.pushState({'index.html' : 'bar'},null,"?vcf=" + encodeURIComponent(vcfiobio.getVcfUrl()) + "&tbi=" + encodeURIComponent(vcfiobio.getTbiURL()) + "&samples=" + samples.join(",") + '&build=' + genomeBuildHelper.getCurrentBuildName() + '&species=' + genomeBuildHelper.getCurrentSpeciesName());

}

function toggleDisplayProperties(){
  d3.select("#selectData")
  .style("visibility", "hidden")
  .style("display", "none");

  d3.select("#showData")
    .style("visibility", "visible");

  $("#showData").removeClass("hide");
}


function onFilesSelected(event) {
  $("#file-alert").addClass("hide");
  $("#accessing-headers-gif").removeClass("hide");
  $("#select-species-box").addClass("hide");
  vcfiobio.openVcfFile( event,
    function(vcfFile) {
      d3.select("#vcf_file").text(vcfFile.name);
      dataSelect.setDefaultBuildFromData();
      loadFromFile();
    },
    function(errorMessage) {
      displayFileError(errorMessage)
    });
}

function onAddBed(event) {
  var h = 5;

  if (event.target.files.length != 1) {
       alert('must select a .bed file');
       return;
    }

    // check file extension
    var fileType = /[^.]+$/.exec(event.target.files[0].name)[0];
    if (fileType != 'bed')  {
      alert('must select a .bed file');
      return;
    }
    // clear brush on read coverage chart
    // resetBrush();

    // // hide add bed / show remove bed buttons
    $("#add-bedfile-button").css('visibility', 'hidden');
    $(".bedfile-checkbox").css('visibility', 'hidden');
    $("#remove-bedfile-button").css('visibility', 'visible')

    // read bed file and store
    var reader = new FileReader();
    reader.onload = function(theFile) {
        window.bed = this.result;
        loadStats(chromosomeIndex);
    }
    reader.readAsText(event.target.files[0])
}

function onDefaultBed() {
  var bedurl = './20130108.exome.targets.bed';
  $("#add-bedfile-button").css('visibility', 'hidden');

    // clear brush on read coverage chart
    //resetBrush();

    // turn on sampling message and off svg
    // turn it on here b\c the bed file is so big it takes a while to download
    // $("section#middle svg").css("display", "none");
    // $(".samplingLoader").css("display", "block");

    // grab bed from url
    $.ajax({
        url: bedurl,
        dataType: 'text'
    }).done(function (data) {
        data = data.replace(/chr/g, '');
        window.bed = data;
        //goSampling({sequenceNames : getSelectedSeqIds() });
        loadStats(chromosomeIndex);
    });

}

function onRemoveBed() {
  $("#add-bedfile-button").css('visibility', 'visible');
    $(".bedfile-checkbox").css('visibility', 'visible');
    $("#remove-bedfile-button").css('visibility', 'hidden')

  window.bed = undefined;
  loadStats(chromosomeIndex);
}

function displayFileError(errorMessage) {
  $("#accessing-headers-gif").addClass("hide");

  if(flag){
    d3.select("#selectData")
      .style("visibility", "visible")
      .style("display", "block");

    d3.select("#showData")
      .style("visibility", "hidden");

    $("#file-alert").text(errorMessage);
    $("#file-alert").removeClass("hide");
    $("#accessing-headers-gif").addClass("hide");
    $("#select-species-box").addClass("hide");

    $("#url-tbi-input").prop('disabled', false);
    $("#url-input").prop('disabled', false);
  }
  else {
    d3.select("#selectData")
      .style("visibility", "visible")
      .style("display", "block");

    d3.select("#showData")
      .style("visibility", "hidden");

    $("#file-alert").text(errorMessage);
    $("#file-alert").removeClass("hide");
    $("#accessing-headers-gif").addClass("hide");
    $("#select-species-box").addClass("hide");

    $("#url-input").prop('disabled', false);
  }
}

function showSamplesDialog() {

}


function onReferencesLoaded(refData) {

  //   // Select 'all' chromosomes (for genome level view)
  pieChartRefData = vcfiobio.getReferences(.005, 1);
  //
  // // Select the 'All' references in the chromosome chart.  This
  // // will fire the 'click all' event, causing the stats to load
  chromosomeChart.clickAllSlices(pieChartRefData);
  //loadStats(chromosomeIndex);

}


function onReferencesLoading(refData) {
  drawPieChart();
}



function drawPieChart(){
    d3.selectAll("section#top svg").classed("hide", false)
    d3.selectAll("section#top .svg-alt").classed("hide", false);
    d3.selectAll("section#top .samplingLoader").classed("hide", true);

    var otherRefData = null;
    var pieChartRefData = null;
    pieChartRefData = vcfiobio.getReferences(.005, 1);

    d3.select("#primary-references svg").remove();
    var selection = d3.select("#primary-references").datum( chromosomePieLayout(pieChartRefData) );
      chromosomeChart( selection );

    otherRefData = vcfiobio.getReferences(0, .005);


    if (otherRefData.length > 0) {
      var dropdown = d3.select("#other-references-dropdown");

      dropdown.on("change", function(event) {
        chromosomeIndex = this.value;
        onReferenceSelected(refData[chromosomeIndex], chromosomeIndex);
      });

      dropdown.selectAll("option")
              .filter( function(d,i) {
                return i > 0;
              })
              .remove();
      dropdown.data(otherRefData)
              .append("option")
          .attr( "value", function(d,i) {
            return d.idx;
          })
          .text( function(d,i) {
            return d.name
          });

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
  var data = vcfiobio.getEstimatedDensity(ref,
    false, densityOptions.removeSpikes, densityOptions.maxPoints, densityOptions.epsilonRDP);


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
    } else {
      regionStart = 0;
      regionEnd = ref.value;
    }

    d3.select("#region_selected")
       .text(d3.format(",")(regionStart) + ' - ' + d3.format(",")(regionEnd));

    // Get the estimated density for the reference (already in memory)
    var data = vcfiobio.getEstimatedDensity(ref,
      false, densityRegionOptions.removeSpikes, null, densityRegionOptions.epsilonRDP);

    // Now filter the estimated density data to only include the points that fall within the selected
    // region
    var filteredData = data.filter(function(d) {
      return (d[0] >= regionStart && d[0] <= regionEnd)
    });

    // Now let's aggregate to show in 900 px space
    var factor = d3.round(filteredData.length / 900);
      filteredData = vcfiobio.reducePoints(filteredData, factor, function(d) { return d[0]; }, function(d) { return d[1]});


    // Show the variant density for the selected region
    variantDensityChart(d3.select("#variant-density").datum(filteredData), onVariantDensityChartRendered);

    // Load the stats based on the selected region
    loadStats(chromosomeIndex);

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


  var data = vcfiobio.getGenomeEstimatedDensity(false, densityOptions.removeSpikes,
    densityOptions.maxPoints, densityOptions.epsilonRDP);


  // Load the variant density chart with the data
  variantDensityChart.showXAxis(false);
  variantDensityChart(d3.select("#variant-density").datum(data), onVariantDensityChartRendered);
  variantDensityRefVF(d3.select("#variant-density-ref-vf").datum(vcfiobio.getReferences(.005, 1)));

}


function loadStats(i) {

  d3.select("#total-reads").select("#value").text(0);

  d3.selectAll("section#middle svg").classed(            "hide",    true);
  d3.selectAll("section#middle .svg-alt").classed(       "hide",    true);
  d3.selectAll("section#middle .no-values").classed(     "hide",    true);
  d3.selectAll("section#middle .samplingLoader").classed("hide",    false);
  d3.selectAll("section#bottom svg").classed(            "hide",    true);
  d3.selectAll("section#bottom .svg-alt").classed(       "hide",    true);
  d3.selectAll("section#bottom .no-values").classed(     "hide",    true);
  d3.selectAll("section#bottom .samplingLoader").classed("hide",    false);


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

  // Increase the bin size by the sampling multiplier, which
  // captures the number of times the "sample more" button
  // has been pressed by the user
  options.binNumber = options.binNumber * statsOptions.samplingMultiplier;
  if (vcfiobio.getVcfFileSize() < statsOptions.minFileSamplingSize) options.fullAnalysis = true;

  vcfiobio.getStats(refs, options, function(data) {
    renderStats(data);
  });


}


function renderStats(stats) {
  window.statsData = stats;


  d3.selectAll("section#middle svg").classed("hide", false);
  d3.selectAll("section#middle .svg-alt").classed("hide", false);
     d3.selectAll("section#middle .samplingLoader").classed("hide", true);
  d3.selectAll("section#middle .no-values").classed("hide", true);


  d3.selectAll("section#bottom svg").classed("hide", false);
  d3.selectAll("section#bottom .svg-alt").classed("hide", false);
     d3.selectAll("section#bottom .samplingLoader").classed("hide", true);
  d3.selectAll("section#bottom .no-values").classed("hide", true);


  // # of Variants sampled
  var readParts = shortenNumber(stats.TotalRecords);
  d3.select("#total-reads")
      .select("#value")
      .text(readParts[0] || " ");
  d3.select("#total-reads")
      .select("#number")
      .text(readParts[1] || " ");
  d3.select("#total-reads")
      .select("#label")
      .style("padding-top", (readParts.length > 1 ? "0px" : "10px"));


  // TsTv Ratio
  if (stats.hasOwnProperty("TsTvRatio")) {
    var tstvRatio = stats.TsTvRatio;
    if (tstvRatio == null) {
      tstvRatio = 0;
    }
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
  } else {
    d3.selectAll('#tstv-ratio svg').classed("hide", true);
    d3.selectAll('#tstv-ratio #ratio-value').text("");
    d3.selectAll('#tstv-ratio .no-values').classed("hide", false);
  }

  // Var types
  var count = 0;
  for (type in stats.var_type) {
    count += stats.var_type[type];
  }
  if (count > 0) {
    var varTypeArray = vcfiobio.jsonToValueArray(stats.var_type);
    var varTypeData = [
      {category: "", values: varTypeArray}
    ];
    // This is the parent object for the chart
    var varTypeSelection = d3.select("#var-type").datum(varTypeData);
    // Render the var type data with the data
    varTypeChart(varTypeSelection);
  } else {
    d3.selectAll('#var-type svg').classed("hide", true);
    d3.selectAll('#var-type .no-values').classed("hide", false);
  }

  // Alelle Frequency
  var afObj = stats.af_hist.afHistBins;
  afData = vcfiobio.jsonToArray2D(afObj);
  if (afData.length > 0) {
    var afSelection = d3.select("#allele-freq-histogram")
                .datum(afData);
    var afOptions = {outliers: true, averageLine: false};
    alleleFreqChart(afSelection, afOptions);
  } else {
    d3.selectAll('#allele-freq svg').classed("hide", true);
    d3.selectAll('#allele-freq .no-values').classed("hide", false);
  }

  // Mutation Spectrum
  count = 0;
  var msObj = stats.mut_spec;
  var msArray = vcfiobio.jsonToArray(msObj, "category", "values");
  msArray.forEach(function (msObject) {
    msObject.values.forEach(function (mutCount) {
      count += mutCount;
    });
  });
  if (count > 0) {
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
  } else {
    d3.selectAll('#mut-spectrum svg').classed("hide", true);
    d3.selectAll('#mut-spectrum .no-values').classed("hide", false);
  }


  // QC distribution
  var qualPoints = vcfiobio.jsonToArray2D(stats.qual_dist.regularBins);
  if (qualPoints.length > 0) {
    var factor = 2;
    qualReducedPoints = vcfiobio.reducePoints(qualPoints, factor, function(d) { return d[0]; }, function(d) { return d[1]});
    //for (var i = 0; i < qualReducedPoints.length; i++) {
    //  qualReducedPoints[i][0] = i;
    //}

    var qualSelection = d3.select("#qual-distribution-histogram")
                .datum(qualReducedPoints);
    var qualOptions = {outliers: true, averageLine: true};
    qualDistributionChart(qualSelection, qualOptions);
  } else {
    d3.selectAll('#qual-distribution svg').classed("hide", true);
    d3.selectAll('#qual-distribution .no-values').classed("hide", false);
  }



  // Indel length distribution
  var outliers = $("#indel-length input[type='checkbox']").is(":checked")
  fillInDelLengthChart(stats, outliers);


  // Reset the sampling multiplier back to one
  // so that next time we get stats, we start
  // with the default sampling size that can
  // be increased as needed
  statsOptions.samplingMultiplier = 1;


}

function fillInDelLengthChart(statsData, outliers) {
    var indelData = vcfiobio.jsonToArray2D(statsData.indel_size);
    if (!outliers) {
      indelData = iobio.viz.layout.outlier()(indelData);
    }
    var selection = d3.select("#indel-length-histogram");
    if (indelData.length > 0) {
        selection.datum(indelData);
        window.indelLengthChart(selection, {'outliers':outliers});
    } else {
    d3.selectAll('#indel-length svg').classed("hide", true);
    d3.selectAll('#indel-length .no-values').classed("hide", false);
    }
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
