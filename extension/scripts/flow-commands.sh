#!/bin/bash
# ============================================================================
# Power Automate Flow Commands
# Bash commands for managing Power Automate cloud flows via Dataverse Web API
#
# Prerequisites:
#   - A modern browser for OAuth sign-in
#   - curl installed
#   - jq installed for JSON parsing
#   - VS Code (code) available in PATH
#   - python3 (for local callback server) OR manually copy the token
#
# Note: Only solution-aware flows (category 5) are supported.
#       Flows under "My Flows" that are not in a solution cannot be managed.
# ============================================================================

CLIENT_ID="51f81489-12ee-4a9e-aaae-a2591f45987d"
REDIRECT_URI="http://localhost:5500/"
TOKEN=""

# ----------------------------
# 1. Sign In to Environment
# ----------------------------
# Opens a browser for OAuth2 implicit flow sign-in, captures the token
# via a local Python HTTP server.
#
# Usage:
#   source flow-commands.sh
#   flow_sign_in "your-tenant-id" "https://yourorg.crm.dynamics.com"
#
flow_sign_in() {
    local TENANT_ID="$1"
    local ENV_URL="$2"

    if [ -z "$TENANT_ID" ] || [ -z "$ENV_URL" ]; then
        echo "Usage: flow_sign_in <tenant-id> <environment-url>"
        echo "Example: flow_sign_in contoso.onmicrosoft.com https://yourorg.crm.dynamics.com"
        return 1
    fi

    local AUTH_URL="https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${REDIRECT_URI}', safe=''))")&scope=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${ENV_URL}/.default', safe=''))")&response_mode=fragment"

    # Create a small Python HTTP server to capture the token
    local CALLBACK_SCRIPT=$(cat <<'PYEOF'
import http.server, urllib.parse, sys, threading

class Handler(http.server.BaseHTTPRequestHandler):
    token = None
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        if parsed.path == "/callback" and "token" in params:
            Handler.token = params["token"][0]
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b"OK")
            threading.Thread(target=self.server.shutdown).start()
        else:
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            html = """<!DOCTYPE html><html><body style="font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#1e1e1e;color:#d4d4d4;">
<div style="text-align:center;"><h2>Authentication Successful</h2><p>You can close this window.</p></div>
<script>
var h=window.location.hash.substring(1);var p=new URLSearchParams(h);var t=p.get('access_token');
if(t){fetch('/callback?token='+encodeURIComponent(t)).then(function(){document.querySelector('h2').textContent='Signed In!';});}
else{document.querySelector('h2').textContent='No token received';}
</script></body></html>"""
            self.wfile.write(html.encode())
    def log_message(self, format, *args):
        pass

server = http.server.HTTPServer(("localhost", 5500), Handler)
print("Waiting for sign-in callback on port 5500...")
server.serve_forever()
if Handler.token:
    print("TOKEN:" + Handler.token)
    sys.exit(0)
else:
    sys.exit(1)
PYEOF
)

    echo "Opening browser for sign-in..."

    # Open browser (cross-platform)
    if command -v xdg-open &> /dev/null; then
        xdg-open "$AUTH_URL" &
    elif command -v open &> /dev/null; then
        open "$AUTH_URL" &
    elif command -v start &> /dev/null; then
        start "$AUTH_URL" &
    else
        echo "Please open this URL in your browser:"
        echo "$AUTH_URL"
    fi

    # Run the callback server and capture token
    local OUTPUT
    OUTPUT=$(python3 -c "$CALLBACK_SCRIPT")

    TOKEN=$(echo "$OUTPUT" | grep "^TOKEN:" | sed 's/^TOKEN://')

    if [ -z "$TOKEN" ]; then
        echo "Error: Failed to capture token from sign-in."
        return 1
    fi

    echo "Sign-in successful. Token cached for this session."
    echo "You can now use flow_list, flow_open, and flow_update."
}

# ----------------------------
# 2. List Flows
# ----------------------------
# List all cloud flows (category 5) in the environment.
#
# Usage:
#   flow_list "https://yourorg.crm.dynamics.com"
#
flow_list() {
    local ENV_URL="$1"

    if [ -z "$ENV_URL" ]; then
        echo "Usage: flow_list <environment-url>"
        return 1
    fi

    if [ -z "$TOKEN" ]; then
        echo "Error: Not signed in. Run flow_sign_in first."
        return 1
    fi

    echo "Listing cloud flows..."
    echo ""

    curl -s \
        -H "Authorization: Bearer $TOKEN" \
        -H "OData-MaxVersion: 4.0" \
        -H "OData-Version: 4.0" \
        -H "Accept: application/json" \
        "$ENV_URL/api/data/v9.2/workflows?\$filter=category%20eq%205&\$select=workflowid,name,statecode,description&\$orderby=name%20asc" \
        | jq -r '.value[] | "ID: \(.workflowid)  | Name: \(.name)  | State: \(if .statecode == 0 then "Draft" elif .statecode == 1 then "Activated" else "Suspended" end)"'
}

