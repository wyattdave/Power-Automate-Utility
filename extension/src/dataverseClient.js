const https = require("https");
const http = require("http");
const url = require("url");
let vscode;
try {
    vscode = require("vscode");
} catch (e) {
    vscode = null;
}

const sClientId = "51f81489-12ee-4a9e-aaae-a2591f45987d";
const iLocalPort = 5500;
const sRedirectUri = "http://localhost:" + iLocalPort + "/";

// Cache tokens per environment URL to avoid re-auth on every call
let oTokenCache = {};

/**
 * Get a bearer token via browser-based OAuth2 implicit flow.
 * Opens the user's browser to the Microsoft login page, then captures the
 * token fragment via a local HTTP server.
 * @param {string} sEnvUrl - The environment URL (e.g., https://yourorg.crm.dynamics.com)
 * @param {string} sTenantId - The Entra ID tenant ID or domain
 * @returns {Promise<string>} The bearer token
 */
function getToken(sEnvUrl, sTenantId) {
    // Return cached token if still present (tokens expire after ~1hr)
    if (oTokenCache[sEnvUrl]) {
        return Promise.resolve(oTokenCache[sEnvUrl]);
    }

    return new Promise(function (resolve, reject) {
        // HTML page served at the redirect URI to extract the token from the URL fragment
        const sCallbackHtml = "<!DOCTYPE html><html><head><title>Sign In Complete</title></head>"
            + "<body style=\"font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#1e1e1e;color:#d4d4d4;\">"
            + "<div style=\"text-align:center;\">"
            + "<h2>Authentication Successful</h2>"
            + "<p>You can close this window and return to VS Code.</p>"
            + "</div>"
            + "<script>"
            + "var sHash = window.location.hash.substring(1);"
            + "var oParams = new URLSearchParams(sHash);"
            + "var sToken = oParams.get('access_token');"
            + "if (sToken) {"
            + "  fetch('/callback?token=' + encodeURIComponent(sToken))"
            + "    .then(function() { document.querySelector('h2').textContent = 'Signed In!'; })"
            + "    .catch(function() { document.querySelector('h2').textContent = 'Error sending token'; });"
            + "} else {"
            + "  document.querySelector('h2').textContent = 'No token received';"
            + "  document.querySelector('p').textContent = window.location.hash || 'No hash fragment';"
            + "}"
            + "</script></body></html>";

        let oServer;
        // Set a timeout so the user isn't stuck forever
        const iTimeout = setTimeout(function () {
            if (oServer) {
                oServer.close();
            }
            reject(new Error("Sign-in timed out after 2 minutes. Please try again."));
        }, 120000);

        oServer = http.createServer(function (oReq, oRes) {
            const oParsedUrl = url.parse(oReq.url, true);

            if (oParsedUrl.pathname === "/callback" && oParsedUrl.query.token) {
                // Token received from the browser page
                const sToken = oParsedUrl.query.token;
                oRes.writeHead(200, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
                oRes.end("OK");

                clearTimeout(iTimeout);
                oServer.close();

                // Cache the token
                oTokenCache[sEnvUrl] = sToken;
                // Clear cache after 55 minutes (tokens last ~60 min)
                setTimeout(function () {
                    delete oTokenCache[sEnvUrl];
                }, 55 * 60 * 1000);

                resolve(sToken);
            } else {
                // Serve the HTML page that extracts the fragment
                oRes.writeHead(200, { "Content-Type": "text/html" });
                oRes.end(sCallbackHtml);
            }
        });

        oServer.on("error", function (oError) {
            clearTimeout(iTimeout);
            if (oError.code === "EADDRINUSE") {
                reject(new Error("Port " + iLocalPort + " is already in use. Close any other servers on that port and try again."));
            } else {
                reject(new Error("Failed to start local auth server: " + oError.message));
            }
        });

        oServer.listen(iLocalPort, function () {
            const sAuthUrl = "https://login.microsoftonline.com/" + sTenantId + "/oauth2/v2.0/authorize"
                + "?client_id=" + sClientId
                + "&response_type=token"
                + "&redirect_uri=" + encodeURIComponent(sRedirectUri)
                + "&scope=" + encodeURIComponent(sEnvUrl + "/.default")
                + "&response_mode=fragment";

            vscode.env.openExternal(vscode.Uri.parse(sAuthUrl));
        });
    });
}

/**
 * Clear the cached token for an environment (e.g., on sign-out or error).
 * @param {string} sEnvUrl - The environment URL
 */
function clearToken(sEnvUrl) {
    if (sEnvUrl) {
        delete oTokenCache[sEnvUrl];
    } else {
        oTokenCache = {};
    }
}

/**
 * Make an HTTPS request to the Dataverse Web API.
 * @param {string} sMethod - HTTP method (GET, PATCH, DELETE)
 * @param {string} sRequestUrl - Full URL to request
 * @param {string} sToken - Bearer token
 * @param {string|null} sBody - Request body for PATCH/POST, or null
 * @returns {Promise<{iStatusCode: number, sBody: string}>}
 */
function makeRequest(sMethod, sRequestUrl, sToken, sBody) {
    return new Promise(function (resolve, reject) {
        const oParsed = url.parse(sRequestUrl);
        const oOptions = {
            hostname: oParsed.hostname,
            path: oParsed.path,
            method: sMethod,
            headers: {
                "Authorization": "Bearer " + sToken,
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                "Accept": "application/json"
            }
        };

        if (sBody) {
            oOptions.headers["Content-Type"] = "application/json";
            oOptions.headers["If-Match"] = "*";
        }

        const oProtocol = oParsed.protocol === "https:" ? https : http;

        const oReq = oProtocol.request(oOptions, function (oRes) {
            let sData = "";
            oRes.on("data", function (oChunk) {
                sData = sData + oChunk;
            });
            oRes.on("end", function () {
                resolve({ iStatusCode: oRes.statusCode, sBody: sData });
            });
        });

        oReq.on("error", function (oError) {
            reject(new Error("HTTP request failed: " + oError.message));
        });

        if (sBody) {
            oReq.write(sBody);
        }
        oReq.end();
    });
}

/**
 * List cloud flows (category 5) from the Dataverse workflows table.
 * @param {string} sEnvUrl - The environment URL
 * @param {string} sToken - Bearer token
 * @returns {Promise<Array<{sId: string, sName: string, iStateCode: number, sDescription: string}>>}
 */
function listFlows(sEnvUrl, sToken) {
    const sRequestUrl = sEnvUrl + "/api/data/v9.2/workflows?$filter=category%20eq%205&$select=workflowid,name,statecode,description&$orderby=name%20asc";

    return makeRequest("GET", sRequestUrl, sToken, null).then(function (oResponse) {
        if (oResponse.iStatusCode !== 200) {
            throw new Error("Failed to list flows. HTTP " + oResponse.iStatusCode + ": " + oResponse.sBody);
        }

        const oData = JSON.parse(oResponse.sBody);
        const aFlows = oData.value || [];

        return aFlows.map(function (oFlow) {
            return {
                sId: oFlow.workflowid,
                sName: oFlow.name || "Unnamed Flow",
                iStateCode: oFlow.statecode,
                sDescription: oFlow.description || ""
            };
        });
    });
}

/**
 * Get the clientdata field for a specific flow.
 * @param {string} sEnvUrl - The environment URL
 * @param {string} sToken - Bearer token
 * @param {string} sFlowId - The workflow GUID
 * @returns {Promise<{sName: string, sClientData: string}>}
 */
function getClientData(sEnvUrl, sToken, sFlowId) {
    const sRequestUrl = sEnvUrl + "/api/data/v9.2/workflows(" + sFlowId + ")?$select=clientdata,name";

    return makeRequest("GET", sRequestUrl, sToken, null).then(function (oResponse) {
        if (oResponse.iStatusCode !== 200) {
            throw new Error("Failed to get flow. HTTP " + oResponse.iStatusCode + ": " + oResponse.sBody);
        }

        const oData = JSON.parse(oResponse.sBody);
        const sClientData = oData.clientdata;

        if (!sClientData) {
            throw new Error("No clientdata found for flow " + sFlowId);
        }

        return {
            sName: oData.name || "unknown-flow",
            sClientData: sClientData
        };
    });
}

/**
 * Update the clientdata field for a specific flow.
 * @param {string} sEnvUrl - The environment URL
 * @param {string} sToken - Bearer token
 * @param {string} sFlowId - The workflow GUID
 * @param {string} sClientData - The updated clientdata JSON string
 * @returns {Promise<void>}
 */
function updateClientData(sEnvUrl, sToken, sFlowId, sClientData) {
    const sRequestUrl = sEnvUrl + "/api/data/v9.2/workflows(" + sFlowId + ")";
    const sBody = JSON.stringify({ clientdata: sClientData });

    return makeRequest("PATCH", sRequestUrl, sToken, sBody).then(function (oResponse) {
        if (oResponse.iStatusCode !== 204) {
            throw new Error("Failed to update flow. HTTP " + oResponse.iStatusCode + ": " + oResponse.sBody);
        }
    });
}

module.exports = {
    getToken: getToken,
    clearToken: clearToken,
    listFlows: listFlows,
    getClientData: getClientData,
    updateClientData: updateClientData
};
