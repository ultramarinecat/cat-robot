// navigation service tests
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

describe('navgationService', () => {
  before(() => {
    // current time increment between tests
    this.currentTime = 0;

    // enable mockery
    mockery.enable({
      useCleanCache: true,
      warnOnUnregistered: false
    });

    // the module under test, messages, and keymirror shouldn't be mocked
    mockery.registerAllowables(['../navigationService', './messages', 'keymirror']);

    mockery.registerMock('johnny-five', mocks.johnnyFive);
    mockery.registerMock('lodash', mocks.lodash);
    mockery.registerMock('./logger', mocks.logger);
    mockery.registerMock('./pubsub', mocks.pubsub);
    mockery.registerMock('./boardService', mocks.boardService);

    // get service with dependencies mocked out
    this.navigationService = require('../navigationService');

    const {
      turnDuration,
      backupDuration,
      maxRecentTurns,
      maxRecentTurnsTimeframe,
      proximitiesRecordingDuration,
      minProximity
    } = this.navigationService;

    Object.assign(this, {
      turnDuration,
      backupDuration,
      maxRecentTurns,
      maxRecentTurnsTimeframe,
      proximitiesRecordingDuration,
      minProximity
    });
  });

  after(() => {
    // disable mockery
    mockery.deregisterAll();
    mockery.disable();
  });

  beforeEach(() => {
    // create sandbox
    shared.createSandbox.call(this);

    // use fake timers, increment current time by max recent turns timeframe plus any turn times
    this.currentTime +=
      this.maxRecentTurnsTimeframe + this.turnDuration + this.backupDuration;
    this.clock = sinon.useFakeTimers(this.currentTime);

    // startup service
    this.startup = this.navigationService.startup();
  });

  afterEach(() => {
    // restore sandbox
    shared.restoreSandbox.call(this);

    // reset pubsub
    mocks.pubsub.reset();

    // reset servos/proximity sensor objects
    mocks.johnnyFive.Servo.Continuous.resetHistory();
    mocks.johnnyFive.Proximity.resetHistory();

    mocks.leftWheel.reset();
    mocks.rightWheel.reset();

    mocks.proximitySensor.reset();
  });

  it('should notify app and exit on uncaught exception', () => {
    // should handle uncaught exception
    shared.testUncaughtExcpetion.call(this);
  });

  it('should init two servos and an ir sensor', () => {
    return this.startup.then(() => {
      // should have initialized two continous servos
      mocks.johnnyFive.Servo.Continuous.should.have.been.calledTwice;

      // and stopped them
      mocks.leftWheel.stop.should.have.been.called;
      mocks.rightWheel.stop.should.have.been.called;

      // should have initialized proximity sensor
      mocks.johnnyFive.Proximity.should.have.been.called;
    });
  });

  it('should stop wheels if robot is shutting down', () => {
    return this.startup
      .then(() => {
        // send shutting down message
        return mocks.pubsub.pub(messages.SHUTTING_DOWN);
      })
      .then(() => {
        // should stop wheels
        mocks.leftWheel.stop.should.have.been.called;
        mocks.rightWheel.stop.should.have.been.called;
      });
  });

  it('should stop wheels if robot is crashing', () => {
    return this.startup
      .then(() => {
        // send crashing message
        return mocks.pubsub.pub(messages.CRASHING);
      })
      .then(() => {
        // should stop wheels
        mocks.leftWheel.stop.should.have.been.called;
        mocks.rightWheel.stop.should.have.been.called;
      });
  });

  it('should stop wheels if robot is in error state', () => {
    return this.startup
      .then(() => {
        // send error state message
        return mocks.pubsub.pub(messages.ERROR_STATE);
      })
      .then(() => {
        // should stop wheels
        mocks.leftWheel.stop.should.have.been.called;
        mocks.rightWheel.stop.should.have.been.called;
      });
  });

  it('should turn left when receiving turn left message', () => {
    return this.startup
      .then(() => {
        mocks.leftWheel.stop.resetHistory(); // (wheels were called with stop in startup)
        mocks.rightWheel.stop.resetHistory();

        // publish turn left message
        const publishTurnLeft = mocks.pubsub.pub(messages.TURN_LEFT);

        // wait for turn to complete
        this.clock.tick(this.turnDuration);
        return publishTurnLeft;
      })
      .then(() => {
        // should have sent turning left message
        mocks.pubsub.pub.should.have.been.calledWith(messages.TURNING_LEFT);

        // should have stopped
        mocks.leftWheel.stop.should.have.been.called;
        mocks.rightWheel.stop.should.have.been.called;

        // should have turned left
        mocks.leftWheel.ccw.should.have.been.called;
        mocks.rightWheel.cw.should.have.been.called;

        // should have started moving forward
        mocks.leftWheel.cw.should.have.been.called;
        mocks.rightWheel.cw.should.have.been.called;

        // should have sent turn completed message
        mocks.pubsub.pub.should.have.been.calledWith(messages.TURN_COMPLETED);
      });
  });

  it('should turn right when receiving turn right message', () => {
    return this.startup
      .then(() => {
        mocks.leftWheel.stop.resetHistory();
        mocks.rightWheel.stop.resetHistory();

        // publish turn right message
        const publishTurnRight = mocks.pubsub.pub(messages.TURN_RIGHT);

        // wait for turn to complete
        this.clock.tick(this.turnDuration);
        return publishTurnRight;
      })
      .then(() => {
        // should have sent turning right message
        mocks.pubsub.pub.should.have.been.calledWith(messages.TURNING_RIGHT);

        // should have stopped
        mocks.leftWheel.stop.should.have.been.called;
        mocks.rightWheel.stop.should.have.been.called;

        // should have turned right
        mocks.leftWheel.cw.should.have.been.called;
        mocks.rightWheel.ccw.should.have.been.called;

        // should have started moving forward
        mocks.leftWheel.cw.should.have.been.called;
        mocks.rightWheel.cw.should.have.been.called;

        // should have sent turn completed message
        mocks.pubsub.pub.should.have.been.calledWith(messages.TURN_COMPLETED);
      });
  });

  it('should send turn in progress message when receiving a turn message while turning', () => {
    return this.startup
      .then(() => {
        mocks.leftWheel.stop.resetHistory();
        mocks.rightWheel.stop.resetHistory();

        // publish turn message
        return mocks.pubsub.pub(messages.TURN_LEFT);
      })
      .then(() => {
        // don't wait for turn to complete
        this.clock.tick(this.turnDuration - 1);

        // publish another turn message
        return mocks.pubsub.pub(messages.TURN_LEFT);
      })
      .then(() => {
        // should have sent turn in progress message
        mocks.pubsub.pub.should.have.been.calledWith(messages.TURN_IN_PROGRESS);

        // now wait for turn to complete
        this.clock.tick(this.turnDuration);

        // publish another turn message
        return mocks.pubsub.pub(messages.TURN_RIGHT);
      })
      .then(() => {
        // should have sent turning message
        mocks.pubsub.pub.should.have.been.calledWith(messages.TURNING_RIGHT);

        this.clock.tick(this.turnDuration); // (wait turn to complete so that turning is set to false)
      });
  });

  it(`should stop, back up, turn left or right, and continue moving forward when it encounters an
      obstacle`, () => {
    return this.startup
      .then(() => {
        mocks.leftWheel.stop.resetHistory();
        mocks.rightWheel.stop.resetHistory();

        // simulate obstacle
        mocks.proximitySensor.read(this.minProximity - 1);

        // should stop
        mocks.leftWheel.stop.should.have.been.called;
        mocks.rightWheel.stop.should.have.been.called;

        // move backward
        mocks.leftWheel.ccw.should.have.been.called;
        mocks.rightWheel.ccw.should.have.been.called;

        mocks.leftWheel.reset();
        mocks.rightWheel.reset();

        this.clock.tick(this.backupDuration);

        // stop again
        mocks.leftWheel.stop.should.have.been.called;
        mocks.rightWheel.stop.should.have.been.called;

        return Promise.resolve();
      })
      .then(() => {
        // turn left or right
        mocks.leftWheel.ccw.should.have.been.called; // (with mocked lodash random will turn left)
        mocks.rightWheel.cw.should.have.been.called;

        mocks.leftWheel.reset();
        mocks.rightWheel.reset();

        this.clock.tick(this.turnDuration);
        return Promise.resolve();
      })
      .then(() => {
        // and start moving forward
        mocks.leftWheel.cw.should.have.been.called;
        mocks.rightWheel.cw.should.have.been.called;
      });
  });

  it(`should look around and decide best direction after making many turns in a short amount of time,
      first guess is right`, () => {
    return this.startup
      .then(() => {
        mocks.leftWheel.stop.resetHistory();
        mocks.rightWheel.stop.resetHistory();

        // simulate obstacle
        mocks.proximitySensor.read(this.minProximity - 1);

        // wait for it to back up
        this.clock.tick(this.backupDuration);
        return Promise.resolve();
      })
      .then(() => {
        // wait for it to turn
        this.clock.tick(this.turnDuration);
        return Promise.resolve();
      })
      .then(() => {
        // simulate another obstacle
        mocks.proximitySensor.read(this.minProximity - 1);

        // wait for it to back up
        this.clock.tick(this.backupDuration);
        return Promise.resolve();
      })
      .then(() => {
        // wait for it to turn
        this.clock.tick(this.turnDuration);
        return Promise.resolve();
      })
      .then(() => {
        // simulate another obstacle (max recent turns == 3)
        mocks.proximitySensor.read(this.minProximity - 1);

        // wait for it to back up
        this.clock.tick(this.backupDuration);
        return Promise.resolve();
      })
      .then(() => {
        // should look initial direction
        mocks.leftWheel.ccw.should.have.been.called; // (with mocked lodash random will turn left)
        mocks.rightWheel.cw.should.have.been.called;

        mocks.leftWheel.reset();
        mocks.rightWheel.reset();

        // wait for it to turn
        this.clock.tick(this.turnDuration);
        return Promise.resolve();
      })
      .then(() => {
        // record initial direction proimities
        mocks.proximitySensor.read(20);
        mocks.proximitySensor.read(25);
        mocks.proximitySensor.read(23);

        // wait for it to finish recording proximities
        this.clock.tick(this.proximitiesRecordingDuration);
        return Promise.resolve();
      })
      .then(() => {
        // should look other direction
        mocks.leftWheel.cw.should.have.been.called; // (with mocked lodash random will turn right)
        mocks.rightWheel.ccw.should.have.been.called;

        mocks.leftWheel.reset();
        mocks.rightWheel.reset();

        // wait for it to turn
        this.clock.tick(this.turnDuration);
        return Promise.resolve();
      })
      .then(() => {
        // (should turn again since it's only back to the center)
        mocks.leftWheel.cw.should.have.been.called;
        mocks.rightWheel.ccw.should.have.been.called;

        mocks.leftWheel.reset();
        mocks.rightWheel.reset();

        // wait for it to turn
        this.clock.tick(this.turnDuration);
        return Promise.resolve();
      })
      .then(() => {
        // record other direction proimities
        mocks.proximitySensor.read(40); // (other direction is better)
        mocks.proximitySensor.read(43);
        mocks.proximitySensor.read(41);

        // wait for it to finish recording proximities
        this.clock.tick(this.proximitiesRecordingDuration);
        return Promise.resolve();
      })
      .then(() => {
        // wait for it to decide if we're all set
        return Promise.resolve();
      })
      .then(() => {
        // since current direction is better, we're all set, start moving forward
        mocks.leftWheel.cw.should.have.been.called;
        mocks.rightWheel.cw.should.have.been.called;

        mocks.leftWheel.reset();
        mocks.rightWheel.reset();
      });
  });

  it(`should look around and decide best direction after making many turns in a short amount of time,
      first guess is wrong`, () => {
    return this.startup
      .then(() => {
        mocks.leftWheel.stop.resetHistory();
        mocks.rightWheel.stop.resetHistory();

        // simulate obstacle
        mocks.proximitySensor.read(this.minProximity - 1);

        // wait for it to back up
        this.clock.tick(this.backupDuration);
        return Promise.resolve();
      })
      .then(() => {
        // wait for it to turn
        this.clock.tick(this.turnDuration);
        return Promise.resolve();
      })
      .then(() => {
        // simulate another obstacle
        mocks.proximitySensor.read(this.minProximity - 1);

        // wait for it to back up
        this.clock.tick(this.backupDuration);
        return Promise.resolve();
      })
      .then(() => {
        // wait for it to turn
        this.clock.tick(this.turnDuration);
        return Promise.resolve();
      })
      .then(() => {
        // simulate another obstacle (max recent turns == 3)
        mocks.proximitySensor.read(this.minProximity - 1);

        // wait for it to back up
        this.clock.tick(this.backupDuration);
        return Promise.resolve();
      })
      .then(() => {
        // should look initial direction
        mocks.leftWheel.ccw.should.have.been.called; // (with mocked lodash random will turn left)
        mocks.rightWheel.cw.should.have.been.called;

        mocks.leftWheel.reset();
        mocks.rightWheel.reset();

        // wait for it to turn
        this.clock.tick(this.turnDuration);
        return Promise.resolve();
      })
      .then(() => {
        // record initial direction proimities
        mocks.proximitySensor.read(55);
        mocks.proximitySensor.read(52);
        mocks.proximitySensor.read(53);

        // wait for it to finish recording proximities
        this.clock.tick(this.proximitiesRecordingDuration);
        return Promise.resolve();
      })
      .then(() => {
        // should look other direction
        mocks.leftWheel.cw.should.have.been.called; // (with mocked lodash random will turn right)
        mocks.rightWheel.ccw.should.have.been.called;

        mocks.leftWheel.reset();
        mocks.rightWheel.reset();

        // wait for it to turn
        this.clock.tick(this.turnDuration);
        return Promise.resolve();
      })
      .then(() => {
        // (should turn again since it's only back to the center)
        mocks.leftWheel.cw.should.have.been.called;
        mocks.rightWheel.ccw.should.have.been.called;

        mocks.leftWheel.reset();
        mocks.rightWheel.reset();

        // wait for it to turn
        this.clock.tick(this.turnDuration);
        return Promise.resolve();
      })
      .then(() => {
        // record other direction proimities
        mocks.proximitySensor.read(32); // (initial direction was better!)
        mocks.proximitySensor.read(34);
        mocks.proximitySensor.read(31);

        // wait for it to finish recording proximities
        this.clock.tick(this.proximitiesRecordingDuration);
        return Promise.resolve();
      })
      .then(() => {
        // should turn back to initial direction
        mocks.leftWheel.ccw.should.have.been.called;
        mocks.rightWheel.cw.should.have.been.called;

        mocks.leftWheel.reset();
        mocks.rightWheel.reset();

        // wait for it to turn
        this.clock.tick(this.turnDuration);
        return Promise.resolve();
      })
      .then(() => {
        // (should turn again since it's only back to the center)
        mocks.leftWheel.ccw.should.have.been.called;
        mocks.rightWheel.cw.should.have.been.called;

        mocks.leftWheel.reset();
        mocks.rightWheel.reset();

        // wait for it to turn
        this.clock.tick(this.turnDuration);
        return Promise.resolve();
      })
      .then(() => {
        // wait for it to finish deciding if we're all set
        return Promise.resolve();
      })
      .then(() => {
        // since we're back to the better (initial) direction, we're all set, start moving forward
        mocks.leftWheel.cw.should.have.been.called;
        mocks.rightWheel.cw.should.have.been.called;

        mocks.leftWheel.reset();
        mocks.rightWheel.reset();
      });
  });
});
