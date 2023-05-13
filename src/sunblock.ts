import process from "node:process";
import dotenv from 'dotenv';
import {
    dbPromise,
    createTables,
} from "./db.js";
import {authenticateBsky} from "./api.js";
import {blockSpam, blockSubscriptions, syncUserBlockList, syncRepoUserBlockList} from "./blockHandler.js";
import sqlite3 from "sqlite3";
import logger from "./logger.js";
import {Did} from "./types";

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

    mainLogger.info("Starting check and block...")

    const agent = await authenticateBsky()
    mainLogger.info("Authenticated with Bluesky.")

    if(!agent.session) {
        throw Error("Session is missing. Something has gone wrong.")
    }

    const db = await dbPromise;
    await createTables();

    mainLogger.info("Database opened.")

    try {
        const user = agent.session.did as Did
        await blockSpam(agent, db, followLimit)

        if (subscriptions) {
            try {
                await blockSubscriptions(agent, subscriptions)
            } catch (error) {
                mainLogger.error(`Error running blocks subscription: ${error.message}`);
            }
        }
        await syncUserBlockList(agent)
        await syncRepoUserBlockList(agent, user)

    } catch (error) {
        mainLogger.error(`Error running spam blocker: ${error.message}`);
    }



    mainLogger.info("Completed run. Exiting.")
}

checkAndBlock()

async function cleanUpAndExit() {
    const db = await dbPromise;
    await db.close();
    mainLogger.info('Database connection closed.');
    process.exit();
}

process.on('SIGINT', cleanUpAndExit);
process.on('SIGTERM', cleanUpAndExit);
