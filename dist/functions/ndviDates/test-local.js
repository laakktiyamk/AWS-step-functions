"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const handler_1 = require("./handler");
(0, handler_1.handler)({
    field_id: 'f1',
    geometry: {
        "type": "Polygon",
        "coordinates": [
            [
                [24.019017492777, 64.233073829478],
                [24.019347556527, 64.232990313561],
                [24.019615315522, 64.232919904435],
                [24.020482755912, 64.233076168492],
                [24.022361546928, 64.233414777739],
                [24.022304933188, 64.233512300717],
                [24.022162986048, 64.233683337832],
                [24.020810232778, 64.233413298021],
                [24.020072476793, 64.23327072941],
                [24.019017492777, 64.233073829478]
            ]
        ]
    },
    "start_date": "2020-01-01T00:00:00Z",
    "end_date": "2025-12-31T00:00:00Z",
    target: 'ml',
    batchId: 'test1',
    kasvulohkot: []
}).then(r => { console.log(JSON.stringify(r).slice(0, 300)); process.exit(0); })
    .catch(e => { console.error(e); process.exit(1); });
