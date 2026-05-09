// Define a premium and vibrant color palette for the 12 Bezirke
const bezirkColors = {
  "Mitte": "#FF3366",
  "Friedrichshain-Kreuzberg": "#33CC99",
  "Pankow": "#3399FF",
  "Charlottenburg-Wilmersdorf": "#FF9933",
  "Spandau": "#9933FF",
  "Steglitz-Zehlendorf": "#3366FF",
  "Tempelhof-Schöneberg": "#FF33CC",
  "Neukölln": "#33FFCC",
  "Treptow-Köpenick": "#FFCC33",
  "Marzahn-Hellersdorf": "#E024B1", // Pink/Magenta for high contrast
  "Lichtenberg": "#FF6633",
  "Reinickendorf": "#CC33FF"
};

const regionMap = {
  "alle": "alle",
  "mitte": ["Mitte"],
  "friedrichshain_kreuzberg": ["Friedrichshain-Kreuzberg"],
  "pankow": ["Pankow"],
  "charlottenburg_wilmersdorf": ["Charlottenburg-Wilmersdorf"],
  "spandau": ["Spandau"],
  "steglitz_zehlendorf": ["Steglitz-Zehlendorf"],
  "tempelhof_schoeneberg": ["Tempelhof-Schöneberg"],
  "neukoelln": ["Neukölln"],
  "treptow_koepenick": ["Treptow-Köpenick"],
  "marzahn_hellersdorf": ["Marzahn-Hellersdorf"],
  "lichtenberg": ["Lichtenberg"],
  "reinickendorf": ["Reinickendorf"]
};

const regionDisplayNames = {
  "mitte": "Mitte",
  "friedrichshain_kreuzberg": "Friedrichshain-Kreuzberg",
  "pankow": "Pankow",
  "charlottenburg_wilmersdorf": "Charlottenburg-Wilmersdorf",
  "spandau": "Spandau",
  "steglitz_zehlendorf": "Steglitz-Zehlendorf",
  "tempelhof_schoeneberg": "Tempelhof-Schöneberg",
  "neukoelln": "Neukölln",
  "treptow_koepenick": "Treptow-Köpenick",
  "marzahn_hellersdorf": "Marzahn-Hellersdorf",
  "lichtenberg": "Lichtenberg",
  "reinickendorf": "Reinickendorf"
};

