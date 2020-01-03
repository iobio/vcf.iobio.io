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
//  to obtain the metrics data.  When the files are accessed locally, the data is first stream through
//  our fibridge local file proxy server, which mamkes it accessible as a URL which the normal backend
//  can access.
//
//  The follow example code illustrates the method calls to make
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
vcfiobio = function module() {

  // iobioServer is a global defined in app/app.js
  var backendPath = iobioServer;
  var apiClient = new iobioApiClient.Client(backendPath, { secure: true });
  //var apiClient = new iobioApiClient.Client('localhost:9001', { secure: false });

  var debug =  false;

  var exports = {};

  var dispatch = d3.dispatch( 'dataReady', 'dataLoading');

  var SOURCE_TYPE_URL = "URL";
  var SOURCE_TYPE_FILE = "file";
  var sourceType = "url";

  var samples = [];


  var emailServer            = "ws://" + iobioServer + "email/";

  var vcfstatsAlive          = iobioServer + "vcfstatsalive/";
  var tabix                  = iobioServer + "od_tabix/";
  var vt                     = iobioServer + "vt/";
  var bcftools               = iobioServer + "bcftools/";

  var vcfURL;
  var tbiURL;
  var vcfReader;
  var vcfFile;
  var tabixFile;
  var refData = [];
  var refDensity = [];
  var refName = "";
  var ssl = true;

  var regions = [];
  var regionIndex = 0;
  var stream = null;

  var errorMessageMap =  {
    "tabix Could not load .tbi": {
        regExp: /tabix\sError:\s.*:\sstderr\s-\sCould not load .tbi.*/,
        message:  "Unable to load the index (.tbi) file, which has to exist in same directory and be given the same name as the .vcf.gz with the file extension of .vcf.gz.tbi.  "
    },
     "tabix [E::hts_open]": {
        regExp:  /tabix\sError:\s.*:\sstderr\s-\s\[E::hts_open\]\sfail\sto\sopen\sfile/,
        message: "Unable to access the file.  "
     },
     "tabix [E::hts_open_format]": {
        regExp:  /tabix\sError:\s.*:\sstderr\s-\s\[E::hts_open_format\]\sfail\sto\sopen\sfile/,
        message: "Unable to access the file. "
     }
  }

  var ignoreMessages =  [
    /tabix\sError:\s.*:\sstderr\s-\s\[M::test_and_fetch\]\sdownloading\sfile\s.*/,
    /tabix\sError:\s.*:\sstderr\s-\s.*to local directory/
  ];





  exports.openVcfUrl = function(url, theTbiUrl, callback) {
    var me = this;
    sourceType = SOURCE_TYPE_URL;
    me.vcfURL = url;
    me.tbiURL = theTbiUrl;


    this.checkVcfUrl(me.vcfURL, me.tbiURL, function(success, message) {
        callback(success, message);
    });

  }


  exports.getVcfUrl = function() {
    return this.vcfURL;
  }

  exports.getVcfFileSize = function() {
    return this.vcfFileSize;
  }

  exports.getTbiURL = function() {
    var me = this;
    return me.tbiURL ? me.tbiURL : "";
  }

  exports.checkVcfUrl = function(url, theTbiUrl, callback) {
    var me = this;
    var success = null;
    var buffer = "";
    var recordCount = 0;

    var cmd = apiClient.streamCommand('variantHeader', {
      url,
      indexUrl: theTbiUrl,
    });

    cmd.on('data', function(data) {
      if (data != undefined) {
        success = true;
        buffer += data;
      }
    });

    cmd.on('end', function() {
      if (success == null) {
        success = true;
      }
      if (success && buffer.length > 0) {
        callback(success);
      }
    });

    cmd.on('error', function(error) {
      if (me.ignoreErrorMessage(error)) {
      } else {
        if (success == null) {
          success = false;
          console.log(error);
          callback(success, me.translateErrorMessage(error));
        }
      }

    });

    cmd.run();
  }

  exports.ignoreErrorMessage = function(error) {
    var me = this;
    var ignore = false;
    ignoreMessages.forEach( function(regExp) {
      if (error.match(regExp)) {
        ignore = true;
      }
    });
    return ignore;

  }

  exports.translateErrorMessage = function(error) {
    var me = this;
    var message = null;
    for (key in errorMessageMap) {
      var errMsg = errorMessageMap[key];
      if (message == null && error.match(errMsg.regExp)) {
        message = errMsg.message;
      }
    }
    return message ? message : error;
  }

  exports.openVcfFile = function(event, callback, errorCallback) {
    // No longer SOURCE_TYPE_FILE because we're using the local file proxy now.
    //sourceType = SOURCE_TYPE_FILE;
    sourceType = SOURCE_TYPE_URL;

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

    // host the files on the local file proxy (fibridge)
    var proxyAddress = 'lf-proxy.iobio.io';
    var port = 443;
    var secure = true;
    var protocol = 'https:';

    fibridge.createHoster({ proxyAddress, port, secure }).then((hoster) => {
      var vcfPath = '/' + vcfFile.name;
      hoster.hostFile({ path: vcfPath, file: vcfFile });
      var tabixPath = '/' + tabixFile.name;
      hoster.hostFile({ path: tabixPath, file: tabixFile });

      var portStr = hoster.getPortStr();
      var baseUrl = `${protocol}//${proxyAddress}${portStr}`;
      this.vcfURL = `${baseUrl}${hoster.getHostedPath(vcfPath)}`;
      this.tbiURL = `${baseUrl}${hoster.getHostedPath(tabixPath)}`;

      callback(this.vcfURL, this.tbiURL);
    });
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

  exports.stripChr = function(ref) {
    if (ref.indexOf("chr") == 0) {
      return ref.split("chr")[1];
    } else {
      return ref;
    }
  }

  exports.loadRemoteIndex = function(theVcfUrl, theTbiUrl, callbackData, callbackEnd) {
    var me = this;
    me.vcfURL = theVcfUrl;
    me.tbiURL = theTbiUrl;
    sourceType = SOURCE_TYPE_URL;
    var me = this;
    var buffer = "";
    var refName;

    var url;
    if (me.tbiURL) {
      url = me.tbiURL;
    } else {
      url = me.vcfURL + '.tbi';
    }

    var cmd = apiClient.streamCommand('vcfReadDepth', {
      url,
    });

    cmd = new LineReader(cmd);

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
              var refLength = genomeBuildHelper.getReferenceLength(refName);
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

  exports.getHeader = function(callback) {
    var me = this;
    var headerStr = "";
    if (me.vcfURL != null) {

        var buffer = "";

        var cmd = apiClient.streamCommand('variantHeader', {
          url: me.vcfURL,
          indexUrl: me.tbiURL,
        });

        cmd.on('data', function(data) {
          if (data != undefined) {
            success = true;
            buffer += data;
          }
        });

        cmd.on('end', function() {
          if (success == null) {
            success = true;
          }
          if (success && buffer.length > 0) {
            headerStr = buffer;
            callback(headerStr);
          }
        });
        cmd.run();

      }
      else {
        callback(null);
      }

  }

  exports.promiseGetRefLengthsFromHeader = function() {
    var me = this;
    return new Promise(function(resolve, reject) {
      var refMap = {};
      me.getHeader(function(header) {
        header.split("\n").forEach(function(headerRec) {
          if (headerRec.indexOf("##contig=<") == 0) {
            var allFields = headerRec.split("##contig=<")[1];

            var fields = allFields.split(/[,>]/);
            var refName = null;
            var refLength = null;
            fields.forEach(function(field) {
              if (field.indexOf("ID=") == 0) {
                refName = field.split("ID=")[1];
              }
              if (field.indexOf("length=") == 0) {
                refLength = field.split("length=")[1];
              }

            })
            if (refName && refLength) {
              refMap[refName] = +refLength;
            }
          }
        })
        resolve(refMap);
      })

    })
  }


  exports.getStats = function(refs, options, callback) {
    this._getRemoteStats(refs, options, callback);
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

    var refNames = [];

    var contigStr = "";
    for (var j=0; j < refs.length; j++) {
      var ref      = refData[refs[j]];
      contigStr += "##contig=<ID=" + ref.name + ">\n";
      refNames.push(ref.name);
    }
    var contigNameFile = new Blob([contigStr])

    var cmd = null;

    var tabixArgs = ['-h', '"'+me.vcfURL+'"', regionStr];
    if (me.tbiURL) {
       tabixArgs.push('"'+me.tbiURL+'"');
    }

    if (samples && samples.length > 0) {
      var sampleNameFile = new Blob([samples.join("\n")]);

      cmd = apiClient.streamCommand('vcfStatsStream', {
        url: me.vcfURL,
        indexUrl: me.tbiURL,
        regions,
        refNames,
        sampleNames: samples,
      });
    } else {

      cmd = apiClient.streamCommand('vcfStatsStream', {
        url: me.vcfURL,
        indexUrl: me.tbiURL,
        regions,
        refNames,
      });
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
    this._getRemoteSampleNames(callback);
  }

  // NEW
  exports._getRemoteSampleNames = function(callback) {
    var me = this;

    var cmd = apiClient.streamCommand('variantHeader', {
      url: me.vcfURL,
      indexUrl: me.tbiURL,
    });

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
    var me = this;
    var allRegions = [];


    var bedRegions;
    for (var j=0; j < refs.length; j++) {
      var ref      = refData[refs[j]];
      var start    = options.start ? options.start : 0;
      var end      = options.end ? options.end : ref.refLength;
      var length   = end - start;
      var sparsePointData = ref.sparsePointData;

      if ( options.fullAnalysis || length < options.binSize * options.binNumber) {
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
            if (a.name == b.name)
              return ((a.start < b.start) ? -1 : ((a.start > b.start) ? 1 : 0));
            else
              return ((a.name < b.name) ? -1 : ((a.name > b.name) ? 1 : 0));
         });
      }
    }
    // map random region coordinates to bed coordinates
    if (window.bed != undefined) {
      if (refs.length == 1)
        var bedArray = this._bedToArray(bed, refData[refs[0]].name, {name:ref.name, 'start':start, 'end':end});
      else
        var bedArray = this._bedToArray(bed, refData[refs[0]].name);
      regions = me._bedGetRegions(bedArray, options.binNumber * refs.length, options);
    }
      // regions = me._mapToBedCoordinates(regions, window.bed)

    // sort by start value
    regions = regions.sort(function(a,b) {
      if (a.name == b.name)
        return ((a.start < b.start) ? -1 : ((a.start > b.start) ? 1 : 0));
      else
        return ((a.name < b.name) ? -1 : ((a.name > b.name) ? 1 : 0));
    });
    return regions;

  }


  /*
   * Grab random regions but only from bed coordinates
   */
  exports._bedGetRegions = function(bedArray, binNumber, options) {
    var totalLength = 0;
    var regions = [];

    if (bedArray.length == 0) {
      return [{name:'somethingnotthere', start:1, end:10}]
    }


    for (var i=0; i < binNumber; i++) {
        var s = parseInt(Math.random()*(bedArray.length-1));
        var region = bedArray[s];
        var ref = region.name;
        var spaceLeft = options.binSize;
        var newRegion = { 'name':region.name, 'start':region.start}

        while(spaceLeft > 0) {
          if(region && region.name == ref) {
            var end = Math.min(region.start + options.binSize, region.end)
            newRegion.end = end;
            spaceLeft -= (end - region.start);
            s+= 1;
            region = bedArray[s];
          } else {
            break;
          }
        }
        regions.push(newRegion);
     }

    return regions
  }

   /*
   * Convert bed file to coordinate array
   */
   exports._bedToArray = function(bed, ref, region) {
      var me = this;
      var a = [];
      bed.split("\n").forEach(function(line){
        if (line[0] == '#' || line == "") return;

        var fields = line.split("\t");
        var start = parseInt(fields[1]);
        var end = parseInt(fields[2]);
        var currRef = me._getCurrRef(fields[0], ref);
        if(!region)
          a.push({ name:currRef, 'start':start, 'end':end });
        else if( me._referenceMatchesBed(region.name,fields[0]) &&
                ((start >= region.start && start < region.end) ||
                (end > region.start && end <= region.end))) {
          a.push({
                  name:currRef,
                  'start':Math.max(region.start,start),
                  'end':Math.min(region.end,end)
          });
        }
      });
      return a;
   }

   exports._getCurrRef = function(bedRef, fileRef) {
       var fileChr = (fileRef.slice(0,3).toLowerCase() == 'chr');
       var bedChr = (bedRef.slice(0,3).toLowerCase() == 'chr');

       if (fileChr && bedChr)
           return fileRef.slice(0,3) + bedRef.slice(3)
       else if (!fileChr && bedChr)
           return bedRef.slice(3);
       else if (fileChr && !bedChr)
           return fileRef.slice(0,3) + bedRef;
       else
           return bedRef;
   }

   /*
   * Compare bed reference to user selected reference both with and w/o chr prefix
   */
   exports._referenceMatchesBed = function(ref, bedRef) {
      if (ref == bedRef) {
        return true;
      }
      // Try stripping chr from reference names and then comparing
      ref1 = ref.replace(/^chr?/,'');
      bedRef1 = bedRef.replace(/^chr?/,'');

      return (ref1 == bedRef1);
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
        'to':       'iobio.arup@gmail.com',
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


function LineReader(cmd) {

  var remainder = "";
  var prev = "";

  cmd.on('data', (data) => {

    var lines = data.split('\n');

    if (remainder.length > 0) {
      lines[0] = remainder + lines[0];
      remainder = "";
    }

    if (!lines[lines.length - 1].endsWith('\n')) {
      remainder = lines.pop();
    }

    for (var line of lines) {
      prev = line;
      this.onData(line);
    }
  });

  cmd.on('end', () => {
    if (remainder.length > 0) {
      this.onData(remainder);
    }
    this.onEnd();
  });

  cmd.on('error', (e) => {
    this.onError(e);
  });

  this._cmd = cmd;
}

LineReader.prototype.run = function() {
  this._cmd.run();
};

LineReader.prototype.on = function(evt, callback) {
  switch (evt) {
    case 'data':
      this.onData = callback;
      break;
    case 'end':
      this.onEnd = callback;
      break;
    case 'error':
      this.onError = callback;
      break;
    default:
      throw new Error("LineReader: Invalid event", evt);
      break;
  }
};
