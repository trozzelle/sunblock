import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bsky from "@atproto/api";
const {BskyAgent} = bsky;
import process from "node:process";

import dotenv from 'dotenv';
import axios from "axios";
import {dbPromise, createTable} from "./db.js";
import {authenticateBsky, getFollowers, getFollowingCount, getBlocks, createBlock} from "./api.js";

dotenv.config();

const followLimit = process.env.FOLLOW_LIMIT

sqlite3.verbose()


export async function checkAndBlock() {

    console.log("Starting check and block...")

    const agent = await authenticateBsky()
    console.log("Authenticated with Bluesky.")

    const db = await dbPromise;
    await createTable();

    console.log("Database opened.")

    const {data: {did}} = await agent.resolveHandle({handle: 'torin.bsky.social'})

    const blockList = await getBlocks(agent, did)

    const followers = await getFollowers(agent);
    for (const follower of followers) {
        let followerRow = await db.get('SELECT * FROM followers WHERE did = ?', follower.did);
        if (!followerRow) {
            followerRow = {
                did: follower.did,
                handle: follower.handle,
                following_count: 0,
                block_status: 0,
                date_last_updated: new Date().toISOString(),
            };
            await db.run('INSERT INTO followers(did, handle, following_count, block_status, date_last_updated) VALUES (?, ?, ?, ?, ?)', [follower.did, follower.handle, follower.following_count, follower.block_status, follower.date_last_updated]);
        }
        const followingCount = await getFollowingCount(agent, follower.did);
        if (followingCount > followLimit) {
            console.log(`Blocking ${follower.handle} who is following ${followingCount} users.`)
            await createBlock(agent,follower.did);
            await db.run('UPDATE followers SET handle = ?, following_count = ?, block_status = ?, date_last_updated = ? WHERE did = ?', [ follower.handle, followingCount, 1, new Date().toISOString(), follower.did]);
        }
        else {
            console.log(`Doing nothing with ${follower.handle} who is following ${followingCount} users.`)
            await db.run('UPDATE followers SET handle = ?, following_count = ?, date_last_updated = ? WHERE did = ?', [follower.handle, followingCount, new Date().toISOString(), follower.did])
        }
    }

    console.log("Completed run. Exiting.")
}

checkAndBlock()