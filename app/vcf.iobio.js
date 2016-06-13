//
//  vcfiobio
//  Tony Di Sera
//  October 2014
//
//  This is a data manager class for the variant summary data.
// 
//  Two file are used to generate the variant data: 
//    1. the bgzipped vcf (.vcf.gz) 
//    2. its corresponding tabix file (.vcf.gz.tbi).  
//
//  The variant summary data come in 3 main forms:  
//    1. reference names and lengths 
//    2. variant density (point data), 
//    3. vcf stats (variant types, tstv ration allele frequency, mutation spectrum,
//       insertion/deletion distribution, and qc distribution).  
//  The reference names and lengths as well as the variant density data obtained from 
//  the tabix file; the vcf stats are determined by parsing the vcf file in sampled regions.
//
//  The files can be hosted remotely, specified by a URL, or reside on the client, accesssed as a local
//  file on the file system. When the files are on a remote server, vcfiobio communicates with iobio services 
//  to obtain the metrics data.  When the files are accessed locally, a client-side javascript library
//  is used to a) read the tabix file to obtain the reference names/lengths and the variant density data 
//  and b) parse the vcf records from sampled regions.  This mini vcf file is then streamed to iobio services
//  to obtain the vcf metrics.  
//  
//  The follow example code illustrates the method calls to make
//  when the vcf file is served remotely (a URL is entered)
//
//  var vcfiobio = vcfiobio();
//  vcfiobio.loadRemoteIndex(vcfUrl, function(data) {
//     // Filter out the short (<1% median reference length) references
//     vcfiobio.getReferenceData(.01, 100);
//     // Show all the references (example: in a pie chart) here....
//     // Render the variant density data here....
//  });
//  vcfiobio.getEstimatedDensity(refName);
//  vcfiobio.getStats(refs, options, function(data) {
//     // Render the vcf stats here....
//  });
//  
//
//  When the vcf file resides on the local file system, call
//  openVcfFile() and then call loadIndex() instead
//  of loadRemoteIndex().
//
//  var vcfiobio = vcfiobio();
//  vcfiobio.openVcfFile( event, function(vcfFile) {
//    vcfiobio.loadIndex( function(data) {
//     .... same as above ......
//    });
//  });
//  ...  same as above
//
//
vcfiobio = function module() {

  var debug =  false;

  var exports = {};

  var dispatch = d3.dispatch( 'dataReady', 'dataLoading');

  var SOURCE_TYPE_URL = "URL";
  var SOURCE_TYPE_FILE = "file";
  var sourceType = "url";

  var samples = [];

  var refLengths_GRCh37 = 
  {
        "1":   +249250621,
        "2":   +243199373,
        "3":   +198022430,
        "4":   +191154276,
        "5":   +180915260,
        "6":   +171115067,
        "7":   +159138663,
        "8":   +146364022,
        "9":   +141213431,
        "10":  +135534747,
        "11":  +135006516,
        "12":  +133851895,
        "13":  +115169878,
        "14":  +107349540,
        "15":  +102531392,
        "16":  +90354753,
        "17":  +81195210,
        "18":  +78077248,
        "19":  +59128983,
        "20":  +63025520,
        "21":  +48129895,
        "22":  +51304566,
        "X":   +155270560,
        "Y":   +59373566
      };



  var emailServer            = "ws://localhost:7068";

  var vcfstatsAlive          = "nv-prod.iobio.io/vcfstatsalive/";
  var tabix                  = "nv-prod.iobio.io/tabix/";
  var vcfReadDepther         = "nv-prod.iobio.io/vcfdepther/"
  var vt                     = "services.iobio.io/vt/";

  var vcfURL;
  var vcfReader;
  var vcfFile;
  var tabixFile;
  var size16kb = Math.pow(2, 14);
  var refData = [];
  var refDensity = [];
  var refName = "";

  var regions = [];
  var regionIndex = 0;
  var stream = null;

  var errorMessageMap =  {
    "tabix Error: stderr - Could not load .tbi":  "Unable to load the index (.tbi) file, which has to exist in same directory and be given the same name as the .vcf.gz with the file extension of .vcf.gz.tbi.",
    "tabix Error: stderr - [E::hts_open] fail to open file": "Unable to access the .vcf.gz file.  ",
    "tabix Error: stderr - [M::test_and_fetch] downloading file": "Invalid index or compressed vcf.  Try bgzipping the vcf and recreating the index with tabix."
  }

  var ignoreMessageMap =  {
    //"tabix Error: stderr - [M::test_and_fetch] downloading file": {ignore: true}
  }



  exports.openVcfUrl = function(url, callback) {
    var me = this;
    sourceType = SOURCE_TYPE_URL;
    vcfURL = url;

    var fileType0 = /([^.]*)\.(vcf\.gz)$/.exec(url);
    var fileExt0 = fileType0 && fileType0.length > 1 ? fileType0[2] : null;
    if (fileExt0 == null) {
      callback(false, "Please specify a URL to a compressed, indexed vcf file with the file extension vcf.gz");
    } else {
      this.checkVcfUrl(url,function(success, message) {
          callback(success, message);
      });      
    }

  }

  exports.checkVcfUrl = function(url, callback) {
    var me = this;
    var success = null;
    var cmd = new iobio.cmd(
        tabix,
        ['-H', url]
    );

    cmd.on('data', function(data) {      
      if (data != undefined) {
        success = true;
      }
    });

    cmd.on('end', function() {
      if (success == null) {
        success = true;
        callback(success);          
      }
    });

    cmd.on('error', function(error) {
      if (ignoreErrorMessage(error)) {
        success = true;
        callback(success)
      } else {
        if (success == null) {
          success = false;
          callback(success, me.translateErrorMessage(error));            
        }        
      }

    });

    cmd.run();
  }

  exports.ignoreErrorMessage = function(error) {
    var me = this;
    var ignore = false;
    for (err in ignoreMessageMap) {
      if (error.indexOf(err) == 0) {
        ignore = ignoreMessageMap[err].ignore;
      }
    }    
    return ignore;

  }

  exports.translateErrorMessage = function(error) {
    var me = this;
    var message = null;
    for (err in errorMessageMap) {
      if (message == null && error.indexOf(err) == 0) {
        message = errorMessageMap[err];
      }
    }    
    return message ? message : error;
  }

  exports.openVcfFile = function(event, callback, errorCallback) {
    sourceType = SOURCE_TYPE_FILE;
                
    if (event.target.files.length != 2) {
       errorCallback('must select 2 files, both a .vcf.gz and .vcf.gz.tbi file');
    }

    if (endsWith(event.target.files[0].name, ".vcf") ||
        endsWith(event.target.files[1].name, ".vcf")) {
      errorCallback('You must select a compressed vcf file (.vcf.gz), not a vcf file');
    }

    var fileType0 = /([^.]*)\.(vcf\.gz(\.tbi)?)$/.exec(event.target.files[0].name);
    var fileType1 = /([^.]*)\.(vcf\.gz(\.tbi)?)$/.exec(event.target.files[1].name);

    var fileExt0 = fileType0 && fileType0.length > 1 ? fileType0[2] : null;
    var fileExt1 = fileType1 && fileType1.length > 1 ? fileType1[2] : null;

    var rootFileName0 = fileType0 && fileType0.length > 1 ? fileType0[1] : null;
    var rootFileName1 = fileType1 && fileType1.length > 1 ? fileType1[1] : null;


    if (fileType0 == null || fileType0.length < 3 || fileType1 == null || fileType1.length <  3) {
      errorCallback('You must select BOTH  a compressed vcf file (.vcf.gz) and an index (.tbi)  file');
    } 


    if (fileExt0 == 'vcf.gz' && fileExt1 == 'vcf.gz.tbi') {
      if (rootFileName0 != rootFileName1) {
        errorCallback('The index (.tbi) file must be named ' +  rootFileName0 + ".tbi");
      } else {
        vcfFile   = event.target.files[0];
        tabixFile = event.target.files[1];
      }    
    } else if (fileExt1 == 'vcf.gz' && fileExt0 == 'vcf.gz.tbi') {
      if (rootFileName0 != rootFileName1) {
        errorCallback('The index (.tbi) file must be named ' +  rootFileName1 + ".tbi");
      } else {
        vcfFile   = event.target.files[1];
        tabixFile = event.target.files[0];
      }
    } else {
      errorCallback('You must select BOTH  a compressed vcf file (.vcf.gz) and an index (.tbi)  file');
    }

    callback(vcfFile);

  } 


  function showFileFormatMessage() {
    alertify.set(
      { 
        labels: {
          cancel     : "Show me how",
          ok         : "OK",
        },  
        buttonFocus:  "cancel"
    });

    alertify.confirm("You must select a compressed vcf file and its corresponding index file in order to run this app. ", 
        function (e) {
        if (e) {
            return;
        } else {
            window.location = 'http://iobio.io/2015/09/03/install-run-tabix/';
        }
     });
  }
  
  function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
  }

  exports.setSamples = function(sampleNames) {
    samples = sampleNames;
  }
  exports.getSamples = function() {
    return samples;
  }

  exports.loadIndex = function(callbackData, callbackEnd, callbackError) {
    var me = this;
 
    vcfReader = new readBinaryVCF(tabixFile, vcfFile, function(tbiR) {
      var tbiIdx = tbiR;
      refDensity.length = 0;

      if (tbiIdx.idxContent.head.n_ref == 0) {
        var errorMsg = "Invalid index file.  The number of references is set to zero.  Try recompressing the vcf with bgzip and regenerating the index with tabix."
        if (callbackError) {
          callbackError(errorMsg);
        }
        console.log(errorMsg);
        return;
      }

      var referenceNames = [];
      for (var i = 0; i < tbiIdx.idxContent.head.n_ref; i++) {
        var ref   = tbiIdx.idxContent.head.names[i];
        referenceNames.push(ref);
      }      

      for (var i = 0; i < referenceNames.length; i++) {
        var ref   = referenceNames[i];

        var indexseq = tbiIdx.idxContent.indexseq[i];
        var calcRefLength = indexseq.n_intv * size16kb;

        var refLength = refLengths_GRCh37[me.stripChr(ref)];

        // Use the linear index to load the estimated density data
        var intervalPoints = [];
        for (var x = 0; x < indexseq.n_intv; x++) {
          var interval = indexseq.intervseq[x];
          var fileOffset = interval.valueOf();
          var fileOffsetPrev = x > 0 ? indexseq.intervseq[x - 1].valueOf() : 0;
          var intervalPos = x * size16kb;
          intervalPoints.push( [intervalPos, fileOffset - fileOffsetPrev] );
          
        }
        if (calcRefLength < refLength) {
          var lastPos = intervalPoints[intervalPoints.length-1][0];
          intervalPoints.push([lastPos+1, 0]);
          intervalPoints.push([refLength-1, 0]);
        }

        // Load the reference density data.  Exclude reference if 0 points.
        refDensity[ref] = {"idx": i, "intervalPoints": intervalPoints};
        refData.push( {"name": ref, "value": refLength, "refLength": refLength, "idx": i});

       

      }


      // Call function from js-bv-sampling to obtain point data.
      estimateCoverageDepth(tbiIdx, function(estimates) {

      for (var i = 0; i < referenceNames.length; i++) {

          
          var refName   = referenceNames[i];
          var pointData = estimates[i];
          var refDataLength  =  refData[i].refLength;
         

          

          // Sort by position of read; otherwise, we get a wonky
          // line chart for read depth.  (When a URL is provided,
          // bamtools returns a sorted array.  We need this same
          // behavior when the BAM file is loaded from a file
          // on the client.
          pointData.push({pos: 0, depth: 0});
          pointData = pointData.sort(function(a,b) {
              var x = +a.pos; 
              var y = +b.pos;
              return ((x < y) ? -1 : ((x > y) ? 1 : 0));
          });  

          // Make sure to zero fill to the end of the reference
          var calcRefLength = pointData[pointData.length - 1].pos + size16kb;
          var refLength = refLengths_GRCh37[me.stripChr(refName)];
          if (refLength == null) {
            refLength = calcRefLength;
          }
          if (calcRefLength < refLength) {
            pointData.push({pos: refLength-1, depth: 0});
          } else if (calcRefLength > refLength) {
            // Remove any points that go past the reference length
            var idxToTruncate = 0;
            for( var idx = 0; idx < pointData.length; idx++) {
              if (pointData[idx].pos > refLength) {
                if (idxToTruncate == 0) {
                  idxToTruncate = idx;
                }
              }
            }
            if (idxToTruncate > 0) {
              pointData = pointData.slice(0, idxToTruncate);
              pointData.push({pos: refLength - 1, depth: 0});
            }
          }



          // If we have sparse data, keep track of these regions
          if (pointData.length < 100) {
            refData[i].sparsePointData = pointData;
          }

          // Zero fill any 16kb points not in array
          var zeroPointData = [];
          for (var x = 1; x < pointData.length; x++) {
              var posPrev = pointData[x-1].pos;
              var pos     = pointData[x].pos;
              var posDiff = pos - posPrev;
              if (posDiff > size16kb) {
                  var intervalCount = posDiff / size16kb;
                  for (var y = 0; y < intervalCount; y++) {
                    zeroPointData.push({pos: posPrev + (y*size16kb), depth: 0});
                  }
              }
          }
          
          //pointData.push({pos: refDataLength, depth: 0});

          if (zeroPointData.length > 0) {
            pointData = pointData.concat(zeroPointData);
            pointData = pointData.sort(function(a,b) {
              var x = +a.pos; 
              var y = +b.pos;
              return ((x < y) ? -1 : ((x > y) ? 1 : 0));
            });  

          }

         

          //refData.push({"name": refName, "value": +refLength, "refLength": +refLength, "idx": + i});
          var refObject = refDensity[refName];
          refObject.points = [];
          
          for (var x = 0; x < pointData.length; x++) {
            var point = [pointData[x].pos, pointData[x].depth];
            refObject.points.push(point);
          }
          // Sort ref data so that refs are ordered numerically
          refData = me.sortRefData(refData);

          if (callbackData) {
            callbackData(refData);
          }

         
        }

      });

      // Sort ref data so that refs are ordered numerically
      refData = me.sortRefData(refData);
    
      if (callbackEnd) {
        callbackEnd(refData);
      }
    
    });

  }


  exports.stripChr = function(ref) {
    if (ref.indexOf("chr") == 0) {
      return ref.split("chr")[1];
    } else {
      return ref;
    }
  }
  

  exports.loadRemoteIndex = function(theVcfUrl, callbackData, callbackEnd) {
    var me = this;
    vcfURL = theVcfUrl;
    sourceType = SOURCE_TYPE_URL;
    var me = this;
    var buffer = "";
    var refName;
    
    var cmd = new iobio.cmd(
        vcfReadDepther,
        ['-i', vcfURL + '.tbi']
    );

    cmd.on('data', function(data) {
      
      if (data == undefined) {
        return;
      }

      data = buffer + data;

      var recs = data.split("\n");
      if (recs.length > 0) {     
        for (var i=0; i < recs.length; i++)  {
          if (recs[i] == undefined) {
            return;
          }

          var success = true;
          if ( recs[i][0] == '#' ) {
          var tokens = recs[i].substr(1).split("\t");
            if (tokens.length >= 3) {
              var refNamePrev = refName;
              refIndex = tokens[0];
              refName = tokens[1];     

              var calcRefLength = tokens[2];
              var refLength = refLengths_GRCh37[me.stripChr(refName)];
              if (refLength == null) {
                 refLength = calcRefLength;
              }

              // Zero fill the previous reference point data and callback with the
              // data we have loaded so far.
              if (refData.length > 0) {
                var refDataPrev = refData[refData.length - 1];
                me.zeroFillPointData(refDataPrev);
                if (callbackData) {
                  callbackData(refData);
                }
              }

              refData.push({"name": refName, "value": +refLength, "refLength": +refLength, "calcRefLength": +calcRefLength, "idx": +refIndex});
              refDensity[refName] =  {"idx": refIndex, "points": [], "intervalPoints": []};   


            } else {
                success = false;
            }
          }
          else {
             if (recs[i] != "") {
                if (refDensity[refName] == null) {
                  console.log("Invalid reference " + refName + " for point data " + recs[i]);
                  success = false;
                } else {
                  var fields = recs[i].split("\t");
                  if (fields.length >= 2) {
                    var point = [ parseInt(fields[0]), parseInt(fields[1]) ];
                    refDensity[refName].points.push(point);
                    refDensity[refName].intervalPoints.push(point);
                  } else {
                    success = false;
                  }
                }

             }
          }                  
          if (success) {
            buffer = "";
          } else {
            buffer += recs[i];
          }
        }
      } else  {
        buffer += data;
      } 



    })

    // All data has been streamed.
    cmd.on('end', function() {
      // sort refData so references or ordered numerically
      refData = me.sortRefData(refData);


      // Zero fill the previous reference point data and callback with the
      // for the last reference that was loaded
      if (refData.length > 0) {
        var refDataPrev = refData[refData.length - 1];
        me.zeroFillPointData(refDataPrev);
        if (callbackData) {
          callbackData(refData);
        }
      }
      if (callbackEnd) {
        callbackEnd(refData);
      }
    })

    // Catch error event when fired 
    cmd.on('error', function(error) {
      console.log("Error occurred in loadRemoteIndex. " +  error);
    })

    // execute command
    cmd.run();


    

  };

  exports.zeroFillPointData = function(refObject) {

        var refDensityObject = refDensity[refObject.name];

        // If we have sparse data, keep track of these regions
        var realPointCount = 0;
        refDensityObject.points.forEach( function (point) {
          if (point[1] > 0) {
            realPointCount++;
          }
        });
        if (realPointCount < 100) {
          refObject.sparsePointData = [];
          refDensityObject.points.forEach( function (point) {
          if (point[1] > 0) {
            refObject.sparsePointData.push( {pos: point[0], depth: point[1]});
          }
        });
        }
        
       
  };


  exports.sortRefData = function(refData) {
    var me = this;
    return refData.sort(function(refa,refb) {
          var x = me.stripChr(refa.name); 
          var y = me.stripChr(refb.name);
          if (me.isNumeric(x) && me.isNumeric(y)) {
            return ((+x < +y) ? -1 : ((+x > +y) ? 1 : 0));
          } else {
             if (!me.isNumeric(x) && !me.isNumeric(y)) {
                return ((+x < +y) ? -1 : ((+x > +y) ? 1 : 0));
             } else if (!me.isNumeric(x)) {
                return 1;
             } else {
                return -1;
             }
          }
          
      });      
  }


 
  exports.isNumeric = function(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  }

  exports.getReferences = function(minLengthPercent, maxLengthPercent) {
    var references = [];
    
    // Calculate the total length
    var totalLength = +0;
    for (var i = 0; i < refData.length; i++) {
      var refObject = refData[i];
      if (!isNaN(refObject.value)) {
        totalLength += refObject.value;
      } else {
        console.log("Invalid length for ref " + refObject.name +  ". Setting to 0.");
        refObject.value = 0;
        refObject.refLength = 0;
      }
    }

    // Only include references with length within percent range
    for (var i = 0; i < refData.length; i++) {
      var refObject = refData[i];
      var lengthPercent = refObject.value / totalLength;
      if (lengthPercent >= minLengthPercent && lengthPercent <= maxLengthPercent) {
        references.push(refObject);
      }
    }


    return references;
  }


  exports.getEstimatedDensity = function(ref, useLinearIndex, removeTheDataSpikes, maxPoints, rdpEpsilon) {
    var points = useLinearIndex ? refDensity[ref].intervalPoints.concat() : refDensity[ref.name].points.concat();

    if (removeTheDataSpikes) {
      var filteredPoints = this._applyCeiling(points);
      if (filteredPoints.length > 500) {
        points = filteredPoints;
      }
    } 


    // Reduce point data to to a reasonable number of points for display purposes
    if (maxPoints) {
      var factor = d3.round(points.length / maxPoints);
      points = this.reducePoints(points, factor, function(d) { return d[0]; }, function(d) { return d[1]});
    }

    // Now perform RDP
    if (rdpEpsilon) {
      points = this._performRDP(points, rdpEpsilon, function(d) { return d[0] }, function(d) { return d[1] });
    }


    // We need to mark the end of the ref if the last post < ref length
    var lastPos = points[points.length-1][0];
    if (lastPos < ref.refLength) {        
      points.push([lastPos+1, 0]);
      points.push([ref.refLength-1, 0]);
    }



    return points;
  }

  exports.getGenomeEstimatedDensity = function(useLinearIndex, removeTheDataSpikes, maxPoints, rdpEpsilon) {
    var allPoints = [];
    var offset = 0;

    var genomeLength = 0;    
    // Figure out how to proportion maxPoints across refs
    for (var i = 0; i < refData.length; i++) {
      genomeLength += refData[i].refLength;
    }
    var roundDecimals = function(value, decimals) {
      return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
    }
    for (var i = 0; i < refData.length; i++) {
      refData[i].genomePercent = roundDecimals(refData[i].refLength / genomeLength, 4);
    }


    for (var i = 0; i < refData.length; i++) {

      var points = useLinearIndex ? refDensity[refData[i].name].intervalPoints.concat() : refDensity[refData[i].name].points.concat();


      // Reduce point data to to a reasonable number of points for display purposes
      if (maxPoints) {
        var factor = d3.round(points.length / (maxPoints * refData[i].genomePercent));
        points = this.reducePoints(points, factor, function(d) { return d[0]; }, function(d) { return d[1]});
      }

      // Now perform RDP
      if (rdpEpsilon) {
        points = this._performRDP(points, rdpEpsilon, function(d) { return d[0] }, function(d) { return d[1] });
      }

      // We need to mark the end of the ref if the last post < ref length
      var lastPos = points[points.length-1][0];
      if (lastPos < refData[i].refLength) {        
        points.push([lastPos+1, 0]);
        points.push([refData[i].refLength-1, 0]);
      }

      var offsetPoints = [];
      for (var x = 0; x < points.length; x++) {
        offsetPoints.push([points[x][0] + offset, points[x][1]]);
      }
      allPoints = allPoints.concat(offsetPoints);
      // We are making a linear representation of all ref density.
      // We will add the length of the ref to the 
      // next reference's positions.
      offset = offset + refData[i].value;
    }

    if (removeTheDataSpikes) {
      allPoints = this._applyCeiling(allPoints);
    }


    return allPoints;
  }


  exports.getStats = function(refs, options, callback) {    
    if (sourceType == SOURCE_TYPE_URL) {
      this._getRemoteStats(refs, options, callback);
    } else {
      this._getLocalStats(refs, options, callback);
    }
    
  }

  // We we are dealing with a local VCF, we will create a mini-vcf of all of the sampled regions.
  // This mini-vcf will be streamed to vcfstatsAliveServer.  
  exports._getLocalStats = function(refs, options, callback ) {
    var me = this;
    this._getRegions(refs, options);

    // options to write stream of vcf records from local file to cmd
    var opts = {        
      writeStream: function(stream) {  
     
        vcfReader.getHeader( function(header) {
           stream.write(header + "\n");
        });

        if (regions.length <= regionIndex) {
          console.log("no regions to process. regionIndex=" + regionIndex + " regions.length=" + regions.length);
        } else {
          var regionObject = regions[regionIndex];
          if (regionObject == null) {
            console.log("encountered null region at index " + regionIndex + " for regions with length " + regions.length);
          }
        }

        var streamNextRegion = function(records) {
          // Stream the vcf records we just parsed for a region in the vcf, one records at a time
          if (records) {
            for (var r = 0; r < records.length; r++) {              
              stream.write(records[r] + "\n");
            }
          } else {
            // This is an error condition.  If vcfRecords can't return any
            // records, we will hit this point in the code.
            // Just log it for now and move on to the next region.
            console.log("WARNING:  unable to create vcf records for region  " + regionIndex);
          }

          // Now that we have streamed the vcf records for a region, continue on
          // to the next region to stream
          regionIndex++;
          if (regionIndex > regions.length) {
            return;
          } else if (regionIndex == regions.length) {
            // We have streamed all of the regions so now we will end the stream.
            stream.end();
            return;
          } else {
            var regionObject = regions[regionIndex];
            if (regionObject == null) {
              console.log("encountered null region at index " + regionIndex + " for regions with length " + regions.length);
            } 
            // There are more regions to obtain vcf records for, so call getVcfRecords now
            // that regionIndex has been incremented.
            vcfReader.getRecords(regions[regionIndex].name, 
              regions[regionIndex].start, 
              regions[regionIndex].end, 
              streamNextRegion);
          } 
        }


        // Stream vcf records for each region in a serial fashion.  (Once vcf records for a region 
        // have been streamed, continue on to the next region to stream its vcf records).
        vcfReader.getRecords(
            regions[regionIndex].name, 
            regions[regionIndex].start, 
            regions[regionIndex].end, 
            streamNextRegion);        
      }  
    };


    var cmd = new iobio.cmd(vcfstatsAlive, ['-u', '1000', vcfFile], opts);       
    
    if (samples && samples.length > 0) {
      cmd = new iobio.cmd(vt, ["subset", "-s", samples.join(","), vcfFile], opts)
                     .pipe(vcfstatsAlive, ['-u', '1000']);
    } else {
      cmd = new iobio.cmd(vcfstatsAlive, ['-u', '1000', vcfFile], opts);        
    }
    
    
    var buffer = "";
    // parse stats
    cmd.on('data', function(results) {
         results.split(';').forEach(function(data) {
           if (data == undefined) {
              return;
           } 
           var success = true;
           try {
             var obj = JSON.parse(buffer + data);
           } catch(e) {
             success = false;
             buffer += data;
           }
           if(success) {
             buffer = "";
             callback(obj); 
           }
        });        
    });

    cmd.on('end', function() {
         
    });

    cmd.on('error', function(error) {
      console.log("error while annotating vcf records " + error);        
    });


    cmd.run();
    
  }

  exports._getRemoteStats = function(refs, options, callback) {      
    var me = this;

    me._getRegions(refs, options);

    // This is the tabix url.  Here we send the regions as arguments.  tabix
    // output (vcf header+records for the regions) will be piped
    // to the vcfstatsalive server.
    var regionStr = "";
    regions.forEach(function(region) { 
      regionStr += " " + region.name + ":" + region.start + "-" + region.end 
    });

    var cmd = null;
    if (samples && samples.length > 0) {
      cmd = new iobio.cmd(tabix, ['-h', vcfURL, regionStr])
                        .pipe(vt, ["subset", "-s", samples.join(",")])
                        .pipe( vcfstatsAlive, ['-u', '1000'] );
    } else {
      cmd = new iobio.cmd(tabix, ['-h', vcfURL, regionStr])
                        .pipe( vcfstatsAlive, ['-u', '1000'] );
    }
    

    // Run like normal
    cmd.run(); 

    var buffer = "";
    // Use Results
    cmd.on('data', function(results) {
         results.split(';').forEach(function(data) {
           if (data == undefined) {
              return;
           } 
           var success = true;
           try {
             var obj = JSON.parse(buffer + data);
           } catch(e) {
             success = false;
             buffer += data;
           }
           if(success) {
             buffer = "";
             callback(obj); 
           }
        });        
    });

    cmd.on('end', function() {
         
    });

    cmd.on('error', function(error) {
      console.log("error while annotating vcf records " + error);        
    });

   
  }; 


    // NEW
  exports.getSampleNames = function(callback) {
    if (sourceType == SOURCE_TYPE_URL) {
      this._getRemoteSampleNames(callback);
    } else {
      this._getLocalSampleNames(callback);
    }
  }
 
  // NEW
  exports._getLocalSampleNames = function(callback) {
    var me = this;

    var vcfReader = new readBinaryVCF(tabixFile, vcfFile, function(tbiR) {
      var sampleNames = [];
      sampleNames.length = 0;

      var headerRecords = [];
      vcfReader.getHeader( function(header) {
         headerRecords = header.split("\n");
         headerRecords.forEach(function(headerRec) {
            if (headerRec.indexOf("#CHROM") == 0) {
              var headerFields = headerRec.split("\t");
              sampleNames = headerFields.slice(9);
              callback(sampleNames);
            }
         });

      });
   });
    
    

  }

  // NEW
  exports._getRemoteSampleNames = function(callback) {
    var me = this;
    
    var cmd = new iobio.cmd(
        tabix,
        ['-h', vcfURL, '1:1-1']);



    cmd.http();


    var headerData = "";
    // Use Results
    cmd.on('data', function(data) {
         if (data == undefined) {
            return;
         } 
         headerData += data;
    });

    cmd.on('end', function(data) {
        var headerRecords = headerData.split("\n");
         headerRecords.forEach(function(headerRec) {
              if (headerRec.indexOf("#CHROM") == 0) {
                var headerFields = headerRec.split("\t");
                var sampleNames = headerFields.slice(9);
                callback(sampleNames);
              }
         });

    });

    cmd.on('error', function(error) {
      console.log(error);
    });
    
    cmd.run(); 

  }

 

  exports._getRegions = function(refs, options) {

    regionIndex = 0;
    regions.length = 0;


    var bedRegions;
    for (var j=0; j < refs.length; j++) {
      var ref      = refData[refs[j]];
      var start    = options.start ? options.start : 0;
      var end      = options.end ? options.end : ref.refLength;
      var length   = end - start;
      var sparsePointData = ref.sparsePointData;

      if ( length < options.binSize * options.binNumber) {
        regions.push({
          'name' : ref.name,
          'start': start,
          'end'  : end    
        });
      } else {
         // If this is sparse data, seed with known regions first
         if (sparsePointData != null && sparsePointData.length > 0) {
          sparsePointData.forEach( function(point) {
            regions.push( {
              'name' : ref.name,
              'start' : point.pos,
              'end' : point.pos + options.binSize 
            })
          })
         }
         // create random reference coordinates
         for (var i=0; i < options.binNumber; i++) {   
            var s = start + parseInt(Math.random()*length); 
            regions.push( {
               'name' : ref.name,
               'start' : s,
               'end' : s + options.binSize
            }); 
         }
         // sort by start value
         regions = regions.sort(function(a,b) {
            var x = a.start; var y = b.start;
            return ((x < y) ? -1 : ((x > y) ? 1 : 0));
         });               
         
         // intelligently determine exome bed coordinates
         /*
         if (options.exomeSampling)
            options.bed = me._generateExomeBed(options.sequenceNames[0]);
         
         // map random region coordinates to bed coordinates
         if (options.bed != undefined)
            bedRegions = me._mapToBedCoordinates(SQs[0].name, regions, options.bed)
          */
      }
    } 
    return regions;     

  }

  /*
  *
  *  Stream the vcf.iobio snapshot (html) to the emailServer which
  *  will email a description of the problem along with an html file attachment
  *  that is the snapshop of vcfiobio.
  */
  exports.sendEmail = function(screenContents, email, note) {
    var client = BinaryClient(emailServer);
    // Strip of the #modal-report-problem from the URL
    var theURL = location.href;
    if (theURL.indexOf("#modal-report-problem") > -1){
      theURL = theURL.substr(0, theURL.indexOf("#modal-report-problem"));
    }

    // Format the body of the email
    var htmlBody = '<span style="padding-right: 4px">Reported by:</span>' + email  + "<br><br>" + 
                   '<span style="padding-right: 51px">URL:</span>'         + theURL + "<br><br>" + 
                   note + '<br><br>';

    client.on('open', function(stream){
      var stream = client.createStream(
      {
        'from':     email, 
        'to':       'vcfiobio@googlegroups.com',
        'subject':  'vcf.iobio.io Issue',
        'filename': 'vcfiobio_snapshot.html',
        'body':     htmlBody
      });
      stream.write(screenContents);
      stream.end();
    });
  }


  exports.jsonToArray = function(_obj, keyAttr, valueAttr) {
    var theArray = [];
    for (prop in _obj) {
      var o = new Object();
      o[keyAttr] = prop;
      o[valueAttr] = _obj[prop];
      theArray.push(o);
    }
    return theArray;
  };

  exports.jsonToValueArray = function(_obj) {
    var theArray = [];
    for (var key in _obj) {
      theArray.push(_obj[key]);
    }
    return theArray;
  };

  exports.jsonToArray2D = function(_obj) {
    var theArray = [];
    for (prop in _obj) {
      var row = [];
      row[0] =  +prop;
      row[1] =  +_obj[prop];
      theArray.push(row);
    }
    return theArray;
  };


  exports.reducePoints = function(data, factor, xvalue, yvalue) {
    if (factor <= 1 ) {
      return data;
    }
    var i, j, results = [], sum = 0, length = data.length, avgWindow;

    if (!factor || factor <= 0) {
      factor = 1;
    }

    // Create a sliding window of averages
    for(i = 0; i < length; i+= factor) {
      // Slice from i to factor
      avgWindow = data.slice(i, i+factor);
      for (j = 0; j < avgWindow.length; j++) {
          var y = yvalue(avgWindow[j]);
          sum += y != null ? d3.round(y) : 0;
      }
      results.push([xvalue(data[i]), sum])
      sum = 0;
    }
    return results;
  };


  //
  //
  //
  //  PRIVATE 
  //
  //
  //

  exports._makeid = function(){
    // make unique string id;
     var text = "";
     var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

     for( var i=0; i < 5; i++ )
         text += possible.charAt(Math.floor(Math.random() * possible.length));

     return text;
  };

  exports._performRDP = function(data, epsilon, pos, depth) {
    var smoothedData = properRDP(data, epsilon);
    return smoothedData;
  }

  exports._applyCeiling = function(someArray) {  
    if (someArray.length < 5) {
      return someArray;
    }

    // Copy the values, rather than operating on references to existing values
    var values = someArray.concat();

    // Then sort
    values.sort( function(a, b) {
            return a[1] - b[1];
         });

    /* Then find a generous IQR. This is generous because if (values.length / 4) 
     * is not an int, then really you should average the two elements on either 
     * side to find q1.
     */     
    var q1 = values[Math.floor((values.length / 4))][1];
    // Likewise for q3. 
    var q3 = values[Math.ceil((values.length * (3 / 4)))][1];
    var iqr = q3 - q1;
    var newValues = [];
    if (q3 != q1) {
      // Then find min and max values
      var maxValue = d3.round(q3 + iqr*1.5);
      var minValue = d3.round(q1 - iqr*1.5);

      // Then filter anything beyond or beneath these values.
      var changeCount = 0;
      values.forEach(function(x) {
          var value = x[1];
          if (x[1] > maxValue) {
            value = maxValue;
            changeCount++;
          }
          newValues.push([x[0], value]);
      });
    } else {
      newValues = values;
    }

    newValues.sort( function(a, b) {
      return a[0] - b[0];
    });

    // Then return
    return newValues;
  }


  // Allow on() method to be invoked on this class
  // to handle data events
  d3.rebind(exports, dispatch, 'on');

  // Return this scope so that all subsequent calls
  // will be made on this scope.
  return exports;
};
