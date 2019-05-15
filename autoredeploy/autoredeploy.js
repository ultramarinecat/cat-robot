// cat-robot auto-redeploy script!
//
// listens for pubnub message to auto-redeploy and then clones or updates the repo
// and (re)starts the app
/* eslint-disable import/no-unresolved */
'use strict';

const path = require('path');
const npm = require('npm');
const util = require('util');

const PubNub = require('pubnub');
const pm2 = require('pm2');
const dotenv = require('dotenv');
const shell = require('shelljs');
const winston = require('winston');
const Repo = require('git-tools');
const rimraf = require('rimraf');

const DEPLOY_CHANNEL = 'DEPLOY';
const LOG_CHANNEL = 'LOG';

const UNCAUGHT_EXCEPTION = 'uncaughtException';
const ERROR_EXIT_DELAY = 1000;

const UPDATE = 'UPDATE';
const RESTART = 'RESTART';
const REBOOT = 'REBOOT';
const SHUTDOWN = 'SHUTDOWN';

const SHUTTING_DOWN = 'SHUTTING_DOWN';
const SHUTDOWN_DELAY = 3000;

const SHUTDOWN_COMMAND = 'sudo shutdown now';
const REBOOT_COMMAND = 'sudo shutdown -r now';

const ROBOT_PATH = 'robot';
const ROBOT_PROCESS = 'robot';

const ONLINE_STATUS = 'online';
const ORIGIN = 'origin';
const NODE_MODULES = 'node_modules';

const LOG_FILE = 'autoredeploy.log';
const LOG_LEVEL = 'verbose';

const ENV = '.env';

dotenv.config({
  path: path.resolve(process.cwd(), ENV)
});

const { PUBLISH_KEY, SUBSCRIBE_KEY, AUTHORIZATION_TOKEN, REPO, BRANCH, PI } = process.env;

const pubnub = new PubNub({
  publishKey: PUBLISH_KEY,
  subscribeKey: SUBSCRIBE_KEY,
  authKey: AUTHORIZATION_TOKEN,
  ssl: true
});

const logger = initLogger();

initUncaughExceptionHandler();

// listen for redeploy messages
listenForDeployMessages();

logger.info('autoredeploy started...');

// start robot!
function start() {
  pm2.start(
    ROBOT_PATH,
    {
      name: ROBOT_PROCESS
    },
    (err, proc) => {
      if (err) {
        logger.error('error occurred trying to start robot!', err);
        return;
      }

      if (!proc) {
        logger.error('could not start robot!');
        return;
      }

      logger.info('starting robot...');
    }
  );
}

// npm install
function installDependencies() {
  return new Promise((resolve, reject) => {
    logger.info('installing dependencies...');
    const cwd = process.cwd();

    function switchToRobotDirectory() {
      try {
        // logger.verbose('switching to robot directory');
        process.chdir(ROBOT_PATH);
      } catch (err) {
        logger.error('error occured changing working directory!', err);
        reject(err);
      }
    }

    function switchBackToCurrentDirectory() {
      try {
        process.chdir(cwd);
        // logger.verbose('switched back to cwd');
      } catch (err) {
        logger.error('error occured switching back to current directory!', err);
      }
    }

    switchToRobotDirectory();

    // run npm install
    npm.load(
      {
        production: true // don't install devDependencies
      },
      err => {
        if (err) {
          logger.error(
            'error occured loading npm while tyring got install dependencies!',
            err
          );
          switchBackToCurrentDirectory();
          reject(err);
          return;
        }

        npm.commands.install([], () => {
          logger.info('done installing dependencies!');
          switchBackToCurrentDirectory();
          resolve();
        });
      }
    );
  });
}

// git clone
function gitClone() {
  return new Promise((resolve, reject) => {
    logger.info('cloning repo...');

    Repo.clone(
      {
        repo: REPO,
        dir: ROBOT_PATH,
        branch: BRANCH,
        depth: 1
      },
      (error, repo) => {
        // eslint-disable-line no-shadow
        if (error) {
          logger.error('error occured cloning repo!', error);
          reject(error);
          return;
        }

        if (!repo) {
          logger.error('was unable to clone repo!');
          reject(error);
          return;
        }

        logger.info('cloned repo!');
        resolve();
      }
    );
  });
}

