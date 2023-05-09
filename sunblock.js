import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bsky from "@atproto/api";
const {BskyAgent} = bsky;
import process from "node:process";

import dotenv from 'dotenv';
import axios from "axios";

dotenv.config();

const apiUser = process.env.ATPROTO_USER
const apiPassword = process.env.ATPROTO_PASS
const followLimit = process.env.FOLLOW_LIMIT

const baseUrl = "https://bsky.social"

sqlite3.verbose()

async function authenticateBsky() {
    const agent = new BskyAgent({
        service: baseUrl,
    });
    await agent.login({
        identifier: apiUser,
        password: apiPassword,
    });

    return agent;
}

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

async function getFollowers(agent) {
    let allFollowers = [];
    let nextCursor;

    try {
        do {
            const response = await agent.getFollowers({ actor: apiUser, cursor: nextCursor });
            allFollowers = allFollowers.concat(response.data.followers);
            nextCursor = response.data.cursor;
        } while (nextCursor);

        return allFollowers;
    } catch (error) {
        console.error(`Error in getFollowers: ${error.message}`);
    }
}

async function getFollowing(agent, did) {
    try {

        const profile = await agent.getProfile({actor:did})

        return profile.data.followsCount;
    } catch (error) {
        console.error(`Error in getFollowing: ${error.message}`);
    }
}

async function createBlock(agent, did) {

    const params = {
        collection: "app.bsky.graph.block",
        record: {
            $type: "app.bsky.graph.block",
            createdAt: new Date().toISOString(),
            subject: did
        },
        repo: agent.session.did
    }

    const accessToken = agent.session.accessJwt

    const blockEndpoint = baseUrl + "/xrpc/com.atproto.repo.createRecord"

    try {
        const response = await axios.post(blockEndpoint, params, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return response;
    } catch (error) {
        console.error(`Error in createBlock: ${error.message}`);
    }
}

export async function checkAndBlock() {

    console.log("Starting check and block...")

    const agent = await authenticateBsky()
    console.log("Authenticated with Bluesky.")

    const db = await dbPromise;
    await createTable();

    console.log("Database opened.")

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
        const followingCount = await getFollowing(agent, follower.did);
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