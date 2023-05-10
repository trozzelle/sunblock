import schedule from "node-schedule";
import { checkAndBlock } from "./src/sunblock.js";

/***
 * Scheduler handler for bot to be used with PM2
 *
 * Set to run every hour
 */
schedule.scheduleJob("0 * * * *", async function () {
    try {
        await checkAndBlock();
    } catch (error) {
        console.log(`Error applying sunblock. Error: ${error}.\n\nTrying again in 10s.`)
    }
});
