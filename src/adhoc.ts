import {authenticateBsky, getBlocks, deleteBlock} from "./api.js";
import dotenv from "dotenv";

dotenv.confg()

const user = process.env.ATPROTO_USER
const pass = process.env.ATPROTO_PASS

    async function main() {

        const agent = await authenticateBsky()

        const {data: {did}} = await agent.resolveHandle({handle:user})

        const blocks = await getBlocks(agent, did)

        const rkeys = blocks.map((block) => {
            let uri = block.uri
            let parts = uri.split('/');
            let lastSegment = parts[parts.length - 1];
            console.log(lastSegment);  // Output: 3jvexyj3js72n

            return lastSegment
        })

        for (const key in rkeys) {

            await deleteBlock(agent, agent.session.did, rkeys[key])

        }

    }

main()