// Fallback color logic if a new/unknown Bezirk appears
function getBezirkColor(bezirkName) {
  if (bezirkColors[bezirkName]) return bezirkColors[bezirkName];
  let hash = 0;
  for (let i = 0; i < bezirkName.length; i++) hash = bezirkName.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 80%, 60%)`;
}

// State Management
const appState = {
  mode: 'lernen', // 'lernen' | 'spielen'
  gameType: 'ortsteile', // 'ortsteile' | 'quartier'
  customTargets: [],
  spielen: {
    inProgress: false,
    allTargets: [],
    remainingTargets: [],
    currentTarget: null,
    attempts: 0,
    lastStartTime: null,
    elapsedBefore: 0,
    stats: { green: 0, orange: 0, red: 0 }
  }
};

// Initialize Map
const map = L.map('map', { center: [52.5200, 13.4050], zoom: 11, zoomControl: false });
L.control.zoom({ position: 'bottomright' }).addTo(map);

// Create a custom pane so district borders stay on top of everything else
map.createPane('bezirkePane');
map.getPane('bezirkePane').style.zIndex = 650; // standard overlayPane is 400
map.getPane('bezirkePane').style.pointerEvents = 'none'; // pass clicks through to ortsteile

// Create a labels pane to stay above features but below borders/tooltips
map.createPane('labelsPane');
map.getPane('labelsPane').style.zIndex = 600;
map.getPane('labelsPane').style.pointerEvents = 'none';

map.getPane('tooltipPane').style.zIndex = 700; // ensure tooltips are above district borders (650)
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 20
}).addTo(map);

const labelsLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 20,
  pane: 'labelsPane'
});

// DOM Elements
const btnLernen = document.getElementById('btn-lernen');
const btnSpielen = document.getElementById('btn-spielen');
const btnRestartGame = document.getElementById('btn-restart-game');
const btnSkipTarget = document.getElementById('btn-skip-target');
const lernenContent = document.getElementById('lernen-content');
const spielenContent = document.getElementById('spielen-content');
const bezirkTitleEl = document.getElementById('bezirk-title');
const ortsteilNameEl = document.getElementById('ortsteil-name');
const targetNameEl = document.getElementById('target-name');
const progressTextEl = document.getElementById('progress-text');
const dots = document.querySelectorAll('.dot');
const statsModal = document.getElementById('stats-modal');
const btnRestart = document.getElementById('btn-restart');
const btnCloseStats = document.getElementById('btn-close-stats');

const toggleErrorNames = document.getElementById('toggle-error-names');
const toggleMapLabels = document.getElementById('toggle-map-labels');
const regionSelect = document.getElementById('region-select');
const gametypeSelect = document.getElementById('gametype-select');
const btnConfigFilter = document.getElementById('btn-config-filter');

const filterModal = document.getElementById('filter-modal');
const btnSaveFilter = document.getElementById('btn-save-filter');
const filterCheckboxesContainer = document.getElementById('filter-checkboxes');
const filterExportInput = document.getElementById('filter-export-input');
const btnCopyFilter = document.getElementById('btn-copy-filter');
const filterImportInput = document.getElementById('filter-import-input');
const btnImportFilter = document.getElementById('btn-import-filter');

function updateExportString() {
  filterExportInput.value = btoa(JSON.stringify(appState.customTargets));
}

// Mode Listeners
btnLernen.addEventListener('click', () => switchMode('lernen'));
btnSpielen.addEventListener('click', () => switchMode('spielen'));
btnRestart.addEventListener('click', () => {
  appState.spielen.inProgress = false;
  switchMode('spielen');
});
if (btnCloseStats) {
  btnCloseStats.addEventListener('click', () => {
    statsModal.classList.add('hidden');
  });
}
if (btnRestartGame) {
  btnRestartGame.addEventListener('click', () => {
    appState.spielen.inProgress = false;
    startSpielenMode();
  });
}
if (btnSkipTarget) {
  btnSkipTarget.addEventListener('click', () => {
    skipTarget();
  });
}
regionSelect.addEventListener('change', () => {
  btnConfigFilter.classList.toggle('hidden', regionSelect.value !== 'custom');
  appState.spielen.inProgress = false;
  switchMode(appState.mode);
  if (geojsonLayer) map.fitBounds(geojsonLayer.getBounds());
});

gametypeSelect.addEventListener('change', () => {
  appState.gameType = gametypeSelect.value;
  appState.spielen.inProgress = false;
  buildActiveLayer();
  updateRegionSelectLabels();
  rebuildCustomFilter();
  switchMode(appState.mode);
});

document.getElementById('btn-settings').addEventListener('click', (e) => {
  document.getElementById('settings-menu').classList.toggle('hidden');
});

if (toggleMapLabels) {
  toggleMapLabels.addEventListener('change', () => {
    if (toggleMapLabels.checked) {
      labelsLayer.addTo(map);
    } else {
      map.removeLayer(labelsLayer);
    }
  });
}

// Close settings menu when clicking outside
document.addEventListener('click', (e) => {
  const settingsMenu = document.getElementById('settings-menu');
  const btnSettings = document.getElementById('btn-settings');
  if (!settingsMenu.classList.contains('hidden')) {
    if (!settingsMenu.contains(e.target) && !btnSettings.contains(e.target)) {
      settingsMenu.classList.add('hidden');
    }
  }
});

// Modal Logic
btnConfigFilter.addEventListener('click', () => {
  document.getElementById('settings-menu').classList.add('hidden');
  filterModal.classList.remove('hidden');
});

btnSaveFilter.addEventListener('click', () => {
  filterModal.classList.add('hidden');
  appState.spielen.inProgress = false;
  switchMode(appState.mode); // re-init regions
});

btnCopyFilter.addEventListener('click', () => {
  filterExportInput.select();
  document.execCommand('copy');
});

btnImportFilter.addEventListener('click', () => {
  try {
    const val = filterImportInput.value.trim();
    if (!val) return;
    const parsed = JSON.parse(atob(val));
    if (Array.isArray(parsed)) {
      appState.customTargets = parsed;
      Array.from(filterCheckboxesContainer.querySelectorAll('input[type="checkbox"]')).forEach(cb => {
        cb.checked = parsed.includes(cb.value);
      });
      updateExportString();
      filterImportInput.value = '';
      alert('Erfolgreich importiert!');
    }
  } catch (e) {
    alert('Ungültiger Import-String!');
  }
});

function switchMode(mode) {
  if (appState.mode === 'spielen' && mode !== 'spielen' && appState.spielen.inProgress) {
    appState.spielen.elapsedBefore += (new Date() - appState.spielen.lastStartTime);
  }

  appState.mode = mode;
  if (mode === 'lernen') {
    btnLernen.classList.add('active');
    btnSpielen.classList.remove('active');
    lernenContent.classList.remove('hidden');
    spielenContent.classList.add('hidden');
    statsModal.classList.add('hidden');
    if (btnRestartGame) btnRestartGame.style.display = 'none';
    if (btnSkipTarget) btnSkipTarget.style.display = 'none';
    resetLernenMode();
  } else {
    btnSpielen.classList.add('active');
    btnLernen.classList.remove('active');
    spielenContent.classList.remove('hidden');
    lernenContent.classList.add('hidden');
    statsModal.classList.add('hidden');
    if (btnRestartGame) btnRestartGame.style.display = 'flex';
    if (btnSkipTarget) btnSkipTarget.style.display = 'flex';
    resumeSpielenMode();
  }
}

let ortsteilData = null;
let quartierData = null;
let plrData = null;
let stationsData = null;
let geojsonLayer;
let highlightedFeature = null;

function getActiveData() {
  if (appState.gameType === 'ortsteile') return ortsteilData;
  if (appState.gameType === 'quartier') return quartierData;
  if (appState.gameType === 'stations') return stationsData;
  return plrData;
}

function getTypeName() {
  if (appState.gameType === 'ortsteile') return 'Ortsteile';
  if (appState.gameType === 'quartier') return 'Quartiere';
  if (appState.gameType === 'stations') return 'Bahnhöfe';
  return 'PLR';
}

function getDefaultPrompt() {
  if (appState.gameType === 'ortsteile') return 'Wähle einen Ortsteil';
  if (appState.gameType === 'quartier') return 'Wähle ein Quartier';
  if (appState.gameType === 'stations') return 'Wähle einen Bahnhof';
  return 'Wähle einen Planungsraum';
}

function updateRegionSelectLabels() {
  const data = getActiveData();
  if (!data) return;
  const typeName = getTypeName();
  Array.from(regionSelect.options).forEach(opt => {
    if (opt.value === 'alle') {
      opt.textContent = `alle ${data.features.length} ${typeName}`;
    } else if (opt.value === 'custom') {
      opt.textContent = 'Benutzerdefiniert';
    } else if (regionMap[opt.value]) {
      const bezirke = regionMap[opt.value];
      const count = data.features.filter(f => bezirke.includes(f.properties.BEZIRK)).length;
      opt.textContent = `${count} ${typeName} - ${regionDisplayNames[opt.value]}`;
    }
  });
}

function rebuildCustomFilter() {
  const data = getActiveData();
  if (!data) return;
  const oteils = data.features.map(f => f.properties.OTEIL).sort();
  appState.customTargets = [];
  filterCheckboxesContainer.innerHTML = '';
  oteils.forEach(o => {
    const lbl = document.createElement('label');
    lbl.style.display = 'flex';
    lbl.style.alignItems = 'center';
    lbl.style.cursor = 'pointer';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = o;
    cb.style.marginRight = '6px';
    cb.addEventListener('change', () => {
      if (cb.checked) {
        if (!appState.customTargets.includes(o)) appState.customTargets.push(o);
      } else {
        appState.customTargets = appState.customTargets.filter(item => item !== o);
      }
      updateExportString();
    });
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(o));
    filterCheckboxesContainer.appendChild(lbl);
  });
  updateExportString();
}

function buildActiveLayer() {
  if (geojsonLayer) {
    map.removeLayer(geojsonLayer);
    geojsonLayer = null;
  }
  const data = getActiveData();
  if (!data) return;
  const opts = { style: getLernenStyle, onEachFeature: onEachFeature };
  if (appState.gameType === 'quartier' || appState.gameType === 'stations') {
    opts.pointToLayer = (feature, latlng) => {
      return L.circleMarker(latlng, { radius: 12 });
    };
  }
  geojsonLayer = L.geoJSON(data, opts).addTo(map);
  highlightedFeature = null;
  map.fitBounds(geojsonLayer.getBounds());
}

// Base styles
function isLayerInRegion(feature) {
  const sel = regionSelect.value;
  if (sel === 'alle') return true;
  if (sel === 'custom') return appState.customTargets.includes(feature.properties.OTEIL);
  return regionMap[sel].includes(feature.properties.BEZIRK);
}

function getInactiveStyle(feature) {
  return { fillColor: '#94a3b8', weight: 1, opacity: 0.4, color: '#cbd5e1', fillOpacity: 0.1 };
}

function getLernenStyle(feature) {
  if (!isLayerInRegion(feature)) return getInactiveStyle(feature);
  
  if (appState.gameType === 'stations') {
    const sType = feature.properties.station_type;
    if (sType === 'S-Bahn') {
      return { fillColor: '#166534', weight: 2, opacity: 0.9, color: '#14532d', fillOpacity: 0.7 }; // Dark Green
    } else if (sType === 'U-Bahn') {
      return { fillColor: '#3b82f6', weight: 2, opacity: 0.9, color: '#1d4ed8', fillOpacity: 0.7 }; // Lighter Blue
    } else if (sType === 'S+U-Bahn') {
      return { fillColor: 'url(#su-gradient)', weight: 2, opacity: 0.9, color: '#0f172a', fillOpacity: 0.9 }; // Gradient fill, slate border
    }
    return { fillColor: '#64748b', weight: 2, opacity: 0.9, color: '#475569', fillOpacity: 0.7 }; // Default Slate
  }
  
  return { fillColor: '#3b82f6', weight: 1, opacity: 0.8, color: '#1d4ed8', fillOpacity: 0.15 };
}
function getSpielenBaseStyle(feature) {
  return getLernenStyle(feature);
}

// Interaction Handlers
function onEachFeature(feature, layer) {
  if (isLayerInRegion(feature)) {
    layer.bindTooltip(feature.properties.OTEIL, { direction: 'center', className: 'custom-tooltip' });
  }

  layer.on({
    mouseover: (e) => {
      const tgt = e.target;
      if (!isLayerInRegion(tgt.feature)) return;

      if (appState.mode === 'lernen') {
        if (highlightedFeature !== tgt) {
          tgt.setStyle({ weight: 3, color: '#1e3a8a', fillOpacity: 0.4 });
          if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) tgt.bringToFront();
          bezirkTitleEl.textContent = tgt.feature.properties.OTEIL;
          ortsteilNameEl.textContent = `Bezirk: ${tgt.feature.properties.BEZIRK}`;
          bezirkTitleEl.style.background = `linear-gradient(135deg, #FFFFFF 0%, ${getBezirkColor(tgt.feature.properties.BEZIRK)} 100%)`;
          bezirkTitleEl.style.webkitBackgroundClip = 'text';
          bezirkTitleEl.style.webkitTextFillColor = 'transparent';
        }
      }
    },
    mouseout: (e) => {
      const tgt = e.target;
      if (!isLayerInRegion(tgt.feature)) return;

      if (appState.mode === 'lernen') {
        if (highlightedFeature !== tgt) {
          geojsonLayer.resetStyle(tgt);
          if (highlightedFeature) {
            const props = highlightedFeature.feature.properties;
            bezirkTitleEl.textContent = props.OTEIL;
            ortsteilNameEl.textContent = `Bezirk: ${props.BEZIRK}`;
            bezirkTitleEl.style.background = `linear-gradient(135deg, #FFFFFF 0%, ${getBezirkColor(props.BEZIRK)} 100%)`;
            bezirkTitleEl.style.webkitBackgroundClip = 'text';
            bezirkTitleEl.style.webkitTextFillColor = 'transparent';
          } else {
            bezirkTitleEl.textContent = "Berlin";
            ortsteilNameEl.textContent = getDefaultPrompt();
            bezirkTitleEl.style.background = `linear-gradient(135deg, #FFFFFF 0%, #A5B4FC 100%)`;
            bezirkTitleEl.style.webkitBackgroundClip = 'text';
            bezirkTitleEl.style.webkitTextFillColor = 'transparent';
          }
        }
      }
    },
    click: (e) => {
      if (!isLayerInRegion(e.target.feature)) return;
      if (appState.mode === 'lernen') {
        if (highlightedFeature && highlightedFeature !== e.target) geojsonLayer.resetStyle(highlightedFeature);
        highlightedFeature = e.target;
        e.target.setStyle({ weight: 3, color: '#1e3a8a', fillOpacity: 0.4 });
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) e.target.bringToFront();
      } else if (appState.mode === 'spielen') {
        handleSpielenClick(e.target);
      }
    }
  });
}

