import schedule from "node-schedule";
import { checkAndBlock } from "./sunblock.js";
import logger from "./logger.js";
const scheduleLogger = logger.child({module: 'scheduler.ts'})


/***
 * Scheduler handler for bot to be used with PM2
 *
 * Set to run every hour
 */
schedule.scheduleJob("0 * * * *", async function () {
    try {
        await checkAndBlock();
    } catch (error) {
        scheduleLogger.info(`Error applying sunblock. Error: ${error}.\n\nTrying again in 10s.`)
    }
});
