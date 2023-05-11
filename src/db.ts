import {Database, open} from 'sqlite';
import sqlite3 from 'sqlite3';

sqlite3.verbose()

const dbPromise: Promise<Database> = open({
    filename: './db.sqlite',
    driver: sqlite3.Database,
});

async function createTables(): Promise<void> {
    try {
        const db = await dbPromise;
        await db.run('CREATE TABLE IF NOT EXISTS followers(did text PRIMARY KEY, handle TEXT, following_count INTEGER, block_status INTEGER, date_last_updated TEXT)');
        // await db.run('CREATE TABLE IF NOT EXISTS subscriptions(did text PRIMARY KEY, handle TEXT, date_added TEXT, date_last_updated TEXT)')
        await db.run('CREATE TABLE IF NOT EXISTS subscriptionBlocks(did TEXT, subscribed_did TEXT, reason TEXT, date_last_updated TEXT, PRIMARY KEY (subscribed_did, did))')
        await db.run('CREATE TABLE IF NOT EXISTS blocks(did text PRIMARY KEY, handle TEXT, r_key TEXT, reason TEXT, date_blocked TEXT, date_last_updated TEXT)')
    } catch (error) {
        console.error(`Error in createTable: ${error.message}`);
    }
}

interface Follower {
    did: string,
    handle: string,
    following_count: number,
    block_status: number,
    date_last_updated: string
}

async function insertFollower({did, handle, following_count, block_status, date_last_updated}: Follower) {
    try {
        const db = await dbPromise
        await db.run('INSERT INTO followers(did, handle, following_count, block_status, date_last_updated) VALUES (?, ?, ?, ?, ?)', [did, handle, following_count, block_status, date_last_updated])
    } catch (error) {
        console.error(`Error in insertFollower: ${error.message}`);
    }
}

async function updateFollower({did, handle, following_count, block_status, date_last_updated}: Follower) {
    try {
        const db = await dbPromise
        await db.run('UPDATE followers SET handle = ?, following_count = ?, block_status = ?, date_last_updated = ? WHERE did = ?', [handle, following_count, block_status, date_last_updated, did])
    } catch (error) {
        console.error(`Error in insertFollower: ${error.message}`);
    }
}

async function getFollower(did: string){
    try {
        const db = await dbPromise
        return await db.get('SELECT * FROM followers WHERE did = ?', did)
    } catch (error) {
    console.error(`Error in getFollower: ${error.message}`);
}
}

async function getAllFollowers() {
    try {
        const db = await dbPromise
        return await db.get('SELECT * FROM followers')
    } catch (error) {
        console.error(`Error in getFollower: ${error.message}`);
    }
}

interface SubscribedBlock {
    blocked_did: string;
    subscribed_did: string;
    date_last_updated: string;
}

async function insertSubscriptionBlock({blocked_did, subscribed_did, date_last_updated}: SubscribedBlock): Promise<void> {
    try {
        const db = await dbPromise;
        await db.run('INSERT INTO subscriptionBlocks(did, subscribed_did, reason, date_last_updated) VALUES (?, ?, ?, ?)', [blocked_did, subscribed_did, 'subscription', date_last_updated]);
    } catch (error) {
        console.error(`Error in insertSubscriptionBlock: ${error.message}`);
    }
}

async function deleteSubscriptionBlock(did:string) {
    try {
        const db = await dbPromise
        await db.run(`DELETE FROM subscriptionBlocks WHERE did = '${did}'`)

    } catch (error) {
        console.error(`Error deleting subscription block: ${error}`)
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

async function insertUserBlock({did, handle, rkey, reason, date_blocked, date_last_updated}: UserBlock): Promise<void> {
    try {
        const db = await dbPromise;
        await db.run('INSERT INTO blocks(did, handle, r_key, reason, date_blocked, date_last_updated) VALUES (?, ?, ?, ?, ?, ?)', [did, handle, rkey, reason, date_blocked, date_last_updated]);
    } catch (error) {
        console.error(`Error in insertUserBlock: ${error.message}`);
    }
}

async function deleteUserBlock(did: string) {
    try{
        const db = await dbPromise
        await db.run(`DELETE FROM blocks WHERE did = '${did}'`)
    } catch (error) {
        console.error(`Error deleting user block: ${error.message}`)
    }
}

async function getSingleUserBlock(did: string) {
    try{
        const db = await dbPromise
        return await db.get(`SELECT * FROM blocks where did = '${did}'`)
    } catch (error) {
        console.error(`Error in getSingleUserBlock: ${error.message}`);
    }
}

async function getAllUserBlocks(): Promise<any> {
    try {
        const db = await dbPromise;
        return await db.all('SELECT did FROM blocks');
    } catch (error) {
        console.error(`Error in getAllBlocks: ${error.message}`);
    }
}

async function getSingleSubscriptionBlocks(subscribed_did: string): Promise<any> {
    try {
        const db = await dbPromise;
        return await db.all(`SELECT did FROM subscriptionBlocks WHERE subscribed_did = '${subscribed_did}'`);
    } catch (error) {
        console.error(`Error in getSingleSubscriptionBlocks: ${error.message}`);
    }
}

async function getAllSubscriptionBlocks(): Promise<any> {
    try {
        const db = await dbPromise;
        return await db.all('SELECT did FROM subscriptionBlocks');
    } catch (error) {
        console.error(`Error in getAllSubscriptionBlocks: ${error.message}`);
    }
}

async function getUniqueDids(leftTable, rightTable) {
    try {
        const db = await dbPromise
        const result = await db.all(`SELECT a.did, a.reason FROM ${leftTable} AS a WHERE NOT EXISTS ( SELECT 1 FROM ${rightTable} AS b WHERE b.did = a.did) AND reason = 'subscription'`)
        return result
    } catch (error) {
        console.error(`Error in getUniqueDids: ${error.message}`)
    }
}

async function getAllSubscriptions() {
    try {
        const db = await dbPromise
        return await db.all(`SELECT did FROM subscriptions`)
    } catch (error) {
        console.error(`Error in getAllSubscriptions: ${error.message}`)
    }
}

async function checkBlockExists(did, table) {
    try {
        const db = await dbPromise
        const result = await db.get(`SELECT COUNT(*) as count FROM ${table} WHERE did = '${did}'`)
        return result.count
    } catch (error) {
        console.error(`Error in ... ${error.message}`)
    }
}


export {dbPromise, createTables, insertFollower, updateFollower, getFollower, getAllFollowers, getUniqueDids, insertSubscriptionBlock, insertUserBlock, deleteUserBlock, deleteSubscriptionBlock, getSingleUserBlock, getAllUserBlocks, getSingleSubscriptionBlocks, getAllSubscriptionBlocks, getAllSubscriptions, checkBlockExists}