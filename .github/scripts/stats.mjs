import { readFileSync, writeFileSync } from "node:fs";

const USER = "jakubwarkusz";
const OUT = ".github/images";

async function graphql(query, variables) {
    const response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
    });
    const json = await response.json();
    if (!response.ok || json.errors) {
        throw new Error(JSON.stringify(json.errors ?? json));
    }
    return json.data;
}

const CALENDAR = `query($login: String!, $from: DateTime, $to: DateTime) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionYears
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

async function calendar(from, to) {
    const data = await graphql(CALENDAR, { login: USER, from, to });
    return data.user.contributionsCollection;
}

const { contributionYears: years } = await calendar();
const all = [];
let total = 0;
for (const year of years) {
    const collection = await calendar(`${year}-01-01T00:00:00Z`, `${year}-12-31T23:59:59Z`);
    total += collection.contributionCalendar.totalContributions;
    for (const week of collection.contributionCalendar.weeks) all.push(...week.contributionDays);
}
all.sort((a, b) => a.date.localeCompare(b.date));

const today = new Date().toISOString().slice(0, 10);
let longest = 0;
let run = 0;
for (const day of all) {
    if (day.date > today) break;
    run = day.contributionCount > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
}
let current = 0;
for (let i = all.length - 1; i >= 0; i--) {
    const day = all[i];
    if (day.date > today) continue;
    if (day.contributionCount > 0) current++;
    else if (day.date === today) continue;
    else break;
}

const W = 1600;
const H = 675;
const file = (name) => readFileSync(`${OUT}/stats/${name}`).toString("base64");
const png = (name) => `data:image/png;base64,${file(name)}`;
const font = `font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"`;
const days = (n) => `${n.toLocaleString("en-US")} ${n === 1 ? "day" : "days"}`;
const stats = [
    ["contributions.png", total.toLocaleString("en-US"), "contributions"],
    ["fire.png", days(current), "current streak"],
    ["trophy.png", days(longest), "longest streak"],
];

function svg(dark) {
    const columns = stats
        .map(([sticker, value, label], i) => {
            const x = 83 + i * 272;
            return (
                `<image href="${png(sticker)}" x="${x - 4}" y="466" width="76" height="76"/>` +
                `<text x="${x + 84}" y="500" ${font} font-size="38" font-weight="700" letter-spacing="-1.1" fill="#F4F2EC" filter="url(#lift)">${value}</text>` +
                `<text x="${x + 85}" y="532" ${font} font-size="20" fill="#F4F2EC" fill-opacity="0.86" filter="url(#lift)">${label}</text>`
            );
        })
        .join("");
    const sky = `data:image/jpeg;base64,${file(dark ? "header-dark.jpg" : "header.jpg")}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Jakub Warkusz: ${total} contributions since ${years.at(-1)}, current streak ${days(current)}, longest ${days(longest)}">
<defs><filter id="lift" x="-10%" y="-40%" width="120%" height="180%"><feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#1a1710" flood-opacity="0.3"/></filter></defs>
<image href="${sky}" width="${W}" height="${H}"/>${columns}</svg>
`;
}

writeFileSync(`${OUT}/header.svg`, svg(false));
writeFileSync(`${OUT}/header-dark.svg`, svg(true));
console.log(`total ${total}, current ${current}, longest ${longest}`);