function resetLernenMode() {
  if (!geojsonLayer) return;
  geojsonLayer.eachLayer(layer => {
    layer.setStyle(getLernenStyle(layer.feature));
    if (!isLayerInRegion(layer.feature)) {
      layer.unbindTooltip();
      layer.getElement()?.classList.add('inactive-region');
    } else {
      layer.getElement()?.classList.remove('inactive-region');
      if (!layer.getTooltip()) layer.bindTooltip(layer.feature.properties.OTEIL, { direction: 'center', className: 'custom-tooltip' });
    }
  });
  highlightedFeature = null;
  bezirkTitleEl.textContent = "Berlin";
  ortsteilNameEl.textContent = getDefaultPrompt();
  bezirkTitleEl.style.background = `linear-gradient(135deg, #FFFFFF 0%, #A5B4FC 100%)`;
  bezirkTitleEl.style.webkitBackgroundClip = 'text';
  bezirkTitleEl.style.webkitTextFillColor = 'transparent';
}

function resumeSpielenMode() {
  if (!geojsonLayer) return;
  if (!appState.spielen.inProgress) {
    startSpielenMode();
    return;
  }

  appState.spielen.lastStartTime = new Date();

  geojsonLayer.eachLayer(layer => {
    layer.unbindTooltip();

    if (!isLayerInRegion(layer.feature)) {
      layer.setStyle(getInactiveStyle(layer.feature));
      layer.getElement()?.classList.add('inactive-region');
    } else {
      layer.getElement()?.classList.remove('inactive-region');
      const state = layer.feature.properties._gameState;
      if (state === 'green') {
        layer.setStyle({ fillColor: '#10b981', fillOpacity: 0.4 });
      } else if (state === 'orange') {
        layer.setStyle({ fillColor: '#f59e0b', fillOpacity: 0.4 });
      } else if (state === 'red') {
        layer.setStyle({ fillColor: '#ef4444', fillOpacity: 0.4 });
      } else {
        layer.setStyle(getSpielenBaseStyle(layer.feature));
      }
    }
  });

  if (appState.spielen.currentTarget) {
    targetNameEl.textContent = appState.spielen.currentTarget.feature.properties.OTEIL;
  }

  const total = appState.spielen.allTargets.length;
  const current = total - appState.spielen.remainingTargets.length;
  progressTextEl.textContent = `${current}/${total}`;

  dots.forEach(d => d.classList.remove('lost'));
  for (let i = 0; i < appState.spielen.attempts && i < 3; i++) {
    dots[3 - (i + 1)].classList.add('lost');
  }
}

