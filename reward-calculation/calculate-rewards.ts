import fetch from 'node-fetch'; // Note: In a real repo, might need to install this or use native fetch in Node 18+

// --- Configuration ---
const EVENT_SLUG = "russia-x-ukraine-ceasefire-in-2025"; // Change this to test other markets
const INVESTMENT_AMOUNT = 1000; // USD

// --- Interfaces ---
interface Order {
    price: string;
    size: string;
}

interface OrderBook {
    bids: Order[];
    asks: Order[];
}

interface Market {
    question: string;
    clobTokenIds: string; // JSON string
    outcomes: string;     // JSON string
    clobRewards: { rewardsDailyRate: number }[];
}

// --- Main Logic ---
async function calculateRewards() {
    console.log(`\n--- Polymarket Reward Calculator Example ---`);
    console.log(`Target Event: ${EVENT_SLUG}`);
    console.log(`Investment: $${INVESTMENT_AMOUNT}\n`);

    try {
        // 1. Fetch Event/Market Data
        const eventUrl = `https://gamma-api.polymarket.com/events?slug=${EVENT_SLUG}`;
        const eventResp = await fetch(eventUrl);
        const eventData = await eventResp.json();

        if (!eventData || eventData.length === 0) {
            throw new Error("Event not found. Check the slug.");
        }

        const market = eventData[0].markets[0] as Market;
        const dailyRewardPool = market.clobRewards?.[0]?.rewardsDailyRate || 0;

        console.log(`Market Question: ${market.question}`);
        console.log(`Daily Reward Pool: $${dailyRewardPool.toFixed(2)}\n`);

        const tokenIds: string[] = JSON.parse(market.clobTokenIds);
        const outcomes: string[] = JSON.parse(market.outcomes);

        // 2. Process each outcome
        for (let i = 0; i < tokenIds.length; i++) {
            const tokenId = tokenIds[i];
            const outcome = outcomes[i];

            // 3. Fetch Order Book
            const bookUrl = `https://clob.polymarket.com/book?token_id=${tokenId}`;
            const bookResp = await fetch(bookUrl);
            const orderBook = (await bookResp.json()) as OrderBook;

            // 4. Sort Order Book (CRITICAL STEP)
            // Bids: Descending (Highest price first)
            // Asks: Ascending (Lowest price first)
            const bids = (orderBook.bids || []).map(b => ({ price: parseFloat(b.price), size: parseFloat(b.size) }))
                .sort((a, b) => b.price - a.price);
            const asks = (orderBook.asks || []).map(a => ({ price: parseFloat(a.price), size: parseFloat(a.size) }))
                .sort((a, b) => a.price - b.price);

            // Determine Mid Price
            const bestBid = bids.length > 0 ? bids[0].price : 0;
            const bestAsk = asks.length > 0 ? asks[0].price : 0;
            const midPrice = (bestBid + bestAsk) / 2;

            console.log(`Outcome: ${outcome} (Mid Price: ${midPrice.toFixed(4)})`);

            // 5. Calculate Depth and Rewards for different spreads
            const spreads = [
                { label: "1%", val: 0.01 },
                { label: "2%", val: 0.02 },
                { label: "3%", val: 0.03 }
            ];

            for (const spread of spreads) {
                // Use Additive Spread (e.g. +/- 1 cent) for accurate low-price handling
                const minBid = midPrice - spread.val;
                const maxAsk = midPrice + spread.val;

                const validBids = bids.filter(b => b.price >= minBid);
                const validAsks = asks.filter(a => a.price <= maxAsk);

                // Calculate Depth in USD (Price * Size)
                const bidDepth = validBids.reduce((sum, b) => sum + (b.price * b.size), 0);
                const askDepth = validAsks.reduce((sum, a) => sum + (a.price * a.size), 0);
                const totalDepth = bidDepth + askDepth;

                // Estimate Reward
                // Formula: DailyPool * (UserInv / (TotalDepth + UserInv))
                // Note: This assumes the pool is split equally or based on probability. 
                // For simplicity here, we apply the user's share to the *entire* pool for this outcome's liquidity.
                // In reality, rewards are split by outcome probability.
                const userShare = INVESTMENT_AMOUNT / (totalDepth + INVESTMENT_AMOUNT);
                // Adjust reward by probability (approximate using price)
                const outcomeRewardPool = dailyRewardPool * midPrice;
                const estReward = outcomeRewardPool * userShare;

                console.log(`  Spread +/- ${spread.label} ($${minBid.toFixed(3)} - $${maxAsk.toFixed(3)}):`);
                console.log(`    Depth: $${totalDepth.toFixed(2)} (Bids: $${bidDepth.toFixed(0)}, Asks: $${askDepth.toFixed(0)})`);
                console.log(`    Est. Daily Reward: $${estReward.toFixed(2)}`);
            }
            console.log("");
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

calculateRewards();
