async function main() {
  const res = await fetch("https://stac.dataspace.copernicus.eu/v1/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      collections: ["sentinel-2-l1c"],
      bbox: [26.2259923453965, 60.7413439834074, 26.234648958155, 60.7461458319497],
      datetime: "2026-07-01T00:00:00Z/..",
      limit: 100,
    }),
  });
  const data = (await res.json()) as {
    features: { properties: { datetime: string } }[];
  };

  const days = [...new Set(data.features.map((f) => f.properties.datetime.slice(0, 10)))].sort();
  const gaps = days.slice(1).map((d, i) => (Date.parse(d) - Date.parse(days[i])) / 86400000);

  console.log(days);
  console.log("välit (vrk):", gaps);
  console.log("keskiarvo:", (gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1));
}

main().catch(console.error);