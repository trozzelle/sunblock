import process from "node:process";
import dotenv from 'dotenv';
import {
    dbPromise,
    createTables,
} from "./db";
import {authenticateBsky} from "./api";
import {blockSpam, blockSubscriptions} from "./blockHandler";

const res = dotenv.config();

// @ts-ignore
if (!res.parsed.ATPROTO_USER || !res.parsed.ATPROTO_PASS) {
    throw new Error('Environment variables ATPROTO_USER and ATPROTO_PASS must be set');
}

const followLimit = process.env.FOLLOW_LIMIT as string
const subscriptions = process.env.SUBSCRIPTIONS as string


export async function checkAndBlock(): Promise<void> {

    console.log("Starting check and block...")

    const agent = await authenticateBsky()
    console.log("Authenticated with Bluesky.")

    const db = await dbPromise;
    await createTables();

    console.log("Database opened.")

    try {
        await blockSpam(agent, db, followLimit)
    } catch (error) {
        console.error(`Error running spam blocker: ${error.message}`);
    }

    if (subscriptions) {
        try {
            await blockSubscriptions(agent, subscriptions)
        } catch (error) {
            console.error(`Error running blocks subscription: ${error.message}`);
        }
    }


    console.log("Completed run. Exiting.")
}

checkAndBlock()

async function cleanUpAndExit() {
    const db = await dbPromise;
    await db.close();
    console.log('Database connection closed.');
    process.exit();
}

process.on('SIGINT', cleanUpAndExit);
process.on('SIGTERM', cleanUpAndExit);