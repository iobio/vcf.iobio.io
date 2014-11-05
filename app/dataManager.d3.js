//Define our data manager module.
dataManagerD3 = function module() {
  var exports = {},
    dispatch = d3.dispatch('dataReady', 'dataLoading'),
    data;

  /**
  * Create a method to load the csv file, and apply cleaning function asynchronously.
  */
  exports.loadCsvData = function(_file, _cleaningFunc) {

    //Create the csv request using d3.csv.
    var loadCsv = d3.csv(_file);

    //On the progress event, dispatch the custom dataLoading event.
    loadCsv.on('progress', function() { dispatch.dataLoading(d3.event.loaded);});

    loadCsv.get(function (_err, _response) {

      if (_cleaningFunc) {
        //Apply the cleaning function supplied in the _cleaningFunc parameter.
        _response.forEach(function (d) {
          _cleaningFunc(d);
        });

      }
      //Assign the cleaned response to our data variable.
      data = _response;
     
      //Dispatch our custom dataReady event passing in the cleaned data.
      dispatch.dataReady(_response);
    });
  };


  /**
  * Create a method to load the json file, and apply cleaning function asynchronously.
  */
  exports.loadJsonData = function(_file, _cleaningFunc) {

    // Create the json request using d3.json.
    var loadJson = d3.json(_file);


    loadJson.get( function(_error, _response) {
        if (_cleaningFunc) {
          //Apply the cleaning function supplied in the _cleaningFunc parameter.
          _response.forEach(function (d) {
            _cleaningFunc(d);
          });

        }
        //Assign the cleaned response to our data variable.
        data = _response;

        //Dispatch our custom dataReady event passing in the cleaned data.
        dispatch.dataReady(_response);
     });

  }


  /**
  * Create a method to load random data points
  */
  exports.loadRandomPointData = function(_maxPoints) {
    data = [];
    _pos = 1;
    count = 0;
    while(true) {
      if (count > 1000) {
        alert(_maxPoints);
        break;
      }
      if (_pos > _maxPoints) {
        break;
      }
      data.push( {"pos" : _pos, "depth" : _randomNumber(1,500000)})
      _pos = _pos + 500000;
      count++;
    }
    dispatch.dataReady(data);
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
  }

  exports.jsonToValueArray = function(_obj) {
    var theArray = [];
    for (var key in _obj) {
      theArray.push(_obj[key]);
    }
    return theArray;
  }

  exports.jsonToArray2D = function(_obj) {
    var theArray = [];
    for (prop in _obj) {
      var row = [];
      row[0] =  +prop;
      row[1] =  +_obj[prop];
      theArray.push(row);
    }
    return theArray;
  }

  function _randomNumber(minimum, maximum){
    return Math.floor( Math.random() * (maximum - minimum) + minimum);
  }    
  
  //Create a method to access the cleaned data.
  exports.getCleanedData = function () {
    return data;
  };

  
  d3.rebind(exports, dispatch, 'on');

  return exports;
};