function startSpielenMode() {
  if (!geojsonLayer) return;
  appState.spielen.inProgress = true;
  appState.spielen.elapsedBefore = 0;
  appState.spielen.lastStartTime = new Date();
  appState.spielen.allTargets = [];
  geojsonLayer.eachLayer(layer => {
    layer.unbindTooltip();
    delete layer.feature.properties._gameState;

    if (!isLayerInRegion(layer.feature)) {
      layer.setStyle(getInactiveStyle(layer.feature));
      layer.getElement()?.classList.add('inactive-region');
    } else {
      appState.spielen.allTargets.push(layer);
      layer.setStyle(getSpielenBaseStyle(layer.feature));
      layer.getElement()?.classList.remove('inactive-region');
    }
  });

  appState.spielen.remainingTargets = [...appState.spielen.allTargets].sort(() => Math.random() - 0.5);
  appState.spielen.stats = { green: 0, orange: 0, red: 0 };

  pickNextTarget();
}

function pickNextTarget() {
  if (appState.spielen.remainingTargets.length === 0) {
    endGame();
    return;
  }
  appState.spielen.currentTarget = appState.spielen.remainingTargets.pop();
  appState.spielen.attempts = 0;

  targetNameEl.textContent = appState.spielen.currentTarget.feature.properties.OTEIL;

  const total = appState.spielen.allTargets.length;
  const current = total - appState.spielen.remainingTargets.length;
  progressTextEl.textContent = `${current}/${total}`;

  dots.forEach(d => d.classList.remove('lost'));
}

