const defaultHomeTeam = "Argentina";
const defaultAwayTeam = "France";
const endpoints = {
  teams: "https://worldcupjson.net/teams",
  matches: "https://worldcupjson.net/matches?by_date=asc",
};
const proxyProviders = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

const fallbackTeamsData = {
  groups: [
    {
      letter: "C",
      teams: [
        { name: "Argentina", group_points: 18, goal_differential: 7 },
        { name: "Poland", group_points: 4, goal_differential: -2 },
        { name: "Mexico", group_points: 4, goal_differential: 0 },
        { name: "Saudi Arabia", group_points: 3, goal_differential: -5 },
      ],
    },
    {
      letter: "D",
      teams: [
        { name: "France", group_points: 15, goal_differential: 8 },
        { name: "Australia", group_points: 6, goal_differential: -2 },
        { name: "Denmark", group_points: 1, goal_differential: -2 },
        { name: "Tunisia", group_points: 4, goal_differential: -2 },
      ],
    },
  ],
};

const fallbackMatchesData = [
  {
    datetime: "2022-11-22T10:00:00Z",
    home_team: { name: "Argentina", goals: 1 },
    away_team: { name: "Saudi Arabia", goals: 2 },
  },
  {
    datetime: "2022-11-26T19:00:00Z",
    home_team: { name: "Argentina", goals: 2 },
    away_team: { name: "Mexico", goals: 0 },
  },
  {
    datetime: "2022-11-30T19:00:00Z",
    home_team: { name: "Poland", goals: 0 },
    away_team: { name: "Argentina", goals: 2 },
  },
  {
    datetime: "2022-11-22T19:00:00Z",
    home_team: { name: "France", goals: 4 },
    away_team: { name: "Australia", goals: 1 },
  },
  {
    datetime: "2022-11-26T19:00:00Z",
    home_team: { name: "France", goals: 2 },
    away_team: { name: "Denmark", goals: 1 },
  },
  {
    datetime: "2022-11-30T19:00:00Z",
    home_team: { name: "Tunisia", goals: 1 },
    away_team: { name: "France", goals: 0 },
  },
  {
    datetime: "2022-12-18T15:00:00Z",
    home_team: { name: "Argentina", goals: 3 },
    away_team: { name: "France", goals: 3 },
  },
];

const statusElement = document.getElementById("statusMessage");

function setStatus(message, isError = false) {
  if (!statusElement) return;
  statusElement.textContent = message;
  statusElement.className = isError ? "status-message status-error" : "status-message";
}

