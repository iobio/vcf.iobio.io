//Define our data manager module.
vcfiobio = function module() {

  var exports = {};
  var dispatch = d3.dispatch( 'dataReady', 'dataLoading');
  var vcfFile;
  var tabixFile;
  var size16kb = Math.pow(2, 14);
  var refData = [];
  var refDensity = [];
  var refName = "";

  var vcfURL;

  var SOURCE_TYPE_URL = "URL";
  var SOURCE_TYPE_FILE = "file";

  var sourceType = "url";

  var vcfstatsAliveServer    = "ws://localhost:7070";
  var tabixServer            = "ws://localhost:7090";
  var tabixReadDeptherServer = "ws://localhost:7062";

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

    var fileType0 = /([^.]*)\.(vcf\.gz(\.tbi)?)$/.exec(event.target.files[0].name);
    var fileType1 = /([^.]*)\.(vcf\.gz(\.tbi)?)$/.exec(event.target.files[1].name);

    if (fileType0.length < 3 || fileType1.length <  3) {
      alter('must select both a .vcf.gz and .vcf.gz.tbi file');
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
      alert('must select both a .vcf.gz and .vcf.gz.tbi file');
    }

    callback(vcfFile);

  } 


  exports.loadIndex = function(callback) {
 
    var vcfR = new readBinaryVCF(tabixFile, vcfFile, function(tbiR) {
      var tbiIdx = tbiR;
      refDensity.length = 0;

      for (var i = 0; i < tbiIdx.tabixContent.head.n_ref; i++) {
        var ref   = tbiIdx.tabixContent.head.names[i];

        var indexseq = tbiIdx.tabixContent.indexseq[i];
        var refLength = indexseq.n_intv * size16kb;

        // Use the bins to load the density data
        var bhash = tbiIdx.bhash[i];
        var points = [];
        for (var bin in bhash) {
          if (bin >= start16kbBinid && bin <= end16kbBinid) {
            var ranges = tbiR.bin2Ranges(i, bin);
            var depth = 0;
            for (var r = 0; r < ranges.length; r++) {
              var range = ranges[r];
              depth += range[1] - range[0];
            }
            var position = (bin - start16kbBinid) * size16kb;
            var point = [position, depth];
            points.push(point);
          }
        }

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
        if (points.length > 0 ) {
            refDensity[ref] = {"idx": i, "points": points, "intervalPoints": intervalPoints};
            refData.push( {"name": ref, "value": refLength, "refLength": refLength, "idx": i});
        }


      }
      callback.call(this, refData);

    });
  }

  exports.loadRemoteIndex = function(theVcfUrl, callback) {
    vcfURL = theVcfUrl;
    sourceType = SOURCE_TYPE_URL;

    var client = BinaryClient(tabixReadDeptherServer);
    var url = encodeURI( tabixReadDeptherServer + '?cmd=-i ' + vcfURL + ".tbi");

    client.on('open', function(stream){
      var stream = client.createStream({event:'run', params : {'url':url}});
      var currentSequence;
      var refName;
      stream.on('data', function(data, options) {
         data = data.split("\n");
         for (var i=0; i < data.length; i++)  {
            if ( data[i][0] == '#' ) {
               
               var refIndex = data[i].substr(1);
               var tokens = data[i].split("\t");
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

      stream.on('end', function() {
         callback(this, refData);
      });
    });

  };

  
  exports.getRefData = function() {
    return refData;
  }


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
      var filteredPoints = ceilingTopQuartile(points);
      if (filteredPoints.length > 500) {
        points = filteredPoints;
      }
    } 


    // Reduce point data to to a reasonable number of points for display purposes
    if (maxPoints) {
      var factor = d3.round(points.length / 900);
      points = reducePoints(points, factor, function(d) { return d[0]; }, function(d) { return d[1]});
    }

    // Now perform RDP
    if (rdpEpsilon) {
      points = performRDP(points, rdpEpsilon, function(d) { return d[0] }, function(d) { return d[1] });
    }

    return points;
  }

  exports.getGenomeEstimatedDensity = function(removeTheDataSpikes, maxPoints, rdpEpsilon) {
    var allPoints = [];
    var offset = 0;
    for (var i = 0; i < refData.length; i++) {
      var points = refDensity[refData[i].name].points;
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
      allPoints = ceilingTopQuartile(allPoints);
    }

    // Reduce point data to to a reasonable number of points for display purposes
    if (maxPoints) {
      var factor = d3.round(allPoints.length / maxPoints);
      allPoints = reducePoints(allPoints, factor, function(d) { return d[0]; }, function(d) { return d[1]});
    }

    // Now perform RDP
    if (rdpEpsilon) {
      allPoints = performRDP(allPoints, rdpEpsilon, function(d) { return d[0] }, function(d) { return d[1] });
    }


    return allPoints;
  }

  exports.getStats = function(refs, options, callback) {      
     var regions = [];
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
            'end'  : length    
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
     
     var client = BinaryClient(vcfstatsAliveServer);
     var regStr = JSON.stringify(regions.map(function(d) { return {start:d.start,end:d.end,chr:d.name};}));  
     console.log(regStr); 
     var url = encodeURI( vcfstatsAliveServer + '?cmd=-u 3000 ' + encodeURIComponent(this._getVcfRegionsUrl(regions)));
     var buffer = "";
     client.on('open', function(stream){
        var stream = client.createStream({event:'run', params : {'url':url}});
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

  function reducePoints (data, factor, xvalue, yvalue) {
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





  exports._getVcfUrl = function(name, start, end) {
    return this._getVcfRegionsUrl([ {'name':name,'start':start,'end':end} ]);
  };

  exports._getVcfRegionsUrl = function(regions) {
    //if ( sourceType == "url") {
       var regionStr = "";
       regions.forEach(function(region) { 
          regionStr += " " + region.name + ":" + region.start + "-" + region.end 
       });
       var url = tabixServer + "?cmd=-h " + vcfURL + regionStr + "&encoding=binary";
    //} else {
       // creates a url for a new vcf that is sliced 
       // open connection to iobio webservice that will request this data, since connections can only be opened from browser
    //}
    return encodeURI(url);
  };



  function performRDP(data, epsilon, pos, depth) {
    var smoothedData = properRDP(data, epsilon);
    console.log("rdp " + data.length + " reduced to " + smoothedData.length);
    return smoothedData;
  }

  function ceilingTopQuartile(someArray) {  
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

    console.log("filter top quartile changes " + changeCount);
    // Then return
    return newValues;
}








  d3.rebind(exports, dispatch, 'on');

  return exports;
};
