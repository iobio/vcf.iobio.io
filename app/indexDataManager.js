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

    callback();

  } 


  exports.loadIndex = function(callback) {
 
    var vcfR = new readBinaryVCF(tabixFile, vcfFile, function(tbiR) {
      var tbiIdx = tbiR;
      refDensity.length = 0;

      for (var i = 0; i < tbiIdx.tabixContent.head.n_ref; i++) {
        var ref   = tbiIdx.tabixContent.head.names[i];
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
            var point = {"pos": position, "depth": depth};
            points.push(point);
          }
        }

        // Load the reference density data.  Exclude reference if 0 points.
        if (points.length > 0) {
          var lastPoint = points[points.length - 1];
          if (lastPoint.pos > 0) {
            refDensity[ref] = {"idx": i, "points": points, "lastPos": lastPoint.pos};
            refData.push( {"name": ref, "value": lastPoint.pos, "idx": i});
          }
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


  exports.getEstimatedDensity = function(ref) {
    return refDensity[ref].points;
  }


  d3.rebind(exports, dispatch, 'on');

  return exports;
};
