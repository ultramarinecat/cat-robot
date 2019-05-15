// connection service tests
'use strict';

const chai = require('chai');
const mockery = require('mockery');
const sinonChai = require('sinon-chai');

const messages = require('../messages');
const mocks = require('./util/mocks');
const shared = require('./util/shared');

const should = chai.should(); // eslint-disable-line no-unused-vars
chai.use(sinonChai);

describe('connectionService', () => {
  before(() => {
    // enable mockery
    mockery.enable({
      useCleanCache: true,
      warnOnUnregistered: false
    });

    // the module under test, messages, and keymirror shouldn't be mocked
    mockery.registerAllowables(['../connectionService', './messages', 'keymirror']);

    mockery.registerMock('lodash', mocks.lodash);
    mockery.registerMock('dotenv', mocks.dotenv);
    mockery.registerMock('./logger', mocks.logger);
    mockery.registerMock('./pubsub', mocks.pubsub);
    mockery.registerMock('./utils/authToken', mocks.authToken);

    // get service with dependencies mocked out
    this.connectionService = require('../connectionService');

    // create sandbox
    shared.createSandbox.call(this);
  });

  after(() => {
    // disable mockery
    mockery.deregisterAll();
    mockery.disable();

    // restore sandbox
    shared.restoreSandbox.call(this);
  });

  beforeEach(() => {
    // startup service
    this.startup = this.connectionService.startup();
  });

  afterEach(() => {
    // make sure there was at least one heartbeat
    return mocks.pubsub
      .pub({
        [messages.CONNECTION_TEST]: 1
      })
      .then(() => {
        // and wait until active connection is cleared for next test
        this.clock.tick(this.connectionService.heartbeatMaxInterval);

        // reset pubsub
        mocks.pubsub.reset();
      });
  });

  it('should notify app and exit on uncaught exception', () => {
    // should handle uncaught exception
    shared.testUncaughtExcpetion.call(this);
  });

  it('should publish error message if robot is shutting down', () => {
    return this.startup
      .then(() => {
        // if received shutting down message
        return mocks.pubsub.pub(messages.SHUTTING_DOWN);
      })
      .then(() => {
        // should send error message to client
        mocks.pubsub.pub.should.have.been.calledWith(messages.ERROR);
      });
  });

  it('should publish error message if robot is crashing', () => {
    return this.startup
      .then(() => {
        // if received crashing message
        return mocks.pubsub.pub(messages.CRASHING);
      })
      .then(() => {
        // should send error message to clinet
        mocks.pubsub.pub.should.have.been.calledWith(messages.ERROR);
      });
  });

  it('should publish error message if robot is in error state', () => {
    return this.startup
      .then(() => {
        // if received error state message
        return mocks.pubsub.pub(messages.ERROR_STATE);
      })
      .then(() => {
        // should send error message to client
        mocks.pubsub.pub.should.have.been.calledWith(messages.ERROR);
      });
  });

  it('should accept connection request if it has no active connection', () => {
    return this.startup
      .then(() => {
        // send connection request
        return mocks.pubsub.pub({
          [messages.CONNECTION_REQUEST]: 1
        });
      })
      .then(() => {
        // should accept, send connected message with auth token
        mocks.pubsub.pub.should.have.been.calledWith({
          [messages.CONNECTED]: 1,
          token: mocks.authToken.token
        });

        // send another connection request
        return mocks.pubsub.pub({
          [messages.CONNECTION_REQUEST]: 2
        });
      })
      .then(() => {
        // should send conflict message
        mocks.pubsub.pub.should.have.been.calledWith({
          [messages.CONFLICT]: 2
        });
      });
  });

  it('should respond to heartbeats from connected clients', () => {
    return this.startup
      .then(() => {
        // send connection request
        return mocks.pubsub.pub({
          [messages.CONNECTION_REQUEST]: 1
        });
      })
      .then(() => {
        // should be accepted
        mocks.pubsub.pub.should.have.been.calledWith({
          [messages.CONNECTED]: 1,
          token: mocks.authToken.token
        });

        // send heartbeat with different connection id
        return mocks.pubsub.pub({
          [messages.CONNECTION_TEST]: 2
        });
      })
      .then(() => {
        // should send invalid message
        mocks.pubsub.pub.should.have.been.calledWith({
          [messages.INVALID]: 2
        });

        // send heartbeat with same connection id
        return mocks.pubsub.pub({
          [messages.CONNECTION_TEST]: 1
        });
      })
      .then(() => {
        // should send connection_ok
        mocks.pubsub.pub.should.have.been.calledWith({
          [messages.CONNECTION_OK]: 1
        });
      });
  });

  it('should accept right turn requests from connected clients', () => {
    return this.startup
      .then(() => {
        // send connection request
        return mocks.pubsub.pub({
          [messages.CONNECTION_REQUEST]: 1
        });
      })
      .then(() => {
        // should be accepted
        mocks.pubsub.pub.should.have.been.calledWith({
          [messages.CONNECTED]: 1,
          token: mocks.authToken.token
        });

        // send right turn request with different connection id
        return mocks.pubsub.pub({
          [messages.RIGHT_TURN_REQUEST]: 2
        });
      })
      .then(() => {
        // should send invalid message
        mocks.pubsub.pub.should.have.been.calledWith({
          [messages.INVALID]: 2
        });

        // send right turn request with same connection id
        return mocks.pubsub.pub({
          [messages.RIGHT_TURN_REQUEST]: 1
        });
      })
      .then(() => {
        // should attempt to turn right
        mocks.pubsub.pub.should.have.been.calledWith(messages.TURN_RIGHT);
      });
  });

  it('should accept left turn requests from connected clients', () => {
    return this.startup
      .then(() => {
        // send connection request
        return mocks.pubsub.pub({
          [messages.CONNECTION_REQUEST]: 1
        });
      })
      .then(() => {
        // should be accepted
        mocks.pubsub.pub.should.have.been.calledWith({
          [messages.CONNECTED]: 1,
          token: mocks.authToken.token
        });

        // send left turn request with different connection id
        return mocks.pubsub.pub({
          [messages.LEFT_TURN_REQUEST]: 2
        });
      })
      .then(() => {
        // should send invalid message
        mocks.pubsub.pub.should.have.been.calledWith({
          [messages.INVALID]: 2
        });

        // send left turn request with same connection id
        return mocks.pubsub.pub({
          [messages.LEFT_TURN_REQUEST]: 1
        });
      })
      .then(() => {
        // should attempt to turn left
        mocks.pubsub.pub.should.have.been.calledWith(messages.TURN_LEFT);
      });
  });

  it('should accept another connection request if client with active connection stops sending heartbeats', () => {
    return this.startup
      .then(() => {
        // send connection request
        return mocks.pubsub.pub({
          [messages.CONNECTION_REQUEST]: 1
        });
      })
      .then(() => {
        // should be accepted
        mocks.pubsub.pub.should.have.been.calledWith({
          [messages.CONNECTED]: 1,
          token: mocks.authToken.token
        });

        // send heartbeat
        return mocks.pubsub.pub({
          [messages.CONNECTION_TEST]: 1
        });
      })
      .then(() => {
        // max heartbeat interval with no heartbeats
        this.clock.tick(this.connectionService.heartbeatMaxInterval);

        // send another connection request
        return mocks.pubsub.pub({
          [messages.CONNECTION_REQUEST]: 2
        });
      })
      .then(() => {
        // should be accepted
        mocks.pubsub.pub.should.have.been.calledWith({
          [messages.CONNECTED]: 2,
          token: mocks.authToken.token
        });

        mocks.pubsub.pub.should.not.have.been.calledWith({
          [messages.CONFLICT]: 2
        });
      });
  });
});
