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
        await db.run('CREATE TABLE IF NOT EXISTS subscriptions(did text PRIMARY KEY, handle TEXT, date_added TEXT, date_last_updated TEXT)')
        await db.run('CREATE TABLE IF NOT EXISTS subscriptionBlocks(subscribed_did TEXT, blocked_did TEXT, date_last_updated TEXT, PRIMARY KEY (subscribed_did, blocked_did))')
        await db.run('CREATE TABLE IF NOT EXISTS blocks(did text PRIMARY KEY, handle TEXT, date_blocked TEXT, date_last_updated TEXT)')
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
        await db.run('INSERT INTO subscriptionBlocks(did, subscribed_did, date_last_updated) VALUES (?, ?, ?)', [blocked_did, subscribed_did, date_last_updated]);
    } catch (error) {
        console.error(`Error in insertSubscriptionBlock: ${error.message}`);
    }
}

interface UserBlock {
    did: string;
    handle: string;
    date_blocked: string;
    date_last_updated: string;
}

async function insertUserBlock({did, handle, date_blocked, date_last_updated}: UserBlock): Promise<void> {
    try {
        const db = await dbPromise;
        await db.run('INSERT INTO blocks(did, handle, date_blocked, date_last_updated) VALUES (?, ?, ?, ?)', [did, handle, date_blocked, date_last_updated]);
    } catch (error) {
        console.error(`Error in insertUserBlock: ${error.message}`);
    }
}


async function getAllBlocks(): Promise<any> {
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
        return await db.all(`SELECT blocked_did FROM subscriptionBlocks WHERE subscribed_did = '${subscribed_did}'`);
    } catch (error) {
        console.error(`Error in getSingleSubscriptionBlocks: ${error.message}`);
    }
}

async function getAllSubscriptionBlocks(): Promise<any> {
    try {
        const db = await dbPromise;
        return await db.all('SELECT blocked_did FROM subscriptionBlocks');
    } catch (error) {
        console.error(`Error in getAllSubscriptionBlocks: ${error.message}`);
    }
}

async function getUniqueDids(leftTable, rightTable) {
    try {
        const db = await dbPromise
        return await db.all(`SELECT a.did FROM ${leftTable} AS a WHERE NOT EXISTS ( SELECT 1 FROM ${rightTable} AS b WHERE b.did = a.did)`)
    } catch (error) {
        console.error(`Error in leftJoin: ${error.message}`)
    }
}

async function checkBlockExists(did, table) {
    try {
        const db = await dbPromise
        return await db.all(`SELECT EXISTS (SELECT 1 FROM ${table} WHERE did = '${did}')`)
    } catch (error) {
        console.error(`Error in ... ${error.message}`)
    }
}


export {dbPromise, createTables, insertFollower, updateFollower, getFollower, getAllFollowers, getUniqueDids, insertSubscriptionBlock, insertUserBlock, getAllBlocks, getSingleSubscriptionBlocks, getAllSubscriptionBlocks, checkBlockExists}