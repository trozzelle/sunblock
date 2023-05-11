import bsky, { AppBskyGraphBlock, BskyAgent, ComAtprotoRepoListRecords} from "@atproto/api";
import {createBlock, getBlocks, getFollowers, getFollowingCount} from "./api.js";
import {getAllBlocks, getSingleSubscriptionBlocks, getAllSubscriptionBlocks, getUniqueDids, getFollower, insertFollower, insertSubscriptionBlock, insertUserBlock, updateFollower, checkBlockExists} from "./db.js";
import {Bsky} from "@atproto/api/dist/helpers/bsky";

interface Blocks extends Array<ComAtprotoRepoListRecords.Record>{}

async function exceedsMaxFollowCount(agent: BskyAgent, did, followLimit ) {

    const followingCount = await getFollowingCount(agent, did);

    const exceedsMax = followingCount > followLimit

    return {exceedsMax, followingCount}
}

async function userBlockExists(did) {

    const blockExists = await checkBlockExists(did, 'blocks')

    return blockExists.length > 0

}


async function updateUserBlockList() {

    const userBlocksCurrent = await getAllBlocks()
    // const userBlockCurrentsSet = new Set(userBlocksCurrent.map(block => block.did));

    const subscriptionBlocksCurrent = await getAllSubscriptionBlocks()
    // const subscriptionBlocksCurrentSet = new Set(subscriptionBlocksCurrent.map(block => block.blocked_did))

    const uniqueSubscribedBlocks = await getUniqueDids('subscriptionBlocks', 'blocks')

    const orphanedUserBlocks = await getUniqueDids('blocks', 'subscriptionBlocks')

    console.dir(uniqueSubscribedBlocks)
    console.dir(orphanedUserBlocks)


}

async function blockSubscriptions(agent: BskyAgent, subscriptionsList: string) {

    const subscriptions = subscriptionsList.split(',')

    console.log(`Retrieving blocks for the following users: ${subscriptions}`)

    try {
        const userBlocksAll = await getAllBlocks();
        const userBlocksSet = new Set(userBlocksAll.map(block => block.did));

        console.log(`Retrieved ${userBlocksSet.size} blocks from the database.`)

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
            const subscriptionBlocksCurrentSet = new Set(subscriptionBlocksCurrent.map(block => block.blocked_did))

            console.log(`Retrieved ${subscriptionBlocksCurrentSet.size} blocks from the database.`)

            for (const block of subscriptionBlocksNew) {

                const blockDid = block.value.subject

                try {
                    const date_last_updated = new Date().toISOString();

                    if (!subscriptionBlocksCurrentSet.has(blockDid)) {
                        await insertSubscriptionBlock({blocked_did: blockDid, subscribed_did: subscriptionDid, date_last_updated});
                    } else {
                        console.log(`${blockDid} already exists in block list for ${handle}. Skipping insert.`)
                    }

                    if (!userBlocksSet.has(blockDid)) {

                        const blockProfile = await agent.getProfile({actor: blockDid})
                        const date_blocked = new Date().toISOString();

                        await createBlock(agent, blockDid);
                        await insertUserBlock({did: blockDid, handle: blockProfile.data.handle, date_blocked, date_last_updated});

                        console.log(`${blockProfile.data.handle} blocked.`)

                        userBlocksSet.add(blockDid);
                    } else {
                        console.log(`${blockDid} already exists in user block list. Skipping.`)
                    }

                } catch (error) {
                    console.error(`Error blocking user: ${error.message}`);
                }
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
                    await createBlock(agent, follower.did);
                    await insertUserBlock({
                        did: follower.did,
                        handle: follower.handle,
                        date_blocked: new Date().toISOString(),
                        date_last_updated: new Date().toISOString()
                    })
                    console.log(`Blocking ${follower.handle} who is following ${followingCount} users.`)
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


export {blockSpam, blockSubscriptions, updateUserBlockList}