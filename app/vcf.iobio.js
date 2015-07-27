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

  //var vcfstatsAliveServer    = "ws://localhost:7070";
  //var tabixServer            = "ws://localhost:7090";
  //var vcfReadDeptherServer   = "ws://localhost:7062";
  //var emailServer            = "ws://localhost:7068";
  //var catInputServer         = "ws://localhost:7063";

  var vcfstatsAliveServer    = "wss://vcfstatsalive.iobio.io";
  var tabixServer            = "wss://tabix.iobio.io";
  var vcfReadDeptherServer   = "wss://vcfreaddepther.iobio.io";
  var emailServer            = "ws://localhost:7068";
  var catInputServer         = "ws://localhost:7063";

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



  exports.openVcfUrl = function(url) {
    sourceType = SOURCE_TYPE_URL;
    vcfURL = url;
  }

  exports.openVcfFile = function(event, callback) {
    sourceType = SOURCE_TYPE_FILE;
                
    if (event.target.files.length != 2) {
       alert('must select 2 files, both a .vcf.gz and .vcf.gz.tbi file');
       return;
    }

    if (endsWith(event.target.files[0].name, ".vcf") ||
        endsWith(event.target.files[1].name, ".vcf")) {
      showFileFormatMessage();
      return;
    }

    var fileType0 = /([^.]*)\.(vcf\.gz(\.tbi)?)$/.exec(event.target.files[0].name);
    var fileType1 = /([^.]*)\.(vcf\.gz(\.tbi)?)$/.exec(event.target.files[1].name);

    if (fileType0 == null || fileType0.length < 3 || fileType1 == 0 || fileType1.length <  3) {
      alert('You must select BOTH  a compressed vcf file (.vcf.gz) and an index (.tbi)  file');
      return;
    }

    fileExt0 = fileType0[2];
    fileExt1 = fileType1[2];

    if (fileExt0 == 'vcf.gz' && fileExt1 == 'vcf.gz.tbi') {
      vcfFile   = event.target.files[0];
      tabixFile = event.target.files[1];
    } else if (fileExt1 == 'vcf.gz' && fileExt0 == 'vcf.gz.tbi') {
      vcfFile   = event.target.files[1];
      tabixFile = event.target.files[0];
    } else {

      showFileFormatMessage();
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
            window.location = 'help.html';
        }
     });
  }
  
  function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
  }

  exports.loadIndex = function(callback) {
 
    vcfReader = new readBinaryVCF(tabixFile, vcfFile, function(tbiR) {
      var tbiIdx = tbiR;
      refDensity.length = 0;

      for (var i = 0; i < tbiIdx.idxContent.head.n_ref; i++) {
        var ref   = tbiIdx.idxContent.head.names[i];

        var indexseq = tbiIdx.idxContent.indexseq[i];
        var refLength = indexseq.n_intv * size16kb;

        // Use the linear index to load the estimated density data
        var intervalPoints = [];
        for (var x = 0; x < indexseq.n_intv; x++) {
          var interval = indexseq.intervseq[x];
          var fileOffset = interval.valueOf();
          var fileOffsetPrev = x > 0 ? indexseq.intervseq[x - 1].valueOf() : 0;
          var intervalPos = x * size16kb;
          intervalPoints.push( [intervalPos, fileOffset - fileOffsetPrev] );
          
        }

        // Load the reference density data.  Exclude reference if 0 points.
        refDensity[ref] = {"idx": i, "intervalPoints": intervalPoints, };
        refData.push( {"name": ref, "value": refLength, "refLength": refLength, "idx": i});


      }

      // Call function from js-bv-sampling to obtain point data.
      estimateCoverageDepth(tbiIdx, function(estimates) {

      for (var i = 0; i < tbiIdx.idxContent.head.n_ref; i++) {

          
          var refName   = tbiIdx.idxContent.head.names[i];
          var pointData = estimates[i];

          // Sort by position of read; otherwise, we get a wonky
          // line chart for read depth.  (When a URL is provided,
          // bamtools returns a sorted array.  We need this same
          // behavior when the BAM file is loaded from a file
          // on the client.
          pointData = pointData.sort(function(a,b) {
              var x = +a.pos; 
              var y = +b.pos;
              return ((x < y) ? -1 : ((x > y) ? 1 : 0));
          });  

          // Zero fill any 16kb points not in array
          var zeroPointData = [];
          for (var x = 1; x < pointData.length - 1; x++) {
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
          if (zeroPointData.length > 0) {
            pointData = pointData.concat(zeroPointData);
            pointData = pointData.sort(function(a,b) {
              var x = +a.pos; 
              var y = +b.pos;
              return ((x < y) ? -1 : ((x > y) ? 1 : 0));
            });  

          }

          var refLength = pointData[pointData.length - 1].pos + size16kb;

          //refData.push({"name": refName, "value": +refLength, "refLength": +refLength, "idx": + i});
          refObject = refDensity[refName];
          refObject.points = [];
          
          for (var x = 0; x < pointData.length; x++) {
            var point = [pointData[x].pos, pointData[x].depth];
            refObject.points.push(point);
          }
        }

      });


      callback.call(this, refData);

    });
  }


  exports.loadRemoteIndex = function(theVcfUrl, callback) {
    vcfURL = theVcfUrl;
    sourceType = SOURCE_TYPE_URL;

    var client = BinaryClient(vcfReadDeptherServer);
    var url = encodeURI( vcfReadDeptherServer + '?cmd=-i ' + vcfURL + ".tbi");

    client.on('open', function(stream){
      var stream = client.createStream({event:'run', params : {'url':url}});
      var currentSequence;
      var refName;
      stream.on('data', function(data, options) {
         data = data.split("\n");
         for (var i=0; i < data.length; i++)  {
            if ( data[i][0] == '#' ) {
               
               var tokens = data[i].substr(1).split("\t");
               refIndex = tokens[0];
               refName = tokens[1];
               var refLength = tokens[2];

               
               refData.push({"name": refName, "value": +refLength, "refLength": +refLength, "idx": +refIndex});
               refDensity[refName] =  {"idx": refIndex, "points": [], "intervalPoints": []};
            }
            else {
               if (data[i] != "") {
                  var d = data[i].split("\t");
                  var point = [ parseInt(d[0]), parseInt(d[1]) ];
                  refDensity[refName].points.push(point);
                  refDensity[refName].intervalPoints.push(point);

               }
            }                  
         }
      });

      stream.on("error", function(error) {

      });

      stream.on('end', function() {
         callback.call(this, refData);
      });
    });

  };


  exports.getReferences = function(minLengthPercent, maxLengthPercent) {
    var references = [];
    
    // Calculate the total length
    var totalLength = +0;
    for (var i = 0; i < refData.length; i++) {
      var refObject = refData[i];
      totalLength += refObject.value;
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
    var points = useLinearIndex ? refDensity[ref].intervalPoints.concat() : refDensity[ref].points.concat();

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

    return points;
  }

  exports.getGenomeEstimatedDensity = function(useLinearIndex, removeTheDataSpikes, maxPoints, rdpEpsilon) {
    var allPoints = [];
    var offset = 0;
    for (var i = 0; i < refData.length; i++) {

      var points = useLinearIndex ? refDensity[refData[i].name].intervalPoints.concat() : refDensity[refData[i].name].points.concat();

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

    // Reduce point data to to a reasonable number of points for display purposes
    if (maxPoints) {
      var factor = d3.round(allPoints.length / maxPoints);
      allPoints = this.reducePoints(allPoints, factor, function(d) { return d[0]; }, function(d) { return d[1]});
    }

    // Now perform RDP
    if (rdpEpsilon) {
      allPoints = this._performRDP(allPoints, rdpEpsilon, function(d) { return d[0] }, function(d) { return d[1] });
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
  exports._getLocalStats = function(refs, options, callback) {      
    this._getRegions(refs, options);
    
    this._streamVcf(vcfstatsAliveServer, callback);

    if (debug) {
      this._streamVcf(catInputServer);
    }
     
  };  

  exports._streamVcf = function(server, callback) {
    var client = BinaryClient(server);
    var url = encodeURI( server + "?protocol=websocket&cmd=" + encodeURIComponent("http://client"));

    var buffer = "";
    client.on('open', function(){
      var stream = client.createStream({event:'run', params : {'url':url + '&debug=true'}});

      // New local file streaming
      stream.on('createClientConnection', function(connection) {
        console.log('got create client request');
        var ended = 0;
        var dataClient = BinaryClient('ws://' + connection.serverAddress);
        dataClient.on('open', function() {
          var dataStream = dataClient.createStream({event:'clientConnected', 'connectionID' : connection.id});

          var onGetRecords = function(records) {
            var me = this;
            if (regionIndex == regions.length) {
              // The executing code should never get there as we should exit the recursion in onGetRecords.
            } else {

              // Stream the vcf records we just parsed for a region in the vcf, one records at a time
              if (records) {
                for (var r = 0; r < records.length; r++) {              
                  dataStream.write(records[r] + "\n");
                }
              } else {
                // This is an error condition.  If vcfRecords can't return any
                // records, we will hit this point in the code.
                // Just log it for now and move on to the next region.
                console.log("WARNING:  unable to create vcf records for region  " + regionIndex);
              }

              regionIndex++;

              if (regionIndex > regions.length) {
                return;
              } else if (regionIndex == regions.length) {
                // We have streamed all of the regions so now we will end the stream.
                dataStream.end();
                return;
              } else {
                // There are more regions to obtain vcf records for, so call getVcfRecords now
                // that regionIndex has been incremented.
                vcfReader.getRecords(regions[regionIndex].name, 
                  regions[regionIndex].start, 
                  regions[regionIndex].end, 
                  onGetRecords);
              }      

            }
          }

          //vcfReader.getHeaderRecords( function(headerRecords) {
          //  for (h = 0; h < headerRecords.length; h++) {
          //    stream.write(headerRecords[h] + "\n");
          //  }
          //});
          vcfReader.getHeader( function(header) {
             dataStream.write(header + "\n");
          });


          // Now we recursively call vcfReader.getRecords (by way of callback function onGetRecords)
          // so that we parse vcf records one region at a time, streaming the vcf records
          // to the server.
          vcfReader.getRecords(
              regions[regionIndex].name, 
              regions[regionIndex].start, 
              regions[regionIndex].end, 
              onGetRecords);

        )};
      });

      
      //
      // listen for stream data (the output) event. 
      //
      stream.on('data', function(data, options) {
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
           if (callback) {
             callback(obj); 
           }
         }               
      });
      
    });
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
    var tabixUrl = tabixServer + "?cmd=-h " + vcfURL + regionStr + "&encoding=binary";

    // This is the full url for vcfstatsalive server which is piped its input from tabixserver
    var url = encodeURI( vcfstatsAliveServer + '?cmd=-u 1000 ' + encodeURIComponent(tabixUrl));

    // Connect to the vcfstatsaliveserver    
    var client = BinaryClient(vcfstatsAliveServer);

    var buffer = "";
    client.on('open', function(stream){

        // Run the command
        var stream = client.createStream({event:'run', params : {'url':url}});

       // Listen for data to be streamed back to the client
        stream.on('data', function(data, options) {
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
        stream.on('end', function() {
           if (options.onEnd != undefined)
              options.onEnd();
        });
     });
     
  };  


 

  exports._getRegions = function(refs, options) {

    regionIndex = 0;
    regions.length = 0;


    var bedRegions;
    for (var j=0; j < refs.length; j++) {
      var ref      = refData[refs[j]];
      var start    = options.start;
      var end      = options.end ? options.end : ref.refLength;
      var length   = end - start;
      if ( length < options.binSize * options.binNumber) {
        regions.push({
          'name' : ref.name,
          'start': start,
          'end'  : end    
        });
      } else {
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