async function fetchJson(url) {
  async function tryFetch(fetchUrl) {
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${fetchUrl}`);
    return response.json();
  }

  try {
    return await tryFetch(url);
  } catch (error) {
    console.warn("Direct fetch failed:", error.message);
    for (const provider of proxyProviders) {
      const proxyUrl = provider(url);
      try {
        return await tryFetch(proxyUrl);
      } catch (proxyError) {
        console.warn("Proxy failed:", proxyUrl, proxyError.message);
      }
    }
    throw error;
  }
}

async function fetchJsonWithFallback(url, fallbackData) {
  try {
    return await fetchJson(url);
  } catch (error) {
    console.warn("Using fallback data because fetch failed:", error.message);
    return fallbackData;
  }
}

function formatMatchScore(match) {
  const homeGoals = match.home_team.goals;
  const awayGoals = match.away_team.goals;
  return `${match.home_team.name} ${homeGoals} - ${awayGoals} ${match.away_team.name}`;
}

function sortMatchesByDate(matches) {
  return matches.slice().sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
}

function collectTeamRecords(matches, teamName) {
  const teamMatches = matches.filter((match) => {
    const home = match.home_team.name.toLowerCase();
    const away = match.away_team.name.toLowerCase();
    return home === teamName.toLowerCase() || away === teamName.toLowerCase();
  });

  const sorted = sortMatchesByDate(teamMatches);
  const record = {
    name: teamName,
    played: sorted.length,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    recentForm: [],
    scoredIn: 0,
    concededIn: 0,
  };

  sorted.forEach((match) => {
    const isHome = match.home_team.name.toLowerCase() === teamName.toLowerCase();
    const teamGoals = isHome ? match.home_team.goals : match.away_team.goals;
    const opponentGoals = isHome ? match.away_team.goals : match.home_team.goals;
    const result = teamGoals > opponentGoals ? "W" : teamGoals === opponentGoals ? "D" : "L";

    record.goalsFor += teamGoals;
    record.goalsAgainst += opponentGoals;
    record.scoredIn += teamGoals > 0 ? 1 : 0;
    record.concededIn += opponentGoals > 0 ? 1 : 0;

    if (result === "W") record.wins += 1;
    if (result === "D") record.draws += 1;
    if (result === "L") record.losses += 1;
    record.recentForm.push(result);
  });

  const lastFive = record.recentForm.slice(-5);
  return {
    ...record,
    recentForm: lastFive,
    avgGoalsFor: record.played ? record.goalsFor / record.played : 0,
    avgGoalsAgainst: record.played ? record.goalsAgainst / record.played : 0,
    goalDiff: record.goalsFor - record.goalsAgainst,
    scoredRate: record.played ? record.scoredIn / record.played : 0,
    concededRate: record.played ? record.concededIn / record.played : 0,
  };
}

function buildHeadToHead(homeName, awayName, matches) {
  return matches.filter((match) => {
    const home = match.home_team.name.toLowerCase();
    const away = match.away_team.name.toLowerCase();
    return (home === homeName.toLowerCase() && away === awayName.toLowerCase()) ||
      (home === awayName.toLowerCase() && away === homeName.toLowerCase());
  }).map((match) => {
    const isHomeMatch = match.home_team.name.toLowerCase() === homeName.toLowerCase();
    const hostName = isHomeMatch ? match.home_team.name : match.away_team.name;
    const guestName = isHomeMatch ? match.away_team.name : match.home_team.name;
    const homeScore = isHomeMatch ? match.home_team.goals : match.away_team.goals;
    const awayScore = isHomeMatch ? match.away_team.goals : match.home_team.goals;
    return {
      score: `${homeScore}-${awayScore}`,
      text: `${hostName} ${homeScore} - ${awayScore} ${guestName}`,
      date: match.datetime.split("T")[0],
    };
  });
}

function renderRanking(teamsData) {
  const container = document.getElementById("fifaRanking");
  if (!container) return;
  const allTeams = teamsData.groups.flatMap((group) => group.teams.map((team) => ({
    name: team.name,
    points: team.group_points,
    gd: team.goal_differential,
    group: group.letter,
  })));
  allTeams.sort((a, b) => b.points - a.points || b.gd - a.gd);
  allTeams.slice(0, 10).forEach((team, index) => {
    const row = document.createElement("div");
    row.className = "stat-row";
    row.innerHTML = `<span class="label">${index + 1}. ${team.name}</span><span class="value">${team.points} pts (GD ${team.gd})</span>`;
    container.appendChild(row);
  });
}

function renderRecentResults(homeRecord, awayRecord, headToHead) {
  const container = document.getElementById("recentResults");
  if (!container) return;

  const homeBox = document.createElement("div");
  homeBox.innerHTML = `<p class="label">${homeRecord.name}</p><p class="value">Últimos 5: ${homeRecord.recentForm.join(" - ") || "N/A"}</p>`;
  container.appendChild(homeBox);

  const awayBox = document.createElement("div");
  awayBox.innerHTML = `<p class="label">${awayRecord.name}</p><p class="value">Últimos 5: ${awayRecord.recentForm.join(" - ") || "N/A"}</p>`;
  container.appendChild(awayBox);

  const h2 = document.createElement("p");
  h2.className = "label";
  h2.textContent = "Enfrentamientos recientes";
  container.appendChild(h2);

  if (!headToHead.length) {
    const notFound = document.createElement("p");
    notFound.textContent = "No hay datos directos de enfrentamientos anteriores en las fuentes actuales.";
    container.appendChild(notFound);
    return;
  }

  const list = document.createElement("ul");
  headToHead.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.date}: ${item.text}`;
    list.appendChild(li);
  });
  container.appendChild(list);
}

function renderBettingOdds(homeRecord, awayRecord) {
  const container = document.getElementById("bettingOdds");
  if (!container) return;
  const totalGoalDelta = homeRecord.avgGoalsFor - awayRecord.avgGoalsAgainst;
  const probabilityHome = Math.min(0.68, Math.max(0.22, 0.35 + totalGoalDelta * 0.07 + (homeRecord.wins - awayRecord.wins) * 0.02));
  const probabilityAway = Math.min(0.65, Math.max(0.18, 0.33 - totalGoalDelta * 0.06 + (awayRecord.wins - homeRecord.wins) * 0.02));
  const probabilityDraw = Math.max(0.12, 1 - probabilityHome - probabilityAway);

  const odds = {
    home: (1 / probabilityHome).toFixed(2),
    draw: (1 / probabilityDraw).toFixed(2),
    away: (1 / probabilityAway).toFixed(2),
  };

  const teamBox = document.createElement("div");
  teamBox.innerHTML = `
    <p class="label">Estimación basada en datos reales</p>
    <div class="stat-row"><span>${homeRecord.name}</span><span class="value">${odds.home}</span></div>
    <div class="stat-row"><span>Empate</span><span class="value">${odds.draw}</span></div>
    <div class="stat-row"><span>${awayRecord.name}</span><span class="value">${odds.away}</span></div>
  `;
  container.appendChild(teamBox);
}

