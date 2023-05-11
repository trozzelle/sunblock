import bsky, {
    BskyAgent,
    AppBskyActorGetProfile,
    AppBskyGraphBlock,
    AppBskyGraphGetFollowers,
    ComAtprotoRepoListRecords,
    AppBskyGraphFollow, AppBskyActorDefs
} from "@atproto/api";
import axios, {AxiosResponse} from "axios";
import process from "node:process";
import dotenv from 'dotenv';
const {BskyAgent} = bsky;


dotenv.config();

const apiUser = process.env.ATPROTO_USER as string

const baseUrl = "https://bsky.social"

interface Blocks extends Array<ComAtprotoRepoListRecords.Record>{}
interface Followers extends Array<AppBskyActorDefs.ProfileView>{}

async function authenticateBsky(): Promise<BskyAgent> {
    const agent = new BskyAgent({
        service: baseUrl,
    });
    await agent.login({
        identifier: process.env.ATPROTO_USER,
        password: process.env.ATPROTO_PASS,
    });
    return agent;
}

async function getFollowers(agent: BskyAgent) {
    let allFollowers: Followers = [];
    let nextCursor;

    try {
        do {
            const response: AppBskyGraphGetFollowers.Response = await agent.getFollowers({ actor: apiUser, cursor: nextCursor });
            allFollowers = allFollowers.concat(response.data.followers);
            nextCursor = response.data.cursor;
        } while (nextCursor);

        return allFollowers;
    } catch (error) {
        console.error(`Error in getFollowers: ${error.message}`);
    }
}

async function getFollowingCount(agent: BskyAgent, did: string) {

    try {
        const profile: AppBskyActorGetProfile.Response = await agent.getProfile({actor:did})
        console.dir(profile)
        return profile.data.followsCount;
    } catch (error) {
        console.error(`Error in getFollowing: ${error.message}`);
    }
}

async function getBlocks (agent: BskyAgent, did: string) {

    let blocks: Blocks = [];
    let nextCursor;

    try {
        do {
            const response: ComAtprotoRepoListRecords.Response = await agent.com.atproto.repo.listRecords({repo: did, collection: 'app.bsky.graph.block', cursor:nextCursor})

            blocks = blocks.concat(response.data.records);
            nextCursor = response.data.cursor;
        } while (nextCursor);

        return blocks
    } catch(error) {
        console.error(`Error getting block list: ${error.message}`)
    }

}

async function createBlock(agent: BskyAgent, did: string) {

    const params = {
        collection: "app.bsky.graph.block",
        record: {
            $type: "app.bsky.graph.block",
            createdAt: new Date().toISOString(),
            subject: did
        },
        repo: agent.session!.did
    }

    const accessToken = agent.session!.accessJwt

    const blockEndpoint = baseUrl + "/xrpc/com.atproto.repo.createRecord"

    try {
        const response: AxiosResponse = await axios.post(blockEndpoint, params, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return response;
    } catch (error) {
        console.error(`Error in createBlock: ${error.message}`);
    }
}

async function deleteBlock(agent: BskyAgent, did: string, rkey: string) {

    const params = {
        collection: "app.bsky.graph.block",
        rkey: rkey,
        repo: agent.session!.did
    }


    const accessToken = agent.session!.accessJwt

    const blockEndpoint = baseUrl + "/xrpc/com.atproto.repo.deleteRecord"

    try {
        const response: AxiosResponse = await axios.post(blockEndpoint, params, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return response;
    } catch (error) {
        console.error(`Error in createBlock: ${error.message}`);
    }
}

export { authenticateBsky, getFollowers, getFollowingCount, getBlocks, createBlock, deleteBlock };