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
  "Marzahn-Hellersdorf": "#66FF33",
  "Lichtenberg": "#FF6633",
  "Reinickendorf": "#CC33FF"
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
  spielen: {
    allTargets: [],
    remainingTargets: [],
    currentTarget: null,
    attempts: 0,
    startTime: null,
    stats: { green: 0, orange: 0, red: 0 }
  }
};

// Initialize Map
const map = L.map('map', { center: [52.5200, 13.4050], zoom: 11, zoomControl: false });
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 20
}).addTo(map);

// DOM Elements
const btnLernen = document.getElementById('btn-lernen');
const btnSpielen = document.getElementById('btn-spielen');
const lernenContent = document.getElementById('lernen-content');
const spielenContent = document.getElementById('spielen-content');
const bezirkTitleEl = document.getElementById('bezirk-title');
const ortsteilNameEl = document.getElementById('ortsteil-name');
const targetNameEl = document.getElementById('target-name');
const progressTextEl = document.getElementById('progress-text');
const dots = document.querySelectorAll('.dot');
const statsModal = document.getElementById('stats-modal');
const btnRestart = document.getElementById('btn-restart');

// Mode Listeners
btnLernen.addEventListener('click', () => switchMode('lernen'));
btnSpielen.addEventListener('click', () => switchMode('spielen'));
btnRestart.addEventListener('click', () => switchMode('spielen'));

function switchMode(mode) {
  appState.mode = mode;
  if (mode === 'lernen') {
    btnLernen.classList.add('active');
    btnSpielen.classList.remove('active');
    lernenContent.classList.remove('hidden');
    spielenContent.classList.add('hidden');
    statsModal.classList.add('hidden');
    resetLernenMode();
  } else {
    btnSpielen.classList.add('active');
    btnLernen.classList.remove('active');
    spielenContent.classList.remove('hidden');
    lernenContent.classList.add('hidden');
    statsModal.classList.add('hidden');
    startSpielenMode();
  }
}

let geojsonLayer;
let highlightedFeature = null;

// Base styles
function getLernenStyle(feature) {
  return { fillColor: getBezirkColor(feature.properties.BEZIRK), weight: 1, opacity: 1, color: 'rgba(255, 255, 255, 0.4)', fillOpacity: 0.35 };
}
function getSpielenBaseStyle() {
  return { fillColor: '#333', weight: 1, opacity: 1, color: 'rgba(255, 255, 255, 0.4)', fillOpacity: 0.2 };
}

// Interaction Handlers
function onEachFeature(feature, layer) {
  layer.bindTooltip(feature.properties.OTEIL, { direction: 'center', className: 'custom-tooltip' });
  
  layer.on({
    mouseover: (e) => {
      if (appState.mode === 'lernen') {
        const tgt = e.target;
        if (highlightedFeature !== tgt) {
          tgt.setStyle({ weight: 3, color: '#fff', fillOpacity: 0.7 });
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
      if (appState.mode === 'lernen') {
        const tgt = e.target;
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
      if (appState.mode === 'lernen') {
        if (highlightedFeature && highlightedFeature !== e.target) geojsonLayer.resetStyle(highlightedFeature);
        highlightedFeature = e.target;
        e.target.setStyle({ weight: 3, color: '#fff', fillOpacity: 0.7 });
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) e.target.bringToFront();
        map.fitBounds(e.target.getBounds(), { padding: [50, 50], maxZoom: 13, animate: true, duration: 1 });
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
    if (!layer.getTooltip()) layer.bindTooltip(layer.feature.properties.OTEIL, { direction: 'center', className: 'custom-tooltip' });
    delete layer.feature.properties._gameState;
  });
  highlightedFeature = null;
  bezirkTitleEl.textContent = "Berlin";
  ortsteilNameEl.textContent = "Wähle einen Ortsteil";
  bezirkTitleEl.style.background = `linear-gradient(135deg, #FFFFFF 0%, #A5B4FC 100%)`;
  bezirkTitleEl.style.webkitBackgroundClip = 'text';
  bezirkTitleEl.style.webkitTextFillColor = 'transparent';
  map.fitBounds(geojsonLayer.getBounds());
}

function startSpielenMode() {
  if (!geojsonLayer) return;
  appState.spielen.allTargets = [];
  geojsonLayer.eachLayer(layer => {
    appState.spielen.allTargets.push(layer);
    layer.unbindTooltip();
    layer.setStyle(getSpielenBaseStyle());
    delete layer.feature.properties._gameState;
  });
  
  appState.spielen.remainingTargets = [...appState.spielen.allTargets].sort(() => Math.random() - 0.5);
  appState.spielen.stats = { green: 0, orange: 0, red: 0 };
  appState.spielen.startTime = new Date();
  
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
    setTimeout(() => {
      if (!clickedLayer.feature.properties._gameState) clickedLayer.setStyle(getSpielenBaseStyle());
    }, 300);
    
    if (appState.spielen.attempts <= 3) dots[3 - appState.spielen.attempts].classList.add('lost');
    
    if (appState.spielen.attempts >= 3) {
      appState.spielen.stats.red++;
      targetLayer.setStyle({ fillColor: '#ef4444', fillOpacity: 0.8 });
      targetLayer.feature.properties._gameState = 'red';
      setTimeout(pickNextTarget, 800);
    }
  }
}

function endGame() {
  const elapsed = Math.floor((new Date() - appState.spielen.startTime) / 1000);
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
    geojsonLayer = L.geoJSON(data, { style: getLernenStyle, onEachFeature: onEachFeature }).addTo(map);
    map.fitBounds(geojsonLayer.getBounds());
  })
  .catch(err => {
    console.error(err);
    ortsteilNameEl.textContent = "Error loading map data.";
    ortsteilNameEl.style.color = "#ef4444";
  });