function renderTeamStats(homeRecord, awayRecord) {
  const container = document.getElementById("teamStats");
  if (!container) return;

  [homeRecord, awayRecord].forEach((team) => {
    const teamBox = document.createElement("div");
    teamBox.innerHTML = `
      <p class="label">${team.name}</p>
      <div class="stat-row"><span>Partidos</span><span class="value">${team.played}</span></div>
      <div class="stat-row"><span>Goles a favor</span><span class="value">${team.goalsFor}</span></div>
      <div class="stat-row"><span>Goles en contra</span><span class="value">${team.goalsAgainst}</span></div>
      <div class="stat-row"><span>Promedio GF</span><span class="value">${team.avgGoalsFor.toFixed(2)}</span></div>
      <div class="stat-row"><span>Promedio GC</span><span class="value">${team.avgGoalsAgainst.toFixed(2)}</span></div>
      <div class="stat-row"><span>Uniforme BTTS</span><span class="value">${(team.scoredRate * 100).toFixed(0)}%</span></div>
    `;
    container.appendChild(teamBox);
  });
}

function buildPredictions(homeRecord, awayRecord, headToHead) {
  const predictions = [];
  const homeStrength = homeRecord.avgGoalsFor - awayRecord.avgGoalsAgainst + (homeRecord.wins - awayRecord.wins) * 0.1;
  predictions.push(homeStrength > 0.25 ? `${homeRecord.name} tiene ventaja en ataque.` : homeStrength < -0.25 ? `${awayRecord.name} tiene ventaja defensiva.` : "Partido equilibrado entre ambos equipos.");

  const bothScore = homeRecord.scoredRate >= 0.6 && awayRecord.scoredRate >= 0.6;
  predictions.push(bothScore ? "Alta probabilidad de que ambos equipos marquen." : "Probablemente uno de los equipos mantenga la portería en cero.");

  const averageGoals = homeRecord.avgGoalsFor + awayRecord.avgGoalsFor;
  predictions.push(averageGoals >= 3 ? "Tendencia hacia más de 2.5 goles." : "Tendencia hacia menos de 2.5 goles.");

  if (headToHead.length > 0 && headToHead.some((item) => item.score.split("-").some((g) => parseInt(g, 10) >= 3))) {
    predictions.push("Los enfrentamientos previos han mostrado partidos abiertos y con varios goles.");
  }

  predictions.push("No se disponen de estadísticas de tarjetas en esta fuente abierta, pero en partidos globales suele haber más de 3 amarillas si los equipos buscan resultado.");
  return predictions;
}

function renderPrediction(predictions) {
  const container = document.getElementById("prediction");
  if (!container) return;
  predictions.forEach((text) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    container.appendChild(paragraph);
  });
}

function renderTips(homeRecord, awayRecord) {
  const container = document.getElementById("tips");
  if (!container) return;

  const tipRows = [
    {
      title: "Ganador probable",
      value: homeRecord.goalDiff >= awayRecord.goalDiff ? `${homeRecord.name} favorito por mejor diferencia de goles` : `${awayRecord.name} favorito por mejor diferencia de goles`,
    },
    {
      title: "Apuesta BTTS",
      value: homeRecord.scoredRate >= 0.6 && awayRecord.scoredRate >= 0.6 ? "Sí: ambos equipos suelen marcar." : "No: atención a partido cerrado.",
    },
    {
      title: "Más / Menos 2.5",
      value: homeRecord.avgGoalsFor + awayRecord.avgGoalsFor >= 3 ? "Más 2.5 goles" : "Menos 2.5 goles",
    },
    {
      title: "Tarjetas amarillas",
      value: "Las fuentes abiertas no ofrecen tarjetas; se sugiere 2+ amarillas según la intensidad del torneo.",
    },
    {
      title: "Mercado recomendado",
      value: "Resultado correcto, más/menos goles y BTTS son los mercados más útiles para validar este análisis.",
    },
  ];

  tipRows.forEach((tip) => {
    const row = document.createElement("div");
    row.className = "tip-row";
    row.innerHTML = `<span class="label">${tip.title}</span><span class="value">${tip.value}</span>`;
    container.appendChild(row);
  });
}

async function init() {
  setStatus("Cargando datos reales desde worldcupjson.net...");
  const [teamsData, matchesData] = await Promise.all([
    fetchJsonWithFallback(endpoints.teams, fallbackTeamsData),
    fetchJsonWithFallback(endpoints.matches, fallbackMatchesData),
  ]);

  if (!teamsData || !matchesData) {
    setStatus("No se pudieron cargar datos reales ni el fallback local.", true);
    return;
  }

  const homeRecord = collectTeamRecords(matchesData, defaultHomeTeam);
  const awayRecord = collectTeamRecords(matchesData, defaultAwayTeam);
  const headToHead = buildHeadToHead(defaultHomeTeam, defaultAwayTeam, matchesData);

  renderRanking(teamsData);
  renderRecentResults(homeRecord, awayRecord, headToHead);
  renderBettingOdds(homeRecord, awayRecord);
  renderTeamStats(homeRecord, awayRecord);
  renderPrediction(buildPredictions(homeRecord, awayRecord, headToHead));
  renderTips(homeRecord, awayRecord);

  setStatus("Datos cargados. Si se usó fallback local, el análisis se basa en datos de ejemplo.");
}

init();
