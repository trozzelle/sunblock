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

async function insertSubscriptionBlock(subscribed_did: string, blocked_did: string, date_last_updated: string): Promise<void> {
    try {
        const db = await dbPromise;
        await db.run('INSERT INTO subscriptionBlocks(subscribed_did, blocked_did, date_last_updated) VALUES (?, ?, ?)', [subscribed_did, blocked_did, date_last_updated]);
    } catch (error) {
        console.error(`Error in insertSubscriptionBlock: ${error.message}`);
    }
}

async function insertUserBlock(did: string, handle: string, date_blocked: string, date_last_updated: string): Promise<void> {
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

async function getAllSubscriptionBlocks(subscribed_did): Promise<any> {
    try {
        const db = await dbPromise;
        return await db.all(`SELECT blocked_did FROM subscriptionBlocks WHERE subscribed_did = '${subscribed_did}'`);
    } catch (error) {
        console.error(`Error in getAllBlocks: ${error.message}`);
    }
}


export {dbPromise, createTables, insertSubscriptionBlock, insertUserBlock, getAllBlocks, getAllSubscriptionBlocks}