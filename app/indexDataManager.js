//Define our data manager module.
indexDataManager = function module() {

  var exports = {};
  var dispatch = d3.dispatch( 'dataReady', 'dataLoading');
  var vcfFile;
  var tabixFile;
  var size16kb = Math.pow(2, 14);
  var refData = [];
  var refDensity = [];

 exports.openVcfFile = function(event, callback) {
                
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
            refData.push( {"name": ref, "value": refLength, "idx": i});
        }


      }
      callback.call(this, refData);

    });
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
      if (lengthPercent >= minLengthPercent && lengthPercent < maxLengthPercent) {
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


  function performRDP(data, epsilon, pos, depth) {
    var smoothedData = properRDP(data, epsilon);
    console.log("rdp " + data.length + " reduced to " + smoothedData.length);
    return smoothedData;
  }

  function ceilingTopQuartile(someArray) {  

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

  function removeDataSpikes(data) {
      var q1 = quantile(data, 0.25); 
      var q3 = quantile(data, 0.75);
      var iqr = (q3-q1) * 1.5; //
      console.log("remove DataSpikes " + q1 + " " + q3 + " " + iqr);
      return data.filter(function(d) { 
        var keep = (d[1]>=(Math.max(q1-iqr,0)) && d[1]<=(q3+iqr));
        if (!keep) {
          //console.log("throwing out " + d[0] + " " + d[1]);
        }
        return keep;
      });
   }
    
   function quantile(arr, p) {
      var length = arr.reduce(function(previousValue, currentValue, index, array){
         return previousValue + currentValue[1];
      }, 0) - 1;
      var H = length * p + 1, 
      h = Math.floor(H);

      var hValue, hMinus1Value, currValue = 0;
      for (var i=0; i < arr.length; i++) {
         currValue += arr[i][1];
         if (hMinus1Value == undefined && currValue >= (h-1))
            hMinus1Value = arr[i][1];
         if (hValue == undefined && currValue >= h) {
            hValue = arr[i][1];
            break;
         }
      } 
      var v = +hMinus1Value, e = H - h;
      return e ? v + e * (hValue - v) : v;
   } 


  d3.rebind(exports, dispatch, 'on');

  return exports;
};