function handleSpielenClick(clickedLayer) {
  const targetLayer = appState.spielen.currentTarget;
  if (!targetLayer || clickedLayer.feature.properties._gameState) return;

  appState.spielen.attempts++;

  if (clickedLayer === targetLayer) {
    dots.forEach(d => d.classList.remove('lost'));
    if (appState.spielen.attempts === 1) {
      clickedLayer.setStyle({ fillColor: '#10b981', fillOpacity: 0.4 });
      clickedLayer.feature.properties._gameState = 'green';
      appState.spielen.stats.green++;
    } else {
      clickedLayer.setStyle({ fillColor: '#f59e0b', fillOpacity: 0.4 });
      clickedLayer.feature.properties._gameState = 'orange';
      appState.spielen.stats.orange++;
    }
    setTimeout(pickNextTarget, 400);
  } else {
    clickedLayer.setStyle({ fillColor: '#ef4444', fillOpacity: 0.4 });

    const showNames = toggleErrorNames && toggleErrorNames.checked;
    const errorDelay = showNames ? 1200 : 400; // give time to read if names are shown

    if (showNames) {
      clickedLayer.bindTooltip(clickedLayer.feature.properties.OTEIL, { direction: 'center', className: 'custom-tooltip error-tooltip', permanent: true }).openTooltip();
    }

    setTimeout(() => {
      if (!clickedLayer.feature.properties._gameState) clickedLayer.setStyle(getSpielenBaseStyle(clickedLayer.feature));
      if (showNames) clickedLayer.unbindTooltip();
    }, errorDelay);

    if (appState.spielen.attempts <= 3) dots[3 - appState.spielen.attempts].classList.add('lost');

    if (appState.spielen.attempts >= 3) {
      appState.spielen.stats.red++;
      targetLayer.setStyle({ fillColor: '#ef4444', fillOpacity: 0.4 });
      targetLayer.feature.properties._gameState = 'red';

      // Always show tooltip on failure
      targetLayer.bindTooltip(targetLayer.feature.properties.OTEIL, {
        direction: 'center',
        className: 'custom-tooltip error-tooltip',
        permanent: true
      }).openTooltip();

      appState.spielen.currentTarget = null; // Disable interaction during delay

      setTimeout(() => {
        targetLayer.unbindTooltip();
        pickNextTarget();
      }, 1200);
    }
  }
}

