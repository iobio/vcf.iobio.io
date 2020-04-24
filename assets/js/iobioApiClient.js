var iobioApiClient = (function (exports) {
  'use strict';

  // This code was originally adapted from
  const XHR_LOADING = 3;
  const XHR_DONE = 4;

  class Stream {
    constructor(xhr, body) {

      this._body = body;

      xhr.seenBytes = 0;

      xhr.onreadystatechange = () => { 
        switch (xhr.readyState) {
          //case XHR_HEADERS_RECEIVED:
          //  if (xhr.status !== 200) {
          //    this._onError(xhr.reponseText);
          //  }

          //  break;
          case XHR_LOADING:

            if (xhr.status === 200) {
              const newData = xhr.responseText.substr(xhr.seenBytes); 
              this._onData(newData);

              xhr.seenBytes = xhr.responseText.length; 
            }
            else {
              this._onError(xhr.responseText);
            }

            break;
          case XHR_DONE:

            if (xhr.status === 200) {
              const lastData = xhr.responseText.substr(xhr.seenBytes); 
              this._onData(lastData);
              this._onEnd();
            }
            else {
              this._onError(xhr.responseText);
            }

            break;
          default:
            //console.error("Unhandle XHR code: " + xhr.readyState);
            break;
        }
      };

      this._xhr = xhr;
      this._started = false;
    }

    onData(callback) {
      if (!this._started) {
        this._started = true;
        this.start();
      }

      this._onData = callback;
    }

    onEnd(callback) {
      this._onEnd = callback;
    }

    onError(callback) {
      this._onError = callback;
    }

    start() {
      if (this._body) {
        this._xhr.send(this._body);
      }
      else {
        this._xhr.send();
      }
    }

    cancel() {
      this._xhr.abort();
    }
  }


  function request(url, options) {
    let method = 'GET';

    let params;
    let contentType = "application/json;charset=UTF-8";

    if (options !== undefined) {
      method = options.method ? options.method : method;

      params = options.params;

      contentType = options.contentType ? options.contentType : contentType;
    }

    var xhr = new XMLHttpRequest();
    xhr.open(method, url);

    let body;
    if (params) {
      xhr.setRequestHeader("Content-Type", contentType);
      body = JSON.stringify(params);
    }
    
    return new Stream(xhr, body);
  }

  var domain;

  // This constructor is used to store event handlers. Instantiating this is
  // faster than explicitly calling `Object.create(null)` to get a "clean" empty
  // object (tested with v8 v4.9).
  function EventHandlers() {}
  EventHandlers.prototype = Object.create(null);

  function EventEmitter() {
    EventEmitter.init.call(this);
  }

  // nodejs oddity
  // require('events') === require('events').EventEmitter
  EventEmitter.EventEmitter = EventEmitter;

  EventEmitter.usingDomains = false;

  EventEmitter.prototype.domain = undefined;
  EventEmitter.prototype._events = undefined;
  EventEmitter.prototype._maxListeners = undefined;

  // By default EventEmitters will print a warning if more than 10 listeners are
  // added to it. This is a useful default which helps finding memory leaks.
  EventEmitter.defaultMaxListeners = 10;

  EventEmitter.init = function() {
    this.domain = null;
    if (EventEmitter.usingDomains) {
      // if there is an active domain, then attach to it.
      if (domain.active && !(this instanceof domain.Domain)) ;
    }

    if (!this._events || this._events === Object.getPrototypeOf(this)._events) {
      this._events = new EventHandlers();
      this._eventsCount = 0;
    }

    this._maxListeners = this._maxListeners || undefined;
  };

  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.
  EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
    if (typeof n !== 'number' || n < 0 || isNaN(n))
      throw new TypeError('"n" argument must be a positive number');
    this._maxListeners = n;
    return this;
  };

  function $getMaxListeners(that) {
    if (that._maxListeners === undefined)
      return EventEmitter.defaultMaxListeners;
    return that._maxListeners;
  }

  EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
    return $getMaxListeners(this);
  };

  // These standalone emit* functions are used to optimize calling of event
  // handlers for fast cases because emit() itself often has a variable number of
  // arguments and can be deoptimized because of that. These functions always have
  // the same number of arguments and thus do not get deoptimized, so the code
  // inside them can execute faster.
  function emitNone(handler, isFn, self) {
    if (isFn)
      handler.call(self);
    else {
      var len = handler.length;
      var listeners = arrayClone(handler, len);
      for (var i = 0; i < len; ++i)
        listeners[i].call(self);
    }
  }
  function emitOne(handler, isFn, self, arg1) {
    if (isFn)
      handler.call(self, arg1);
    else {
      var len = handler.length;
      var listeners = arrayClone(handler, len);
      for (var i = 0; i < len; ++i)
        listeners[i].call(self, arg1);
    }
  }
  function emitTwo(handler, isFn, self, arg1, arg2) {
    if (isFn)
      handler.call(self, arg1, arg2);
    else {
      var len = handler.length;
      var listeners = arrayClone(handler, len);
      for (var i = 0; i < len; ++i)
        listeners[i].call(self, arg1, arg2);
    }
  }
  function emitThree(handler, isFn, self, arg1, arg2, arg3) {
    if (isFn)
      handler.call(self, arg1, arg2, arg3);
    else {
      var len = handler.length;
      var listeners = arrayClone(handler, len);
      for (var i = 0; i < len; ++i)
        listeners[i].call(self, arg1, arg2, arg3);
    }
  }

  function emitMany(handler, isFn, self, args) {
    if (isFn)
      handler.apply(self, args);
    else {
      var len = handler.length;
      var listeners = arrayClone(handler, len);
      for (var i = 0; i < len; ++i)
        listeners[i].apply(self, args);
    }
  }

  EventEmitter.prototype.emit = function emit(type) {
    var er, handler, len, args, i, events, domain;
    var doError = (type === 'error');

    events = this._events;
    if (events)
      doError = (doError && events.error == null);
    else if (!doError)
      return false;

    domain = this.domain;

    // If there is no 'error' event listener then throw.
    if (doError) {
      er = arguments[1];
      if (domain) {
        if (!er)
          er = new Error('Uncaught, unspecified "error" event');
        er.domainEmitter = this;
        er.domain = domain;
        er.domainThrown = false;
        domain.emit('error', er);
      } else if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
      return false;
    }

    handler = events[type];

    if (!handler)
      return false;

    var isFn = typeof handler === 'function';
    len = arguments.length;
    switch (len) {
      // fast cases
      case 1:
        emitNone(handler, isFn, this);
        break;
      case 2:
        emitOne(handler, isFn, this, arguments[1]);
        break;
      case 3:
        emitTwo(handler, isFn, this, arguments[1], arguments[2]);
        break;
      case 4:
        emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
        break;
      // slower
      default:
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        emitMany(handler, isFn, this, args);
    }

    return true;
  };

  function _addListener(target, type, listener, prepend) {
    var m;
    var events;
    var existing;

    if (typeof listener !== 'function')
      throw new TypeError('"listener" argument must be a function');

    events = target._events;
    if (!events) {
      events = target._events = new EventHandlers();
      target._eventsCount = 0;
    } else {
      // To avoid recursion in the case that type === "newListener"! Before
      // adding it to the listeners, first emit "newListener".
      if (events.newListener) {
        target.emit('newListener', type,
                    listener.listener ? listener.listener : listener);

        // Re-assign `events` because a newListener handler could have caused the
        // this._events to be assigned to a new object
        events = target._events;
      }
      existing = events[type];
    }

    if (!existing) {
      // Optimize the case of one listener. Don't need the extra array object.
      existing = events[type] = listener;
      ++target._eventsCount;
    } else {
      if (typeof existing === 'function') {
        // Adding the second element, need to change to array.
        existing = events[type] = prepend ? [listener, existing] :
                                            [existing, listener];
      } else {
        // If we've already got an array, just append.
        if (prepend) {
          existing.unshift(listener);
        } else {
          existing.push(listener);
        }
      }

      // Check for listener leak
      if (!existing.warned) {
        m = $getMaxListeners(target);
        if (m && m > 0 && existing.length > m) {
          existing.warned = true;
          var w = new Error('Possible EventEmitter memory leak detected. ' +
                              existing.length + ' ' + type + ' listeners added. ' +
                              'Use emitter.setMaxListeners() to increase limit');
          w.name = 'MaxListenersExceededWarning';
          w.emitter = target;
          w.type = type;
          w.count = existing.length;
          emitWarning(w);
        }
      }
    }

    return target;
  }
  function emitWarning(e) {
    typeof console.warn === 'function' ? console.warn(e) : console.log(e);
  }
  EventEmitter.prototype.addListener = function addListener(type, listener) {
    return _addListener(this, type, listener, false);
  };

  EventEmitter.prototype.on = EventEmitter.prototype.addListener;

  EventEmitter.prototype.prependListener =
      function prependListener(type, listener) {
        return _addListener(this, type, listener, true);
      };

  function _onceWrap(target, type, listener) {
    var fired = false;
    function g() {
      target.removeListener(type, g);
      if (!fired) {
        fired = true;
        listener.apply(target, arguments);
      }
    }
    g.listener = listener;
    return g;
  }

  EventEmitter.prototype.once = function once(type, listener) {
    if (typeof listener !== 'function')
      throw new TypeError('"listener" argument must be a function');
    this.on(type, _onceWrap(this, type, listener));
    return this;
  };

  EventEmitter.prototype.prependOnceListener =
      function prependOnceListener(type, listener) {
        if (typeof listener !== 'function')
          throw new TypeError('"listener" argument must be a function');
        this.prependListener(type, _onceWrap(this, type, listener));
        return this;
      };

  // emits a 'removeListener' event iff the listener was removed
  EventEmitter.prototype.removeListener =
      function removeListener(type, listener) {
        var list, events, position, i, originalListener;

        if (typeof listener !== 'function')
          throw new TypeError('"listener" argument must be a function');

        events = this._events;
        if (!events)
          return this;

        list = events[type];
        if (!list)
          return this;

        if (list === listener || (list.listener && list.listener === listener)) {
          if (--this._eventsCount === 0)
            this._events = new EventHandlers();
          else {
            delete events[type];
            if (events.removeListener)
              this.emit('removeListener', type, list.listener || listener);
          }
        } else if (typeof list !== 'function') {
          position = -1;

          for (i = list.length; i-- > 0;) {
            if (list[i] === listener ||
                (list[i].listener && list[i].listener === listener)) {
              originalListener = list[i].listener;
              position = i;
              break;
            }
          }

          if (position < 0)
            return this;

          if (list.length === 1) {
            list[0] = undefined;
            if (--this._eventsCount === 0) {
              this._events = new EventHandlers();
              return this;
            } else {
              delete events[type];
            }
          } else {
            spliceOne(list, position);
          }

          if (events.removeListener)
            this.emit('removeListener', type, originalListener || listener);
        }

        return this;
      };

  EventEmitter.prototype.removeAllListeners =
      function removeAllListeners(type) {
        var listeners, events;

        events = this._events;
        if (!events)
          return this;

        // not listening for removeListener, no need to emit
        if (!events.removeListener) {
          if (arguments.length === 0) {
            this._events = new EventHandlers();
            this._eventsCount = 0;
          } else if (events[type]) {
            if (--this._eventsCount === 0)
              this._events = new EventHandlers();
            else
              delete events[type];
          }
          return this;
        }

        // emit removeListener for all listeners on all events
        if (arguments.length === 0) {
          var keys = Object.keys(events);
          for (var i = 0, key; i < keys.length; ++i) {
            key = keys[i];
            if (key === 'removeListener') continue;
            this.removeAllListeners(key);
          }
          this.removeAllListeners('removeListener');
          this._events = new EventHandlers();
          this._eventsCount = 0;
          return this;
        }

        listeners = events[type];

        if (typeof listeners === 'function') {
          this.removeListener(type, listeners);
        } else if (listeners) {
          // LIFO order
          do {
            this.removeListener(type, listeners[listeners.length - 1]);
          } while (listeners[0]);
        }

        return this;
      };

  EventEmitter.prototype.listeners = function listeners(type) {
    var evlistener;
    var ret;
    var events = this._events;

    if (!events)
      ret = [];
    else {
      evlistener = events[type];
      if (!evlistener)
        ret = [];
      else if (typeof evlistener === 'function')
        ret = [evlistener.listener || evlistener];
      else
        ret = unwrapListeners(evlistener);
    }

    return ret;
  };

  EventEmitter.listenerCount = function(emitter, type) {
    if (typeof emitter.listenerCount === 'function') {
      return emitter.listenerCount(type);
    } else {
      return listenerCount.call(emitter, type);
    }
  };

  EventEmitter.prototype.listenerCount = listenerCount;
  function listenerCount(type) {
    var events = this._events;

    if (events) {
      var evlistener = events[type];

      if (typeof evlistener === 'function') {
        return 1;
      } else if (evlistener) {
        return evlistener.length;
      }
    }

    return 0;
  }

  EventEmitter.prototype.eventNames = function eventNames() {
    return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
  };

  // About 1.5x faster than the two-arg version of Array#splice().
  function spliceOne(list, index) {
    for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
      list[i] = list[k];
    list.pop();
  }

  function arrayClone(arr, i) {
    var copy = new Array(i);
    while (i--)
      copy[i] = arr[i];
    return copy;
  }

  function unwrapListeners(arr) {
    var ret = new Array(arr.length);
    for (var i = 0; i < ret.length; ++i) {
      ret[i] = arr[i].listener || arr[i];
    }
    return ret;
  }

  class Client {

    constructor(server, options) {
      this.cmd = Command;
      const proto = options && options.secure ? 'https://' : 'http://';
      this._server = proto + server;
    }

    streamCommand(commandName, params) {
      return new PostCommand(this._server, commandName, params);
    }

    // bam.iobio endpoints
    //
    streamAlignmentHeader(url) {
      return new Command(this._server, 'alignmentHeader', { url });
    }

    streamBaiReadDepth(url) {
      return new Command(this._server, 'baiReadDepth', { url });
    }

    streamCraiReadDepth(url) {
      return new Command(this._server, 'craiReadDepth', { url });
    }

    streamAlignmentStatsStream(url, indexUrl, regions) {

      //const regArr = regions.map(function(d) { return d.name+ ":"+ d.start + '-' + d.end;});
      //const regStr = JSON.stringify(regions.map(function(d) { return {start:d.start,end:d.end,chr:d.name};}));
      return new Command(this._server, 'alignmentStatsStream', {
        url,
        indexUrl: indexUrl ? indexUrl : "",
        regions: JSON.stringify(regions),
      });
    }


    // gene.iobio endpoints
    //
    streamVariantHeader(url, indexUrl) {
      return new Command(this._server, 'variantHeader', { 
        url,
        indexUrl: indexUrl ? indexUrl : "",
      });
    }

    streamVcfReadDepth(url) {
      return new Command(this._server, 'vcfReadDepth', { url });
    }

    streamAlignmentCoverage(url, indexUrl, samtoolsRegion, maxPoints, coverageRegions) {
      return new PostCommand(this._server, 'alignmentCoverage', {
        url,
        indexUrl: indexUrl ? indexUrl : "",
        samtoolsRegion,
        maxPoints,
        coverageRegions,
      });
    }

    streamGeneCoverage(url, indexUrl, refName, geneName, regionStart, regionEnd, regions) {
      return new Command(this._server, 'geneCoverage', {
        url,
        indexUrl: indexUrl ? indexUrl : "",
        refName,
        geneName,
        regionStart,
        regionEnd,
        regions: JSON.stringify(regions),
      });
    }

    streamNormalizeVariants(vcfUrl, tbiUrl, refName, regions, contigStr, refFastaFile) {
      return new Command(this._server, 'normalizeVariants', {
        vcfUrl,
        tbiUrl: tbiUrl ? tbiUrl: "",
        refName,
        regions: JSON.stringify(regions),
        contigStr: encodeURIComponent(contigStr),
        refFastaFile: encodeURIComponent(refFastaFile),
      });
    }

    streamAnnotateVariants(args) {
      return new Command(this._server, 'annotateVariants', Object.assign({},
        args, {
          refNames: JSON.stringify(args.refNames),
          regions: JSON.stringify(args.regions),
          vcfSampleNames: JSON.stringify(args.vcfSampleNames),
        }
      ));
    }

    streamFreebayesJointCall(args) {
      return new PostCommand(this._server, 'freebayesJointCall', args);
    }

    streamClinvarCountsForGene(args) {
      return new PostCommand(this._server, 'clinvarCountsForGene', args);
    }

    // genepanel endpoints
    //
    async clinphen(args) {
      return fetchNoStream(this._server, 'clinphen', args);
    }
    streamClinphen(args) {
      return new Command(this._server, 'clinphen', args);
    }
  }


  async function fetchNoStream(server, endpoint, params) {
    const query = encodeURI(server + '/' + endpoint + encodeParams(params));
    const response = await fetch(query);
    if (response.ok) {
      return response.text();
    }
    else {
      throw new Error(`iobio API call failed with status code ${response.status}: '${query}'`);
    }
  }


  class Command extends EventEmitter {
    constructor(server, endpoint, params) {
      super();

      this._server = server;
      this._endpoint = endpoint;
      this._params = params;
    }

    run() {
      const query = encodeURI(this._server + '/' + this._endpoint + encodeParams(this._params));
      //console.log(query);
      this._stream = request(query);

      this._stream.onData((data) => {
        this.emit('data', data);
      });
      this._stream.onEnd(() => {
        this.emit('end');
      });
      this._stream.onError((e) => {
        this.emit('error', e);
      });
    }

    cancel() {
      this._stream.cancel();
    }
  }


  class PostCommand extends EventEmitter {
    constructor(server, endpoint, params) {
      super();

      this._server = server;
      this._endpoint = endpoint;
      this._params = params;
    }

    run() {
      const query = this._server + '/' + this._endpoint;
      //console.log(query);
      this._stream = request(query, {
        method: 'POST',
        params: this._params,
        contentType: 'text/plain; charset=utf-8',
      });

      this._stream.onData((data) => {
        this.emit('data', data);
      });
      this._stream.onEnd(() => {
        this.emit('end');
      });
      this._stream.onError((e) => {
        this.emit('error', e);
      });
    }

    cancel() {
      this._stream.cancel();
    }
  }


  function encodeParams(obj) {

    const params = Object.keys(obj).map((key, i) => {
      let sep = '&';
      if (i === 0) {
        sep = '?';
      }

      // TODO: might need this
      //const value = encodeURIComponent(String(obj[key]));
      const value = String(obj[key]);

      return sep + key + '=' + value;
    });

    return params.join('');
  }

  exports.Client = Client;

  return exports;

}({}));
