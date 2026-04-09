/**
 * WEATHER_EDGE_TERMINAL — main.js
 *
 * Manages the Kalshi WebSocket connection and bridges market data
 * to the background worker that runs sensor polling + edge math.
 *
 * Auth: Kalshi's trading WS requires a session token obtained via
 * POST /trade-api/v2/log_in (REST). Store the returned token in
 * sessionStorage and pass it below, or use a local signing proxy.
 * Never hard-code credentials in this file.
 */

const SESSION_TOKEN = sessionStorage.getItem('kalshi_token') || '';

// Market ticker → ICAO mapping
const markets = {
    'KXCHITEMP-26APR-T85': 'KORD',
    'KXNYCTEMP-26APR-T90': 'KNYC',
    'KXMIATEMP-26APR-T92': 'KMIA',
    'KXAUSTEMP-26APR-T95': 'KAUS',
};

// Target temperatures (°F) matching the tickers above
const targets = {
    KORD: 85.0,
    KNYC: 90.0,
    KMIA: 92.0,
    KAUS: 95.0,
};

// ── Build grid rows ──────────────────────────────────────────────
const grid = document.getElementById('terminal-grid');
Object.values(markets).forEach(icao => {
    const row = document.createElement('div');
    row.id = `row-${icao}`;
    row.className = 'row';
    row.innerHTML = `
        <span>${icao}</span>
        <span id="${icao}-temp">--.--</span>
        <span id="${icao}-target">${targets[icao].toFixed(1)}</span>
        <span id="${icao}-ask">--.--</span>
        <span id="${icao}-edge">--.--</span>
        <span id="${icao}-status" class="status-offline">OFFLINE</span>
    `;
    grid.appendChild(row);
});

// ── Worker ───────────────────────────────────────────────────────
const weatherWorker = new Worker('engine/worker.js');

// Seed the worker with targets so it can compute edge independently
weatherWorker.postMessage({ type: 'INIT', targets });

weatherWorker.onmessage = (e) => {
    const { icao, currentF, ask, edge, isTriggered, status } = e.data;
    const row = document.getElementById(`row-${icao}`);
    if (!row) return;

    document.getElementById(`${icao}-temp`).textContent   = currentF.toFixed(2);
    document.getElementById(`${icao}-ask`).textContent    = ask.toFixed(2);
    document.getElementById(`${icao}-edge`).textContent   = (edge * 100).toFixed(1) + '%';

    const statusEl = document.getElementById(`${icao}-status`);
    statusEl.textContent  = status;
    statusEl.className    = `status-${status.toLowerCase()}`;

    if (isTriggered) row.classList.add('trigger');
    else             row.classList.remove('trigger');
};

// ── Kalshi WebSocket ─────────────────────────────────────────────
function connectKalshi() {
    // Browser WebSocket does not support custom headers.
    // Auth is handled by passing the session token in the first message
    // after the connection is open (Kalshi's protocol supports this).
    const ws = new WebSocket('wss://trading-api.kalshi.com/trade-api/v2/ws');

    ws.onopen = () => {
        // Subscribe to order book updates for all tracked markets
        ws.send(JSON.stringify({
            id:  1,
            cmd: 'subscribe',
            params: {
                channels: ['orderbook_delta'],
                market_tickers: Object.keys(markets),
            },
            // Pass session token if available (Kalshi accepts it here)
            ...(SESSION_TOKEN && { token: SESSION_TOKEN }),
        }));
        console.log('[WS] connected + subscribed');
    };

    ws.onmessage = (e) => {
        let data;
        try { data = JSON.parse(e.data); } catch { return; }

        if (data.type !== 'orderbook_delta') return;

        const msg    = data.msg;
        const ticker = msg?.market_ticker;
        const icao   = markets[ticker];
        if (!icao) return;

        // NO bids are ordered best-first (highest price first).
        // Best NO bid → implied YES ask = 1 - (bestNoBid / 100).
        const noBids = msg?.no;
        if (!noBids?.length) return;

        const bestNoBid = noBids[0][0];            // FIX: was bids[bids.length-1]
        const yesAsk    = 1.0 - (bestNoBid / 100);

        weatherWorker.postMessage({ type: 'MARKET', icao, ask: yesAsk });
    };

    ws.onerror = (err) => console.error('[WS] error', err);
    ws.onclose = ()    => {
        console.warn('[WS] closed — reconnecting in 5s');
        setTimeout(connectKalshi, 5000);
    };
}

connectKalshi();
