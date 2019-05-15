// robot tests
'use strict';

const chai = require('chai');
const mockery = require('mockery');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

const messages = require('../messages');
const mocks = require('./util/mocks');
const shared = require('./util/shared');

const should = chai.should(); // eslint-disable-line no-unused-vars
chai.use(sinonChai);

const SIGINT = 'SIGINT';
const EXIT = 'exit';

describe('robot', () => {
  before(() => {
    // enable mockery
    mockery.enable({
      useCleanCache: true,
      warnOnUnregistered: false
    });

    // the module under test, messages, and keymirror shouldn't be mocked
    mockery.registerAllowables(['../robot', './messages', 'keymirror']);

    mockery.registerMock('./logger', mocks.logger);
    mockery.registerMock('./pubsub', mocks.pubsub);
    mockery.registerMock('./boardService', mocks.boardService);
    mockery.registerMock('./connectionService', mocks.connectionService);
    mockery.registerMock('./ledService', mocks.ledService);
    mockery.registerMock('./navigationService', mocks.navigationService);

    // get robot with dependencies mocked out
    this.robot = require('../robot');
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

    // reset pubsub
    mocks.pubsub.reset();
  });

  it('should notify app and exit on uncaught exception', () => {
    // should handle uncaught exception
    shared.testUncaughtExcpetion.call(this);
  });

  it('should notify app and shut down if it receives termination request', () => {
    // stub process.exit
    const processExit = sinon.stub(process, EXIT);

    // start robot
    this.robot.start();

    // emit interupt signal
    process.emit(SIGINT);

    // should have sent shutting down message
    mocks.pubsub.pub.should.have.been.calledWith(messages.SHUTTING_DOWN);

    // and exited
    this.clock.tick(2000);
    processExit.should.have.been.calledWith(0);
  });

  it('should start up all services and start robot moving forward', done => {
    // start robot
    this.robot.start();

    this.clock.restore();

    setTimeout(() => {
      // should have started all services
      mocks.boardService.startup.should.have.been.called;
      mocks.ledService.startup.should.have.been.called;
      mocks.navigationService.startup.should.have.been.called;
      mocks.connectionService.startup.should.have.been.called;

      // blinked startup light
      mocks.ledService.indicateStartupSuccess.should.have.been.called;

      // and started moving forward
      mocks.navigationService.moveForward.should.have.been.called;

      done();
    }, 100);
  });
});
