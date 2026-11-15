/**
 * Leaflet's own side effects: the stylesheet and the default marker icon, whose
 * image URLs the bundler has to rewrite. Importing this module is what pulls
 * Leaflet in, so only map components should — see `@/lib/mapDefaults` for the
 * viewport constants, which carry no such weight.
 */

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;
