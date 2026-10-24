// Club colours for the "dark page, club colour as the glow" look.
// colour: fill of an opened band. text: text on that fill. glow: edge and name tint on the dark band.
export const BAND_BG = '#23252b';

export const CLUBS = [
  { name: 'Arsenal', fplName: 'Arsenal', colour: '#E80008', text: '#FFFFFF', glow: '#FF4D52' },
  { name: 'Aston Villa', fplName: 'Aston Villa', colour: '#670E36', text: '#C9E4FA', glow: '#95BFE5' },
  { name: 'Bournemouth', fplName: 'Bournemouth', colour: '#B71C14', text: '#FFFFFF', glow: '#F25B50' },
  { name: 'Brentford', fplName: 'Brentford', colour: '#C8000D', text: '#FFFFFF', glow: '#FF4F5A' },
  { name: 'Brighton', fplName: 'Brighton', colour: '#0057B8', text: '#FFFFFF', glow: '#4A93E8' },
  { name: 'Chelsea', fplName: 'Chelsea', colour: '#034694', text: '#FFFFFF', glow: '#4B8BE0' },
  { name: 'Coventry City', fplName: 'Coventry City', colour: '#5CBFEB', text: '#08283A', glow: '#5CBFEB' },
  { name: 'Crystal Palace', fplName: 'Crystal Palace', colour: '#1B458F', text: '#FFFFFF', glow: '#5B8FE0' },
  { name: 'Everton', fplName: 'Everton', colour: '#003399', text: '#FFFFFF', glow: '#5C85E6' },
  { name: 'Fulham', fplName: 'Fulham', colour: '#E6E6E6', text: '#000000', glow: '#E6E6E6' },
  { name: 'Hull City', fplName: 'Hull City', colour: '#F5A12D', text: '#1A1100', glow: '#F5A12D' },
  { name: 'Ipswich Town', fplName: 'Ipswich Town', colour: '#2E5496', text: '#FFFFFF', glow: '#6E9BE0' },
  { name: 'Leeds United', fplName: 'Leeds', colour: '#FFCD00', text: '#1D428A', glow: '#FFCD00' },
  { name: 'Liverpool', fplName: 'Liverpool', colour: '#C8102E', text: '#FFFFFF', glow: '#F0566E' },
  { name: 'Manchester City', fplName: 'Man City', colour: '#6CABDD', text: '#0B2236', glow: '#6CABDD' },
  { name: 'Manchester United', fplName: 'Man Utd', colour: '#B8180D', text: '#FFFFFF', glow: '#F25B4F' },
  { name: 'Newcastle United', fplName: 'Newcastle', colour: '#3A3A3A', text: '#FFFFFF', glow: '#F2F2F2' },
  { name: "Nottingham Forest", fplName: "Nott'm Forest", colour: '#C40000', text: '#FFFFFF', glow: '#FF5252' },
  { name: 'Tottenham Hotspur', fplName: 'Spurs', colour: '#132257', text: '#FFFFFF', glow: '#7D97E0' },
  { name: 'Sunderland', fplName: 'Sunderland', colour: '#C8102E', text: '#FFFFFF', glow: '#F0566E' },
];

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colours (1 to 21). */
export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
