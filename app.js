const SUPABASE_URL = "https://cchccghkdeqmjwtuhtxj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZHB6ko077EEp1SktG8qz5g_AB4y4id0";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const map = L.map("map").setView([50.6, 4.65], 8);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

const participantsLayer = L.layerGroup().addTo(map);

const form = document.getElementById("participant-form");
const consent = document.getElementById("consent");
const submitButton = document.getElementById("submit-button");
const message = document.getElementById("message");
const totalCountElement = document.getElementById("total-count");

consent.addEventListener("change", () => {
  submitButton.disabled = !consent.checked;
});

function displayMessage(text, type) {
  message.textContent = text;
  message.className = `message ${type}`;
}

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}

function createCommuneIcon(count) {
  return L.divIcon({
    className: "",
    html: `<div class="city-marker">${count}</div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21]
  });
}

async function updateTotalCount() {
  const { count, error } = await supabaseClient
    .from("participants")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Erreur du compteur :", error);
    totalCountElement.textContent = "Compteur momentanément indisponible";
    return;
  }

  const total = count ?? 0;

  totalCountElement.textContent =
    `Nous sommes déjà ${total} constituant${total === 1 ? "" : "s"}`;
}

async function loadParticipants() {
  const { data, error } = await supabaseClient
    .from("participants")
    .select("pseudo, commune, code_postal, latitude, longitude");

  if (error) {
    console.error("Erreur de chargement :", error);
    displayMessage("Impossible de charger les données de la carte.", "error");
    return;
  }

  participantsLayer.clearLayers();

  const communes = {};

  data.forEach((participant) => {
    const communeName = participant.commune.trim();
    const postalCode = participant.code_postal.trim();
    const key = `${communeName.toLowerCase()}-${postalCode}`;

    if (!communes[key]) {
      communes[key] = {
        commune: communeName,
        codePostal: postalCode,
        latitude: Number(participant.latitude),
        longitude: Number(participant.longitude),
        participants: []
      };
    }

    communes[key].participants.push(participant.pseudo);
  });

  Object.values(communes).forEach((commune) => {
    const count = commune.participants.length;

    const marker = L.marker(
      [commune.latitude, commune.longitude],
      { icon: createCommuneIcon(count) }
    );

    const pseudoList = commune.participants
      .map((pseudo) => `<li>${escapeHtml(pseudo)}</li>`)
      .join("");

    marker.bindPopup(`
      <strong>${escapeHtml(commune.commune)} (${escapeHtml(commune.codePostal)})</strong>
      <br>
      ${count} personne${count > 1 ? "s" : ""}
      <hr>
      <strong>Pseudonymes :</strong>
      <ul>${pseudoList}</ul>
    `);

    participantsLayer.addLayer(marker);
  });
}

async function getCoordinates(commune, codePostal) {
  const searchQuery = `${commune}, ${codePostal}, Belgique`;

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=be&q=${encodeURIComponent(searchQuery)}`
  );

  if (!response.ok) {
    throw new Error("Le service de recherche de commune est indisponible.");
  }

  const results = await response.json();

  if (!results.length) {
    throw new Error("Commune introuvable.");
  }

  return {
    latitude: Number(results[0].lat),
    longitude: Number(results[0].lon)
  };
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const pseudo = document.getElementById("pseudo").value.trim();
  const commune = document.getElementById("commune").value.trim();
  const codePostal = document.getElementById("code-postal").value.trim();

  if (!consent.checked) {
    displayMessage(
      "Veuillez accepter les conditions avant de valider.",
      "error"
    );
    return;
  }

  if (!/^[0-9]{4}$/.test(codePostal)) {
    displayMessage(
      "Le code postal belge doit comporter 4 chiffres.",
      "error"
    );
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Validation en cours...";

  try {
    const coordinates = await getCoordinates(commune, codePostal);

    const { error } = await supabaseClient
      .from("participants")
      .insert({
        pseudo,
        commune,
        code_postal: codePostal,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude
      });

    if (error) {
      throw error;
    }

    displayMessage(
      "Votre participation a bien été enregistrée.",
      "success"
    );

    form.reset();
    submitButton.disabled = true;

    map.setView(
      [coordinates.latitude, coordinates.longitude],
      12
    );

    await loadParticipants();
    await updateTotalCount();
  } catch (error) {
    console.error("Erreur :", error);

    displayMessage(
      "L’enregistrement a échoué. Vérifiez la commune et le code postal, puis réessayez.",
      "error"
    );
  } finally {
    submitButton.textContent = "Valider";
    submitButton.disabled = !consent.checked;
  }
});

loadParticipants();
updateTotalCount();
