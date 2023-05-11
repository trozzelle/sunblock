import {BskyAgent} from "@atproto/api";
import {createBlock, getBlocks, getFollowers, getFollowingCount} from "./api.js";
import {getAllBlocks, getAllSubscriptionBlocks, insertFollower, insertSubscriptionBlock, insertUserBlock, updateFollower} from "./db.js";


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
            const subscriptionBlocksNew = await getBlocks(agent, subscriptionDid);

            console.log(`Received block list of ${subscriptionBlocksNew.length} entries`)

            console.log(`Retrieving all subscribed block lists from the database`)
            const subscriptionBlocksCurrent = await getAllSubscriptionBlocks(subscriptionDid)
            const subscriptionBlocksCurrentSet = new Set(subscriptionBlocksCurrent.map(block => block.blocked_did))

            console.log(`Retrieved ${subscriptionBlocksCurrentSet.size} blocks from the database.`)

            for (const block of subscriptionBlocksNew) {

                const blockDid = block.value.subject

                try {
                    const date_last_updated = new Date().toISOString();

                    if (!subscriptionBlocksCurrentSet.has(blockDid)) {
                        await insertSubscriptionBlock({subscribed_did: subscriptionDid, blocked_did: blockDid, date_last_updated});
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
                // await db.run('INSERT INTO followers(did, handle, following_count, block_status, date_last_updated) VALUES (?, ?, ?, ?, ?)', [follower.did, follower.handle, follower.following_count, follower.block_status, follower.date_last_updated]);
                await insertFollower({did: follower.did, handle: follower.handle, following_count: follower.following_count, block_status: follower.block_status, date_last_updated: follower.date_last_updated})
            }
            const followingCount = await getFollowingCount(agent, follower.did);
            if (followingCount > followLimit) {
                console.log(`Blocking ${follower.handle} who is following ${followingCount} users.`)
                await createBlock(agent, follower.did);
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


export {blockSpam, blockSubscriptions}