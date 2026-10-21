"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDimsForResolution = getDimsForResolution;
function getDimsForResolution(geom, metersPerPixel, maxPx = 2500) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const walk = (c) => {
        if (typeof c[0] === "number") {
            minX = Math.min(minX, c[0]);
            maxX = Math.max(maxX, c[0]);
            minY = Math.min(minY, c[1]);
            maxY = Math.max(maxY, c[1]);
        }
        else {
            c.forEach(walk);
        }
    };
    walk(geom.coordinates);
    const midLat = (minY + maxY) / 2;
    const widthM = (maxX - minX) * 111320 * Math.cos((midLat * Math.PI) / 180);
    const heightM = (maxY - minY) * 110574;
    const toPx = (m) => Math.min(maxPx, Math.max(1, Math.ceil(m / metersPerPixel)));
    return { width: toPx(widthM), height: toPx(heightM) };
}