// delete current robot directory
function deleteDirectory() {
  return new Promise((resolve, reject) => {
    logger.verbose('deleting directory...');

    rimraf(ROBOT_PATH, err => {
      if (err) {
        logger.error('error occured deleting directory!', err);
        reject(err);
        return;
      }

      logger.verbose('done deleting directory');
      resolve();
    });
  });
}

// clone the repo, npm install, and startup
function cloneRepo() {
  deleteDirectory()
    .then(() => {
      return gitClone();
    })
    .then(() => {
      return installDependencies();
    })
    .then(() => {
      start();
    })
    .catch(e => {
      logger.error('could not clone repo!', e);
    });
}

// git pull --rebse
function gitPull(localRepo) {
  return new Promise((resolve, reject) => {
    logger.verbose(`running git pull --rebase origin ${BRANCH}...`);

    localRepo.exec.call(localRepo, 'pull', '--rebase', 'origin', BRANCH, error => {
      if (error) {
        logger.error('error trying to pull repo:', error);
        reject(error);
        return;
      }

      logger.verbose('git pull done');
      logger.info('updated to the latest!');
      resolve();
    });
  });
}

// reset any local changes
function gitReset(localRepo) {
  return new Promise((resolve, reject) => {
    logger.verbose('running git reset --hard...');

    localRepo.exec.call(localRepo, 'reset', '--hard', error => {
      if (error) {
        logger.error('error trying to reset repo:', error);
        reject(error);
        return;
      }

      logger.verbose('git reset done');
      resolve();
    });
  });
}

// delete any untracked files (except node_modules directory)
function gitClean(localRepo) {
  return new Promise((resolve, reject) => {
    logger.verbose('running git clean -fdx -e node_modules...');

    localRepo.exec.call(
      localRepo,
      'clean',
      '-f',
      '-d',
      '-x',
      '-e',
      NODE_MODULES,
      error => {
        if (error) {
          logger.error('error trying to clean repo:', error);
          reject(error);
          return;
        }

        logger.verbose('git clean done');
        resolve();
      }
    );
  });
}

// update repo to the latest, npm install, and startup
function pullRepo(localRepo) {
  gitClean(localRepo)
    .then(() => {
      return gitReset(localRepo);
    })
    .then(() => {
      return gitPull(localRepo);
    })
    .then(() => {
      return installDependencies();
    })
    .then(() => {
      start();
    })
    .catch(e => {
      logger.error('could not pull repo!', e);
      cloneRepo();
    });
}

// pull or clone the repo
function update() {
  const localRepo = new Repo(ROBOT_PATH);

  localRepo.isRepo((error, isRepo) => {
    if (error) {
      logger.error('error occured trying to check if directory is a git repo!', error);
      return;
    }

    if (!isRepo) {
      logger.verbose('directory is not a git repo');
      cloneRepo();
      return;
    }

    // eslint-disable-next-line no-shadow
    localRepo.remotes((error, remotes) => {
      if (error) {
        logger.error('error occurred reading repo remotes!', error);
        return;
      }

      if (!remotes) {
        logger.error('could not read repo remotes!');
        return;
      }

      // eslint-disable-next-line eqeqeq
      const origin = remotes.filter(remote => remote.name == ORIGIN);

      if (!origin || origin.length !== 1) {
        logger.error('could not determine repo origin!');
        return;
      }

      // eslint-disable-next-line eqeqeq
      const sameOrigin = path.normalize(origin[0].url) == path.normalize(REPO);

      if (!sameOrigin) {
        logger.info('directory doesnt have same origin');
        cloneRepo();
        return;
      }

      pullRepo(localRepo);
    });
  });
}

// stop robot, if necessary, and update the code
function redeploy() {
  logger.info('updating...');

  pm2.connect(err => {
    if (err) {
      logger.error('error occurred connecting to process mananager!', err);
      return;
    }

    pm2.describe(ROBOT_PROCESS, (err, description) => {
      if (err) {
        logger.error('error occurred trying to describe process!', err);
        return;
      }

      // eslint-disable-next-line eqeqeq
      const isRunning = description[0] && description[0].pm2_env.status == ONLINE_STATUS;

      // if not running, update
      if (!isRunning) {
        logger.info('robot not currently running');
        update();
        return;
      }

      // if running, stop it, and then update
      logger.info('robot running, stopping...');
      pm2.stop(ROBOT_PROCESS, err => {
        if (err) {
          logger.error('error occurred trying to stop robot!', err);
          return;
        }

        logger.info('stopped robot');
        update();
      });
    });
  });
}

