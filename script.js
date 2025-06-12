let geojsonCollection = [];

document
  .getElementById("upload")
  .addEventListener("change", async function (e) {
    const files = Array.from(e.target.files);
    const output = document.getElementById("output");
    const progressContainer = document.getElementById("progress-container");
    const status = document.getElementById("status");
    const previewMapBtn = document.getElementById("previewMap");

    geojsonCollection = [];
    output.textContent = "";
    progressContainer.innerHTML = "";
    status.style.display = "none";
    previewMapBtn.style.display = "none";

    const progressItems = {};

    for (const file of files) {
      const progressItem = document.createElement("div");
      progressItem.className = "progress-item";
      progressItem.textContent = `Processing ${file.name}...`;
      progressContainer.appendChild(progressItem);
      progressItems[file.name] = progressItem;
    }

    for (const file of files) {
      await processFile(file, output, progressItems[file.name]);
    }

    status.style.display = "block";
    previewMapBtn.style.display = "inline-block";
  });

async function processFile(file, output, progressItem) {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = async function () {
      let geojson;

      try {
        if (file.name.endsWith(".kml") || file.name.endsWith(".gpx")) {
          const parser = new DOMParser();
          const xml = parser.parseFromString(reader.result, "text/xml");
          geojson = file.name.endsWith(".kml")
            ? toGeoJSON.kml(xml)
            : toGeoJSON.gpx(xml);
        } else if (file.name.endsWith(".zip")) {
          geojson = await shp(reader.result);
        } else if (file.name.endsWith(".geojson")) {
          geojson = JSON.parse(reader.result);
        } else {
          throw new Error("Unsupported file type: " + file.name);
        }
      } catch (err) {
        progressItem.textContent = `Error parsing ${file.name}: ${err.message}`;
        return resolve();
      }

      progressItem.textContent = `Loaded ${file.name} as GeoJSON.`;
      const geoJSONString = JSON.stringify(geojson, null, 2);
      if (geoJSONString.length > 2000) {
        output.textContent += `${file.name}: GeoJSON parsed. Too large to preview.\n`;
      } else {
        output.textContent +=
          `${file.name} GeoJSON:\n` + geoJSONString + "\n\n";
      }

      const blob = new Blob([geoJSONString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = file.name.replace(/\.(kml|gpx|zip|geojson)/, ".geojson");
      a.textContent = `Download ${a.download}`;
      a.style.display = "block";
      document.body.appendChild(a);

      geojsonCollection.push({ name: file.name, data: geojson });

      resolve();
    };

    if (file.name.endsWith(".zip")) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  });
}

document.getElementById("previewMap").addEventListener("click", () => {
  const mapWindow = window.open("", "_blank");
  const blob = new Blob(
    [
      `
    <html>
    <head>
      <title>Map Preview</title>
      <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
      <style>
  html, body {
    height: 100%;
    margin: 0;
    font-family: "Segoe UI", sans-serif;
    background-color: #f5f7fa;
  }

  #map {
    height: 100%;
    width: 100%;
    box-shadow: inset 0 0 5px rgba(0,0,0,0.1);
    border-radius: 4px;
  }

  .leaflet-popup-content {
    font-size: 14px;
    line-height: 1.4;
  }

  .leaflet-control-zoom {
    box-shadow: 0 1px 5px rgba(0,0,0,0.3);
    border-radius: 4px;
  }

  .leaflet-container {
    background: #e6ecf0;
  }
</style>

      <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map').setView([0, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap'
        }).addTo(map);
        const geojsons = ${JSON.stringify(geojsonCollection)};
       const overlayMaps = {};
geojsons.forEach(({ name, data }) => {
  const layer = L.geoJSON(data);
  overlayMaps[name] = layer;
  layer.addTo(map);
  map.fitBounds(layer.getBounds());
});
L.control.layers(null, overlayMaps, { collapsed: false }).addTo(map);

      </script>
    </body>
    </html>
  `,
    ],
    { type: "text/html" }
  );

  const url = URL.createObjectURL(blob);
  mapWindow.location.href = url;
});
