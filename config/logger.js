const chalk = require('react-dev-utils/chalk');

function dir(args) {
  console.dir(args, {
    depth: 5,
    // showHidden: true,
    color: true,
    maxArrayLength: 5,
    maxStringLength: 200,
    breakLength: 100,
  });
}

function log(message, ...args) {
  process.stdout.write(message + ' ');
  if (args.length) dir(args);

  console.log();
}

function info(message, ...args) {
  process.stdout.write(chalk.green(message) + ' ');
  if (args.length) dir(args);

  console.log();
}

function error(message, ...args) {
  process.stdout.write(chalk.red(message) + ' ');
  if (args.length) dir(args);

  console.log();
}

function warn(message, ...args) {
  process.stdout.write(chalk.yellow(message) + ' ');
  if (args.length) dir(args);

  console.log();
}

module.exports = { log, error, warn, info };