// restart robot
function restart() {
  logger.info('restarting...');

  pm2.connect(err => {
    if (err) {
      logger.error('error occurred connecting to process mananager!', err);
      return;
    }

    // publish shutdown message
    pubnub.publish(
      {
        message: SHUTTING_DOWN,
        channel: DEPLOY_CHANNEL
      },
      ({ error }) => {
        if (error) {
          logger.error('error occured publishing shutting down message!', error);
        }
      }
    );

    // give robot some time to prepare for restart
    setTimeout(() => {
      // and restart
      pm2.restart(ROBOT_PROCESS, err => {
        if (err) {
          logger.error('error occurred restarting!', err);
          return;
        }

        logger.info('robot restarted!', err);
      });
    }, SHUTDOWN_DELAY);
  });
}

// shutdown robot
function shutdown(reboot) {
  logger.info(reboot ? 'rebooting...' : 'shutting down...');

  const shutdownCommand = reboot ? REBOOT_COMMAND : SHUTDOWN_COMMAND;

  // publish shutdown message
  pubnub.publish(
    {
      message: SHUTTING_DOWN,
      channel: DEPLOY_CHANNEL
    },
    ({ error }) => {
      if (error) {
        logger.error('error occured publishing shutting down message!', error);
      }
    }
  );

  // give robot some time to prepare for shutdown
  if (PI) {
    setTimeout(() => {
      // and shutdown
      shell.exec(shutdownCommand, { async: true });
    }, SHUTDOWN_DELAY);
  }
}

function initLogger() {
  // eslint-disable-next-line no-shadow
  const logger = new winston.Logger({
    transports: [
      new winston.transports.Console({
        level: LOG_LEVEL,
        handleExceptions: false
      }),
      new winston.transports.File({
        filename: LOG_FILE,
        level: LOG_LEVEL,
        handleExceptions: false,
        json: false
      })
    ],
    exitOnError: false
  });

  // add pubnub transport
  // eslint-disable-next-line func-names, no-multi-assign
  const pubnubTransport = (winston.transports.PubNub = function() {
    this.name = 'pubnub';
    this.level = LOG_LEVEL;
  });

  util.inherits(pubnubTransport, winston.Transport);

  // log to pubnub, appending meta object if present
  // eslint-disable-next-line func-names
  pubnubTransport.prototype.log = function(level, msg, meta, callback) {
    const hasMeta =
      meta != null && typeof meta === 'object' && Object.entries(meta).length > 0;

    pubnub.publish(
      {
        message: !hasMeta ? msg : `${msg} - ${meta}`,
        channel: LOG_CHANNEL
      },
      ({ error }) => {
        if (error) {
          // if can't publish, log using default logger
          winston.add(winston.transports.File, {
            filename: LOG_FILE,
            json: false
          });

          winston.error('error occured publishing log message!', error);
          callback(error, false);
          return;
        }

        callback(null, true);
      }
    );
  };

  logger.add(winston.transports.PubNub, {});

  return logger;
}

function initUncaughExceptionHandler() {
  process.on(UNCAUGHT_EXCEPTION, e => {
    logger.error('autoredeploy uncaughtException occured!', e);

    const timer = setTimeout(() => {
      process.exit(1);
    }, ERROR_EXIT_DELAY);

    timer.unref();
  });
}

// listen for redeploy messages
function listenForDeployMessages() {
  pubnub.addListener({
    message: ({ message }) => {
      if (message === UPDATE) {
        redeploy();
      } else if (message === RESTART) {
        restart();
      } else if (message === REBOOT) {
        shutdown(true);
      } else if (message === SHUTDOWN) {
        shutdown();
      }
    }
  });

  pubnub.subscribe({
    channels: [DEPLOY_CHANNEL]
  });
}
