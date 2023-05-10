import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

sqlite3.verbose()

const dbPromise = open({
    filename: './db.sqlite',
    driver: sqlite3.Database,
});

async function createTable() {
    try {
        const db = await dbPromise;
        await db.run('CREATE TABLE IF NOT EXISTS followers(did text PRIMARY KEY, handle TEXT, following_count INTEGER, block_status INTEGER, date_last_updated TEXT)');
    } catch (error) {
        console.error(`Error in createTable: ${error.message}`);
    }
}

export {dbPromise, createTable}