import pino, {Logger} from 'pino';

const logger: Logger = pino({
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true
        }
    }
});

export default logger;