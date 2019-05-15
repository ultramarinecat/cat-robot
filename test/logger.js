// logger tests
'use strict';

const chai = require('chai');
const mockery = require('mockery');
const sinonChai = require('sinon-chai');

const mocks = require('./util/mocks');
const shared = require('./util/shared');

const should = chai.should(); // eslint-disable-line no-unused-vars
chai.use(sinonChai);

describe('logger', () => {
  before(() => {
    // enable mockery
    mockery.enable({
      useCleanCache: true,
      warnOnUnregistered: false
    });

    // the module under test shouldn't be mocked
    mockery.registerAllowables(['../logger']);

    mockery.registerMock('winston', mocks.winston);
    mockery.registerMock('util', mocks.util);
    mockery.registerMock('./pubsub', mocks.pubsub);
  });

  after(() => {
    // disable mockery
    mockery.deregisterAll();
    mockery.disable();
  });

  beforeEach(() => {
    // create sandbox
    shared.createSandbox.call(this);
  });

  afterEach(() => {
    // restore sandbox
    shared.restoreSandbox.call(this);

    // reset winston and path objects
    mocks.winston.reset();
    mocks.util.inherits.resetHistory();

    // reset mockery cache
    mockery.resetCache();
  });

  it('should init a logger with console, file, and pubnub transports', () => {
    // get logger
    require('../logger');

    // should initialize logger with console and file transports
    mocks.winston.Logger.should.have.been.called;
    mocks.winston.Logger.getCall(0).args[0].transports[0].should.be.an.instanceOf(
      mocks.winston.transports.Console
    );
    mocks.winston.Logger.getCall(0).args[0].transports[1].should.be.an.instanceOf(
      mocks.winston.transports.File
    );

    // with silly and verbose log levels, respectively
    mocks.winston.transports.Console.getCall(0).args[0].level.should.equal('silly');
    mocks.winston.transports.File.getCall(0).args[0].level.should.equal('verbose');

    // should init custom transport
    const customTransport = mocks.util.inherits.getCall(0).args[0];
    mocks.util.inherits.getCall(0).args[1].should.equal(mocks.winston.Transport);

    // and add it to the logger
    mocks.winston.Logger.returnValues[0].add
      .getCall(0)
      .args[0].should.equal(customTransport);
  });

  it('should publish info level messages on pubnub', () => {
    // use real winston
    mockery.deregisterMock('winston');
    mockery.deregisterMock('util');
    mockery.warnOnUnregistered(false);

    // get logger
    const logger = require('../logger');

    // log message at info level
    logger.info('message');

    // should get published on log channel on pubnub
    mocks.pubsub.publish.should.have.been.called;
    mocks.pubsub.publish.getCall(0).args[0].should.equals('LOG');
  });
});
