import {Database, open} from 'sqlite';
import sqlite3 from 'sqlite3';
import {FollowerRecord, SubscribedBlockRecord, Did} from "./types";
import { PrismaClient } from '@prisma/client'
import logger from "./logger.js";

const dbLogger = logger.child({module: 'db.ts'})

sqlite3.verbose()


// For debugging, log Prisma to console
const prisma = new PrismaClient({
    log: [
        { level: 'warn', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'error', emit: 'event' },
    ],
})

prisma.$on('warn', (e) => {
    console.log(e)
})

prisma.$on('info', (e) => {
    console.log(e)
})

prisma.$on('error', (e) => {
    console.log(e)
})

// Open or create db
const dbPromise: Promise<Database> = open({
    filename: './db.sqlite',
    driver: sqlite3.Database,
});

// Initialize db
async function createTables(): Promise<void> {
    try {
        const db = await dbPromise;
        await db.run('CREATE TABLE IF NOT EXISTS followers(did text PRIMARY KEY, handle TEXT, following_count INTEGER, block_status INTEGER, date_last_updated TEXT)');
        await db.run('CREATE TABLE IF NOT EXISTS subscriptions(did text PRIMARY KEY, handle TEXT, block_count INTEGER, date_added TEXT, date_last_updated TEXT)')
        await db.run('CREATE TABLE IF NOT EXISTS subscriptionBlocks(did TEXT, subscribed_did TEXT, reason TEXT, date_last_updated TEXT, PRIMARY KEY (subscribed_did, did))')
        await db.run('CREATE TABLE IF NOT EXISTS blocks(did text PRIMARY KEY, handle TEXT, r_key TEXT, reason TEXT, date_blocked TEXT, date_last_updated TEXT)')
    } catch (error) {
        dbLogger.error(`Error in createTable: ${error.message}`);
    }
}

interface User {
    did: string,
    handle: string,
}

interface UserMeta {
    did?: string,
    avatar?: string,
    banner?: string,
    description?: string
    displayName?: string,
    followers?: number,
    following?: number,
    labels?: string
}

async function createSingleUser({did, handle}: User, {avatar, banner, description, displayName, followers, following, labels}: UserMeta) {
    try {
        const response = await prisma.users.create({
            data: {
                did: did,
                handle: handle,
                userMeta: {
                    create: {
                        did: did,
                        avatar: avatar,
                        banner: banner,
                        description: description,
                        displayName: displayName,
                        followers: followers,
                        following: following,
                        labels: labels
                    }
                }
            }

        })

        }
     catch
        (error) {
        console.error(`Error in ... ${error.message}`)
    }
}

async function getSingleUser(handle) {
    try {
        const response = await prisma.users.findFirst({
            where: {
                handle: handle
            }
        })
        return response
    } catch (error) {
        console.error(`Error in ... ${error.message}`)
    }
}

async function insertSingleFollower(userDid: string, {did, handle, followingCount}: FollowerRecord){
    try {
        const follower = await prisma.followers.create({
            data: {
                follower: did,
                handle: handle,
                followingCount: followingCount,
                user: {
                    connect: {
                        did: userDid
                    }
                }
            }
        })
        return follower
    } catch (error) {
        console.error(`Error in ... ${error.message}`)
    }
}

// Insert single follower into the followers table
// async function insertFollower({did, handle, following_count, block_status, date_last_updated}: FollowerRecord) {
//     try {
//         const db = await dbPromise
//         await db.run('INSERT INTO followers(did, handle, following_count, block_status, date_last_updated) VALUES (?, ?, ?, ?, ?)', [did, handle, following_count, block_status, date_last_updated])
//     } catch (error) {
//         dbLogger.error(`Error in insertFollower: ${error.message}`);
//     }
// }

// Update single follower in the followers table
async function updateSingleFollower({did, handle, following_count, block_status, date_last_updated}: FollowerRecord, opts: object) {
    try {
        const statement = {
            where: {
                follower: did
            },
            data: {
                handle: handle,
                followingCount: following_count,
                blockStatus: block_status,
                dateLastUpdated: new Date().toISOString(),
                blocksDid: {
                    connect: opts
                }
            },

        }
        const response = prisma.followers.update({
            where: {
                follower: did
            },
            data: {
                handle: handle,
                followingCount: following_count,
                blockStatus: block_status,
                dateLastUpdated: new Date().toISOString(),
                blocks: {
                    connect: opts
                }
            }
        })
    } catch (error) {
        dbLogger.error(`Error in insertFollower: ${error.message}`);
    }
}

// Retrieve single follower from  the followers table
async function getSingleFollower(did: Did){
    try {
        const response = await prisma.followers.findUnique({
            where: {
                follower: did
            }
        })
        return response
    } catch (error) {
        dbLogger.error(`Error in getSingleFollower: ${error.message}`);
    }
}

// Retrieve all followers from the followers table
async function getAllFollowers() {
    try {
        const response = await prisma.followers.findMany()
        return response
    } catch (error) {
        dbLogger.error(`Error in getSingleFollower: ${error.message}`);
    }
}