function skipTarget() {
  const targetLayer = appState.spielen.currentTarget;
  if (!targetLayer || !appState.spielen.inProgress) return;

  appState.spielen.stats.red++;
  targetLayer.setStyle({ fillColor: '#ef4444', fillOpacity: 0.4 });
  targetLayer.feature.properties._gameState = 'red';

  targetLayer.bindTooltip(targetLayer.feature.properties.OTEIL, {
    direction: 'center',
    className: 'custom-tooltip error-tooltip',
    permanent: true
  }).openTooltip();

  appState.spielen.currentTarget = null; // Disable interaction during delay

  setTimeout(() => {
    targetLayer.unbindTooltip();
    pickNextTarget();
  }, 1200);
}

function endGame() {
  appState.spielen.inProgress = false;
  const elapsedMs = appState.spielen.elapsedBefore + (new Date() - appState.spielen.lastStartTime);
  const elapsed = Math.floor(elapsedMs / 1000);
  const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const s = String(elapsed % 60).padStart(2, '0');

  document.getElementById('stat-time').textContent = `${m}:${s}`;
  document.getElementById('stat-green').textContent = appState.spielen.stats.green;
  document.getElementById('stat-orange').textContent = appState.spielen.stats.orange;
  document.getElementById('stat-red').textContent = appState.spielen.stats.red;

  statsModal.classList.remove('hidden');
}

