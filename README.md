# YouTube

Connect a YouTube account to your workspace so Cinatra agents can access it. The connector uses Nango to manage each user's YouTube OAuth connection and checks the shared Google OAuth connector status before enabling Connect — configure your Google client ID and secret once in the Google OAuth connector, then each user connects their own YouTube account from the connector settings page. To connect, open the YouTube connector settings page and click Connect YouTube; the button stays disabled until the shared Google OAuth client is configured. Once connected, the account is available to agents and workflows running in your workspace. To revoke access, use the Reconnect button to re-issue the OAuth token with a different account, or disconnect through your Google account settings. For development, call `registerYouTubeConnector(stubDeps)` in your test setup before importing settings-page code so the OAuth host service is properly stubbed.

## Works with

- Google OAuth connector (required: supplies the shared Google client ID and secret)

## Capabilities

- Connect a user's YouTube account to the workspace via Google OAuth
- Show the connected account status and surface a connect or reconnect action
- Gate the connect button until the shared Google OAuth client is configured
- Make the connected account available to agents and workflows in the workspace
