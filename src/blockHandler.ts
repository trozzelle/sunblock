import bsky, { AppBskyGraphBlock, BskyAgent, ComAtprotoRepoListRecords} from "@atproto/api";
import {createBlock, deleteBlock, getBlocks, getFollowers, getFollowingCount} from "./api.js";
import {getAllUserBlocks, getSingleSubscriptionBlocks, getAllSubscriptionBlocks, getUniqueDids, getFollower, insertFollower, insertSubscriptionBlock, insertUserBlock, getSingleUserBlock, deleteUserBlock, deleteSubscriptionBlock, updateFollower, getAllSubscriptions, checkBlockExists} from "./db.js";
import {Bsky} from "@atproto/api/dist/helpers/bsky";

interface Blocks extends Array<ComAtprotoRepoListRecords.Record>{}

async function exceedsMaxFollowCount(agent: BskyAgent, did, followLimit ) {

    const followingCount = await getFollowingCount(agent, did);
    const exceedsMax = followingCount > followLimit

    return {exceedsMax, followingCount}
}

async function userBlockExists(did) {

    const blockExists = await checkBlockExists(did, 'blocks')
    return blockExists > 0

}

async function parserKeyFromURI (uri: string) {

    // Needs some guard rails
        const parts = uri.split('/')
        const rKey = parts[parts.length - 1]

        return rKey

}

async function syncRepoUserBlockList(agent: BskyAgent, did: string) {

    const repoUserBlocks = await getBlocks(agent, did)
    const allUserBlocks = await getAllUserBlocks()
    const allUserBlocksSet = new Set(allUserBlocks.map(block => block.did))

    if(repoUserBlocks.length > 0) {

        console.log(`Repo has ${repoUserBlocks.length} blocks`)
        for (const block of repoUserBlocks) {
            if(!allUserBlocksSet.has(block.value.subject)) {

                console.log(`Repo block at ${block.uri} does not exist in the local block list.`)
                const rkey = await parserKeyFromURI(block.uri)
                const profile = await agent.getProfile({actor:block.value.subject})
                await insertUserBlock({did: block.value.subject, handle: profile.data.handle, rkey: rkey, reason: 'manual', date_blocked: block.value.createdAt, date_last_updated: new Date().toISOString()})
                console.log(`${block.value.subject} blocked.`)
            }
        }
    }



}

async function syncUserBlockList(agent: BskyAgent) {

    console.log('Starting user block list sync...')

    const uniqueSubscribedBlocks = await getUniqueDids('subscriptionBlocks', 'blocks')
    const orphanedUserBlocks = await getUniqueDids('blocks', 'subscriptionBlocks')

    console.log(`${uniqueSubscribedBlocks.length} new blocks from subscriptions. ${orphanedUserBlocks.length} orphaned blocks to unblock.`)

    if(uniqueSubscribedBlocks.length > 0) {
        for (const block of uniqueSubscribedBlocks) {
            try {

                const response = await createBlock(agent, block.did)
                const {data: {handle}} = await agent.getProfile({actor: block.did})

                const rkey = await parserKeyFromURI(response.data.uri)

                await insertUserBlock({did: block.did,
                    handle: handle,
                    rkey: rkey,
                    reason: 'subscription',
                    date_blocked: new Date().toISOString(),
                    date_last_updated: new Date().toISOString()} )

                console.log(`${block.did} blocked`)

            } catch (error) {
                console.error(`Unable to process blocking for ${block.did}: ${error}`)
            }
        }
    }

    if(orphanedUserBlocks.length > 0) {
        for(const block of orphanedUserBlocks) {
            try {
                const record = await getSingleUserBlock(block.did)
                const response = await deleteBlock(agent, block.did, record.r_key)

                if (response.status == '200') {
                    await deleteUserBlock(block.did)
                    console.log(`Deleted block for ${record.did}`)
                }
            } catch(error) {
                console.error('')
            }
        }
    }

}