// Insert single block into subscriptions block table
async function insertSingleSubscriptionBlock({blockedDid, subscribedDid, updatedAt}: SubscribedBlockRecord) {
    try {
        const response = await prisma.subscriptionBlocks.create({
            data: {
                did: blockedDid,
                author: subscribedDid,
                reason: 'subscription',
                dateLastUpdated: new Date().toISOString()
            }
        })
    } catch (error) {
        dbLogger.error(`Error in insertSubscriptionBlock: ${error.message}`);
    }
}

// Get single block from subscription
// TODO doublecheck this...
async function getSingleSubscriptionBlocks(subscribed_did: Did) {
    try {
        const response = await prisma.subscriptionBlocks.findUnique({
            where: {
                did: subscribed_did
            }
        })
        return response
    } catch (error) {
        dbLogger.error(`Error in getSingleSubscriptionBlocks: ${error.message}`);
    }
}

// Get all blocks in the subscription blocks table
async function getAllSubscriptionBlocks() {
    try {
        const response = await prisma.subscriptionBlocks.findMany()
        return response
    } catch (error) {
        dbLogger.error(`Error in getAllSubscriptionBlocks: ${error.message}`);
    }
}

// Delete single block in the subscriptions block table
async function deleteSingleSubscriptionBlock(did:Did) {
    try {
        const response = await prisma.subscriptionBlocks.delete({
            where: {
                did: did
            }
        })
    } catch (error) {
        dbLogger.error(`Error deleting subscription block: ${error}`)
    }
}

interface UserBlock {
    did: string;
    handle: string;
    rkey: string;
    reason: string;
    blockedAt?: string;
    updatedAt?: string;
}

interface UserBlockOpts {
    opts?: object
}

// Delete single block in the user's local block table
async function insertSingleUserBlock(userDid: string, {did, handle, rkey, reason}: UserBlock, opts?: UserBlockOpts) {
    try {
        const statement = {
            data: {
                did: did,
                handle: handle,
                rKey: rkey,
                blockedAt: new Date().toISOString(),
                follower: {
                    connect: opts
                }
            }
        }
        const response = await prisma.blocks.create({
            data: {
                did: did,
                handle: handle,
                rKey: rkey,
                reason: reason,
                blockedAt: new Date().toISOString(),
                user: {
                    connect: {
                        did: userDid
                    }
                }
            }
        })
    } catch (error) {
        dbLogger.error(`Error in insertUserBlock: ${error.message}`);
    }
}

// Get single block from the user's local block table
async function getSingleUserBlock(did: Did) {
    try{
        const response = await prisma.blocks.findUnique({
            where: {
                did: did
            }
        })
        return response
    } catch (error) {
        dbLogger.error(`Error in getSingleUserBlock: ${error.message}`);
    }
}

// Delete single block in the user's local block table
async function deleteSingleUserBlock(did: Did) {
    try{
        const response = await prisma.blocks.delete({
            where: {
                did: did
            }
        })
    } catch (error) {
        dbLogger.error(`Error deleting user block: ${error.message}`)
    }
}

// Get all blocks from the user's local block table
async function getAllUserBlocks(){
    try {
        const response = prisma.blocks.findMany()
        return  response
    } catch (error) {
        dbLogger.error(`Error in getAllBlocks: ${error.message}`);
    }
}

// Get all blocks from the user's local block table
async function getAllUserBlocksByReason(reason: string | string[]){

    let reasons = Array.isArray(reason) ? reason : [reason];

    try {
        return await prisma.blocks.findMany({
            where: {
                reason: {
                    in: reasons,
                },
            },
        });
    } catch (error) {
        console.error(`Error in getAllBlocksByReason: ${error.message}`);
    }
}

// Get the set difference between two tables
// i.e. elements that exist only in table a
async function getUniqueDids(leftTable, rightTable) {
    try {
        const db = await dbPromise
        const result = await db.all(`SELECT a.did, a.reason FROM ${leftTable} AS a WHERE NOT EXISTS ( SELECT 1 FROM ${rightTable} AS b WHERE b.did = a.did) AND reason = 'subscription'`)
        return result
    } catch (error) {
        dbLogger.error(`Error in getUniqueDids: ${error.message}`)
    }
}

// Get all handles that the user is subscribed to
async function getAllSubscriptions() {
    try {
        const response = await prisma.subscriptions.findMany()
        return response
    } catch (error) {
        dbLogger.error(`Error in getAllSubscriptions: ${error.message}`)
    }
}

// Check whether a did is in the provided table
async function checkBlockExists(did: Did, table: string) {
    try {
        const response = await prisma.blocks.findUnique({
            where: {
                did: did
            }
        })
        const db = await dbPromise
        const result = await db.get(`SELECT COUNT(*) as count FROM ${table} WHERE did = '${did}'`)
        return result.count
    } catch (error) {
        dbLogger.error(`Error in ... ${error.message}`)
    }
}


export {dbPromise, createTables, createSingleUser, getSingleUser, insertSingleFollower, updateSingleFollower, getSingleFollower,
    getAllFollowers, getUniqueDids, insertSingleSubscriptionBlock, insertSingleUserBlock, deleteSingleUserBlock,
    deleteSingleSubscriptionBlock, getSingleUserBlock, getAllUserBlocks, getAllUserBlocksByReason,
    getSingleSubscriptionBlocks, getAllSubscriptionBlocks, getAllSubscriptions, checkBlockExists}
