// Generated by CoffeeScript 1.6.3
var Sentry, events, nodeurl, os, parseDSN, request, scrub, util, with_timeout, _, _handle_http_load_errors,
  __slice = [].slice,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

_ = require('underscore');

os = require('os');

nodeurl = require('url');

request = require('request');

util = require('util');

events = require('events');

scrub = require('loofah')["default"]();

parseDSN = function(dsn) {
  var auth, err, hostname, key, pathname, project_id, secret, url, _ref, _ref1;
  try {
    _ref = nodeurl.parse(dsn), auth = _ref.auth, hostname = _ref.hostname, pathname = _ref.pathname;
    _ref1 = auth.split(':'), key = _ref1[0], secret = _ref1[1];
    project_id = pathname.split('/')[1];
    url = hostname;
    return {
      key: key,
      secret: secret,
      project_id: project_id,
      url: url
    };
  } catch (_error) {
    err = _error;
    return {};
  }
};

_handle_http_load_errors = function(context, err) {
  return context.emit("warning", err);
};

with_timeout = function(msecs, fn) {
  return function() {
    var args, cb, _i;
    args = 2 <= arguments.length ? __slice.call(arguments, 0, _i = arguments.length - 1) : (_i = 0, []), cb = arguments[_i++];
    cb = _.once(cb);
    setTimeout((function() {
      return cb(new Error('Sentry timed out'));
    }), msecs);
    return fn.apply(null, __slice.call(args).concat([function() {
      var results;
      results = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return cb.apply(null, results);
    }]));
  };
};

module.exports = Sentry = (function(_super) {
  __extends(Sentry, _super);

  function Sentry(credentials) {
    this.wrapper = __bind(this.wrapper, this);
    this._send = __bind(this._send, this);
    this.message = __bind(this.message, this);
    this.error = __bind(this.error, this);
    this.enabled = false;
    if (_.isString(credentials)) {
      credentials = parseDSN(credentials);
    }
    if (!_.isObject(credentials)) {
      this.disable_message = "Sentry client expected String or Object as argument. You passed: " + credentials + ".";
    } else if (_.every(['key', 'secret', 'project_id', 'url'], function(prop) {
      return _.has(credentials, prop);
    })) {
      _.extend(this, credentials);
      this.enabled = true;
    } else {
      this.disable_message = "Credentials you passed in aren't complete.";
    }
    _.defaults(this, {
      hostname: os.hostname()
    });
  }

  Sentry.prototype.error = function(err, logger, culprit, extra, cb) {
    var data;
    if (extra == null) {
      extra = {};
    }
    if (!(err instanceof Error)) {
      err = new Error("WARNING: err not passed as Error! " + (JSON.stringify(err, null, 2)));
      this.emit('warning', err);
    }
    data = {
      message: err.message,
      logger: logger,
      server_name: this.hostname,
      platform: 'node',
      level: 'error',
      extra: _.extend(extra, {
        stacktrace: err.stack
      })
    };
    if (!_.isNull(culprit)) {
      _.extend(data, {
        culprit: culprit
      });
    }
    return this._send(data, cb);
  };

  Sentry.prototype.message = function(message, logger, extra, cb) {
    var data;
    if (extra == null) {
      extra = {};
    }
    data = {
      message: message,
      logger: logger,
      level: 'info',
      extra: extra
    };
    return this._send(data, cb);
  };

  Sentry.prototype._send = function(data, cb) {
    var options,
      _this = this;
    if (cb == null) {
      cb = function() {};
    }
    if (!this.enabled) {
      this.emit("done");
      console.log(this.disable_message);
      return setImmediate(cb);
    }
    if ((data.logger != null) && !_.isString(data.logger)) {
      data.logger = "WARNING: logger not passed as string! " + (JSON.stringify(data.logger));
      this.emit('warning', new Error(data.logger));
    }
    try {
      JSON.stringify(data.extra);
    } catch (_error) {
      this.emit('warning', new Error("WARNING: extra not parseable to JSON!"));
      data.extra = {
        serialized: util.inspect(data.extra, {
          depth: null
        })
      };
    }
    options = {
      uri: "https://" + this.url + "/api/" + this.project_id + "/store/",
      method: 'post',
      headers: {
        'X-Sentry-Auth': "Sentry sentry_version=4, sentry_key=" + this.key + ", sentry_secret=" + this.secret + ", sentry_client=sentry-node"
      },
      json: data
    };
    return request(options, function(err, res, body) {
      var _ref;
      try {
        _this.emit("done");
        if ((err != null) || !res || res.statusCode > 299) {
          if ((_ref = res != null ? res.statusCode : void 0) === 429 || _ref === 413) {
            _handle_http_load_errors(_this, err);
            return cb(err || new Error("status code: " + res.statusCode));
          }
          console.error('Error posting event to Sentry:', err, body);
          _this.emit("error", err);
          return cb(err || new Error("status code: " + (res != null ? res.statusCode : void 0)));
        } else {
          _this.emit("logged");
          return cb();
        }
      } catch (_error) {
        err = _error;
        return console.error(err);
      }
    });
  };

  Sentry.prototype.wrapper = function(logger, timeout) {
    var log_to_sentry,
      _this = this;
    if (timeout == null) {
      timeout = 5000;
    }
    log_to_sentry = with_timeout(timeout, function(err, extra, cb) {
      _this.once('logged', function() {
        return cb();
      });
      _this.once('error', function(sentry_err) {
        return cb(sentry_err);
      });
      return _this.error(scrub(err), logger, null, scrub(extra));
    });
    return {
      globals: {},
      wrap: this.enabled ? function(fn) {
        var _this = this;
        return function() {
          var args, cb, ret, _i;
          args = 2 <= arguments.length ? __slice.call(arguments, 0, _i = arguments.length - 1) : (_i = 0, []), cb = arguments[_i++];
          ret = fn.apply(null, __slice.call(args).concat([function() {
            var err, extra, results;
            err = arguments[0], results = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
            if (err != null) {
              extra = _this.globals;
              extra.args = args;
              return log_to_sentry(err, extra, function(sentry_err) {
                return cb(sentry_err != null ? _.extend(sentry_err, {
                  original_error: err
                }) : err);
              });
            } else {
              return cb.apply(null, [null].concat(__slice.call(results)));
            }
          }]));
          if (ret && ret.then && ret["catch"]) {
            return ret.then(function(val) {
              return cb(null, val);
            })["catch"](function(err) {
              return log_to_sentry(err, {
                args: args
              }, function(sentry_err) {
                return cb(sentry_err != null ? _.extend(sentry_err, {
                  original_error: err
                }) : err);
              });
            });
          }
        };
      } : function(fn) {
        return fn;
      }
    };
  };

  return Sentry;

})(events.EventEmitter);

if (process.env.NODE_ENV === 'test') {
  module.exports._private = {
    _handle_http_load_errors: _handle_http_load_errors
  };
}
