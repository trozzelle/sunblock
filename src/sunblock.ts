import process from "node:process";
import dotenv from 'dotenv';
import {
    dbPromise,
    createTables,
} from "./db.js";
import {createSingleUser, getSingleUser } from "./db-prisma.js";
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

const apiUser = process.env.ATPROTO_USER as string
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

    const {data: profile} = await agent.getProfile({actor: apiUser})

    if(!(await getSingleUser(apiUser))) {
        try {
            await createSingleUser({did: profile.did, handle: apiUser},
                {
                    avatar: profile.avatar,
                    banner: profile.banner,
                    description: profile.description,
                    displayName: profile.displayName,
                    followers: profile.followersCount,
                    following: profile.followsCount,
                    labels: profile.labels.join(',')
                })
        }
        catch (error) {
            logger.error( `Something went wrong instantiating the user: ${error}\n\nQuitting...`)
            process.exit(1)
        }
    }



    // const db = await dbPromise;
    // await createTables();

    mainLogger.info("Database opened.")

    try {
        const user = agent.session.did as Did
        await blockSpam(profile.did, agent, followLimit)

        // if (subscriptions) {
        //     try {
        //         await blockSubscriptions(agent, subscriptions)
        //     } catch (error) {
        //         mainLogger.error(`Error running blocks subscription: ${error.message}`);
        //     }
        // }
        // await syncUserBlockList(agent)
        // await syncRepoUserBlockList(agent, user)

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
