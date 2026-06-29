const backendBaseUrl = process.env.BACKEND_BASE_URL || "http://localhost:3000";
const [command = "status", ...rest] = process.argv.slice(2);
const text = [command, ...rest].join(" ");

const response = await fetch(`${backendBaseUrl}/dev/slack-command`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    team_id: "T_LOCAL",
    channel_id: "C_LOCAL",
    user_id: "U_LOCAL",
    text
  })
});

if (!response.ok) {
  console.error(await response.text());
  process.exit(1);
}

console.log(JSON.stringify(await response.json(), null, 2));