// Init Fetch - load all datasets
Promise.all([
  fetch('./lor_ortsteile.geojson').then(r => r.json()),
  fetch('./quartier_berlin.geojson').then(r => r.json()),
  fetch('./lor_2021_a_lor_plr_2021_WGS84.geojson').then(r => r.json()),
  fetch('./bezirksgrenzen.geojson').then(r => r.json()),
  fetch('./berlin_stations.geojson').then(r => r.json())
]).then(([oData, qData, pData, bezirkData, sData]) => {
  ortsteilData = oData;
  quartierData = qData;
  
  // Spatial join helpers
  function pointInPolygon(point, polygon) {
    let isInside = false;
    for (let i = 0; i < polygon.length; i++) {
      let ring = polygon[i];
      let insideRing = false;
      for (let j = 0, k = ring.length - 1; j < ring.length; k = j++) {
        let xi = ring[j][0], yi = ring[j][1];
        let xj = ring[k][0], yj = ring[k][1];
        let intersect = ((yi > point[1]) != (yj > point[1])) && (point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi);
        if (intersect) insideRing = !insideRing;
      }
      if (i === 0) isInside = insideRing;
      else if (insideRing) { isInside = false; break; }
    }
    return isInside;
  }

  function getBezirkForPoint(lng, lat, bezirkData) {
    for (let feature of bezirkData.features) {
      let polygons = feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates : [feature.geometry.coordinates];
      for (let poly of polygons) {
        if (pointInPolygon([lng, lat], poly)) return feature.properties.Gemeinde_name;
      }
    }
    return null;
  }

  // Normalize stations data
  sData.features.forEach(f => {
    f.properties.OTEIL = f.properties.name;
    let coords = f.geometry.coordinates;
    let bezirk = getBezirkForPoint(coords[0], coords[1], bezirkData);
    f.properties.BEZIRK = bezirk || "Mitte"; // Fallback
  });
  stationsData = sData;

  // Normalize PLR data to match OTEIL/BEZIRK schema
  pData.features.forEach(f => {
    f.properties.OTEIL = f.properties.plr_name;
    // Strip "01 - " prefix from "01 - Mitte"
    if (f.properties.bez && f.properties.bez.includes(' - ')) {
      f.properties.BEZIRK = f.properties.bez.split(' - ')[1];
    } else {
      f.properties.BEZIRK = f.properties.bez;
    }
  });
  plrData = pData;

  // Build initial layer and UI
  rebuildCustomFilter();
  buildActiveLayer();
  updateRegionSelectLabels();

  // Bezirksgrenzen overlay
  L.geoJSON(bezirkData, {
    pane: 'bezirkePane',
    style: {
      color: '#0f172a',
      weight: 3,
      opacity: 0.8,
      fillOpacity: 0,
      interactive: false
    }
  }).addTo(map);
}).catch(err => {
  console.error(err);
  ortsteilNameEl.textContent = "Error loading map data.";
  ortsteilNameEl.style.color = "#ef4444";
});
