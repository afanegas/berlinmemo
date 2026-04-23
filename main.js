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
  "mitte_fk": ["Mitte", "Friedrichshain-Kreuzberg"],
  "reinickendorf": ["Reinickendorf"],
  "pankow": ["Pankow"],
  "spandau": ["Spandau"],
  "charlottenburg_wilmersdorf": ["Charlottenburg-Wilmersdorf"],
  "lichtenberg_marzahn": ["Lichtenberg", "Marzahn-Hellersdorf"],
  "steglitz_zehlendorf": ["Steglitz-Zehlendorf"],
  "tempelhof_neukoelln": ["Tempelhof-Schöneberg", "Neukölln"],
  "treptow_koepenick": ["Treptow-Köpenick"]
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
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 20
}).addTo(map);

// DOM Elements
const btnLernen = document.getElementById('btn-lernen');
const btnSpielen = document.getElementById('btn-spielen');
const btnRestartGame = document.getElementById('btn-restart-game');
const lernenContent = document.getElementById('lernen-content');
const spielenContent = document.getElementById('spielen-content');
const bezirkTitleEl = document.getElementById('bezirk-title');
const ortsteilNameEl = document.getElementById('ortsteil-name');
const targetNameEl = document.getElementById('target-name');
const progressTextEl = document.getElementById('progress-text');
const dots = document.querySelectorAll('.dot');
const statsModal = document.getElementById('stats-modal');
const btnRestart = document.getElementById('btn-restart');

const toggleErrorNames = document.getElementById('toggle-error-names');
const regionSelect = document.getElementById('region-select');
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
if (btnRestartGame) {
  btnRestartGame.addEventListener('click', () => {
    appState.spielen.inProgress = false;
    startSpielenMode();
  });
}
regionSelect.addEventListener('change', () => {
  btnConfigFilter.classList.toggle('hidden', regionSelect.value !== 'custom');
  appState.spielen.inProgress = false;
  switchMode(appState.mode);
});

document.getElementById('btn-settings').addEventListener('click', (e) => {
  document.getElementById('settings-menu').classList.toggle('hidden');
});

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
    resetLernenMode();
  } else {
    btnSpielen.classList.add('active');
    btnLernen.classList.remove('active');
    spielenContent.classList.remove('hidden');
    lernenContent.classList.add('hidden');
    statsModal.classList.add('hidden');
    if (btnRestartGame) btnRestartGame.style.display = 'flex';
    resumeSpielenMode();
  }
}

let geojsonLayer;
let highlightedFeature = null;

// Base styles
function isLayerInRegion(feature) {
  const sel = regionSelect.value;
  if (sel === 'alle') return true;
  if (sel === 'custom') return appState.customTargets.includes(feature.properties.OTEIL);
  return regionMap[sel].includes(feature.properties.BEZIRK);
}

function getInactiveStyle(feature) {
  return { fillColor: '#94a3b8', weight: 1, opacity: 0.4, color: '#cbd5e1', fillOpacity: 0.2 };
}

function getLernenStyle(feature) {
  if (!isLayerInRegion(feature)) return getInactiveStyle(feature);
  return { fillColor: '#3b82f6', weight: 1, opacity: 0.8, color: '#1d4ed8', fillOpacity: 0.35 };
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
          tgt.setStyle({ weight: 3, color: '#1e3a8a', fillOpacity: 0.7 });
          if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) tgt.bringToFront();
          bezirkTitleEl.textContent = tgt.feature.properties.BEZIRK;
          ortsteilNameEl.textContent = `Ortsteil: ${tgt.feature.properties.OTEIL}`;
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
            bezirkTitleEl.textContent = props.BEZIRK;
            ortsteilNameEl.textContent = `Ortsteil: ${props.OTEIL}`;
            bezirkTitleEl.style.background = `linear-gradient(135deg, #FFFFFF 0%, ${getBezirkColor(props.BEZIRK)} 100%)`;
            bezirkTitleEl.style.webkitBackgroundClip = 'text';
            bezirkTitleEl.style.webkitTextFillColor = 'transparent';
          } else {
            bezirkTitleEl.textContent = "Berlin";
            ortsteilNameEl.textContent = "Wähle einen Ortsteil";
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
        e.target.setStyle({ weight: 3, color: '#1e3a8a', fillOpacity: 0.7 });
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
  ortsteilNameEl.textContent = "Wähle einen Ortsteil";
  bezirkTitleEl.style.background = `linear-gradient(135deg, #FFFFFF 0%, #A5B4FC 100%)`;
  bezirkTitleEl.style.webkitBackgroundClip = 'text';
  bezirkTitleEl.style.webkitTextFillColor = 'transparent';
  map.fitBounds(geojsonLayer.getBounds());
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
        layer.setStyle({ fillColor: '#10b981', fillOpacity: 0.8 });
      } else if (state === 'orange') {
        layer.setStyle({ fillColor: '#f59e0b', fillOpacity: 0.8 });
      } else if (state === 'red') {
        layer.setStyle({ fillColor: '#ef4444', fillOpacity: 0.8 });
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

  map.fitBounds(geojsonLayer.getBounds());
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
  
  map.fitBounds(geojsonLayer.getBounds());
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
      clickedLayer.setStyle({ fillColor: '#10b981', fillOpacity: 0.8 });
      clickedLayer.feature.properties._gameState = 'green';
      appState.spielen.stats.green++;
    } else {
      clickedLayer.setStyle({ fillColor: '#f59e0b', fillOpacity: 0.8 });
      clickedLayer.feature.properties._gameState = 'orange';
      appState.spielen.stats.orange++;
    }
    setTimeout(pickNextTarget, 400);
  } else {
    clickedLayer.setStyle({ fillColor: '#ef4444', fillOpacity: 0.8 });
    
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
      targetLayer.setStyle({ fillColor: '#ef4444', fillOpacity: 0.8 });
      targetLayer.feature.properties._gameState = 'red';
      setTimeout(pickNextTarget, errorDelay); 
    }
  }
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

// Init Fetch
fetch('./lor_ortsteile.geojson')
  .then(resp => resp.json())
  .then(data => {
    // Populate custom filter choices
    const oteils = data.features.map(f => f.properties.OTEIL).sort();
    appState.customTargets = []; // default blank
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

    geojsonLayer = L.geoJSON(data, { style: getLernenStyle, onEachFeature: onEachFeature }).addTo(map);
    map.fitBounds(geojsonLayer.getBounds());
    
    // Load bezirksgrenzen with thicker borders
    fetch('./bezirksgrenzen.geojson')
      .then(resp => resp.json())
      .then(bezirkData => {
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
      })
      .catch(err => console.error("Could not load bezirksgrenzen.geojson", err));
  })
  .catch(err => {
    console.error(err);
    ortsteilNameEl.textContent = "Error loading map data.";
    ortsteilNameEl.style.color = "#ef4444";
  });
