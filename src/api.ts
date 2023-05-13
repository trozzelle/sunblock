// @ts-ignore
import bsky, {
    BskyAgent,
    AppBskyActorGetProfile,
    AppBskyGraphGetFollowers,
    ComAtprotoRepoListRecords,
} from "@atproto/api";
import axios, {AxiosResponse} from "axios";
import process from "node:process";
import dotenv from 'dotenv';
import logger from "./logger.js";
// @ts-ignore
const {BskyAgent} = bsky;
import {Block, Follower, Did} from "./types";

const apiLogger = logger.child({module: 'api.ts'})


dotenv.config();

const apiUser = process.env.ATPROTO_USER as string
const apiPass = process.env.ATPROTO_PASS as string
const baseUrl = "https://bsky.social"


async function authenticateBsky(): Promise<BskyAgent> {
    const agent = new BskyAgent({
        service: baseUrl,
    });
    await agent.login({
        identifier: apiUser,
        password: apiPass,
    });
    return agent;
}

//
// Get the count of accounts a user is following
async function getProfile(agent: BskyAgent, did: Did) {

    try {
        return await agent.getProfile({actor:did})
    } catch (error) {
        apiLogger.error(`Error in getFollowing: ${error.message}`);
    }
}

// Gets all followers of the calling user
async function getFollowers(agent: BskyAgent) {
    let allFollowers: Follower[] = [];
    let nextCursor: string;

    try {
        do {
            const response: AppBskyGraphGetFollowers.Response = await agent.getFollowers({ actor: apiUser, cursor: nextCursor });
            // @ts-ignore
            allFollowers = allFollowers.concat(response.data.followers); //TODO fix type
            nextCursor = response.data.cursor;
        } while (nextCursor);

        return allFollowers;
    } catch (error) {
        apiLogger.error(`Error in getFollowers: ${error.message}`);
    }
}

// Get the count of accounts a user is following
async function getFollowingCount(agent: BskyAgent, did: Did) {

    try {
        const profile: AppBskyActorGetProfile.Response = await agent.getProfile({actor:did})
        return profile.data.followsCount;
    } catch (error) {
        apiLogger.error(`Error in getFollowing: ${error.message}`);
    }
}

// Get a user's blocks
async function getBlocks (agent: BskyAgent, did: Did) {

    let blocks: Block[] = [];
    let nextCursor: string;

    try {
        do {
            const response: ComAtprotoRepoListRecords.Response = await agent.com.atproto.repo.listRecords({repo: did, collection: 'app.bsky.graph.block', cursor:nextCursor})
            // @ts-ignore
            blocks = blocks.concat(response.data.records); //TODO Fix types
            nextCursor = response.data.cursor;
        } while (nextCursor);

        return blocks
    } catch(error) {
        apiLogger.error(`Error getting block list: ${error.message}`)
    }

}

// Creates a single block
async function createBlock(agent: BskyAgent, did: Did) {

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
        const response: AxiosResponse = await axios.post(blockEndpoint, params, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return response;
    } catch (error) {
        apiLogger.error(`Error in createBlock: ${error.message}`);
    }
}

// Deletes a single block
async function deleteBlock(agent: BskyAgent, did: Did, rkey: string) {

    const params = {
        collection: "app.bsky.graph.block",
        rkey: rkey,
        repo: agent.session.did
    }

    const accessToken = agent.session.accessJwt
    const blockEndpoint = baseUrl + "/xrpc/com.atproto.repo.deleteRecord"

    try {
        const response: AxiosResponse = await axios.post(blockEndpoint, params, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return response;
    } catch (error) {
        apiLogger.error(`Error in createBlock: ${error.message}`);
    }
}

export { authenticateBsky, getProfile, getFollowers, getFollowingCount, getBlocks, createBlock, deleteBlock };
