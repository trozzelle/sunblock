import process from "node:process";
import dotenv from 'dotenv';
import {
    dbPromise,
    createTables,
} from "./db.js";
import {authenticateBsky} from "./api.js";
import {blockSpam, blockSubscriptions, syncUserBlockList, syncRepoUserBlockList} from "./blockHandler.js";
import sqlite3 from "sqlite3";
import logger from "./logger";
const res = dotenv.config();

const mainLogger = logger.child({module: 'sunblock'})

// @ts-ignore
if (!res.parsed.ATPROTO_USER || !res.parsed.ATPROTO_PASS) {
    throw new Error('Environment variables ATPROTO_USER and ATPROTO_PASS must be set')
}

const followLimit = process.env.FOLLOW_LIMIT as string
const subscriptions = process.env.SUBSCRIPTIONS as string

sqlite3.verbose()

export async function checkAndBlock(): Promise<void> {

    console.log("Starting check and block...")

    const agent = await authenticateBsky()
    console.log("Authenticated with Bluesky.")

    if(!agent.session) {
        throw Error
    }

    const db = await dbPromise;
    await createTables();

    console.log("Database opened.")

    try {
        await blockSpam(agent, db, followLimit)

        if (subscriptions) {
            try {
                await blockSubscriptions(agent, subscriptions)
            } catch (error) {
                console.error(`Error running blocks subscription: ${error.message}`);
            }
        }

        await syncUserBlockList(agent)

        const user = agent.session.did
        await syncRepoUserBlockList(agent, user)

    } catch (error) {
        console.error(`Error running spam blocker: ${error.message}`);
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