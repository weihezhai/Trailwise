import { loadConfig } from "./config.js";
import { isLikelyBotToken, maskSlackToken, postSlackMessage, testSlackAuth } from "./slack.js";

const config = loadConfig();

if (!config.slackBotToken) {
  console.error("SLACK_BOT_TOKEN is not set. Put it in .env or .env.local; do not commit it.");
  process.exit(1);
}

console.log(`Checking Slack token ${maskSlackToken(config.slackBotToken)}`);
if (!isLikelyBotToken(config.slackBotToken)) {
  console.warn("Warning: this does not look like an xoxb bot token. Slash-command response posting usually needs a Slack bot token with chat:write.");
}

const auth = await testSlackAuth(config.slackBotToken);
if (!auth.ok) {
  console.error(`Slack auth.test failed: ${auth.error ?? "unknown_error"}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: auth.ok,
      team: auth.team,
      team_id: auth.team_id,
      user: auth.user,
      user_id: auth.user_id,
      bot_id: auth.bot_id
    },
    null,
    2
  )
);

if (config.slackTestChannelId) {
  await postSlackMessage({
    token: config.slackBotToken,
    channel: config.slackTestChannelId,
    text: "Trailwise Slack token check succeeded."
  });
  console.log(`Posted Slack test message to ${config.slackTestChannelId}`);
}