async function blockSubscriptions(agent: BskyAgent, subscriptionsList: string) {

    const subscriptions = subscriptionsList.split(',')

    console.log(`Retrieving blocks for the following users: ${subscriptions}`)

    try {
        const newSubscriptionDidsSet = new Set();
        const allSubscriptionBlocksCurrent = await getAllSubscriptionBlocks()

        for (const handle of subscriptions) {

            console.log(`Requesting block list from user ${handle}`)

            const {data: {did: subscriptionDid}} = await agent.resolveHandle({handle: handle});
            const subscriptionBlocksNew: Blocks = await getBlocks(agent, subscriptionDid);

            if(!subscriptionBlocksNew) {
                throw Error
            }

            console.log(`Received block list of ${subscriptionBlocksNew.length} entries`)
            console.log(`Retrieving all subscribed block lists from the database`)

            const subscriptionBlocksCurrent = await getSingleSubscriptionBlocks(subscriptionDid)
            const subscriptionBlocksCurrentSet = new Set(subscriptionBlocksCurrent.map(block => block.did))

            console.log(`Retrieved ${subscriptionBlocksCurrentSet.size} blocks from the database.`)

            for (const block of subscriptionBlocksNew) {

                const blockDid = block.value.subject
                newSubscriptionDidsSet.add(blockDid)

                try {
                    const date_last_updated = new Date().toISOString();

                    if (!subscriptionBlocksCurrentSet.has(blockDid)) {
                        await insertSubscriptionBlock({blocked_did: blockDid, subscribed_did: subscriptionDid, date_last_updated});
                        console.log(`${blockDid} inserted into subscriptionBlock`)
                    } else {
                        console.log(`${blockDid} already exists in block list for ${handle}. Skipping insert.`)
                    }
                } catch (error) {
                    console.error(`Error adding subscription block for user: ${error.message}`);
                }
            }
        }

        for (const block of allSubscriptionBlocksCurrent) {
            if(!newSubscriptionDidsSet.has(block.did)) {
                await deleteSubscriptionBlock(block.did)
                console.log(`Removed ${block.did} from subscriptionBlocks as it no longer appears in any subscription lists`)
            }
        }
    } catch (error) {
        console.error(`Error running blockSubscriptions: ${error.message}`);
    }
}

async function blockSpam(agent: BskyAgent, db: any, followLimit: number): Promise<void> {

    try {
        const followers = await getFollowers(agent);

        if(!followers) {
            throw Error
        }

        for (const follower of followers) {

            let followerRow = await getFollower(follower.did)

            if (!followerRow) {
                followerRow = {
                    did: follower.did,
                    handle: follower.handle,
                    following_count: 0,
                    block_status: 0,
                    date_last_updated: new Date().toISOString(),
                };
                await insertFollower({did: follower.did, handle: follower.handle, following_count: follower.following_count, block_status: follower.block_status, date_last_updated: new Date().toISOString()})
            }

            const { exceedsMax, followingCount } = await exceedsMaxFollowCount(agent, follower.did, followLimit)

            // @ts-ignore
            if (exceedsMax) {

                console.log(`Blocking ${follower.handle} who is following ${followingCount} users.`)
                const blockExists = await userBlockExists(follower.did)

                if(!blockExists) {
                    const response = await createBlock(agent, follower.did);
                    const rKey = await parserKeyFromURI(response.data.uri)
                    await insertUserBlock({
                        did: follower.did,
                        handle: follower.handle,
                        rkey: rKey,
                        reason: 'spam',
                        date_blocked: new Date().toISOString(),
                        date_last_updated: new Date().toISOString()
                    })
                    console.log(`Blocked ${follower.handle}.`)
                } else {
                    console.log(`${follower.handle} is already in block list. Updating followers table then continuing.`)
                }
                await updateFollower({did:follower.did, handle: follower.handle, following_count: followingCount, block_status: 1, date_last_updated: new Date().toISOString()})
            } else {
                console.log(`Doing nothing with ${follower.handle} who is following ${followingCount} users.`)
                await updateFollower({did:follower.did, handle: follower.handle, following_count: followingCount, block_status: 0, date_last_updated: new Date().toISOString()})
            }
        }
    } catch (error) {
        console.error(`Error running spam blocker: ${error.message}`);
    }
}

export {blockSpam, blockSubscriptions, syncUserBlockList, syncRepoUserBlockList}