# ----------------------------
# 3. Open Flow ClientData
# ----------------------------
# Download a flow's clientdata field and open it as a JSON file in VS Code.
#
# Usage:
#   flow_open "https://yourorg.crm.dynamics.com" "<workflowid-guid>"
#
flow_open() {
    local ENV_URL="$1"
    local FLOW_ID="$2"

    if [ -z "$ENV_URL" ] || [ -z "$FLOW_ID" ]; then
        echo "Usage: flow_open <environment-url> <workflow-id>"
        echo "Example: flow_open https://yourorg.crm.dynamics.com 12345678-abcd-efgh-ijkl-123456789012"
        return 1
    fi

    if [ -z "$TOKEN" ]; then
        echo "Error: Not signed in. Run flow_sign_in first."
        return 1
    fi

    echo "Downloading clientdata for flow $FLOW_ID..."

    local RESPONSE
    RESPONSE=$(curl -s \
        -H "Authorization: Bearer $TOKEN" \
        -H "OData-MaxVersion: 4.0" \
        -H "OData-Version: 4.0" \
        -H "Accept: application/json" \
        "$ENV_URL/api/data/v9.2/workflows($FLOW_ID)?\$select=clientdata,name")

    local FLOW_NAME
    FLOW_NAME=$(echo "$RESPONSE" | jq -r '.name // "unknown-flow"' | tr ' ' '-' | tr -cd '[:alnum:]-_')

    local CLIENT_DATA
    CLIENT_DATA=$(echo "$RESPONSE" | jq -r '.clientdata // empty')

    if [ -z "$CLIENT_DATA" ]; then
        echo "Error: No clientdata found for flow $FLOW_ID"
        return 1
    fi

    local OUTPUT_FILE="${FLOW_NAME}.${FLOW_ID}.clientdata.json"

    echo "$CLIENT_DATA" | jq '.' > "$OUTPUT_FILE"

    echo "ClientData saved to $OUTPUT_FILE"
    echo "Opening in VS Code..."
    code "$OUTPUT_FILE"
}

# ----------------------------
# 4. Update Flow ClientData
# ----------------------------
# Update the clientdata field of a flow with the contents of a local JSON file.
#
# Usage:
#   flow_update "https://yourorg.crm.dynamics.com" "<workflowid-guid>" "<clientdata-file>"
#
flow_update() {
    local ENV_URL="$1"
    local FLOW_ID="$2"
    local FILE_PATH="$3"

    if [ -z "$ENV_URL" ] || [ -z "$FLOW_ID" ] || [ -z "$FILE_PATH" ]; then
        echo "Usage: flow_update <environment-url> <workflow-id> <clientdata-json-file>"
        echo "Example: flow_update https://yourorg.crm.dynamics.com 12345678-abcd-efgh-ijkl-123456789012 my-flow.clientdata.json"
        return 1
    fi

    if [ ! -f "$FILE_PATH" ]; then
        echo "Error: File not found: $FILE_PATH"
        return 1
    fi

    if [ -z "$TOKEN" ]; then
        echo "Error: Not signed in. Run flow_sign_in first."
        return 1
    fi

    echo "Updating clientdata for flow $FLOW_ID..."

    # Stringify the JSON file content for the clientdata field
    local UPDATED_JSON
    UPDATED_JSON=$(cat "$FILE_PATH" | jq -c '.' | jq -Rs '.')

    local HTTP_CODE
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X PATCH \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -H "OData-MaxVersion: 4.0" \
        -H "OData-Version: 4.0" \
        -H "If-Match: *" \
        "$ENV_URL/api/data/v9.2/workflows($FLOW_ID)" \
        -d "{\"clientdata\": $UPDATED_JSON}")

    if [ "$HTTP_CODE" = "204" ]; then
        echo "Success: Flow clientdata updated (HTTP 204 No Content)"
    else
        echo "Error: Update failed with HTTP status $HTTP_CODE"
        echo "Re-running with full response for diagnostics..."
        curl -s \
            -X PATCH \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -H "OData-MaxVersion: 4.0" \
            -H "OData-Version: 4.0" \
            -H "If-Match: *" \
            "$ENV_URL/api/data/v9.2/workflows($FLOW_ID)" \
            -d "{\"clientdata\": $UPDATED_JSON}" | jq '.'
        return 1
    fi
}

echo "Power Automate Flow Commands loaded."
echo "Available functions: flow_sign_in, flow_list, flow_open, flow_update"
echo "Run flow_sign_in <environment-url> to get started."
