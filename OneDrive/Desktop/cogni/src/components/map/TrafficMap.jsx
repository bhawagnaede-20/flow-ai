import { Fragment } from 'react';
import { CircleMarker, MapContainer, Popup, ScaleControl, TileLayer } from 'react-leaflet';
import { CONGESTION_LEVELS, SIMULATION, levelMeta } from '../../data/simulatedData.js';

export const MAP_CENTER = [12.9716, 77.5946]; // Bengaluru (sample city)

/** Congestion colour legend — overlaid on the map. */
export function CongestionLegend({ className = '' }) {
  return (
    <div
      className={`pointer-events-auto z-[1000] rounded-xl border border-white/10 bg-navy-950/90 p-3 shadow-panel backdrop-blur ${className}`}
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Congestion legend</p>
      <ul className="space-y-1.5">
        {CONGESTION_LEVELS.map((level) => (
          <li key={level.key} className="flex items-center gap-2 text-xs text-slate-300">
            <span
              className="h-3 w-3 rounded-full ring-2 ring-navy-950"
              style={{ background: level.color }}
              aria-hidden="true"
            />
            {level.label}
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-white/10 pt-2 text-[10px] leading-snug text-slate-500">
        {SIMULATION.badge} sample roads — not live traffic.
      </p>
    </div>
  );
}

/**
 * Leaflet map with sample road markers.
 * ⚠️ Markers and congestion values are SIMULATED; only the basemap tiles are real.
 */
export default function TrafficMap({ roads, heightClass = 'h-[420px] lg:h-[560px]' }) {
  return (
    <div className={`relative w-full ${heightClass}`}>
      <MapContainer
        center={MAP_CENTER}
        zoom={11}
        scrollWheelZoom
        className="h-full w-full rounded-2xl"
        style={{ borderRadius: '1rem' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <ScaleControl position="bottomleft" />

        {roads.map((road) => {
          const level = levelMeta(road.congestion);
          const severe = road.congestion === 'severe';
          return (
            <Fragment key={road.id}>
              <CircleMarker
                center={[road.lat, road.lng]}
                radius={severe ? 10 : 8}
                pathOptions={{
                  color: '#0a1229',
                  weight: 2,
                  fillColor: level.color,
                  fillOpacity: 0.9,
                }}
                className={severe ? 'animate-pulse' : undefined}
              >
                <Popup>
                  <div className="min-w-[190px] space-y-1">
                    <p className="text-sm font-semibold text-white">{road.name}</p>
                    <p className="text-[11px] text-slate-400">{road.id} · sample corridor</p>
                    <div className="flex items-center gap-2 pt-1">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: level.color }}
                        aria-hidden="true"
                      />
                      <span className="text-xs font-semibold" style={{ color: level.color }}>
                        {level.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Avg speed {road.speedKph} km/h · {road.volume.toLocaleString()} veh/h
                    </p>
                    <p className="text-[11px] text-slate-400">{road.note}</p>
                    <p className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                      Simulated data
                    </p>
                  </div>
                </Popup>
              </CircleMarker>
            </Fragment>
          );
        })}
      </MapContainer>

      <CongestionLegend className="absolute right-3 top-3" />
    </div>
  );
}
