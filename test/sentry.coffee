_ = require 'underscore'
assert = require 'assert'
os = require 'os'
nock = require 'nock'

Sentry = require("#{__dirname}/../lib/sentry")
sentry_settings = require("#{__dirname}/credentials").sentry


describe 'sentry-node', ->
    
  before ->
    @sentry = new Sentry sentry_settings
    # because only in production env sentry api would make http request
    process.env.NODE_ENV = 'production'
    
  it 'setup sentry client from SENTRY_DSN correctly', (done) ->
    # mock sentry dsn with random uuid as public_key and secret_key
    dsn = 'https://c28500314a0f4cf28b6d658c3dd37ddb:a5d3fcd72b70494b877a1c2deba6ad74@app.getsentry.com/16088'
    
    process.env.SENTRY_DSN = dsn
    _sentry = new Sentry
    assert.equal _sentry.key, 'c28500314a0f4cf28b6d658c3dd37ddb'
    assert.equal _sentry.secret, 'a5d3fcd72b70494b877a1c2deba6ad74'
    assert.equal _sentry.project_id, '16088'
    assert.equal os.hostname(), _sentry.hostname
    assert.deepEqual ['production'], _sentry.enable_env
    
    delete process.env.SENTRY_DSN
    _sentry = new Sentry dsn
    assert.equal _sentry.key, 'c28500314a0f4cf28b6d658c3dd37ddb'
    assert.equal _sentry.secret, 'a5d3fcd72b70494b877a1c2deba6ad74'
    assert.equal _sentry.project_id, '16088'
    assert.equal os.hostname(), _sentry.hostname
    assert.deepEqual ['production'], _sentry.enable_env
    
    done()
    
  it 'setup sentry client from credentials correctly', (done) ->
    assert.equal sentry_settings.key, @sentry.key
    assert.equal sentry_settings.secret, @sentry.secret
    assert.equal sentry_settings.project_id, @sentry.project_id
    assert.equal os.hostname(), @sentry.hostname
    assert.deepEqual ['production'], @sentry.enable_env
    done()
    
  it 'report error if credentials are missing', (done) ->
    assert.throws (-> new Sentry {}), Error
    assert.throws (-> new Sentry), Error
    done()
    
  it 'send error correctly', (done) ->
    scope = nock('https://app.getsentry.com')
                .matchHeader('X-Sentry-Auth'
                , "Sentry sentry_version=4, sentry_key=#{sentry_settings.key}, sentry_secret=#{sentry_settings.secret}, sentry_client=sentry-node/0.1.0")
                .filteringRequestBody (path) ->
                  params = JSON.parse path
                  if _.every(['culprit','message','logger','server_name','platform','level'], (prop) -> _.has(params, prop))
                    if params.extra?.stacktrace?
                      return 'error'
                  throw Error 'Body of Sentry error request is incorrect.'
                .post("/api/#{sentry_settings.project_id}/store/", 'error')
                .reply(200, {"id": "534f9b1b491241b28ee8d6b571e1999d"}) # mock sentry response with a random uuid
                
    _this = @
    assert.doesNotThrow ->
      err = new Error 'Error message'
      _this.sentry.error err, 'message', '/path/to/logger'
      scope.done()
    done()
    
  it 'send message correctly', (done) ->
    scope = nock('https://app.getsentry.com')
                .matchHeader('X-Sentry-Auth'
                , "Sentry sentry_version=4, sentry_key=#{sentry_settings.key}, sentry_secret=#{sentry_settings.secret}, sentry_client=sentry-node/0.1.0")
                .filteringRequestBody (path) ->
                  params = JSON.parse path
                  if _.every(['message','logger','level'], (prop) -> _.has(params, prop))
                    unless _.some(['culprit','server_name','platform','extra'], (prop) -> _.has(params, prop))
                      return 'message'
                  throw Error 'Body of Sentry message request is incorrect.'
                .post("/api/#{sentry_settings.project_id}/store/", 'message')
                .reply(200, {"id": "c3115249083246efa839cfac2abbdefb"}) # mock sentry response with a random uuid
                
    _this = @
    assert.doesNotThrow ->
      _this.sentry.message 'message', '/path/to/logger'
      scope.done()
    done()