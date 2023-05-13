import {Database, open} from 'sqlite';
import sqlite3 from 'sqlite3';
import {FollowerRecord, SubscribedBlockRecord, Did} from "./types";
import logger from "./logger.js";

const dbLogger = logger.child({module: 'db.ts'})

sqlite3.verbose()

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
        // await db.run('CREATE TABLE IF NOT EXISTS subscriptions(did text PRIMARY KEY, handle TEXT, date_added TEXT, date_last_updated TEXT)')
        await db.run('CREATE TABLE IF NOT EXISTS subscriptionBlocks(did TEXT, subscribed_did TEXT, reason TEXT, date_last_updated TEXT, PRIMARY KEY (subscribed_did, did))')
        await db.run('CREATE TABLE IF NOT EXISTS blocks(did text PRIMARY KEY, handle TEXT, r_key TEXT, reason TEXT, date_blocked TEXT, date_last_updated TEXT)')
    } catch (error) {
        dbLogger.error(`Error in createTable: ${error.message}`);
    }
}

// Insert single follower into the followers table
async function insertFollower({did, handle, following_count, block_status, date_last_updated}: FollowerRecord) {
    try {
        const db = await dbPromise
        await db.run('INSERT INTO followers(did, handle, following_count, block_status, date_last_updated) VALUES (?, ?, ?, ?, ?)', [did, handle, following_count, block_status, date_last_updated])
    } catch (error) {
        dbLogger.error(`Error in insertFollower: ${error.message}`);
    }
}

// Update single follower in the followers table
async function updateFollower({did, handle, following_count, block_status, date_last_updated}: FollowerRecord) {
    try {
        const db = await dbPromise
        await db.run('UPDATE followers SET handle = ?, following_count = ?, block_status = ?, date_last_updated = ? WHERE did = ?', [handle, following_count, block_status, date_last_updated, did])
    } catch (error) {
        dbLogger.error(`Error in insertFollower: ${error.message}`);
    }
}

// Retrieve single follower from  the followers table
async function getFollower(did: Did){
    try {
        const db = await dbPromise
        return await db.get('SELECT * FROM followers WHERE did = ?', did)
    } catch (error) {
    dbLogger.error(`Error in getFollower: ${error.message}`);
}
}

// Retrieve all followers from the followers table
async function getAllFollowers() {
    try {
        const db = await dbPromise
        return await db.get('SELECT * FROM followers')
    } catch (error) {
        dbLogger.error(`Error in getFollower: ${error.message}`);
    }
}


// Insert single block into subscriptions block table
async function insertSubscriptionBlock({blocked_did, subscribed_did, date_last_updated}: SubscribedBlockRecord) {
    try {
        const db = await dbPromise;
        await db.run('INSERT INTO subscriptionBlocks(did, subscribed_did, reason, date_last_updated) VALUES (?, ?, ?, ?)', [blocked_did, subscribed_did, 'subscription', date_last_updated]);
    } catch (error) {
        dbLogger.error(`Error in insertSubscriptionBlock: ${error.message}`);
    }
}

// Get single block from subscription
async function getSingleSubscriptionBlocks(subscribed_did: Did) {
    try {
        const db = await dbPromise;
        return await db.all(`SELECT did FROM subscriptionBlocks WHERE subscribed_did = '${subscribed_did}'`);
    } catch (error) {
        dbLogger.error(`Error in getSingleSubscriptionBlocks: ${error.message}`);
    }
}

// Get all blocks in the subscription blocks table
async function getAllSubscriptionBlocks() {
    try {
        const db = await dbPromise;
        return await db.all('SELECT did FROM subscriptionBlocks');
    } catch (error) {
        dbLogger.error(`Error in getAllSubscriptionBlocks: ${error.message}`);
    }
}

// Delete single block in the subscriptions block table
async function deleteSubscriptionBlock(did:Did) {
    try {
        const db = await dbPromise
        await db.run(`DELETE FROM subscriptionBlocks WHERE did = '${did}'`)

    } catch (error) {
        dbLogger.error(`Error deleting subscription block: ${error}`)
    }
}

interface UserBlock {
    did: string;
    handle: string;
    rkey: string;
    reason: string;
    date_blocked: string;
    date_last_updated: string;
}

// Delete single block in the user's local block table
async function insertUserBlock({did, handle, rkey, reason, date_blocked, date_last_updated}: UserBlock) {
    try {
        const db = await dbPromise;
        await db.run('INSERT INTO blocks(did, handle, r_key, reason, date_blocked, date_last_updated) VALUES (?, ?, ?, ?, ?, ?)', [did, handle, rkey, reason, date_blocked, date_last_updated]);
    } catch (error) {
        dbLogger.error(`Error in insertUserBlock: ${error.message}`);
    }
}

// Get single block from the user's local block table
async function getUserBlock(did: Did) {
    try{
        const db = await dbPromise
        return await db.get(`SELECT * FROM blocks where did = '${did}'`)
    } catch (error) {
        dbLogger.error(`Error in getSingleUserBlock: ${error.message}`);
    }
}

// Delete single block in the user's local block table
async function deleteUserBlock(did: Did) {
    try{
        const db = await dbPromise
        await db.run(`DELETE FROM blocks WHERE did = '${did}'`)
    } catch (error) {
        dbLogger.error(`Error deleting user block: ${error.message}`)
    }
}

// Get all blocks from the user's local block table
async function getAllUserBlocks(){
    try {
        const db = await dbPromise;
        return await db.all('SELECT did FROM blocks');
    } catch (error) {
        dbLogger.error(`Error in getAllBlocks: ${error.message}`);
    }
}

// Get all blocks from the user's local block table
async function getAllUserBlocksByReason(reason: string | string[]){

    let reasons

    if (Array.isArray(reason)) {
        reasons = reason.join(`', '`)
    }
        else {
            reasons = reason
    }

    try {
        const db = await dbPromise;
        return await db.all(`SELECT * FROM blocks WHERE reason IN ('${reasons}')`);
    } catch (error) {
        dbLogger.error(`Error in getAllBlocks: ${error.message}`);
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
        const db = await dbPromise
        return await db.all(`SELECT did FROM subscriptions`)
    } catch (error) {
        dbLogger.error(`Error in getAllSubscriptions: ${error.message}`)
    }
}

// Check whether a did is in the provided table
async function checkBlockExists(did: Did, table: string) {
    try {
        const db = await dbPromise
        const result = await db.get(`SELECT COUNT(*) as count FROM ${table} WHERE did = '${did}'`)
        return result.count
    } catch (error) {
        dbLogger.error(`Error in ... ${error.message}`)
    }
}


export {dbPromise, createTables, insertFollower, updateFollower, getFollower, getAllFollowers, getUniqueDids, insertSubscriptionBlock, insertUserBlock, deleteUserBlock, deleteSubscriptionBlock, getUserBlock, getAllUserBlocks, getAllUserBlocksByReason, getSingleSubscriptionBlocks, getAllSubscriptionBlocks, getAllSubscriptions, checkBlockExists}