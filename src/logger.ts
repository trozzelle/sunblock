import pino, {Logger} from 'pino';

const logger: Logger = pino({
    prettyPrint: { colorize: true },
    level: 'debug'
});

export default logger;