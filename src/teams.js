// Odds-file (football-data.co.uk) team names that differ from the FPL names.
// Explicit aliases only: a fuzzy match could silently pair the wrong clubs.
const ALIASES = {
  'Man United': 'Man Utd',
  'Tottenham': 'Spurs',
  'Ipswich': 'Ipswich Town',
  'Hull': 'Hull City',
  'Coventry': 'Coventry City',
  "Nott'm Forest": "Nott'm Forest",
  'Leeds': 'Leeds',
  'Newcastle': 'Newcastle',
};

/** @param {string} name odds-file team name  @param {{id:number,name:string}[]} fplTeams */
export function oddsNameToTeamId(name, fplTeams) {
  const target = ALIASES[name] ?? name;
  const team = fplTeams.find((t) => t.name === target);
  if (!team) throw new Error(`Unknown team in odds file: ${name}`);
  return team.id;
}
