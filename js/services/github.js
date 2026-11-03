/**
 * GitHub API Bidirectional Sync Service
 */
window.GitHubSyncService = {
    getBaseUrl(ghConfig) {
        return `https://api.github.com/repos/${ghConfig.username}/${ghConfig.repo}/contents/data.json`;
    },

    getHeaders(token) {
        return {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
    },

    /**
     * Pull data.json from GitHub repository
     */
    async pull(ghConfig) {
        if (!ghConfig.token || !ghConfig.username || !ghConfig.repo) {
            throw new Error('GitHub configuration is incomplete.');
        }

        const url = this.getBaseUrl(ghConfig);
        const res = await fetch(url, {
            headers: this.getHeaders(ghConfig.token)
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || `GitHub error: HTTP ${res.status}`);
        }

        const data = await res.json();
        const jsonString = window.BarUtils.base64ToUtf8(data.content);
        const decoded = JSON.parse(jsonString);

        return {
            ingredients: Array.isArray(decoded.ingredients) ? decoded.ingredients : [],
            recipes: Array.isArray(decoded.recipes) ? decoded.recipes : [],
            orders: Array.isArray(decoded.orders) ? decoded.orders : [],
            audits: Array.isArray(decoded.audits) ? decoded.audits : [],
            sha: data.sha
        };
    },

    /**
     * Push data.json to GitHub repository
     */
    async push(ghConfig, payload) {
        if (!ghConfig.token || !ghConfig.username || !ghConfig.repo) {
            throw new Error('GitHub configuration is incomplete.');
        }

        const url = this.getBaseUrl(ghConfig);
        const headers = this.getHeaders(ghConfig.token);

        // Fetch current SHA to avoid conflict
        let sha = '';
        try {
            const getRes = await fetch(url, { headers });
            if (getRes.ok) {
                const fileData = await getRes.json();
                sha = fileData.sha;
            }
        } catch (e) {
            console.warn('Could not fetch existing file SHA, attempting direct commit:', e);
        }

        const jsonString = JSON.stringify(payload, null, 2);
        const contentEncoded = window.BarUtils.utf8ToBase64(jsonString);

        const bodyData = {
            message: 'Auto-sync inventory, recipes, orders, and audits via web app',
            content: contentEncoded
        };
        if (sha) bodyData.sha = sha;

        const putRes = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify(bodyData)
        });

        if (!putRes.ok) {
            const errData = await putRes.json().catch(() => ({}));
            throw new Error(errData.message || `GitHub error: HTTP ${putRes.status}`);
        }

        return await putRes.json();
    }
};
