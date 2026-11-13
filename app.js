const carte = L.map("carte").setView([46.6, 2.5], 6);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(carte);

fetch("./data/communes.json")
  .then((response) => {
    if (!response.ok) {
      throw new Error("Impossible de charger les données.");
    }
    return response.json();
  })
  .then((communes) => {
    const limites = [];

    communes.forEach((lieu) => {
      const lat = Number(lieu.latitude);
      const lon = Number(lieu.longitude);
      const nombre = Number(lieu.participants) || 0;

      if (!lieu.commune || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        return;
      }

      const marqueur = L.marker([lat, lon]).addTo(carte);

      marqueur.bindPopup(
        `<strong>${echapper(lieu.commune)}</strong>` +
        `<br>Code postal : ${echapper(lieu.codePostal || "non indiqué")}` +
        `<br>Participants : ${nombre}`
      );

      limites.push([lat, lon]);
    });

    if (limites.length > 0) {
      carte.fitBounds(limites, { padding: [30, 30], maxZoom: 10 });
    }
  })
  .catch((erreur) => {
    document.getElementById("message").textContent =
      "La carte n’a pas pu charger les données. Vérifiez le fichier communes.json.";
    console.error(erreur);
  });

function echapper(valeur) {
  return String(valeur).replace(/[&<>"']/g, (caractere) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[caractere]);
}
