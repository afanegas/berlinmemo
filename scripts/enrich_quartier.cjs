/**
 * Pre-processing script to enrich quartier_berlin.geojson with BEZIRK assignments.
 * Uses point-in-polygon (ray casting) to determine which Bezirk each quartier belongs to.
 * Also normalizes property names: adds OTEIL (from name) and BEZIRK.
 * 
 * Run: node scripts/enrich_quartier.js
 */

const fs = require('fs');
const path = require('path');

const quartierPath = path.join(__dirname, '..', 'public', 'quartier_berlin.geojson');
const bezirkePath = path.join(__dirname, '..', 'public', 'bezirksgrenzen.geojson');

const quartier = JSON.parse(fs.readFileSync(quartierPath, 'utf8'));
const bezirke = JSON.parse(fs.readFileSync(bezirkePath, 'utf8'));

function pointInPolygon(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInFeature(point, feature) {
  const geom = feature.geometry;
  if (geom.type === 'Polygon') {
    return pointInPolygon(point, geom.coordinates[0]);
  } else if (geom.type === 'MultiPolygon') {
    return geom.coordinates.some(poly => pointInPolygon(point, poly[0]));
  }
  return false;
}

function getCentroid(feature) {
  const geom = feature.geometry;
  if (geom.type === 'Point') {
    return geom.coordinates;
  }
  // For Polygon, compute centroid of outer ring
  const ring = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0];
  let sumLng = 0, sumLat = 0;
  for (const [lng, lat] of ring) {
    sumLng += lng;
    sumLat += lat;
  }
  return [sumLng / ring.length, sumLat / ring.length];
}

let assigned = 0, unassigned = 0;
const unassignedNames = [];

for (const feature of quartier.features) {
  const centroid = getCentroid(feature);

  let foundBezirk = null;
  for (const bezirk of bezirke.features) {
    if (pointInFeature(centroid, bezirk)) {
      foundBezirk = bezirk.properties.Gemeinde_name;
      break;
    }
  }

  feature.properties.OTEIL = feature.properties.name;
  feature.properties.BEZIRK = foundBezirk;

  if (foundBezirk) {
    assigned++;
  } else {
    unassigned++;
    unassignedNames.push(feature.properties.name);
  }
}

console.log(`Assigned: ${assigned}, Unassigned: ${unassigned}`);
if (unassignedNames.length > 0) {
  console.log('Unassigned quartiers:', unassignedNames);
}

// Print stats per Bezirk
const bezirkCounts = {};
for (const f of quartier.features) {
  const b = f.properties.BEZIRK || 'UNASSIGNED';
  bezirkCounts[b] = (bezirkCounts[b] || 0) + 1;
}
console.log('\nQuartier counts per Bezirk:');
for (const [k, v] of Object.entries(bezirkCounts).sort()) {
  console.log(`  ${k}: ${v}`);
}

fs.writeFileSync(quartierPath, JSON.stringify(quartier));
console.log('\nSaved enriched quartier GeoJSON.');
